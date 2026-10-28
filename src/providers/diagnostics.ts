// Diagnostics: issues found by the document analysis, refreshed while typing.
import * as vscode from 'vscode';
import { Severity } from '../analysis/document';
import { forgetAnalysis, getAnalysis } from './shared';

const SEVERITY: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
};

export function registerDiagnostics(context: vscode.ExtensionContext): void {
  const collection = vscode.languages.createDiagnosticCollection('pros');
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const refresh = (document: vscode.TextDocument) => {
    if (document.languageId !== 'pros') {
      return;
    }
    const diagnostics = getAnalysis(document).issues.map(issue => {
      const range = new vscode.Range(document.positionAt(issue.start), document.positionAt(issue.end));
      const diagnostic = new vscode.Diagnostic(range, issue.message, SEVERITY[issue.severity]);
      diagnostic.source = 'pros';
      diagnostic.code = issue.code;
      return diagnostic;
    });
    collection.set(document.uri, diagnostics);
  };

  const schedule = (document: vscode.TextDocument) => {
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      refresh(document);
    }, 300));
  };

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument(refresh),
    vscode.workspace.onDidChangeTextDocument(event => schedule(event.document)),
    vscode.workspace.onDidCloseTextDocument(document => {
      collection.delete(document.uri);
      forgetAnalysis(document);
    }),
  );
  vscode.workspace.textDocuments.forEach(refresh);
}
