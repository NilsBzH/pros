// Completion: language reference (excluded entries left out), confML methods after "confML.", macros and variables of the document.
// Block keywords insert the whole block and calls get one field per parameter (see completionItems.ts);
// this replaces the former snippets file.
import * as vscode from 'vscode';
import { EntryKind } from '../data/reference';
import { CompletionSpec, REGION_LABEL, caseModeFor, globalSpecs, macroSnippet, methodSpecs } from './completionItems';
import { entryMarkdown, getAnalysis, inStringOrComment, macroLabel } from './shared';

const KIND: Record<EntryKind | 'block', vscode.CompletionItemKind> = {
  block: vscode.CompletionItemKind.Keyword,
  keyword: vscode.CompletionItemKind.Keyword,
  command: vscode.CompletionItemKind.Keyword,
  function: vscode.CompletionItemKind.Function,
  'command-function': vscode.CompletionItemKind.Function,
  operator: vscode.CompletionItemKind.Operator,
  constant: vscode.CompletionItemKind.Constant,
  method: vscode.CompletionItemKind.Method,
  class: vscode.CompletionItemKind.Class,
  object: vscode.CompletionItemKind.Variable,
};

const WORD = /[A-Za-z_À-ÿ][A-Za-z0-9_À-ÿ]*/;

function toItem(spec: CompletionSpec): vscode.CompletionItem {
  const item = new vscode.CompletionItem(spec.label, KIND[spec.kind]);
  item.detail = spec.kind === 'block' ? `bloc — ${spec.detail}` : spec.detail;
  if (spec.entry) {
    item.documentation = entryMarkdown(spec.entry);
  }
  item.insertText = spec.snippet === spec.label ? spec.label : new vscode.SnippetString(spec.snippet);
  item.sortText = spec.sortText;
  return item;
}

export class ProsCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionList | undefined {
    const analysis = getAnalysis(document);
    if (inStringOrComment(analysis, document.offsetAt(position))) {
      return undefined;
    }

    const linePrefix = document.lineAt(position).text.slice(0, position.character);
    const member = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*[A-Za-z0-9_]*$/.exec(linePrefix);
    if (member) {
      // Only confML has a known type; other objects fall back to the editor word completion.
      return member[1] === 'confML' ? new vscode.CompletionList(methodSpecs('confML').map(toItem)) : undefined;
    }

    // Keywords are inserted in the case of the typed prefix; with no prefix yet, the list is
    // recomputed at the next keystroke so that the case of the first letter is taken into account.
    const wordRange = document.getWordRangeAtPosition(position, WORD);
    const start = wordRange ? wordRange.start : position;
    const prefix = document.getText(new vscode.Range(start, position));
    // "#" is not a word character: when "#reg" is typed, the region item also replaces the "#".
    const hash = start.character > 0 && document.lineAt(position).text[start.character - 1] === '#' ? start.translate(0, -1) : undefined;
    const items = globalSpecs(caseModeFor(prefix)).map(spec => {
      const item = toItem(spec);
      if (spec.label === REGION_LABEL) {
        item.filterText = hash ? REGION_LABEL : 'region';
        if (hash) {
          item.range = new vscode.Range(hash, position);
        }
      }
      return item;
    });

    for (const macro of analysis.macros) {
      const item = new vscode.CompletionItem(macro.name, vscode.CompletionItemKind.Function);
      item.detail = `macro ${macroLabel(macro)}`;
      item.insertText = new vscode.SnippetString(macroSnippet(macro.name, macro.params.map(p => p.text)));
      item.sortText = `0${macro.name}`;
      items.push(item);
    }
    const seen = new Set<string>();
    for (const variable of analysis.variables) {
      if (seen.has(variable.name)) {
        continue;
      }
      seen.add(variable.name);
      const item = new vscode.CompletionItem(variable.name, vscode.CompletionItemKind.Variable);
      item.detail = variable.macro ? `variable (${variable.declaration}) de ${variable.macro.name}` : `variable (${variable.declaration})`;
      item.sortText = `0${variable.name}`;
      items.push(item);
    }
    return new vscode.CompletionList(items, prefix === '');
  }
}
