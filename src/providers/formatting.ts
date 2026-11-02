// Folding of blocks, regions and comments, and document or selection formatting (see analysis/folding.ts and analysis/format.ts).
import * as vscode from 'vscode';
import { foldingRanges } from '../analysis/folding';
import { formatLines } from '../analysis/format';
import { getAnalysis } from './shared';

const FOLD_KIND = { comment: vscode.FoldingRangeKind.Comment, region: vscode.FoldingRangeKind.Region };

export class ProsFoldingRangeProvider implements vscode.FoldingRangeProvider {
  provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
    return foldingRanges(getAnalysis(document)).map(f => new vscode.FoldingRange(f.start, f.end, f.kind && FOLD_KIND[f.kind]));
  }
}

function edits(document: vscode.TextDocument, options: vscode.FormattingOptions, range?: vscode.Range): vscode.TextEdit[] {
  const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
  return formatLines(document.getText(), getAnalysis(document), { indent })
    .filter(e => !range || (e.line >= range.start.line && e.line <= range.end.line))
    .map(e => vscode.TextEdit.replace(document.lineAt(e.line).range, e.text));
}

export class ProsFormattingProvider implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    return edits(document, options);
  }

  provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions): vscode.TextEdit[] {
    return edits(document, options, range);
  }
}
