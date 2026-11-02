// Parameter name hints for calls without parentheses, controlled by the "pros.inlayHints.parameterNames" setting.
import * as vscode from 'vscode';
import { HintMode, parameterHints } from '../analysis/inlayHints';
import { getAnalysis } from './shared';

export const HINTS_SETTING = 'pros.inlayHints.parameterNames';

export class ProsInlayHintsProvider implements vscode.InlayHintsProvider {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeInlayHints = this.changed.event;

  /** Refreshes the hints when the setting changes. */
  watchSetting(): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration(HINTS_SETTING)) {
        this.changed.fire();
      }
    });
  }

  provideInlayHints(document: vscode.TextDocument, range: vscode.Range): vscode.InlayHint[] {
    const mode = vscode.workspace.getConfiguration('pros', document).get<HintMode>('inlayHints.parameterNames', 'literals');
    return parameterHints(getAnalysis(document), mode)
      .filter(h => h.token.line >= range.start.line && h.token.line <= range.end.line)
      .map(h => {
        const hint = new vscode.InlayHint(new vscode.Position(h.token.line, h.token.character), h.label, vscode.InlayHintKind.Parameter);
        hint.paddingRight = true;
        return hint;
      });
  }
}
