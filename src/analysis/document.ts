// Document analysis independent from the VS Code API: block matching, macros, variables, regions and issues.
import { Token, tokenize } from './lexer';
import { keywordForm, lookup, mixedCaseMatch } from '../data/reference';

export type Severity = 'error' | 'warning' | 'information';

export interface Issue {
  start: number;
  end: number;
  severity: Severity;
  message: string;
  code: string;
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

export interface Analysis {
  tokens: Token[];
  code: Token[];
  macros: MacroInfo[];
  variables: VariableInfo[];
  regions: RegionInfo[];
  issues: Issue[];
}

type BlockKind = 'define' | 'if' | 'while' | 'repeat';

const OPENERS: Record<string, BlockKind> = {
  DEFINE: 'define', DEFINITION: 'define', IF: 'if', SI: 'if',
  WHILE: 'while', TANT_QUE: 'while', REPEAT: 'repeat', REPETER: 'repeat',
};
const CLOSERS: Record<string, BlockKind> = {
  END_DEFINE: 'define', END_DEFINITION: 'define', FIN_DEFINITION: 'define',
  END_IF: 'if', FIN_SI: 'if', END_WHILE: 'while', FIN_TANT_QUE: 'while',
  UNTIL: 'repeat', JUSQU_A: 'repeat',
};
const ELSE_IF = new Set(['ELSE_IF', 'SINON_SI']);
const ELSE = new Set(['ELSE', 'SINON']);
const EXIT_LOOP = new Set(['EXIT_LOOP', 'SORTIE_BOUCLE']);
const EXIT_MACRO = new Set(['EXIT_MACRO', 'SORTIE_MACRO']);
const DECLARATIONS = new Set(['LET', 'SOIT', 'LOCAL']);
const EXPECTED_CLOSER: Record<BlockKind, string> = { define: 'END_DEFINE', if: 'END_IF', while: 'END_WHILE', repeat: 'UNTIL' };
const OPENER_NAME: Record<BlockKind, string> = { define: 'DEFINE', if: 'IF', while: 'WHILE', repeat: 'REPEAT' };
/** Spellings confirmed as invalid by the user (Q-14, Q-09). */
const INVALID_FORMS: Record<string, string> = { TRACE_END: 'TRACE_OFF' };

interface Frame {
  kind: BlockKind;
  token: Token;
  hasElse: boolean;
  macro?: MacroInfo;
}

/** A word token that is not a member name (obj.word). */
function isFreeWord(code: Token[], index: number): boolean {
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
  const stack: Frame[] = [];

  const report = (token: Token, severity: Severity, code: string, message: string) =>
    issues.push({ start: token.start, end: token.end, severity, message, code });

  const reportUnclosed = (frame: Frame) =>
    report(frame.token, 'error', 'unclosed-block', `Bloc ${frame.token.text} non fermé : ${EXPECTED_CLOSER[frame.kind]} attendu.`);

  const closeMacro = (frame: Frame, end: number, endToken?: Token) => {
    if (frame.macro) {
      frame.macro.end = end;
      frame.macro.endToken = endToken;
    }
  };

  // Unterminated strings and comments
  for (const token of tokens) {
    if (token.closed === false) {
      const what = token.kind === 'string' ? 'Chaîne non fermée' : 'Commentaire non fermé : */ attendu';
      issues.push({ start: token.start, end: Math.min(token.end, token.start + 2), severity: 'error', code: `unclosed-${token.kind}`, message: `${what}.` });
    }
  }

  for (let i = 0; i < code.length; i++) {
    const token = code[i];

    // "//" is not a comment (Q-03)
    if (token.kind === 'operator' && token.text === '/' && code[i + 1]?.text === '/' && code[i + 1].start === token.end) {
      issues.push({ start: token.start, end: code[i + 1].end, severity: 'warning', code: 'line-comment',
        message: "« // » n'est pas un commentaire en langage macro : utiliser /* … */." });
      i++;
      continue;
    }

    if (!isFreeWord(code, i)) {
      continue;
    }
    const word = token.text;
    const form = keywordForm(word);

    // Mixed case keyword (Display, End_If…): not recognised by the language (Q-02)
    const mixed = mixedCaseMatch(word);
    if (mixed) {
      report(token, 'warning', 'mixed-case',
        `« ${word} » : les mots-clés s'écrivent tout en majuscules ou tout en minuscules (${mixed.upper} ou ${mixed.upper.toLowerCase()}).`);
      continue;
    }

    if (form && INVALID_FORMS[form]) {
      report(token, 'warning', 'invalid-form', `« ${word} » n'est pas valide : utiliser ${INVALID_FORMS[form]}.`);
      continue;
    }

    // "BRC name()" is not a valid header (Q-09)
    if (form === 'BRC' && code[i + 1]?.kind === 'word' && code[i + 2]?.text === '(' && (i === 0 || code[i - 1].line < token.line)) {
      report(token, 'error', 'brc-header', "« BRC nom() » n'est pas un en-tête valide : utiliser DEFINE nom().");
      continue;
    }

    const entry = lookup(word);
    if (entry?.status === 'excluded') {
      const replacement = entry.replacement ? ` Remplacement : ${entry.replacement}.` : '';
      report(token, 'warning', 'excluded', `${entry.name} ne fonctionne plus sur la plateforme (${entry.reason}).${replacement}`);
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
        stack.push({ kind: 'define', token, hasElse: false, macro });
      } else {
        stack.push({ kind: opener, token, hasElse: false });
      }
      continue;
    }

    const closer = CLOSERS[form];
    if (closer) {
      const index = stack.map(f => f.kind).lastIndexOf(closer);
      if (index === -1) {
        report(token, 'error', 'unexpected-closer', `${word} sans ${OPENER_NAME[closer]} correspondant.`);
        continue;
      }
      while (stack.length - 1 > index) {
        const frame = stack.pop()!;
        reportUnclosed(frame);
        closeMacro(frame, token.start);
      }
      const frame = stack.pop()!;
      closeMacro(frame, token.end, token);
      continue;
    }

    if (ELSE_IF.has(form) || ELSE.has(form)) {
      const top = stack[stack.length - 1];
      if (!top || top.kind !== 'if') {
        report(token, 'error', 'misplaced-else', `${word} en dehors d'un bloc IF.`);
      } else if (top.hasElse) {
        report(token, 'error', 'misplaced-else', `${word} après ELSE dans le même bloc IF.`);
      } else if (ELSE.has(form)) {
        top.hasElse = true;
      }
      continue;
    }

    if (EXIT_LOOP.has(form) && !stack.some(f => f.kind === 'while' || f.kind === 'repeat')) {
      report(token, 'warning', 'exit-outside', `${word} en dehors d'une boucle WHILE ou REPEAT.`);
      continue;
    }
    if (EXIT_MACRO.has(form) && !stack.some(f => f.kind === 'define')) {
      report(token, 'warning', 'exit-outside', `${word} en dehors d'une macro.`);
    }
  }

  while (stack.length > 0) {
    const frame = stack.pop()!;
    reportUnclosed(frame);
    closeMacro(frame, text.length);
  }

  return { tokens, code, macros, variables, regions: findRegions(tokens), issues };
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

const REGION_START = /^\/\*\s*#?region\b[:\s]*([\s\S]*?)\s*\*\/$/;
const REGION_END = /^\/\*\s*#?endregion\b/;

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
