// Hover: reference entries (keywords, functions, confML and object methods), macros and variables of the document.
import * as vscode from 'vscode';
import { lookup, lookupMethods } from '../data/reference';
import { entryMarkdown, getAnalysis, inStringOrComment, macroAt, macroLabel, tokenRange, wordAt } from './shared';

export class ProsHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const analysis = getAnalysis(document);
    const offset = document.offsetAt(position);
    if (inStringOrComment(analysis, offset)) {
      return undefined;
    }
    const target = wordAt(analysis, offset);
    if (!target) {
      return undefined;
    }
    const range = tokenRange(document, target.token);

    if (target.receiver) {
      // confML methods are certain; for other objects the method is shown only when its name is unambiguous.
      const methods = target.receiver === 'confML'
        ? lookupMethods(target.word, 'confML')
        : lookupMethods(target.word).filter(m => m.receiver !== 'confML');
      if (methods.length !== 1) {
        return undefined;
      }
      const md = entryMarkdown(methods[0]);
      if (target.receiver !== 'confML') {
        md.appendMarkdown(`\n\n_Méthode de ${methods[0].receiver}, déduite de son nom._`);
      }
      return new vscode.Hover(md, range);
    }

    const entry = lookup(target.word);
    if (entry) {
      return new vscode.Hover(entryMarkdown(entry), range);
    }

    const macro = analysis.macros.find(m => m.name === target.word);
    if (macro) {
      const md = new vscode.MarkdownString().appendCodeblock(`DEFINE ${macroLabel(macro)}`, 'pros');
      md.appendMarkdown(`Macro définie ligne ${macro.start.line + 1}.`);
      return new vscode.Hover(md, range);
    }

    const scope = macroAt(analysis, offset);
    const variable = analysis.variables.find(v => v.name === target.word && v.macro === scope)
      ?? analysis.variables.find(v => v.name === target.word);
    if (variable) {
      const where = variable.macro ? ` dans ${variable.macro.name}` : '';
      return new vscode.Hover(new vscode.MarkdownString(`Variable déclarée par \`${variable.declaration}\` ligne ${variable.token.line + 1}${where}.`), range);
    }
    return undefined;
  }
}
