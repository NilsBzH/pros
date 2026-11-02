// Calls under the cursor and their active parameter, independent from the VS Code API.
// Two call styles exist: Name(a, b) and, for commands and functions without parentheses, NAME a b
// where the arguments are separated by spaces. The latter is resolved with a small operand parser.
import { Token } from './lexer';
import { Entry, Param, Signature, keywordForm, lookup, lookupMethods } from '../data/reference';

export interface SyntaxPart {
  kind: 'param' | 'literal' | 'choice';
  /** Offsets of the part in the signature label. */
  start: number;
  end: number;
  optional: boolean;
  /** Accepted keywords of a literal or choice part. */
  words?: string[];
  /** Index in the parameter list, for param and choice parts. */
  param?: number;
}

export interface ParsedSignature {
  label: string;
  parts: SyntaxPart[];
  params: Param[];
}

/** Splits a documented syntax into parameters, optional parts, keyword choices and literal keywords. */
export function parseSignature(signature: Signature, style: Entry['style']): ParsedSignature {
  const label = signature.syntax;
  const parts: SyntaxPart[] = [];
  let param = 0;
  if (style === 'paren') {
    const open = label.indexOf('(');
    const close = label.lastIndexOf(')');
    let offset = open + 1;
    for (const raw of label.slice(open + 1, close).split(',')) {
      const text = raw.trim();
      const start = label.indexOf(text, offset);
      offset = start + text.length;
      if (text && text !== '…') {
        parts.push({ kind: 'param', start, end: offset, optional: /^\[.*\]$/.test(text), param: param++ });
      }
    }
  } else if (style === 'space') {
    const nameEnd = label.indexOf(' ');
    for (const match of nameEnd === -1 ? [] : label.slice(nameEnd).matchAll(/\[[^\]]*\]|"[^"]*"|\S+/g)) {
      const start = nameEnd + (match.index ?? 0);
      const end = start + match[0].length;
      const optional = /^\[(.*)\]$/.exec(match[0]);
      if (optional && /^[A-Z_|]+$/.test(optional[1])) {
        parts.push({ kind: 'choice', start, end, optional: true, words: optional[1].split('|'), param: param++ });
      } else if (!optional && /^[A-Z_]+$/.test(match[0])) {
        parts.push({ kind: 'literal', start, end, optional: false, words: [match[0]] });
      } else {
        parts.push({ kind: 'param', start, end, optional: Boolean(optional), param: param++ });
      }
    }
  }
  return { label, parts, params: signature.params ?? [] };
}

export function signaturesOf(entry: Entry): ParsedSignature[] {
  return [entry, ...(entry.overloads ?? [])].map(s => parseSignature(s, entry.style));
}

// ---------------------------------------------------------------------------------------------
// Operand parser for calls without parentheses

const BINARY_WORDS = new Set(['AND', 'OR', 'ET', 'OU', 'EX_OR', 'DIV', 'MODULO', 'RESTE', 'POWER', 'PUISSANCE']);

function isBinary(token: Token | undefined): boolean {
  if (!token) {
    return false;
  }
  if (token.kind === 'operator') {
    return true;
  }
  const form = token.kind === 'word' ? keywordForm(token.text) : undefined;
  return form !== undefined && BINARY_WORDS.has(form);
}

/** Built-in function written without parentheses (STR x, SUBSTR s 1 2). */
function spaceFunction(token: Token): Entry | undefined {
  const entry = token.kind === 'word' ? lookup(token.text) : undefined;
  return entry && entry.style === 'space' && entry.kind === 'function' && entry.status !== 'excluded' ? entry : undefined;
}

/** Words that can start an operand: anything but keywords and commands. */
function startsOperand(token: Token): boolean {
  if (token.kind === 'number' || token.kind === 'string' || token.text === '(' || token.text === '-') {
    return true;
  }
  if (token.kind !== 'word') {
    return false;
  }
  if (keywordForm(token.text) === 'NOT') {
    return true;
  }
  const entry = lookup(token.text);
  return !entry || ['function', 'constant', 'class', 'object'].includes(entry.kind);
}

