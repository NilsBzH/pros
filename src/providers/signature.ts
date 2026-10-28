// Signature help for calls with parentheses: functions, constructors, confML and object methods, macros of the document.
import * as vscode from 'vscode';
import { Entry, Signature, lookup, lookupMethods } from '../data/reference';
import { getAnalysis, inStringOrComment } from './shared';

function signatureInformation(signature: Signature, entry: Entry): vscode.SignatureInformation {
  const info = new vscode.SignatureInformation(signature.syntax, new vscode.MarkdownString(entry.description));
  const open = signature.syntax.indexOf('(');
  let from = open;
  info.parameters = (signature.params ?? []).map(param => {
    const index = signature.syntax.indexOf(param.name, from);
    const doc = `${param.optional ? '(facultatif) ' : ''}${param.description}`;
    if (index === -1) {
      return new vscode.ParameterInformation(param.name, doc);
    }
    from = index + param.name.length;
    return new vscode.ParameterInformation([index, from], doc);
  });
  return info;
}

export class ProsSignatureHelpProvider implements vscode.SignatureHelpProvider {
  provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position): vscode.SignatureHelp | undefined {
    const analysis = getAnalysis(document);
    const offset = document.offsetAt(position);
    if (inStringOrComment(analysis, offset)) {
      return undefined;
    }

    // Innermost unclosed "(" before the cursor and the number of commas at its level.
    const before = analysis.code.filter(t => t.end <= offset);
    let depth = 0;
    let commas = 0;
    let openIndex = -1;
    for (let i = before.length - 1; i >= 0; i--) {
      const text = before[i].text;
      if (before[i].kind !== 'punct') {
        continue;
      }
      if (text === ')' || text === ']') {
        depth++;
      } else if (text === '(' || text === '[') {
        if (depth === 0) {
          if (text === '(') {
            openIndex = i;
          }
          break;
        }
        depth--;
      } else if (text === ',' && depth === 0) {
        commas++;
      }
    }
    const callee = before[openIndex - 1];
    if (openIndex === -1 || !callee || callee.kind !== 'word') {
      return undefined;
    }
    const receiver = before[openIndex - 2]?.text === '.' ? before[openIndex - 3]?.text : undefined;

    let entry: Entry | undefined;
    if (receiver) {
      const methods = receiver === 'confML'
        ? lookupMethods(callee.text, 'confML')
        : lookupMethods(callee.text).filter(m => m.receiver !== 'confML');
      entry = methods.length === 1 ? methods[0] : undefined;
    } else {
      const found = lookup(callee.text);
      entry = found && found.style === 'paren' ? found : undefined;
    }

    const help = new vscode.SignatureHelp();
    if (entry) {
      help.signatures = [entry, ...(entry.overloads ?? [])].map(s => signatureInformation(s, entry!));
    } else {
      const macro = receiver ? undefined : analysis.macros.find(m => m.name === callee.text);
      if (!macro) {
        return undefined;
      }
      const label = `${macro.name}(${macro.params.map(p => p.text).join(', ')})`;
      const info = new vscode.SignatureInformation(label, `Macro définie ligne ${macro.start.line + 1}.`);
      info.parameters = macro.params.map(p => new vscode.ParameterInformation(p.text));
      help.signatures = [info];
    }
    const fitting = help.signatures.findIndex(s => s.parameters.length > commas);
    help.activeSignature = fitting === -1 ? 0 : fitting;
    help.activeParameter = commas;
    return help;
  }
}
