// Quick fixes for the diagnostics of the extension (see analysis/fixes.ts).
import * as vscode from 'vscode';
import { quickFixes } from '../analysis/fixes';

export class ProsCodeActionProvider implements vscode.CodeActionProvider {
  static readonly kinds = [vscode.CodeActionKind.QuickFix];

  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    const text = document.getText();
    const actions: vscode.CodeAction[] = [];
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.source !== 'pros' || typeof diagnostic.code !== 'string') {
        continue;
      }
      const issue = { start: document.offsetAt(diagnostic.range.start), end: document.offsetAt(diagnostic.range.end), code: diagnostic.code };
      for (const fix of quickFixes(text, issue)) {
        const action = new vscode.CodeAction(fix.title, vscode.CodeActionKind.QuickFix);
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(document.uri, new vscode.Range(document.positionAt(fix.change.start), document.positionAt(fix.change.end)), fix.change.text);
        action.diagnostics = [diagnostic];
        action.isPreferred = fix.preferred;
        actions.push(action);
      }
    }
    return actions;
  }
}
