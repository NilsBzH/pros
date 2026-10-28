// Tokenizer for the PROS macro language.
// Strings use ' or " and escape the delimiter by doubling it; backslash is a plain character.
// Comments are /* ... */ only; strings and comments may span several lines.

export type TokenKind = 'word' | 'number' | 'string' | 'comment' | 'operator' | 'punct' | 'other';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Offset of the first character. */
  start: number;
  /** Offset after the last character. */
  end: number;
  line: number;
  character: number;
  /** For strings and comments: false when the end of the document is reached first. */
  closed?: boolean;
}

const WORD_START = /[A-Za-z_À-ÿ]/;
const WORD_PART = /[A-Za-z0-9_À-ÿ]/;
const DIGIT = /[0-9]/;
const TWO_CHAR_OPERATORS = [':=', '<=', '>=', '<>', '**'];
const ONE_CHAR_OPERATORS = '+-*/%^=<>';
const PUNCTUATION = '()[],.';

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 0;
  let lineStart = 0;

  const push = (kind: TokenKind, start: number, end: number, startLine: number, startCharacter: number, closed?: boolean) => {
    const token: Token = { kind, text: text.slice(start, end), start, end, line: startLine, character: startCharacter };
    if (closed !== undefined) {
      token.closed = closed;
    }
    tokens.push(token);
  };

  // Advances over text[from, to) and keeps line counters up to date.
  const advance = (to: number) => {
    for (; i < to; i++) {
      if (text[i] === '\n') {
        line++;
        lineStart = i + 1;
      }
    }
  };

  while (i < text.length) {
    const c = text[i];
    const start = i;
    const startLine = line;
    const startCharacter = i - lineStart;

    if (c === '\n' || c === ' ' || c === '\t' || c === '\r') {
      advance(i + 1);
      continue;
    }

    if (c === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close === -1 ? text.length : close + 2;
      advance(end);
      push('comment', start, end, startLine, startCharacter, close !== -1);
      continue;
    }

    if (c === '"' || c === "'") {
      let j = i + 1;
      let closed = false;
      while (j < text.length) {
        if (text[j] === c) {
          if (text[j + 1] === c) {
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        j++;
      }
      advance(j);
      push('string', start, j, startLine, startCharacter, closed);
      continue;
    }

    if (WORD_START.test(c)) {
      let j = i + 1;
      while (j < text.length && WORD_PART.test(text[j])) {
        j++;
      }
      advance(j);
      push('word', start, j, startLine, startCharacter);
      continue;
    }

    if (DIGIT.test(c)) {
      let j = i + 1;
      while (j < text.length && DIGIT.test(text[j])) {
        j++;
      }
      if (text[j] === '.' && DIGIT.test(text[j + 1] ?? '')) {
        j++;
        while (j < text.length && DIGIT.test(text[j])) {
          j++;
        }
      }
      advance(j);
      push('number', start, j, startLine, startCharacter);
      continue;
    }

    const two = text.slice(i, i + 2);
    if (TWO_CHAR_OPERATORS.includes(two)) {
      advance(i + 2);
      push('operator', start, i, startLine, startCharacter);
      continue;
    }
    if (ONE_CHAR_OPERATORS.includes(c)) {
      advance(i + 1);
      push('operator', start, i, startLine, startCharacter);
      continue;
    }
    if (PUNCTUATION.includes(c)) {
      advance(i + 1);
      push('punct', start, i, startLine, startCharacter);
      continue;
    }

    advance(i + 1);
    push('other', start, i, startLine, startCharacter);
  }

  return tokens;
}

/** Tokens that carry code (comments removed). */
export function codeTokens(tokens: Token[]): Token[] {
  return tokens.filter(t => t.kind !== 'comment');
}

/** Token containing the offset, if any. */
export function tokenAt(tokens: Token[], offset: number): Token | undefined {
  return tokens.find(t => t.start <= offset && offset < t.end);
}
