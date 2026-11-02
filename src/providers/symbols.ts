// Document outline (macros with their variables, regions) and go to definition (macros, variables).
import * as vscode from 'vscode';
import { getAnalysis, inStringOrComment, macroAt, otherProsFiles, tokenRange, wordAt, wordRange } from './shared';

export class ProsDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const analysis = getAnalysis(document);
    const symbols: vscode.DocumentSymbol[] = [];

    for (const macro of analysis.macros) {
      const range = new vscode.Range(document.positionAt(macro.start.start), document.positionAt(Math.max(macro.end, macro.nameToken.end)));
      const symbol = new vscode.DocumentSymbol(macro.name, `(${macro.params.map(p => p.text).join(', ')})`,
        vscode.SymbolKind.Function, range, tokenRange(document, macro.nameToken));
      const seen = new Set<string>();
      for (const variable of analysis.variables.filter(v => v.macro === macro)) {
        if (seen.has(variable.name)) {
          continue;
        }
        seen.add(variable.name);
        const variableRange = tokenRange(document, variable.token);
        symbol.children.push(new vscode.DocumentSymbol(variable.name, variable.declaration, vscode.SymbolKind.Variable, variableRange, variableRange));
      }
      symbols.push(symbol);
    }

    for (const region of analysis.regions) {
      const end = region.end ?? region.start;
      const range = new vscode.Range(document.positionAt(region.start.start), document.positionAt(end.end));
      symbols.push(new vscode.DocumentSymbol(region.name, 'region', vscode.SymbolKind.Namespace, range, tokenRange(document, region.start)));
    }
    return symbols.sort((a, b) => a.range.start.compareTo(b.range.start));
  }
}

/** Definitions of a macro in the other .pros files of the workspace. */
export async function macrosInWorkspace(name: string, exclude: vscode.Uri): Promise<vscode.Location[]> {
  const locations: vscode.Location[] = [];
  for (const { uri, analysis } of await otherProsFiles(exclude)) {
    for (const macro of analysis.macros.filter(m => m.name === name)) {
      locations.push(new vscode.Location(uri, wordRange(macro.nameToken)));
    }
  }
  return locations;
}

export class ProsDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | undefined> {
    const analysis = getAnalysis(document);
    const offset = document.offsetAt(position);
    if (inStringOrComment(analysis, offset)) {
      return undefined;
    }
    const target = wordAt(analysis, offset);
    if (!target || target.receiver) {
      return undefined;
    }

    const local = analysis.macros.filter(m => m.name === target.word);
    if (local.length > 0) {
      return local.map(m => new vscode.Location(document.uri, tokenRange(document, m.nameToken)));
    }

    const scope = macroAt(analysis, offset);
    const variable = analysis.variables.find(v => v.name === target.word && v.macro === scope)
      ?? analysis.variables.find(v => v.name === target.word);
    if (variable) {
      return [new vscode.Location(document.uri, tokenRange(document, variable.token))];
    }

    // Child macros may be defined in other .pros files of the workspace.
    const elsewhere = await macrosInWorkspace(target.word, document.uri);
    return elsewhere.length > 0 ? elsewhere : undefined;
  }
}
