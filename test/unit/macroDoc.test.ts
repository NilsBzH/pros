import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze, parseDoc } from '../../src/analysis/document';
import { macroDocumentation, signatureHelpAt } from '../../src/analysis/signatureHelp';

test('documentation comment: description, @param lines and their continuation', () => {
  const comment = ['/**', ' * Total price.', ' * Taxes included.', ' *', ' * @param price unit price', ' *   in euros', ' * @param qty quantity', ' */'].join('\r\n');
  assert.deepEqual(parseDoc(comment), { description: 'Total price.\nTaxes included.', params: { price: 'unit price in euros', qty: 'quantity' } });
  assert.deepEqual(parseDoc('/* Short. */'), { description: 'Short.', params: {} });
  assert.equal(parseDoc('/*  */'), undefined);
});

test('only the comment right above DEFINE documents the macro', () => {
  const text = [
    '/* Adds. @param is not a tag here',
    '@param a first value */',
    'DEFINE m(a)',
    'END_DEFINE',
    '/* Too far. */',
    '',
    'DEFINE n()',
    'END_DEFINE',
    '/*#region helpers*/',
    'DEFINE o()',
    'END_DEFINE',
  ].join('\n');
  const [m, n, o] = analyze(text).macros;
  assert.deepEqual(m.doc, { description: 'Adds. @param is not a tag here', params: { a: 'first value' } });
  assert.equal(n.doc, undefined);
  assert.equal(o.doc, undefined);
});

test('the documentation is used by the signature help', () => {
  const text = '/* Adds two values.\n@param a first value\n@param b second value */\nDEFINE add(a, b)\nEND_DEFINE\nLET x add(1, ';
  const analysis = analyze(text);
  const model = signatureHelpAt(analysis, text.length, 5)!;
  assert.equal(model.activeParameter, 1);
  assert.equal(model.signatures[0].parameters[1].documentation, 'second value');
  assert.equal(model.signatures[0].documentation, 'Adds two values.\n\nMacro defined on line 4.');
  assert.equal(macroDocumentation(analysis.macros[0], true), 'Adds two values.\n\n- `a`: first value\n- `b`: second value\n\nMacro defined on line 4.');
});
