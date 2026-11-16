import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyze, parseDoc } from '../../src/analysis/document';
import { quickFixes } from '../../src/analysis/fixes';
import { macroDocumentation, signatureHelpAt } from '../../src/analysis/signatureHelp';
import { allSpellings, entries, restrictionNote } from '../../src/data/reference';
import { globalSpecs, methodSpecs } from '../../src/providers/completionItems';

const root = path.resolve(__dirname, '../../..');

const FRENCH_WORDS = new Set([
  'le', 'la', 'les', 'de', 'des', 'du', 'une', 'pour', 'que', 'qui', 'dans', 'avec', 'sans', 'est', 'sont', 'au', 'aux',
  'par', 'ce', 'cette', 'ces', 'pas', 'mais', 'leur', 'selon', 'lorsque', 'quand', 'documenté', 'fonctionne', 'chaîne',
  'valeur', 'tableau', 'fichier', 'renvoie', 'retourne', 'paramètre', 'facultatif', 'utiliser',
]);
const ACCENT = /[àâäçéèêëîïôöùûüœ]/i;
/** Keywords and synonyms of the language (SI, sinon, créer_environnement…) are syntax, not text. */
const SPELLINGS = new Set(entries.flatMap(allSpellings));

/** French words of a displayed text; code spans, upper case words and language spellings are left out. */
function frenchWords(text: string): string[] {
  const words = text.replace(/`[^`]*`/g, ' ').match(/[A-Za-zÀ-ÿ_]+/g) ?? [];
  const found = words.filter(w => w !== w.toUpperCase() && !SPELLINGS.has(w) && (FRENCH_WORDS.has(w.toLowerCase()) || ACCENT.test(w)));
  return /non document/i.test(text) ? [...found, 'non documenté'] : found;
}

function assertEnglish(where: string, text: string | undefined): void {
  if (text) {
    assert.deepEqual(frenchWords(text), [], `${where}: ${text}`);
  }
}

test('the French detector catches French and ignores the syntax of the language', () => {
  // "dans" is the lower case form of the DANS keyword, so it is left to the syntax.
  assert.deepEqual(frenchWords('Non documenté dans le manuel'), ['documenté', 'le', 'non documenté']);
  assert.deepEqual(frenchWords('Ne fonctionne plus sur la plateforme'), ['fonctionne', 'la']);
  assert.deepEqual(frenchWords('Synonym of SI: `SI x FIN_SI`, or créer_environnement'), []);
  assert.deepEqual(frenchWords('Returns the part of a string between two positions.'), []);
});

test('language data is written in English', () => {
  for (const e of entries) {
    const id = `${e.receiver ? `${e.receiver}.` : ''}${e.name}`;
    for (const [field, text] of [['description', e.description], ['returns', e.returns], ['reason', e.reason], ['replacement', e.replacement]]) {
      assertEnglish(`${id} ${field}`, text);
    }
    for (const signature of [e, ...(e.overloads ?? [])]) {
      for (const p of signature.params ?? []) {
        assertEnglish(`${id} param ${p.name}`, p.description);
      }
    }
    assertEnglish(`${id} note`, restrictionNote(e));
  }
});

test('completion details, diagnostics, quick fixes and signature texts are in English', () => {
  for (const s of [...globalSpecs('upper'), ...globalSpecs('lower'), ...methodSpecs('confML')]) {
    assertEnglish(`completion ${s.label}`, s.detail);
  }
  const text = [
    '/* Adds. @param a value */', 'DEFINE m(a)', 'Display a', 'LET b 1 // note', 'trace_end', 'EXECUTE b', 'ELSE',
    'EXIT_LOOP', 'IF a', 'END_WHILE', 'LET s "open', 'BRC n()',
  ].join('\n');
  const analysis = analyze(text);
  assert.ok(analysis.issues.length >= 8);
  for (const issue of analysis.issues) {
    assertEnglish(`diagnostic ${issue.code}`, issue.message);
    for (const fix of quickFixes(text, issue)) {
      assertEnglish(`quick fix ${issue.code}`, fix.title);
    }
  }
  assertEnglish('macro documentation', macroDocumentation(analysis.macros[0], true));
  assertEnglish('documentation comment', parseDoc('/* Adds. */')?.description);
  for (const source of ['LET x SUBSTR ', 'LET x Lpad(', 'TRACE ']) {
    for (const signature of signatureHelpAt(analyze(source), source.length, 0)?.signatures ?? []) {
      assertEnglish(`signature ${signature.label}`, signature.documentation);
      signature.parameters.forEach(p => assertEnglish(`parameter of ${signature.label}`, p.documentation));
    }
  }
});

test('texts written in the source code and the manifest are in English', () => {
  const sources = (dir: string): string[] => fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(d => (d.isDirectory() ? sources(path.join(dir, d.name)) : d.name.endsWith('.ts') ? [path.join(dir, d.name)] : []));
  for (const file of sources(path.join(root, 'src'))) {
    for (const literal of fs.readFileSync(file, 'utf8').match(/'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|"(?:[^"\\\n]|\\.)*"/g) ?? []) {
      assertEnglish(path.relative(root, file), literal);
    }
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assertEnglish('package.json description', manifest.description);
  assertEnglish('package.json displayName', manifest.displayName);
  for (const [name, setting] of Object.entries<{ markdownDescription?: string; enumDescriptions?: string[] }>(manifest.contributes.configuration?.properties ?? {})) {
    [setting.markdownDescription, ...(setting.enumDescriptions ?? [])].forEach(t => assertEnglish(name, t));
  }
  for (const file of ['README.md', 'CHANGELOG.md']) {
    fs.readFileSync(path.join(root, file), 'utf8').split('\n').forEach((line, i) => assertEnglish(`${file}:${i + 1}`, line));
  }
});
