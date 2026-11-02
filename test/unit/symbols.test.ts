import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';
import { semanticTokens } from '../../src/analysis/semanticTokens';
import { macroOccurrences, newNameError, occurrenceAt, occurrencesOf, renameError } from '../../src/analysis/symbols';

const source = [
  'DEFINE total(price, qty)',
  'LOCAL rate 2',
  'LET res price * qty * rate + inDiscount',
  'LET total res',
  'END_DEFINE',
  'DEFINE other()',
  'LET res total(1, 2)',
  'LET n confML.getSetting("k").size()',
  'LET m map.count',
  'DISPLAY Display',
  'END_DEFINE',
].join('\n');

/** "word:type[.modifier…]" for every semantic token. */
function classes(text: string): string[] {
  return semanticTokens(analyze(text)).map(t => [text.substr(t.start, t.length) + ':' + t.type, ...t.modifiers].join('.'));
}

test('semantic tokens: parameters, variables, macros, undeclared names and members', () => {
  assert.deepEqual(classes(source), [
    'total:function.declaration', 'price:parameter.declaration', 'qty:parameter.declaration',
    'rate:variable.declaration',
    'res:variable.declaration', 'price:parameter', 'qty:parameter', 'rate:variable', 'inDiscount:variable.readonly',
    'total:function', 'res:variable',
    'other:function.declaration',
    'res:variable.declaration', 'total:function',
    'n:variable.declaration', 'getSetting:method.defaultLibrary', 'size:method',
    'm:variable.declaration', 'map:variable.readonly', 'count:property',
  ]);
});

test('keywords, built-in names, strings and comments are left to the grammar', () => {
  assert.deepEqual(classes('IF SUBSTR "a" 1 2 = "x" /* y */ DISPLAY TRUE END_IF'), []);
});

test('variables are resolved per macro', () => {
  const analysis = analyze(source);
  const inFirst = occurrenceAt(analysis, source.indexOf('res'))!;
  assert.equal(inFirst.ref.kind, 'variable');
  assert.equal(occurrencesOf(analysis, inFirst.ref).length, 2);
  const inSecond = occurrenceAt(analysis, source.lastIndexOf('LET res') + 4)!;
  assert.equal(occurrencesOf(analysis, inSecond.ref).length, 1);
});

test('macro occurrences: definition, call and returned value', () => {
  const analysis = analyze(source);
  assert.deepEqual(macroOccurrences(analysis, 'total').map(o => o.token.line), [0, 3, 6]);
  assert.deepEqual(macroOccurrences(analyze('DISPLAY MACRO total\nLET x total (1)'), 'total').map(o => o.token.line), [0]);
});

test('rename: undeclared names, keywords and names already in use are refused', () => {
  const analysis = analyze(source);
  const at = (needle: string, from = 0) => occurrenceAt(analysis, source.indexOf(needle, from))!;
  assert.match(renameError(at('inDiscount'))!, /not declared/);
  assert.equal(renameError(occurrenceAt(analysis, source.indexOf('LOCAL'))), 'Only macros, parameters and variables of the document can be renamed.');
  assert.equal(renameError(at('rate')), undefined);
  const rate = at('rate').ref;
  assert.equal(newNameError(analysis, rate, 'discount'), undefined);
  assert.match(newNameError(analysis, rate, 'price')!, /already used in total/);
  assert.match(newNameError(analysis, rate, 'inDiscount')!, /already used/);
  assert.match(newNameError(analysis, rate, 'other')!, /macro named/);
  assert.match(newNameError(analysis, rate, 'substr')!, /built-in/);
  assert.match(newNameError(analysis, rate, 'Display')!, /built-in/);
  assert.match(newNameError(analysis, rate, '2x')!, /not a valid name/);
  assert.equal(newNameError(analysis, at('total').ref, 'grandTotal'), undefined);
});
