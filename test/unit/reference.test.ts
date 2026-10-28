import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { allSpellings, entries, lookup, lookupMethods, mixedCaseMatch } from '../../src/data/reference';

const root = path.resolve(__dirname, '../../..');

test('every entry has a description, a syntax, a source and a valid status', () => {
  for (const entry of entries) {
    assert.ok(entry.description && entry.syntax && entry.source, entry.name);
    assert.ok(['documented', 'undocumented', 'legacy', 'excluded'].includes(entry.status), entry.name);
    if (entry.status === 'excluded') {
      assert.ok(entry.reason, `${entry.name}: excluded entries need a reason`);
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

test('grammar built-in functions are known and not excluded', () => {
  for (const word of grammarWords('builtin-functions')) {
    const entry = lookup(word);
    assert.ok(entry, `${word} is highlighted but missing from functions.json`);
    assert.notEqual(entry.status, 'excluded', `${word} is highlighted but excluded`);
  }
});

test('grammar confML methods match functions.json', () => {
  const highlighted = grammarWords('confml').sort();
  const known = entries.filter(e => e.receiver === 'confML').map(e => e.name).sort();
  assert.deepEqual(highlighted, known);
});

test('excluded entries are not highlighted by the grammar', () => {
  const highlighted = new Set([...grammarWords('builtin-functions'), ...grammarWords('commands'), ...grammarWords('control')]);
  for (const entry of entries.filter(e => e.status === 'excluded')) {
    for (const spelling of allSpellings(entry)) {
      assert.ok(!highlighted.has(spelling), `${spelling} is excluded but highlighted`);
    }
  }
});
