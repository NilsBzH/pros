import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';

const codes = (text: string) => analyze(text).issues.map(i => i.code);

test('well formed blocks produce no issue (English, French, lower case, one-line IF)', () => {
  const text = [
    'DEFINE m(a, b)',
    'LOCAL i 1',
    'IF a > b',
    '    WHILE i <= 3',
    '        IF i = 2 EXIT_LOOP END_IF',
    '        LET i i + 1',
    '    END_WHILE',
    'ELSE_IF a = b',
    '    REPEAT',
    '        LET i i - 1',
    '    UNTIL (i = 0)',
    'ELSE',
    '    EXIT_MACRO',
    'END_IF',
    'END_DEFINE',
    'DEFINITION n()',
    'SI x = 1 SOIT y 2 SINON SOIT y 3 FIN_SI',
    'TANT_QUE y < 3 SOIT y y + 1 FIN_TANT_QUE',
    'REPETER SOIT y y - 1 JUSQU_A (y = 0)',
    'FIN_DEFINITION',
    'define o()',
    'if x = 1 display x end_if',
    'end_define',
  ].join('\n');
  assert.deepEqual(analyze(text).issues, []);
});

test('unclosed and unexpected blocks', () => {
  assert.deepEqual(codes('DEFINE m()\nIF a = 1\nEND_DEFINE'), ['unclosed-block']);
  assert.deepEqual(codes('DEFINE m()\nEND_IF\nEND_DEFINE'), ['unexpected-closer']);
  assert.deepEqual(codes('DEFINE m()\nWHILE a < 2\nEND_IF\nEND_DEFINE'), ['unexpected-closer', 'unclosed-block']);
  assert.deepEqual(codes('DEFINE m()\nREPEAT\nLET a 1'), ['unclosed-block', 'unclosed-block']);
});

test('a new DEFINE closes the previous macro with an error', () => {
  const analysis = analyze('DEFINE a()\nLET x 1\nDEFINE b()\nEND_DEFINE');
  assert.deepEqual(analysis.issues.map(i => i.code), ['unclosed-block']);
  assert.deepEqual(analysis.macros.map(m => m.name), ['a', 'b']);
  assert.equal(analysis.macros[0].endToken, undefined);
  assert.equal(analysis.macros[1].endToken?.text, 'END_DEFINE');
});

test('misplaced ELSE and ELSE_IF', () => {
  assert.deepEqual(codes('DEFINE m()\nELSE\nEND_DEFINE'), ['misplaced-else']);
  assert.deepEqual(codes('IF a\nELSE\nELSE\nEND_IF'), ['misplaced-else']);
  assert.deepEqual(codes('IF a\nELSE\nELSE_IF b\nEND_IF'), ['misplaced-else']);
});

test('exits outside their block', () => {
  assert.deepEqual(codes('DEFINE m()\nEXIT_LOOP\nEND_DEFINE'), ['exit-outside']);
  assert.deepEqual(codes('EXIT_MACRO'), ['exit-outside']);
});

test('comments and strings are ignored by block matching', () => {
  assert.deepEqual(codes('DEFINE m()\n/*ELSE_IF x = 1\nEND_IF */ LET s "END_IF"\nEND_DEFINE'), []);
});

test('mixed case keywords, excluded commands, invalid forms and "//"', () => {
  assert.deepEqual(codes('Display x'), ['mixed-case']);
  assert.deepEqual(codes('OPEN_FILE 1 "r" "f"'), ['excluded']);
  assert.deepEqual(codes('LET c ReadFile("f")'), ['excluded']);
  assert.deepEqual(codes('TRACE_OFF\ntrace_end'), ['invalid-form']);
  assert.deepEqual(codes('LET a 1 // b'), ['line-comment']);
  assert.deepEqual(codes('BRC m()\nEND_DEFINE'), ['brc-header', 'unexpected-closer']);
  assert.deepEqual(codes('LET a "open'), ['unclosed-string']);
});

test('member names are not keywords', () => {
  assert.deepEqual(codes('map.put("k", v)\nobj.Display()\nlist.ReadFile()'), []);
});

test('macros, parameters and variables', () => {
  const analysis = analyze('DEFINE child(p1, p2)\nLOCAL a 1\nLET b a\nLET child b\nEND_DEFINE\nLET top 2');
  const [macro] = analysis.macros;
  assert.equal(macro.name, 'child');
  assert.deepEqual(macro.params.map(p => p.text), ['p1', 'p2']);
  assert.deepEqual(analysis.variables.map(v => `${v.declaration} ${v.name} ${v.macro?.name ?? '-'}`), [
    'LOCAL a child', 'LET b child', 'LET child child', 'LET top -',
  ]);
});

test('regions', () => {
  const analysis = analyze('/*#region:Calcul*/\nLET a 1\n/*#endregion*/\n/* region */\n/* endregion */');
  assert.deepEqual(analysis.regions.map(r => [r.name, r.end?.line]), [['Calcul', 2], ['region', 4]]);
});
