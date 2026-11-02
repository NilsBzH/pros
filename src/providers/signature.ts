// Signature help for calls with parentheses (functions, constructors, methods, macros) and without parentheses
// (SUBSTR s start length): the label shows every parameter, the current one is highlighted and documented.
import * as vscode from 'vscode';
import { signatureHelpAt } from '../analysis/signatureHelp';
import { getAnalysis, inStringOrComment } from './shared';

export class ProsSignatureHelpProvider implements vscode.SignatureHelpProvider {
  provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position): vscode.SignatureHelp | undefined {
    const analysis = getAnalysis(document);
    const offset = document.offsetAt(position);
    if (inStringOrComment(analysis, offset)) {
      return undefined;
    }
    const model = signatureHelpAt(analysis, offset, position.line);
    if (!model) {
      return undefined;
    }
    const help = new vscode.SignatureHelp();
    help.signatures = model.signatures.map(s => {
      const info = new vscode.SignatureInformation(s.label, new vscode.MarkdownString(s.documentation));
      info.parameters = s.parameters.map(p => new vscode.ParameterInformation([p.start, p.end], p.documentation || undefined));
      return info;
    });
    help.activeSignature = model.activeSignature;
    help.activeParameter = model.activeParameter;
    return help;
  }
}
