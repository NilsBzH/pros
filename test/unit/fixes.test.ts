import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { analyze } from '../../src/analysis/document';
import { quickFixes } from '../../src/analysis/fixes';

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
