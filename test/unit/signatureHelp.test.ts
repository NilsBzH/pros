import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';
import { signaturesOf } from '../../src/analysis/calls';
import { signatureHelpAt } from '../../src/analysis/signatureHelp';
import { entries } from '../../src/data/reference';

/** Signature help at the "|" marker: label of the active signature and name of the active parameter. */
function helpAt(source: string): { label: string; param: string | undefined } | undefined {
  const offset = source.indexOf('|');
  const text = source.slice(0, offset) + source.slice(offset + 1);
  const line = text.slice(0, offset).split('\n').length - 1;
  const model = signatureHelpAt(analyze(text), offset, line);
  if (!model) {
    return undefined;
  }
  const signature = model.signatures[model.activeSignature];
  const parameter = signature.parameters[model.activeParameter];
  return { label: signature.label, param: parameter ? signature.label.slice(parameter.start, parameter.end) : undefined };
}

test('every syntax lists its parameters in the same order as "params"', () => {
  for (const entry of entries.filter(e => e.style !== 'none')) {
    for (const signature of signaturesOf(entry)) {
      const fromSyntax = signature.parts.filter(p => p.param !== undefined).length;
      assert.equal(fromSyntax, signature.params.length, `${entry.name}: ${signature.label}`);
    }
  }
});

test('calls without parentheses: the active parameter follows the typed arguments', () => {
  assert.deepEqual(helpAt('SUBSTR |'), { label: 'SUBSTR string start length', param: 'string' });
  assert.deepEqual(helpAt('LET s SUBSTR "abc" |'), { label: 'SUBSTR string start length', param: 'start' });
  assert.deepEqual(helpAt('LET s SUBSTR "abc" 2|'), { label: 'SUBSTR string start length', param: 'start' });
  assert.deepEqual(helpAt('LET s SUBSTR "abc" 2 |'), { label: 'SUBSTR string start length', param: 'length' });
  assert.deepEqual(helpAt('LET s substr "abc" |'), { label: 'SUBSTR string start length', param: 'start' });
  assert.deepEqual(helpAt('LET s SOUS_CHAINE x |'), { label: 'SUBSTR string start length', param: 'start' });
  assert.deepEqual(helpAt('LET r ATAN2 (a + b) |'), { label: 'ATAN2 y x', param: 'x' });
});

test('calls without parentheses: arguments may be nested calls or expressions in parentheses', () => {
  assert.deepEqual(helpAt('LET d REPLACE_STR descr "(KIT)" (" - " + |'), { label: 'REPLACE_STR string search replacement', param: 'replacement' });
  assert.deepEqual(helpAt('LET d REPLACE_STR STR n "a" |'), { label: 'REPLACE_STR string search replacement', param: 'replacement' });
  assert.deepEqual(helpAt('LET d REPLACE_STR x.get(1) |'), { label: 'REPLACE_STR string search replacement', param: 'search' });
  assert.deepEqual(helpAt('LET d SUBSTR tab[1, 2] |'), { label: 'SUBSTR string start length', param: 'start' });
});

test('calls without parentheses: optional parameters, keyword choices and literal keywords', () => {
  assert.deepEqual(helpAt('FIND_STR "abc" |'), { label: 'FIND_STR [start] string search', param: 'search' });
  assert.deepEqual(helpAt('FIND_STR 3 "abc" |'), { label: 'FIND_STR [start] string search', param: 'search' });
  assert.deepEqual(helpAt('TRACE |'), { label: 'TRACE [DEL_OLD|CONCAT_ANC] file', param: 'file' });
  assert.deepEqual(helpAt('TRACE DEL_OLD |'), { label: 'TRACE [DEL_OLD|CONCAT_ANC] file', param: 'file' });
  assert.deepEqual(helpAt('TRACE SUPP_ANC |'), { label: 'TRACE [DEL_OLD|CONCAT_ANC] file', param: 'file' });
  assert.deepEqual(helpAt('TRIM LEFT |'), { label: 'TRIM [LEFT|RIGHT] string', param: 'string' });
  assert.deepEqual(helpAt('SQL_QUERY query IN |'), { label: 'SQL_QUERY [channel] query IN "array"', param: '"array"' });
  assert.deepEqual(helpAt('DISPLAY MACRO |'), { label: 'DISPLAY MACRO name', param: 'name' });
  assert.deepEqual(helpAt('DISPLAY |'), { label: 'DISPLAY expression', param: 'expression' });
});

test('commands: the last parameter takes a whole expression', () => {
  assert.deepEqual(helpAt('LET i |'), { label: 'LET name expression', param: 'expression' });
  assert.deepEqual(helpAt('LET i i + |'), { label: 'LET name expression', param: 'expression' });
  assert.deepEqual(helpAt('ERROR 2 |'), { label: 'ERROR status message', param: 'message' });
});

test('no signature help once a call is complete or outside a call', () => {
  assert.equal(helpAt('IF FIND_STR code "x" = 0 |'), undefined);
  assert.equal(helpAt('SUBSTR|'), undefined);
  assert.equal(helpAt('LET a 1\n|'), undefined);
  assert.equal(helpAt('IF a = 1 |'), undefined);
});

test('restricted entries have a signature help like the others', () => {
  assert.deepEqual(helpAt('EXECUTE |'), { label: 'EXECUTE variable', param: 'variable' });
  assert.deepEqual(helpAt('LET c ReadFile(|'), { label: 'ReadFile(file)', param: 'file' });
});

test('the signature help stays open while a string argument is typed, not in a comment', () => {
  assert.deepEqual(helpAt('replace_str "sdsd" "d|f"'), { label: 'REPLACE_STR string search replacement', param: 'search' });
  assert.deepEqual(helpAt('LET x SUBSTR "ab|'), { label: 'SUBSTR string start length', param: 'string' });
  assert.deepEqual(helpAt('LET x Lpad("a, b|", 5'), { label: 'Lpad(string, length, padding)', param: 'string' });
  assert.equal(helpAt('LET x SUBSTR /* s |'), undefined);
  assert.equal(helpAt('LET x Lpad(/* a, | */'), undefined);
});

test('calls with parentheses: functions, methods, overloads, macros', () => {
  assert.deepEqual(helpAt('LET x Lpad("a", |'), { label: 'Lpad(string, length, padding)', param: 'length' });
  assert.deepEqual(helpAt('IF IsDefined(|'), { label: 'IsDefined(expr)', param: 'expr' });
  assert.deepEqual(helpAt('LET t confML.getBdtTableName("x", |'), { label: 'confML.getBdtTableName(bdtName, workspace)', param: 'workspace' });
  assert.deepEqual(helpAt('LET d ACDate(|'), { label: 'ACDate()', param: undefined });
  assert.deepEqual(helpAt('LET d ACDate("01-01-2026", |'), { label: 'ACDate(date, format)', param: 'format' });
  assert.deepEqual(helpAt('DEFINE child(p1, p2)\nEND_DEFINE\nLET r child(a, |'), { label: 'child(p1, p2)', param: 'p2' });
  assert.deepEqual(helpAt('LET x Lpad(SUBSTR s |'), { label: 'SUBSTR string start length', param: 'start' });
  assert.deepEqual(helpAt('LET x Lpad(Integer(STR(j)), |'), { label: 'Lpad(string, length, padding)', param: 'length' });
});
