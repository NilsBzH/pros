import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { tokenize } from '../../src/analysis/lexer';

const kinds = (text: string) => tokenize(text).map(t => `${t.kind}:${t.text}`);

test('strings escape their delimiter by doubling it, backslash is literal', () => {
  assert.deepEqual(kinds('LET s "a ""b"" c"'), ['word:LET', 'word:s', 'string:"a ""b"" c"']);
  assert.deepEqual(kinds("LET t 'it''s'"), ['word:LET', 'word:t', "string:'it''s'"]);
  assert.deepEqual(kinds('LET p "c:\\temp\\" + x'), ['word:LET', 'word:p', 'string:"c:\\temp\\"', 'operator:+', 'word:x']);
});

test('strings and comments may span several lines', () => {
  const tokens = tokenize('LET a "one\ntwo"\n/* x\ny */ LET b 1');
  assert.equal(tokens[2].kind, 'string');
  assert.equal(tokens[2].text, '"one\ntwo"');
  assert.equal(tokens[3].kind, 'comment');
  assert.equal(tokens[3].line, 2);
  assert.equal(tokens[4].line, 3);
  assert.equal(tokens[4].character, 5);
});

test('unterminated strings and comments are flagged', () => {
  const last = (text: string) => tokenize(text).slice(-1)[0];
  assert.equal(last('LET a "open').closed, false);
  assert.equal(last('/* open').closed, false);
  assert.equal(tokenize('"ok"')[0].closed, true);
});

test('numbers, operators and punctuation', () => {
  assert.deepEqual(kinds('a := 3.14 ** 2 <> b <= c'), [
    'word:a', 'operator::=', 'number:3.14', 'operator:**', 'number:2', 'operator:<>', 'word:b', 'operator:<=', 'word:c',
  ]);
  assert.deepEqual(kinds('tab["NR", 1].x'), ['word:tab', 'punct:[', 'string:"NR"', 'punct:,', 'number:1', 'punct:]', 'punct:.', 'word:x']);
});

test('"//" is two division operators, not a comment', () => {
  assert.deepEqual(kinds('LET a 1 // b'), ['word:LET', 'word:a', 'number:1', 'operator:/', 'operator:/', 'word:b']);
});

test('accented identifiers', () => {
  assert.deepEqual(kinds('créer_environnement "x"'), ['word:créer_environnement', 'string:"x"']);
});
