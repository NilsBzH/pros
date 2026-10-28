// Helpers shared by the providers: per-version analysis cache, word lookup and Markdown rendering.
import * as vscode from 'vscode';
import { analyze, Analysis, MacroInfo } from '../analysis/document';
import { Token, tokenAt } from '../analysis/lexer';
import { Entry, Param, allSpellings } from '../data/reference';

const cache = new Map<string, { version: number; analysis: Analysis }>();

export function getAnalysis(document: vscode.TextDocument): Analysis {
  const key = document.uri.toString();
  const cached = cache.get(key);
  if (cached && cached.version === document.version) {
    return cached.analysis;
  }
  const analysis = analyze(document.getText());
  cache.set(key, { version: document.version, analysis });
  return analysis;
}

export function forgetAnalysis(document: vscode.TextDocument): void {
  cache.delete(document.uri.toString());
}

export function tokenRange(document: vscode.TextDocument, token: Token): vscode.Range {
  return new vscode.Range(document.positionAt(token.start), document.positionAt(token.end));
}

/** True when the offset is inside a string or a comment. */
export function inStringOrComment(analysis: Analysis, offset: number): boolean {
  const token = tokenAt(analysis.tokens, offset) ?? tokenAt(analysis.tokens, offset - 1);
  if (!token || (token.kind !== 'string' && token.kind !== 'comment')) {
    return false;
  }
  // The position right after a closed string or comment is outside of it.
  return offset < token.end || token.closed === false;
}

export interface WordAt {
  word: string;
  token: Token;
  /** Name before the dot for obj.word, if any. */
  receiver?: string;
}

/** Word token at an offset, with the receiver of a member access. */
export function wordAt(analysis: Analysis, offset: number): WordAt | undefined {
  const index = analysis.code.findIndex(t => t.kind === 'word' && t.start <= offset && offset <= t.end);
  if (index === -1) {
    return undefined;
  }
  const token = analysis.code[index];
  const dot = analysis.code[index - 1];
  const receiver = dot?.text === '.' && analysis.code[index - 2]?.kind === 'word' ? analysis.code[index - 2].text : undefined;
  return { word: token.text, token, receiver };
}

/** Innermost macro containing the offset. */
export function macroAt(analysis: Analysis, offset: number): MacroInfo | undefined {
  return analysis.macros.find(m => m.start.start <= offset && offset <= m.end);
}

function readableSource(source: string): string {
  return source.replace(/\bM p\./g, 'manuel p.').replace(/\bBRC p\./g, 'guide BRC p.');
}

function paramLine(param: Param): string {
  return `- \`${param.name}\`${param.optional ? ' (facultatif)' : ''} : ${param.description}`;
}

export function entryMarkdown(entry: Entry): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.appendCodeblock([entry.syntax, ...(entry.overloads ?? []).map(o => o.syntax)].join('\n'), 'pros');
  if (entry.status === 'excluded') {
    md.appendMarkdown(`⚠ **Ne fonctionne plus sur la plateforme** (${entry.reason}).`);
    if (entry.replacement) {
      md.appendMarkdown(` Remplacement : \`${entry.replacement}\`.`);
    }
    md.appendMarkdown('\n\n');
  }
  md.appendMarkdown(`${entry.description}\n\n`);
  if (entry.params && entry.params.length > 0) {
    md.appendMarkdown(`**Paramètres**\n\n${entry.params.map(paramLine).join('\n')}\n\n`);
  }
  if (entry.returns) {
    md.appendMarkdown(`**Retour** : ${entry.returns}\n\n`);
  }
  const others = allSpellings(entry).filter(s => s !== entry.name && s !== entry.name.toLowerCase());
  if (others.length > 0) {
    md.appendMarkdown(`**Synonymes** : ${others.map(s => `\`${s}\``).join(', ')}\n\n`);
  }
  if (entry.status === 'undocumented') {
    md.appendMarkdown('_Non documenté dans le manuel._\n\n');
  } else if (entry.status === 'legacy') {
    md.appendMarkdown('_Mot-clé reconnu pour compatibilité, non documenté dans le manuel._\n\n');
  }
  // Undocumented entries have no page to point to; their status line above already says so.
  if (/\bp\./.test(entry.source)) {
    md.appendMarkdown(`_Réf. : ${readableSource(entry.source)}_`);
  }
  return md;
}

export function macroLabel(macro: MacroInfo): string {
  return `${macro.name}(${macro.params.map(p => p.text).join(', ')})`;
}
