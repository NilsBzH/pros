// Formatter, independent from the VS Code API: re-indents lines from the block structure and removes trailing spaces.
// The macro body stays at the DEFINE level; a block opened and closed on the same line does not indent; continuation
// lines (starting with an operator, after an operator or inside brackets) keep their offset from the statement;
// lines that start inside a multi-line string or comment are left as they are.
import { Analysis, BlockKind, CLOSERS, ELSE, ELSE_IF, OPENERS, isFreeWord } from './document';
import { Token } from './lexer';
import { keywordForm } from '../data/reference';

export interface FormatOptions {
  /** One indentation level: a tab or spaces. */
  indent: string;
}

export interface LineEdit {
  line: number;
  /** New content of the line, without the line break. */
  text: string;
}

const BINARY_WORDS = new Set(['AND', 'OR', 'ET', 'OU', 'EX_OR']);
/** Statements after which an unclosed bracket of a previous line is forgotten. */
const STATEMENT_WORDS = new Set(['LET', 'SOIT', 'LOCAL']);

function lastLine(token: Token): number {
  return token.line + token.text.split('\n').length - 1;
}

function isBinary(token: Token): boolean {
  return token.kind === 'operator' || (token.kind === 'word' && BINARY_WORDS.has(keywordForm(token.text) ?? ''));
}

function depthOf(stack: BlockKind[]): number {
  return stack.filter(k => k !== 'define').length;
}

export function formatLines(text: string, analysis: Analysis, options: FormatOptions): LineEdit[] {
  const lines = text.split('\n').map(l => (l.endsWith('\r') ? l.slice(0, -1) : l));
  const startInside = new Set<number>();
  const endInside = new Set<number>();
  const byLine: Token[][] = lines.map(() => []);
  for (const token of analysis.tokens) {
    byLine[token.line].push(token);
    if (token.kind === 'string' || token.kind === 'comment') {
      for (let l = token.line; l < lastLine(token); l++) {
        endInside.add(l);
        startInside.add(l + 1);
      }
    }
  }
  const codeIndex = new Map<Token, number>(analysis.code.map((t, i) => [t, i]));
  const formOf = (token: Token | undefined) =>
    token && token.kind === 'word' && isFreeWord(analysis.code, codeIndex.get(token)!) ? keywordForm(token.text) : undefined;

  const edits: LineEdit[] = [];
  const stack: BlockKind[] = [];
  let brackets = 0;
  let lastCode: Token | undefined;
  let statement: { old: string; new: string } | undefined;

  for (let l = 0; l < lines.length; l++) {
    const original = lines[l];
    const tokens = byLine[l];
    const firstCode = tokens.find(t => t.kind !== 'comment');
    const form = formOf(firstCode);

    // Closing words and ELSE branches go back to the level of their opening line.
    let level = depthOf(stack);
    if (form && CLOSERS[form]) {
      const index = stack.lastIndexOf(CLOSERS[form]);
      level = index === -1 ? level : depthOf(stack.slice(0, index));
    } else if (form && (ELSE.has(form) || ELSE_IF.has(form)) && stack[stack.length - 1] === 'if') {
      level--;
    } else if (form && OPENERS[form] === 'define' && stack.includes('define')) {
      level = depthOf(stack.slice(0, stack.indexOf('define')));
    }
    if (form && (OPENERS[form] || CLOSERS[form] || ELSE.has(form) || ELSE_IF.has(form) || STATEMENT_WORDS.has(form))) {
      brackets = 0;
    }

    const first = tokens[0];
    const continuation = Boolean(statement && first && !startInside.has(l)
      && (brackets > 0 || isBinary(first) || (lastCode !== undefined && isBinary(lastCode))));
    const oldIndent = /^[ \t]*/.exec(original)![0];
    let newIndent = options.indent.repeat(level);
    if (continuation && statement) {
      newIndent = oldIndent.length > statement.old.length && oldIndent.startsWith(statement.old)
        ? statement.new + oldIndent.slice(statement.old.length)
        : statement.new + options.indent;
    }

    let result = original;
    if (!startInside.has(l)) {
      if (original.trim() === '') {
        result = '';
      } else {
        const content = original.slice(oldIndent.length);
        result = newIndent + (endInside.has(l) ? content : content.trimEnd());
      }
      if (firstCode && !continuation) {
        statement = { old: oldIndent, new: newIndent };
      }
    }
    if (result !== original) {
      edits.push({ line: l, text: result });
    }

    for (const token of tokens) {
      if (token.kind === 'comment') {
        continue;
      }
      if (token.text === '(' || token.text === '[') {
        brackets++;
      } else if (token.text === ')' || token.text === ']') {
        brackets = Math.max(0, brackets - 1);
      }
      const word = formOf(token);
      if (word && OPENERS[word]) {
        if (OPENERS[word] === 'define' && stack.includes('define')) {
          stack.length = stack.indexOf('define');
        }
        stack.push(OPENERS[word]);
      } else if (word && CLOSERS[word]) {
        const index = stack.lastIndexOf(CLOSERS[word]);
        if (index !== -1) {
          stack.length = index;
        }
      }
      lastCode = token;
    }
  }
  return edits;
}
