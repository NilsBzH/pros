// Document analysis independent from the VS Code API: block matching, macros, variables, regions and issues.
import { Token, tokenize } from './lexer';
import { keywordForm, lookup, mixedCaseMatch, restrictionNote } from '../data/reference';

export type Severity = 'error' | 'warning' | 'information' | 'hint';

export interface Issue {
  start: number;
  end: number;
  severity: Severity;
  message: string;
  code: string;
}

/** Value of the pros.diagnostics.restrictedCommands setting. */
export type RestrictedMode = 'off' | 'hint' | 'warning';

/** Issues to report: uses of restricted entries are left out (off) or reported with the chosen severity. */
export function reportedIssues(issues: Issue[], restricted: RestrictedMode): Issue[] {
  return issues
    .filter(i => i.code !== 'restricted' || restricted !== 'off')
    .map(i => (i.code === 'restricted' ? { ...i, severity: restricted as Severity } : i));
}

export interface MacroInfo {
  name: string;
  nameToken: Token;
  params: Token[];
  /** DEFINE token. */
  start: Token;
  /** Closing token (END_DEFINE…), undefined when the macro is not closed. */
  endToken?: Token;
  /** Offset after the macro (closing token end, or where the analysis stopped). */
  end: number;
  /** Comment written right above DEFINE. */
  doc?: MacroDoc;
}

export interface MacroDoc {
  description: string;
  /** Descriptions given by "@param name description" lines. */
  params: Record<string, string>;
}

export interface VariableInfo {
  name: string;
  token: Token;
  /** LET, SOIT or LOCAL, upper case. */
  declaration: string;
  macro?: MacroInfo;
}

export interface RegionInfo {
  name: string;
  start: Token;
  end?: Token;
}

export type BlockKind = 'define' | 'if' | 'while' | 'repeat';

export interface BlockInfo {
  kind: BlockKind;
  open: Token;
  /** ELSE_IF and ELSE of an IF block. */
  branches: Token[];
  /** Undefined when the block is not closed. */
  close?: Token;
}

export interface Analysis {
  tokens: Token[];
  code: Token[];
  macros: MacroInfo[];
  variables: VariableInfo[];
  regions: RegionInfo[];
  blocks: BlockInfo[];
  issues: Issue[];
}

export const OPENERS: Record<string, BlockKind> = {
  DEFINE: 'define', DEFINITION: 'define', IF: 'if', SI: 'if',
  WHILE: 'while', TANT_QUE: 'while', REPEAT: 'repeat', REPETER: 'repeat',
};
export const CLOSERS: Record<string, BlockKind> = {
  END_DEFINE: 'define', END_DEFINITION: 'define', FIN_DEFINITION: 'define',
  END_IF: 'if', FIN_SI: 'if', END_WHILE: 'while', FIN_TANT_QUE: 'while',
  UNTIL: 'repeat', JUSQU_A: 'repeat',
};
export const ELSE_IF = new Set(['ELSE_IF', 'SINON_SI']);
export const ELSE = new Set(['ELSE', 'SINON']);
const EXIT_LOOP = new Set(['EXIT_LOOP', 'SORTIE_BOUCLE']);
const EXIT_MACRO = new Set(['EXIT_MACRO', 'SORTIE_MACRO']);
const DECLARATIONS = new Set(['LET', 'SOIT', 'LOCAL']);
const EXPECTED_CLOSER: Record<BlockKind, string> = { define: 'END_DEFINE', if: 'END_IF', while: 'END_WHILE', repeat: 'UNTIL' };
const OPENER_NAME: Record<BlockKind, string> = { define: 'DEFINE', if: 'IF', while: 'WHILE', repeat: 'REPEAT' };
/** Spellings known to be invalid, with the form to use instead. */
export const INVALID_FORMS: Record<string, string> = { TRACE_END: 'TRACE_OFF' };

interface Frame {
  kind: BlockKind;
  token: Token;
  hasElse: boolean;
  macro?: MacroInfo;
  block: BlockInfo;
}

/** A word token that is not a member name (obj.word). */
export function isFreeWord(code: Token[], index: number): boolean {
  const token = code[index];
  const previous = code[index - 1];
  return token.kind === 'word' && !(previous && previous.kind === 'punct' && previous.text === '.');
}