/** Index of the token closing the bracket at `index`, or the last index when it is not closed. */
function closing(tokens: Token[], index: number, end: number): number {
  let depth = 0;
  for (let i = index; i < end; i++) {
    if (tokens[i].text === '(' || tokens[i].text === '[') {
      depth++;
    } else if (tokens[i].text === ')' || tokens[i].text === ']') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return end - 1;
}

function requiredCount(entry: Entry): number {
  return (entry.params ?? []).filter(p => !p.optional).length;
}

/** Index after one operand starting at `index` (a value, a group, a call, or a function with its own operands). */
function operand(tokens: Token[], index: number, end: number): number {
  if (index >= end) {
    return end;
  }
  const token = tokens[index];
  if (token.text === '-' || (token.kind === 'word' && keywordForm(token.text) === 'NOT')) {
    return operand(tokens, index + 1, end);
  }
  let next: number;
  if (token.text === '(') {
    next = closing(tokens, index, end) + 1;
  } else if (token.kind === 'number' || token.kind === 'string') {
    next = index + 1;
  } else if (token.kind === 'word') {
    const fn = spaceFunction(token);
    next = index + 1;
    if (fn && tokens[next]?.text !== '(') {
      for (let n = 0; n < requiredCount(fn) && next < end; n++) {
        next = operand(tokens, next, end);
      }
      return next;
    }
  } else {
    return index;
  }
  // Member access, call and index: only when glued to the previous token (obj.m(), f(x), tab[1]).
  while (next < end) {
    const t = tokens[next];
    if (t.text === '.' && tokens[next + 1]?.kind === 'word') {
      next += 2;
    } else if ((t.text === '(' || t.text === '[') && t.start === tokens[next - 1].end) {
      next = closing(tokens, next, end) + 1;
    } else {
      break;
    }
  }
  return Math.min(next, end);
}

function expression(tokens: Token[], index: number, end: number): number {
  let next = operand(tokens, index, end);
  while (next < end && isBinary(tokens[next])) {
    next = operand(tokens, next + 1, end);
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// Call detection

export interface ParenCall {
  style: 'paren';
  name: Token;
  receiver?: string;
  /** Number of commas before the cursor at the call level. */
  argIndex: number;
}

export interface SpaceCall {
  style: 'space';
  name: Token;
  entry: Entry;
  /** Arguments typed so far; an empty array stands for the argument being started. */
  items: Token[][];
  /** Index of the argument under the cursor in `items`. */
  cursor: number;
}

export type Call = ParenCall | SpaceCall;

function keywordWords(entry: Entry): Set<Entry> {
  const words = new Set<Entry>();
  for (const signature of signaturesOf(entry)) {
    for (const part of signature.parts) {
      for (const word of part.words ?? []) {
        const keyword = lookup(word);
        if (keyword) {
          words.add(keyword);
        }
      }
    }
  }
  return words;
}

function maxParts(entry: Entry): number {
  return Math.max(...signaturesOf(entry).map(s => s.parts.length));
}

/** Arguments of the call without parentheses named by tokens[index], read up to `end` or to the first token that cannot be one. */
function readArguments(tokens: Token[], index: number, end: number, entry: Entry): { items: Token[][]; next: number } {
  const keywords = keywordWords(entry);
  const limit = maxParts(entry);
  const command = entry.kind === 'command';
  const items: Token[][] = [];
  let i = index + 1;
  while (i < end && items.length < limit) {
    const token = tokens[i];
    const keyword = token.kind === 'word' ? lookup(token.text) : undefined;
    if (keyword && keywords.has(keyword)) {
      items.push([token]);
      i++;
      continue;
    }
    if (!startsOperand(token)) {
      break;
    }
    // The last parameter of a command takes a whole expression (LET x a + 1); other arguments are operands.
    const next = command && items.length === limit - 1 ? expression(tokens, i, end) : operand(tokens, i, end);
    items.push(tokens.slice(i, next));
    i = next;
  }
  return { items, next: i };
}

/** Space call of `entry` named by tokens[index], if the cursor (after tokens[end - 1]) is among its arguments. */
function spaceCallAt(tokens: Token[], index: number, end: number, offset: number, entry: Entry): SpaceCall | undefined {
  const limit = maxParts(entry);
  const { items, next } = readArguments(tokens, index, end, entry);
  if (next < end) {
    return undefined;
  }
  const name = tokens[index];
  if (items.length === 0) {
    return offset > name.end ? { style: 'space', name, entry, items: [[]], cursor: 0 } : undefined;
  }
  const last = items[items.length - 1];
  const lastToken = last[last.length - 1];
  const open = last.filter(t => t.text === '(' || t.text === '[').length > last.filter(t => t.text === ')' || t.text === ']').length;
  if (offset > lastToken.end && !isBinary(lastToken) && !open) {
    if (items.length >= limit) {
      return undefined;
    }
    return { style: 'space', name, entry, items: [...items, []], cursor: items.length };
  }
  return { style: 'space', name, entry, items, cursor: items.length - 1 };
}

/** Innermost call without parentheses among tokens[from, end) whose arguments contain the cursor. */
function spaceSearch(tokens: Token[], from: number, end: number, offset: number): SpaceCall | undefined {
  for (let i = end - 1; i >= from; i--) {
    const t = tokens[i];
    if (t.kind !== 'word' || tokens[i - 1]?.text === '.') {
      continue;
    }
    const entry = lookup(t.text);
    if (!entry || entry.style !== 'space' || entry.status === 'excluded' || !['function', 'command'].includes(entry.kind)) {
      continue;
    }
    const call = spaceCallAt(tokens, i, end, offset, entry);
    if (call) {
      return call;
    }
  }
  return undefined;
}

/**
 * Call around the cursor. Unclosed brackets are visited from the innermost one: inside each of them,
 * a call without parentheses containing the cursor wins, then the bracket itself if it is a call.
 * At the top level, calls without parentheses are searched on the current line only.
 */
export function findCall(code: Token[], offset: number, line: number): Call | undefined {
  const before = code.filter(t => t.end <= offset);

  const opens: { index: number; commas: number }[] = [];
  let depth = 0;
  let commas = 0;
  for (let i = before.length - 1; i >= 0; i--) {
    const text = before[i].kind === 'punct' ? before[i].text : '';
    if (text === ')' || text === ']') {
      depth++;
    } else if (text === '(' || text === '[') {
      if (depth > 0) {
        depth--;
      } else {
        opens.push({ index: i, commas });
        commas = 0;
      }
    } else if (text === ',' && depth === 0) {
      commas++;
    }
  }

  for (const open of opens) {
    const inside = spaceSearch(before, open.index + 1, before.length, offset);
    if (inside) {
      return inside;
    }
    const bracket = before[open.index];
    const callee = before[open.index - 1];
    if (bracket.text === '(' && callee?.kind === 'word' && callee.end === bracket.start && startsOperand(callee)) {
      const receiver = before[open.index - 2]?.text === '.' && before[open.index - 3]?.kind === 'word' ? before[open.index - 3].text : undefined;
      return { style: 'paren', name: callee, receiver, argIndex: open.commas };
    }
  }

  const lineStart = before.findIndex(t => t.line === line);
  return lineStart === -1 ? undefined : spaceSearch(before, lineStart, before.length, offset);
}

/** Entry called with parentheses: confML or unambiguous object method, or a global function, command or class. */
export function parenEntry(call: ParenCall): Entry | undefined {
  if (call.receiver) {
    const methods = call.receiver === 'confML'
      ? lookupMethods(call.name.text, 'confML')
      : lookupMethods(call.name.text).filter(m => m.receiver !== 'confML');
    return methods.length === 1 ? methods[0] : undefined;
  }
  const entry = lookup(call.name.text);
  return entry && entry.style === 'paren' && entry.status !== 'excluded' ? entry : undefined;
}

// ---------------------------------------------------------------------------------------------
// Active parameter

export interface Activity {
  /** Index in the parameter list, or -1 when the cursor is on a literal keyword. */
  param: number;
  /** False when the typed arguments do not match the signature. */
  fits: boolean;
}

function matches(item: Token[], words: string[] | undefined): boolean {
  if (item.length !== 1 || item[0].kind !== 'word') {
    return false;
  }
  const entry = lookup(item[0].text);
  return Boolean(entry && (words ?? []).some(w => lookup(w) === entry));
}

/** Syntax part of each argument for one signature; optional parameters count only when enough arguments are typed. */
export function spaceAssignment(signature: ParsedSignature, items: Token[][]): { parts: SyntaxPart[]; fits: boolean } {
  const keywordParts = signature.parts.filter(p => p.kind !== 'param');
  const operands = items.filter(item => !keywordParts.some(p => matches(item, p.words))).length;
  const required = signature.parts.filter(p => p.kind === 'param' && !p.optional).length;
  let optionalSlots = Math.max(0, operands - required);
  const parts: SyntaxPart[] = [];
  for (const part of signature.parts) {
    if (parts.length >= items.length) {
      break;
    }
    if (part.kind === 'literal' || part.kind === 'choice') {
      if (matches(items[parts.length], part.words)) {
        parts.push(part);
      }
      continue;
    }
    if (part.optional) {
      if (optionalSlots === 0) {
        continue;
      }
      optionalSlots--;
    }
    parts.push(part);
  }
  return { parts, fits: parts.length >= items.length };
}

/** Active parameter of a call without parentheses for one signature. */
export function spaceActivity(signature: ParsedSignature, call: SpaceCall): Activity {
  const { parts, fits } = spaceAssignment(signature, call.items);
  return { param: parts[call.cursor]?.param ?? -1, fits };
}

/** Active parameter of a call with parentheses: one parameter per comma. */
export function parenActivity(signature: ParsedSignature, call: ParenCall): Activity {
  const params = signature.parts.filter(p => p.kind === 'param').length;
  return { param: Math.min(call.argIndex, Math.max(params - 1, 0)), fits: call.argIndex < Math.max(params, 1) };
}
