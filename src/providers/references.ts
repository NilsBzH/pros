// Find all references and rename: parameters and variables within their macro, macros across the .pros files of the workspace.
import * as vscode from 'vscode';
import { Analysis } from '../analysis/document';
import { Occurrence, macroOccurrences, newNameError, occurrenceAt, occurrencesOf, renameError } from '../analysis/symbols';
import { getAnalysis, inStringOrComment, otherProsFiles, wordRange } from './shared';
import { macrosInWorkspace } from './symbols';

function symbolAt(analysis: Analysis, document: vscode.TextDocument, position: vscode.Position): Occurrence | undefined {
  const offset = document.offsetAt(position);
  return inStringOrComment(analysis, offset) ? undefined : occurrenceAt(analysis, offset);
}

/** Every occurrence of the symbol: in the document, plus the other files for a macro. */
async function locate(document: vscode.TextDocument, analysis: Analysis, target: Occurrence): Promise<{ uri: vscode.Uri; occurrence: Occurrence }[]> {
  const ref = target.ref;
  const here = ref.kind === 'macro' ? macroOccurrences(analysis, ref.name) : occurrencesOf(analysis, ref);
  const result = here.map(occurrence => ({ uri: document.uri, occurrence }));
  if (ref.kind === 'macro') {
    for (const { uri, analysis: other } of await otherProsFiles(document.uri)) {
      result.push(...macroOccurrences(other, ref.name).map(occurrence => ({ uri, occurrence })));
    }
  }
  return result;
}

export class ProsReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext): Promise<vscode.Location[] | undefined> {
    const analysis = getAnalysis(document);
    const target = symbolAt(analysis, document, position);
    if (!target) {
      return undefined;
    }
    const found = await locate(document, analysis, target);
    return found
      .filter(f => context.includeDeclaration || !f.occurrence.declaration)
      .map(f => new vscode.Location(f.uri, wordRange(f.occurrence.token)));
  }
}

export class ProsRenameProvider implements vscode.RenameProvider {
  async prepareRename(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Range> {
    const analysis = getAnalysis(document);
    const target = symbolAt(analysis, document, position);
    const error = renameError(target);
    if (error) {
      throw new Error(error);
    }
    // Calls of something that is not a macro of the workspace (Java constructor, external method) are left alone.
    if (target!.ref.kind === 'macro' && !target!.ref.defined && (await macrosInWorkspace(target!.ref.name, document.uri)).length === 0) {
      throw new Error(`"${target!.ref.name}" is not a macro defined in the workspace and cannot be renamed.`);
    }
    return wordRange(target!.token);
  }

  async provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string): Promise<vscode.WorkspaceEdit> {
    await this.prepareRename(document, position);
    const analysis = getAnalysis(document);
    const target = symbolAt(analysis, document, position)!;
    const error = newNameError(analysis, target.ref, newName);
    if (error) {
      throw new Error(error);
    }
    const found = await locate(document, analysis, target);
    const edit = new vscode.WorkspaceEdit();
    for (const { uri, occurrence } of found) {
      edit.replace(uri, wordRange(occurrence.token), newName);
    }
    return edit;
  }
}
