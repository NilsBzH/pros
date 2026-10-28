// Completion: language reference (excluded entries left out), confML methods after "confML.", macros and variables of the document.
import * as vscode from 'vscode';
import { Entry, EntryKind, entries, methodsOf } from '../data/reference';
import { entryMarkdown, getAnalysis, inStringOrComment, macroLabel } from './shared';

const KIND: Record<EntryKind, vscode.CompletionItemKind> = {
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

const SORT: Record<Entry['status'], string> = { documented: '1', undocumented: '2', legacy: '3', excluded: '9' };

function insertText(entry: Entry, label: string): string | vscode.SnippetString {
  if (entry.style !== 'paren') {
    return label;
  }
  return entry.params && entry.params.length === 0 ? `${label}()` : new vscode.SnippetString(`${label}($0)`);
}

function entryItems(entry: Entry): vscode.CompletionItem[] {
  // Canonical name and synonyms; lower case forms are left to the user (convention: upper case).
  return [entry.name, ...(entry.synonyms ?? [])].map(label => {
    const item = new vscode.CompletionItem(label, KIND[entry.kind]);
    item.detail = label === entry.name ? entry.syntax : `${entry.syntax}  (synonyme de ${entry.name})`;
    item.documentation = entryMarkdown(entry);
    item.insertText = insertText(entry, label);
    item.sortText = `${SORT[entry.status]}${label}`;
    return item;
  });
}

const globalItems = entries
  .filter(e => !e.receiver && e.status !== 'excluded')
  .flatMap(entryItems);

export class ProsCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
    const analysis = getAnalysis(document);
    if (inStringOrComment(analysis, document.offsetAt(position))) {
      return undefined;
    }

    const linePrefix = document.lineAt(position).text.slice(0, position.character);
    const member = /([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*[A-Za-z0-9_]*$/.exec(linePrefix);
    if (member) {
      // Only confML has a known type; other objects fall back to the editor word completion.
      return member[1] === 'confML' ? methodsOf('confML').flatMap(entryItems) : undefined;
    }

    const items = [...globalItems];
    for (const macro of analysis.macros) {
      const item = new vscode.CompletionItem(macro.name, vscode.CompletionItemKind.Function);
      item.detail = `macro ${macroLabel(macro)}`;
      item.insertText = new vscode.SnippetString(`${macro.name}($0)`);
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
    return items;
  }
}
