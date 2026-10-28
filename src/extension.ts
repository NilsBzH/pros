// Entry point: registers the language features of the PROS macro language.
import * as vscode from 'vscode';
import { ProsCompletionProvider } from './providers/completion';
import { registerDiagnostics } from './providers/diagnostics';
import { ProsHoverProvider } from './providers/hover';
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
  );
  registerDiagnostics(context);
}

export function deactivate(): void {}
