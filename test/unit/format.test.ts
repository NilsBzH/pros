import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';
import { foldingRanges } from '../../src/analysis/folding';
import { formatLines } from '../../src/analysis/format';

function format(lines: string[], indent = '    '): string[] {
  const text = lines.join('\n');
  const result = [...lines];
  for (const edit of formatLines(text, analyze(text), { indent })) {
    result[edit.line] = edit.text;
  }
  return result;
}

test('blocks are re-indented, the macro body stays at the DEFINE level', () => {
  assert.deepEqual(format([
    'DEFINE m(a)',
    '      LOCAL i 1   ',
    'IF a > 1',
    'WHILE i < 3',
    '  LET i i + 1',
    '        END_WHILE',
    '  ELSE_IF a = 1',
    'REPEAT',
    'LET i i - 1',
    'UNTIL (i = 0)',
    '    else',
    'if a = 0 display a end_if',
    'EXIT_MACRO',
    '    END_IF',
    '   ',
    '  END_DEFINE',
  ]), [
    'DEFINE m(a)',
    'LOCAL i 1',
    'IF a > 1',
    '    WHILE i < 3',
    '        LET i i + 1',
    '    END_WHILE',
    'ELSE_IF a = 1',
    '    REPEAT',
    '        LET i i - 1',
    '    UNTIL (i = 0)',
    'else',
    '    if a = 0 display a end_if',
    '    EXIT_MACRO',
    'END_IF',
    '',
    'END_DEFINE',
  ]);
});

test('continuation lines keep their offset; multi-line strings and comments are untouched', () => {
  assert.deepEqual(format([
    'IF x',
    'LET q "SELECT a"',
    '        + " FROM t"',
    '+ " WHERE b"',
    'LET s "first',
    '   second  ',
    '  third"',
    '  /* note',
    '       detail */',
    'LET r f(1,',
    '2)',
    'END_IF',
  ], '\t'), [
    'IF x',
    '\tLET q "SELECT a"',
    '\t        + " FROM t"',
    '\t\t+ " WHERE b"',
    '\tLET s "first',
    '   second  ',
    '  third"',
    '\t/* note',
    '       detail */',
    '\tLET r f(1,',
    '\t\t2)',
    'END_IF',
  ]);
});

test('an unclosed block does not shift the following macros', () => {
  assert.deepEqual(format(['DEFINE a()', 'IF x', 'LET y 1', 'DEFINE b()', 'LET z 2', 'END_DEFINE']),
    ['DEFINE a()', 'IF x', '    LET y 1', 'DEFINE b()', 'LET z 2', 'END_DEFINE']);
});

test('folding: blocks per branch, regions and multi-line comments', () => {
  const text = [
    '/*#region main*/',     // 0
    'DEFINE m()',           // 1
    '/* a',                 // 2
    '   b */',              // 3
    'IF x',                 // 4
    '    LET y 1',          // 5
    'ELSE',                 // 6
    '    LET y 2',          // 7
    'END_IF',               // 8
    'IF z LET y 3 END_IF',  // 9
    'END_DEFINE',           // 10
    '/*#endregion*/',       // 11
  ].join('\n');
  assert.deepEqual(foldingRanges(analyze(text)), [
    { start: 0, end: 11, kind: 'region' },
    { start: 1, end: 9 },
    { start: 2, end: 3, kind: 'comment' },
    { start: 4, end: 5 },
    { start: 6, end: 7 },
  ]);
});
