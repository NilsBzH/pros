// Entry point: registers the language features of the PROS macro language.
import * as vscode from 'vscode';
import { ProsCompletionProvider } from './providers/completion';
import { registerDiagnostics } from './providers/diagnostics';
import { ProsFoldingRangeProvider, ProsFormattingProvider } from './providers/formatting';
import { ProsHoverProvider } from './providers/hover';
import { ProsReferenceProvider, ProsRenameProvider } from './providers/references';
import { ProsSemanticTokensProvider, legend } from './providers/semanticTokens';
import { ProsSignatureHelpProvider } from './providers/signature';
import { ProsDefinitionProvider, ProsDocumentSymbolProvider } from './providers/symbols';

const selector: vscode.DocumentSelector = { language: 'pros' };

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(selector, new ProsCompletionProvider(), '.'),
    vscode.languages.registerHoverProvider(selector, new ProsHoverProvider()),
    vscode.languages.registerSignatureHelpProvider(selector, new ProsSignatureHelpProvider(), '(', ','),
    vscode.languages.registerDocumentSymbolProvider(selector, new ProsDocumentSymbolProvider()),
    vscode.languages.registerDefinitionProvider(selector, new ProsDefinitionProvider()),
    vscode.languages.registerDocumentSemanticTokensProvider(selector, new ProsSemanticTokensProvider(), legend),
    vscode.languages.registerReferenceProvider(selector, new ProsReferenceProvider()),
    vscode.languages.registerRenameProvider(selector, new ProsRenameProvider()),
    vscode.languages.registerFoldingRangeProvider(selector, new ProsFoldingRangeProvider()),
    vscode.languages.registerDocumentFormattingEditProvider(selector, new ProsFormattingProvider()),
    vscode.languages.registerDocumentRangeFormattingEditProvider(selector, new ProsFormattingProvider()),
  );
  registerDiagnostics(context);
}

export function deactivate(): void {}
