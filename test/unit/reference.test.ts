import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { allSpellings, entries, lookup, lookupMethods, mixedCaseMatch, restrictionNote } from '../../src/data/reference';

const root = path.resolve(__dirname, '../../..');

test('every entry has a description, a syntax, a source and a valid status', () => {
  for (const entry of entries) {
    assert.ok(entry.description && entry.syntax && entry.source, entry.name);
    assert.ok(['documented', 'undocumented', 'legacy', 'restricted'].includes(entry.status), entry.name);
    if (entry.status === 'restricted') {
      assert.ok(entry.reason, `${entry.name}: restricted entries need a reason`);
    }
  }
});

test('no spelling is used by two global entries', () => {
  const seen = new Map<string, string>();
  for (const entry of entries.filter(e => !e.receiver)) {
    for (const spelling of allSpellings(entry)) {
      assert.ok(!seen.has(spelling), `${spelling}: ${seen.get(spelling)} and ${entry.name}`);
      seen.set(spelling, entry.name);
    }
  }
});

test('spelling rule: upper case names accept lower case, other names are exact', () => {
  assert.equal(lookup('display')?.name, 'DISPLAY');
  assert.equal(lookup('afficher')?.name, 'DISPLAY');
  assert.equal(lookup('Display'), undefined);
  assert.equal(lookup('IsDefined')?.name, 'IsDefined');
  assert.equal(lookup('isdefined'), undefined);
  assert.equal(lookup('sum')?.name, 'sum');
  assert.equal(lookup('SUM'), undefined);
  assert.equal(mixedCaseMatch('End_If')?.upper, 'END_IF');
  assert.equal(mixedCaseMatch('IsDefined'), undefined);
});

test('confML methods are looked up by receiver', () => {
  assert.equal(lookupMethods('getObjectByCPE', 'confML').length, 1);
  assert.equal(lookupMethods('getObjectByCPE', 'ACDate').length, 0);
  assert.equal(lookup('getObjectByCPE'), undefined);
});

/** Words of the word list (the largest alternation group) of a grammar rule. */
function grammarWords(rule: string): string[] {
  const grammar = JSON.parse(fs.readFileSync(path.join(root, 'syntaxes/pros.tmLanguage.json'), 'utf8'));
  const match: string = grammar.repository[rule].match;
  const groups = [...match.matchAll(/\((?:\?:)?([^()]+)\)/g)].map(m => m[1]).filter(g => g.includes('|'));
  const list = groups.sort((a, b) => b.length - a.length)[0];
  return list ? list.split('|') : [];
}

test('grammar built-in functions are known', () => {
  for (const word of grammarWords('builtin-functions')) {
    assert.ok(lookup(word), `${word} is highlighted but missing from functions.json`);
  }
});

test('grammar confML methods match functions.json', () => {
  const highlighted = grammarWords('confml').sort();
  const known = entries.filter(e => e.receiver === 'confML').map(e => e.name).sort();
  assert.deepEqual(highlighted, known);
});

test('restricted entries are highlighted by the grammar like the others', () => {
  const highlighted = new Set([...grammarWords('builtin-functions'), ...grammarWords('commands'), ...grammarWords('predefined-objects')]);
  for (const entry of entries.filter(e => e.status === 'restricted')) {
    for (const spelling of allSpellings(entry)) {
      assert.ok(highlighted.has(spelling), `${spelling} is restricted but not highlighted`);
    }
  }
});

test('restricted entries: neutral note with the manual page, never "no longer works"', () => {
  assert.equal(restrictionNote(lookup('EXECUTE')!), 'Restricted or discouraged by the manual (p. 43): execution is not authorized on the server.');
  assert.equal(restrictionNote(lookup('SqlConnectPool')!), 'Restricted or discouraged by the manual (p. 113): obsolete. Alternative: SqlConnectPool2.');
  assert.equal(restrictionNote(lookup('SQL_EXPORT')!), 'Restricted or discouraged: considered obsolete. Alternative: SQL_QUERY.');
  assert.equal(restrictionNote(lookup('DISPLAY')!), undefined);
  for (const entry of entries.filter(e => e.status === 'restricted')) {
    assert.doesNotMatch(restrictionNote(entry)!, /no longer works|not work/i, entry.name);
  }
});

test('no parameter name inlay hints are contributed', () => {
  const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  assert.doesNotMatch(manifest, /inlayHints/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'src/extension.ts'), 'utf8'), /registerInlayHintsProvider/);
});

/** Text files of the repository with a given extension, outside dependencies and generated files. */
function textFiles(dir: string, extensions: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      return ['node_modules', '.git', 'help', 'docs', 'examples'].includes(d.name) ? [] : textFiles(full, extensions);
    }
    return extensions.some(e => d.name.endsWith(e)) ? [full] : [];
  });
}

const SHIPPED_TEXT = ['src/data/functions.json', 'syntaxes/pros.tmLanguage.json', 'language-configuration.json', 'icons.json', 'package.json', 'README.md', 'CHANGELOG.md'];

test('shipped files contain no project-internal reference', () => {
  const internal = /Q-\d+|questions-ouvertes|analyse-exemples|pros-language-reference|CLAUDE\.md|docs\/|examples\/|confirmé par l.utilisateur|snippet d.origine|exemples r[ée]els|fichiers r[ée]els|grammaire d.origine|user request|§/;
  const files = [...SHIPPED_TEXT.map(f => path.join(root, f)), ...textFiles(path.join(root, 'out/src'), ['.js'])];
  for (const file of files) {
    const match = internal.exec(fs.readFileSync(file, 'utf8'));
    assert.equal(match, null, `${path.relative(root, file)}: ${match?.[0]}`);
  }
});

test('no stray control character in source and shipped text files', () => {
  // Tab, line feed and carriage return are the only control characters allowed.
  const control = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
  const files = [
    ...SHIPPED_TEXT.map(f => path.join(root, f)),
    ...textFiles(path.join(root, 'src'), ['.ts', '.json']),
    ...textFiles(path.join(root, 'test'), ['.ts', '.pros']),
    ...textFiles(path.join(root, 'out/src'), ['.js', '.json']),
  ];
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    const match = control.exec(text);
    if (match) {
      const line = text.slice(0, match.index).split('\n').length;
      assert.fail(`${path.relative(root, file)}:${line}: control character U+${match[0].charCodeAt(0).toString(16).padStart(4, '0')}`);
    }
  }
});

test('extension identity: only the package name changes, not the language', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(`${manifest.publisher}.${manifest.name}`, 'nilsbzh.pros-macro-language');
  assert.deepEqual(manifest.contributes.languages.map((l: { id: string; extensions: string[] }) => [l.id, l.extensions]), [['pros', ['.pros']]]);
  assert.deepEqual(manifest.contributes.grammars.map((g: { language: string; scopeName: string }) => [g.language, g.scopeName]), [['pros', 'source.pros']]);
});
