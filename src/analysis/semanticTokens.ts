// Semantic classification of words, independent from the VS Code API. The grammar colours keywords and built-in
// names; this covers what only the document analysis knows: parameters, variables, user macros, undeclared names, members.
import { Analysis } from './document';
import { occurrences } from './symbols';
import { lookupMethods } from '../data/reference';

export const TOKEN_TYPES = ['parameter', 'variable', 'function', 'method', 'property'] as const;
export const TOKEN_MODIFIERS = ['declaration', 'readonly', 'defaultLibrary'] as const;

export type TokenType = typeof TOKEN_TYPES[number];
export type TokenModifier = typeof TOKEN_MODIFIERS[number];

export interface SemanticToken {
  start: number;
  line: number;
  character: number;
  length: number;
  type: TokenType;
  modifiers: TokenModifier[];
}

export function semanticTokens(analysis: Analysis): SemanticToken[] {
  const result: SemanticToken[] = [];

  for (const { token, ref, declaration } of occurrences(analysis)) {
    const modifiers: TokenModifier[] = declaration ? ['declaration'] : [];
    let type: TokenType;
    if (ref.kind === 'parameter') {
      type = 'parameter';
    } else if (ref.kind === 'variable') {
      type = 'variable';
    } else if (ref.kind === 'macro') {
      // Calls of macros defined elsewhere, Java constructors and static methods are left to the grammar.
      if (!ref.defined) {
        continue;
      }
      type = 'function';
    } else {
      // Declared nowhere in the document: shown as a read-only variable.
      type = 'variable';
      modifiers.push('readonly');
    }
    result.push({ start: token.start, line: token.line, character: token.character, length: token.text.length, type, modifiers });
  }

  // Members: obj.method(…) and obj.field
  const code = analysis.code;
  for (let i = 2; i < code.length; i++) {
    const token = code[i];
    if (token.kind !== 'word' || code[i - 1].text !== '.') {
      continue;
    }
    const call = code[i + 1]?.text === '(';
    const receiver = code[i - 2].text;
    const known = receiver === 'confML' && lookupMethods(token.text, 'confML').length > 0;
    result.push({
      start: token.start, line: token.line, character: token.character, length: token.text.length,
      type: call ? 'method' : 'property', modifiers: known ? ['defaultLibrary'] : [],
    });
  }

  return result.sort((a, b) => a.start - b.start);
}
