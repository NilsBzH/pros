// Semantic highlighting: parameters, variables, user macros, undeclared names and members (see analysis/semanticTokens.ts).
import * as vscode from 'vscode';
import { TOKEN_MODIFIERS, TOKEN_TYPES, semanticTokens } from '../analysis/semanticTokens';
import { getAnalysis } from './shared';

export const legend = new vscode.SemanticTokensLegend([...TOKEN_TYPES], [...TOKEN_MODIFIERS]);

export class ProsSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(legend);
    for (const token of semanticTokens(getAnalysis(document))) {
      const modifiers = token.modifiers.reduce((bits, m) => bits | (1 << TOKEN_MODIFIERS.indexOf(m)), 0);
      builder.push(token.line, token.character, token.length, TOKEN_TYPES.indexOf(token.type), modifiers);
    }
    return builder.build();
  }
}