export function analyze(text: string): Analysis {
  const tokens = tokenize(text);
  const code = tokens.filter(t => t.kind !== 'comment');
  const issues: Issue[] = [];
  const macros: MacroInfo[] = [];
  const variables: VariableInfo[] = [];
  const blocks: BlockInfo[] = [];
  const stack: Frame[] = [];
  const open = (kind: BlockKind, token: Token, macro?: MacroInfo) => {
    const block: BlockInfo = { kind, open: token, branches: [] };
    blocks.push(block);
    stack.push({ kind, token, hasElse: false, macro, block });
  };

  const report = (token: Token, severity: Severity, code: string, message: string) =>
    issues.push({ start: token.start, end: token.end, severity, message, code });

  const reportUnclosed = (frame: Frame) =>
    report(frame.token, 'error', 'unclosed-block', `${frame.token.text} block is not closed: ${EXPECTED_CLOSER[frame.kind]} expected.`);

  const closeMacro = (frame: Frame, end: number, endToken?: Token) => {
    if (frame.macro) {
      frame.macro.end = end;
      frame.macro.endToken = endToken;
    }
  };

  // Unterminated strings and comments
  for (const token of tokens) {
    if (token.closed === false) {
      const what = token.kind === 'string' ? 'Unclosed string' : 'Unclosed comment: */ expected';
      issues.push({ start: token.start, end: Math.min(token.end, token.start + 2), severity: 'error', code: `unclosed-${token.kind}`, message: `${what}.` });
    }
  }

  for (let i = 0; i < code.length; i++) {
    const token = code[i];

    // "//" is not a comment: the language only has /* ... */ comments
    if (token.kind === 'operator' && token.text === '/' && code[i + 1]?.text === '/' && code[i + 1].start === token.end) {
      issues.push({ start: token.start, end: code[i + 1].end, severity: 'warning', code: 'line-comment',
        message: "\"//\" is not a comment in the macro language: use /* … */." });
      i++;
      continue;
    }

    if (!isFreeWord(code, i)) {
      continue;
    }
    const word = token.text;
    const form = keywordForm(word);

    // Mixed case keyword (Display, End_If…): keywords are written all upper or all lower case
    const mixed = mixedCaseMatch(word);
    if (mixed) {
      report(token, 'warning', 'mixed-case',
        `"${word}": keywords are written all upper case or all lower case (${mixed.upper} or ${mixed.upper.toLowerCase()}).`);
      continue;
    }

    if (form && INVALID_FORMS[form]) {
      report(token, 'warning', 'invalid-form', `"${word}" is not valid: use ${INVALID_FORMS[form]}.`);
      continue;
    }

    // "BRC name()" is not a valid header: macros start with DEFINE
    if (form === 'BRC' && code[i + 1]?.kind === 'word' && code[i + 2]?.text === '(' && (i === 0 || code[i - 1].line < token.line)) {
      report(token, 'error', 'brc-header', "\"BRC name()\" is not a valid header: use DEFINE name().");
      continue;
    }

    const entry = lookup(word);
    const note = entry && restrictionNote(entry);
    if (entry && note) {
      // Reported or not depending on the setting (see reportedIssues).
      report(token, 'information', 'restricted', `${entry.name}: ${note}`);
      continue;
    }

    if (!form) {
      continue;
    }

    if (DECLARATIONS.has(form)) {
      const next = code[i + 1];
      if (next && next.kind === 'word' && code[i + 2]?.text !== '.' && next.line === token.line) {
        variables.push({ name: next.text, token: next, declaration: form, macro: [...stack].reverse().find(f => f.kind === 'define')?.macro });
      }
      continue;
    }

    const opener = OPENERS[form];
    if (opener) {
      if (opener === 'define') {
        const openDefine = stack.findIndex(f => f.kind === 'define');
        if (openDefine !== -1) {
          while (stack.length > openDefine) {
            const frame = stack.pop()!;
            reportUnclosed(frame);
            closeMacro(frame, token.start);
          }
        }
        const macro = parseMacroHeader(code, i);
        if (macro) {
          macros.push(macro);
        }
        open('define', token, macro);
      } else {
        open(opener, token);
      }
      continue;
    }

    const closer = CLOSERS[form];
    if (closer) {
      const index = stack.map(f => f.kind).lastIndexOf(closer);
      if (index === -1) {
        report(token, 'error', 'unexpected-closer', `${word} without a matching ${OPENER_NAME[closer]}.`);
        continue;
      }
      while (stack.length - 1 > index) {
        const frame = stack.pop()!;
        reportUnclosed(frame);
        closeMacro(frame, token.start);
      }
      const frame = stack.pop()!;
      frame.block.close = token;
      closeMacro(frame, token.end, token);
      continue;
    }

    if (ELSE_IF.has(form) || ELSE.has(form)) {
      const top = stack[stack.length - 1];
      if (!top || top.kind !== 'if') {
        report(token, 'error', 'misplaced-else', `${word} outside an IF block.`);
      } else if (top.hasElse) {
        report(token, 'error', 'misplaced-else', `${word} after ELSE in the same IF block.`);
      } else {
        top.block.branches.push(token);
        top.hasElse = ELSE.has(form);
      }
      continue;
    }

    if (EXIT_LOOP.has(form) && !stack.some(f => f.kind === 'while' || f.kind === 'repeat')) {
      report(token, 'warning', 'exit-outside', `${word} outside a WHILE or REPEAT loop.`);
      continue;
    }
    if (EXIT_MACRO.has(form) && !stack.some(f => f.kind === 'define')) {
      report(token, 'warning', 'exit-outside', `${word} outside a macro.`);
    }
  }

  while (stack.length > 0) {
    const frame = stack.pop()!;
    reportUnclosed(frame);
    closeMacro(frame, text.length);
  }

  for (const macro of macros) {
    macro.doc = macroDoc(tokens, macro);
  }
  return { tokens, code, macros, variables, regions: findRegions(tokens), blocks, issues };
}

