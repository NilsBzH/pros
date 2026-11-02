// Name resolution for the words of a document, independent from the VS Code API: macro parameters, variables
// (LET, SOIT, LOCAL), macros, and names declared nowhere in the document (aliases of the rule inputs, for example).
import { Analysis, MacroInfo } from './document';
import { Token } from './lexer';
import { keywordForm, lookup, mixedCaseMatch } from '../data/reference';

export type SymbolKind = 'parameter' | 'variable' | 'macro' | 'undeclared';

export interface SymbolRef {
  kind: SymbolKind;
  name: string;
  /** Macro declaring the parameter or the variable; undefined for document level variables, macros and undeclared names. */
  scope?: MacroInfo;
  /** For macros: true when the macro is defined in the document. */
  defined?: boolean;
}

export interface Occurrence {
  token: Token;
  ref: SymbolRef;
  /** True on the declaration itself: macro header, parameter list, first word after LET, SOIT or LOCAL. */
  declaration: boolean;
}

const HEADER_WORDS = new Set(['DEFINE', 'DEFINITION', 'MACRO']);

/** Macro containing the offset. */
export function scopeAt(analysis: Analysis, offset: number): MacroInfo | undefined {
  return analysis.macros.find(m => m.start.start <= offset && offset <= m.end);
}

/** Word followed by "(" (a call) or preceded by DEFINE, DEFINITION or MACRO. */
function callShaped(code: Token[], index: number): boolean {
  const next = code[index + 1];
  const previous = code[index - 1];
  const header = previous?.kind === 'word' && HEADER_WORDS.has(keywordForm(previous.text) ?? '');
  return header || (next?.text === '(' && next.start === code[index].end);
}

function resolve(analysis: Analysis, code: Token[], index: number): SymbolRef {
  const token = code[index];
  const name = token.text;
  const scope = scopeAt(analysis, token.start);
  const defined = analysis.macros.some(m => m.name === name);
  if (scope && scope.params.some(p => p.text === name)) {
    return { kind: 'parameter', name, scope };
  }
  // Inside a macro, its own name holds the returned value (LET name value).
  if (scope && scope.name === name) {
    return { kind: 'macro', name, defined: true };
  }
  if (callShaped(code, index)) {
    return { kind: 'macro', name, defined };
  }
  if (scope && analysis.variables.some(v => v.name === name && v.macro === scope)) {
    return { kind: 'variable', name, scope };
  }
  if (analysis.variables.some(v => v.name === name && !v.macro)) {
    return { kind: 'variable', name };
  }
  if (defined) {
    return { kind: 'macro', name, defined };
  }
  return { kind: 'undeclared', name };
}

/** True for a word that names something of the document: not a member, keyword, built-in name or mixed case keyword. */
function isUserWord(code: Token[], index: number): boolean {
  const token = code[index];
  if (token.kind !== 'word' || code[index - 1]?.text === '.') {
    return false;
  }
  return !lookup(token.text) && !mixedCaseMatch(token.text);
}

const cache = new WeakMap<Analysis, Occurrence[]>();

/** Every word of the document that names a parameter, a variable, a macro or an undeclared name, in document order. */
export function occurrences(analysis: Analysis): Occurrence[] {
  let list = cache.get(analysis);
  if (list) {
    return list;
  }
  const declarations: Record<SymbolKind, Set<Token>> = {
    macro: new Set(analysis.macros.map(m => m.nameToken)),
    parameter: new Set(analysis.macros.flatMap(m => m.params)),
    variable: new Set(analysis.variables.map(v => v.token)),
    undeclared: new Set(),
  };
  list = [];
  const code = analysis.code;
  for (let i = 0; i < code.length; i++) {
    if (isUserWord(code, i)) {
      const ref = resolve(analysis, code, i);
      list.push({ token: code[i], ref, declaration: declarations[ref.kind].has(code[i]) });
    }
  }
  cache.set(analysis, list);
  return list;
}

export function sameSymbol(a: SymbolRef, b: SymbolRef): boolean {
  return a.kind === b.kind && a.name === b.name && a.scope === b.scope;
}

/** Occurrence under the offset (the end of a word counts). */
export function occurrenceAt(analysis: Analysis, offset: number): Occurrence | undefined {
  return occurrences(analysis).find(o => o.token.start <= offset && offset <= o.token.end);
}

/** All occurrences of a symbol in the document. */
export function occurrencesOf(analysis: Analysis, ref: SymbolRef): Occurrence[] {
  return occurrences(analysis).filter(o => sameSymbol(o.ref, ref));
}

/** Occurrences of a macro name in a document: definition, calls, DISPLAY MACRO name and the returned value. */
export function macroOccurrences(analysis: Analysis, name: string): Occurrence[] {
  return occurrences(analysis).filter(o => o.ref.kind === 'macro' && o.ref.name === name);
}
