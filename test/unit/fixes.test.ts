import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';
import { quickFixes } from '../../src/analysis/fixes';
import { HintMode, parameterHints } from '../../src/analysis/inlayHints';

/** Text after applying the preferred fix of the first issue with `code`. */
function fixed(text: string, code: string): string | undefined {
  const issue = analyze(text).issues.find(i => i.code === code);
  const fix = issue && quickFixes(text, issue).find(f => f.preferred);
  return fix && text.slice(0, fix.change.start) + fix.change.text + text.slice(fix.change.end);
}

test('quick fixes for the diagnostics', () => {
  assert.equal(fixed('Display x', 'mixed-case'), 'DISPLAY x');
  assert.deepEqual(quickFixes('Display x', { start: 0, end: 7, code: 'mixed-case' }).map(f => f.title), ['Change to DISPLAY', 'Change to display']);
  assert.equal(fixed('LET a 1 // note  \r\nLET b 2', 'line-comment'), 'LET a 1 /* note */\r\nLET b 2');
  assert.equal(fixed('LET a 1 //', 'line-comment'), 'LET a 1 /* */');
  assert.equal(fixed('trace_end', 'invalid-form'), 'trace_off');
  assert.equal(fixed('TRACE_END', 'invalid-form'), 'TRACE_OFF');
  assert.equal(fixed('BRC m()\nEND_DEFINE', 'brc-header'), 'DEFINE m()\nEND_DEFINE');
  assert.equal(fixed('brc m()\nend_define', 'brc-header'), 'define m()\nend_define');
});

/** Text with the hints written inline, as the editor shows them. */
function hinted(text: string, mode: HintMode = 'literals'): string {
  let result = text;
  for (const hint of parameterHints(analyze(text), mode).reverse()) {
    result = result.slice(0, hint.token.start) + hint.label + ' ' + result.slice(hint.token.start);
  }
  return result;
}

test('parameter name hints for calls without parentheses', () => {
  assert.equal(hinted('LET x SUBSTR s 2 3'), 'LET x SUBSTR s start: 2 length: 3');
  assert.equal(hinted('LET x SUBSTR s 2 3', 'all'), 'LET x SUBSTR string: s start: 2 length: 3');
  assert.equal(hinted('LET x SUBSTR s 2 3', 'none'), 'LET x SUBSTR s 2 3');
  assert.equal(hinted('LET x SUBSTR s -1 (n + 1)', 'literals'), 'LET x SUBSTR s start: -1 (n + 1)');
  assert.equal(hinted('IF FIND_STR a "b" = 0 LET y 1 END_IF'), 'IF FIND_STR a search: "b" = 0 LET y 1 END_IF');
  assert.equal(hinted('TRACE DEL_OLD "log.txt"'), 'TRACE DEL_OLD file: "log.txt"');
  assert.equal(hinted('DISPLAY "x"\nLET s STR(5)\nLET t STR 5'), 'DISPLAY "x"\nLET s STR(5)\nLET t STR 5');
});