/** DEFINE name ( p1 , p2 ) starting at code[index]. */
function parseMacroHeader(code: Token[], index: number): MacroInfo | undefined {
  const nameToken = code[index + 1];
  if (!nameToken || nameToken.kind !== 'word') {
    return undefined;
  }
  const params: Token[] = [];
  if (code[index + 2]?.text === '(') {
    for (let j = index + 3; j < code.length && code[j].text !== ')'; j++) {
      if (code[j].kind === 'word') {
        params.push(code[j]);
      }
    }
  }
  return { name: nameToken.text, nameToken, params, start: code[index], end: nameToken.end };
}

/** Comment ending on the line above DEFINE (or on the same line), region markers excepted. */
function macroDoc(tokens: Token[], macro: MacroInfo): MacroDoc | undefined {
  const comment = tokens[tokens.indexOf(macro.start) - 1];
  if (!comment || comment.kind !== 'comment' || comment.closed === false || REGION_START.test(comment.text) || REGION_END.test(comment.text)) {
    return undefined;
  }
  const endLine = comment.line + comment.text.split('\n').length - 1;
  return endLine >= macro.start.line - 1 ? parseDoc(comment.text) : undefined;
}

const PARAM_TAG = /^@param\s+([A-Za-z_À-ÿ][A-Za-z0-9_À-ÿ]*)\s*(.*)$/;

/** Description and "@param name description" lines of a documentation comment; leading "*" are ignored. */
export function parseDoc(comment: string): MacroDoc | undefined {
  const lines = comment.slice(2, -2).split('\n').map(l => l.replace(/^\s*\*?[ \t]?/, '').trimEnd());
  const description: string[] = [];
  const params: Record<string, string> = {};
  let param: string | undefined;
  for (const line of lines) {
    const tag = PARAM_TAG.exec(line.trim());
    if (tag) {
      param = tag[1];
      params[param] = tag[2];
    } else if (param && line.trim() !== '') {
      // Non empty lines after @param continue its description.
      params[param] = `${params[param]} ${line.trim()}`.trim();
    } else {
      param = undefined;
      description.push(line);
    }
  }
  const text = description.join('\n').trim();
  return text || Object.keys(params).length > 0 ? { description: text, params } : undefined;
}

export const REGION_START = /^\/\*\s*#?region\b[:\s]*([\s\S]*?)\s*\*\/$/;
export const REGION_END = /^\/\*\s*#?endregion\b/;

function findRegions(tokens: Token[]): RegionInfo[] {
  const regions: RegionInfo[] = [];
  const open: RegionInfo[] = [];
  for (const token of tokens) {
    if (token.kind !== 'comment') {
      continue;
    }
    const start = REGION_START.exec(token.text);
    if (start) {
      const region: RegionInfo = { name: start[1] || 'region', start: token };
      regions.push(region);
      open.push(region);
    } else if (REGION_END.test(token.text) && open.length > 0) {
      open.pop()!.end = token;
    }
  }
  return regions;
}
