import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { applyCase, blockSnippet, callSnippet, caseModeFor, globalSpecs, macroSnippet, methodSpecs } from '../../src/providers/completionItems';
import { lookup, lookupMethods } from '../../src/data/reference';

const spec = (label: string, mode: 'upper' | 'lower' = 'upper') => {
  const found = globalSpecs(mode).find(s => s.label === label);
  assert.ok(found, `no completion item ${label}`);
  return found;
};

test('no duplicate label in the completion list (both cases, confML methods)', () => {
  for (const labels of [globalSpecs('upper'), globalSpecs('lower'), methodSpecs('confML')].map(specs => specs.map(s => s.label))) {
    const duplicates = labels.filter((label, i) => labels.indexOf(label) !== i);
    assert.deepEqual(duplicates, []);
  }
});

test('one item per block keyword form, English and French', () => {
  for (const keyword of ['DEFINE', 'DEFINITION', 'IF', 'SI', 'ELSE_IF', 'SINON_SI', 'ELSE', 'SINON', 'WHILE', 'TANT_QUE', 'REPEAT', 'REPETER']) {
    assert.equal(globalSpecs('upper').filter(s => s.label === keyword).length, 1, keyword);
    assert.equal(spec(keyword).kind, 'block', keyword);
  }
});

test('case of the typed prefix: lower case only when the prefix is all lower case', () => {
  assert.equal(caseModeFor(''), 'upper');
  assert.equal(caseModeFor('i'), 'lower');
  assert.equal(caseModeFor('tant_q'), 'lower');
  assert.equal(caseModeFor('I'), 'upper');
  assert.equal(caseModeFor('If'), 'upper');
  assert.equal(caseModeFor('_'), 'upper');
  assert.equal(applyCase('END_IF', 'lower'), 'end_if');
  assert.equal(applyCase('IsDefined', 'lower'), 'IsDefined');
});

test('no keyword is ever generated in mixed case', () => {
  for (const mode of ['upper', 'lower'] as const) {
    for (const s of globalSpecs(mode)) {
      const exact = s.entry && (s.label === s.entry.name || (s.entry.synonyms ?? []).includes(s.label));
      const uniform = s.label === s.label.toUpperCase() || s.label === s.label.toLowerCase();
      assert.ok(exact || uniform, `${s.label} (${mode})`);
      for (const word of s.snippet.replace(/\$\{\d+:[^}]*\}/g, '').match(/[A-Za-z_]+/g) ?? []) {
        const keyword = lookup(word.toUpperCase());
        if (keyword && keyword.name === keyword.name.toUpperCase() && word !== word.toUpperCase()) {
          assert.equal(word, word.toLowerCase(), `${word} in ${s.snippet}`);
        }
      }
    }
  }
});

test('blocks: closing keyword, fields and final cursor', () => {
  assert.equal(blockSnippet('IF', 'upper'), 'IF ${1:condition}\n\t$0\nEND_IF');
  assert.equal(blockSnippet('IF', 'lower'), 'if ${1:condition}\n\t$0\nend_if');
  assert.equal(blockSnippet('SI', 'upper'), 'SI ${1:condition}\n\t$0\nFIN_SI');
  assert.equal(blockSnippet('ELSE_IF', 'upper'), 'ELSE_IF ${1:condition}\n\t$0');
  assert.equal(blockSnippet('SINON', 'lower'), 'sinon\n\t$0');
  assert.equal(blockSnippet('WHILE', 'upper'), 'WHILE ${1:condition}\n\t$0\nEND_WHILE');
  assert.equal(blockSnippet('TANT_QUE', 'lower'), 'tant_que ${1:condition}\n\t$0\nfin_tant_que');
  assert.equal(blockSnippet('REPEAT', 'upper'), 'REPEAT\n\t$1\nUNTIL (${2:condition})$0');
  assert.equal(blockSnippet('REPETER', 'upper'), 'REPETER\n\t$1\nJUSQU_A (${2:condition})$0');
  assert.equal(blockSnippet('DEFINE', 'upper'), 'DEFINE ${1:name}(${2})\n$0\nEND_DEFINE');
  assert.equal(blockSnippet('DEFINITION', 'lower'), 'definition ${1:name}(${2})\n$0\nfin_definition');
  assert.equal(spec('END_IF').snippet, 'END_IF');
  assert.equal(spec('fin_si', 'lower').snippet, 'fin_si');
});

test('calls with parentheses insert the name and the parentheses only, then open the signature help', () => {
  assert.equal(spec('Lpad').snippet, 'Lpad($0)');
  assert.equal(spec('IsDefined', 'lower').snippet, 'IsDefined($0)');
  assert.equal(spec('sum_if').snippet, 'sum_if($0)');
  assert.equal(spec('opLike').snippet, 'opLike($0)');
  assert.equal(spec('ACDate').snippet, 'ACDate($0)');
  assert.equal(spec('LinkedHashMap').snippet, 'LinkedHashMap()');
  assert.equal(spec('SqlCloseCreatedPools').snippet, 'SqlCloseCreatedPools()');
  assert.equal(spec('Lpad').signatureHelp, true);
  assert.equal(spec('LinkedHashMap').signatureHelp, false);
  assert.equal(callSnippet(lookupMethods('getObjectByCPE', 'confML')[0], 'getObjectByCPE', 'upper'), 'getObjectByCPE($0)');
  assert.equal(macroSnippet('child', ['p1', 'p2']), 'child($0)');
  assert.equal(macroSnippet('noParam', []), 'noParam()');
});

test('calls without parentheses insert the name and a space only, then open the signature help', () => {
  assert.equal(spec('SUBSTR').snippet, 'SUBSTR ');
  assert.equal(spec('sous_chaine', 'lower').snippet, 'sous_chaine ');
  assert.equal(spec('SQL_QUERY').snippet, 'SQL_QUERY ');
  assert.equal(spec('LET').snippet, 'LET ');
  assert.equal(spec('LIST').snippet, 'LIST ');
  assert.equal(spec('SUBSTR').signatureHelp, true);
  assert.equal(spec('TRACE_OFF').snippet, 'TRACE_OFF');
  assert.equal(spec('TRACE_OFF').signatureHelp, false);
  assert.equal(spec('PI').snippet, 'PI');
  assert.equal(spec('IF').signatureHelp, false);
});

test('multi-line IF variants and #region, found by typing IF, if, SI or si', () => {
  assert.equal(spec('IF … ELSE').snippet, 'IF ${1:condition}\n\t$2\nELSE\n\t$0\nEND_IF');
  assert.equal(spec('IF … ELSE_IF … ELSE').snippet, 'IF ${1:condition}\n\t$2\nELSE_IF ${3:condition}\n\t$4\nELSE\n\t$0\nEND_IF');
  assert.equal(spec('si … sinon', 'lower').snippet, 'si ${1:condition}\n\t$2\nsinon\n\t$0\nfin_si');
  assert.equal(spec('SI … SINON_SI … SINON').snippet, 'SI ${1:condition}\n\t$2\nSINON_SI ${3:condition}\n\t$4\nSINON\n\t$0\nFIN_SI');
  assert.equal(spec('#region').snippet, '/*#region:${1:name}*/\n$0\n/*#endregion*/');
  for (const [mode, keyword] of [['upper', 'IF'], ['lower', 'if'], ['upper', 'SI'], ['lower', 'si']] as const) {
    const variants = globalSpecs(mode).filter(s => s.kind === 'block' && s.label.startsWith(`${keyword} …`));
    assert.equal(variants.length, 2, `${keyword}: ${variants.map(v => v.label)}`);
  }
});

test('no block is inserted on a single line', () => {
  for (const s of globalSpecs('upper').filter(s => s.kind === 'block')) {
    for (const line of s.snippet.split('\n')) {
      const words = line.match(/[A-Z_]+/g) ?? [];
      assert.ok(!(words.some(w => ['IF', 'SI'].includes(w)) && words.some(w => ['END_IF', 'FIN_SI'].includes(w))), s.snippet);
    }
  }
});

test('confML methods insert their name and parentheses', () => {
  const methods = new Map(methodSpecs('confML').map(s => [s.label, s.snippet]));
  assert.equal(methods.get('getObjectByCPE'), 'getObjectByCPE($0)');
  assert.equal(methods.get('getDefaultPricingMethods'), 'getDefaultPricingMethods()');
  assert.equal(methods.size, 20);
});

test('excluded entries are never proposed', () => {
  for (const label of ['OPEN_FILE', 'ReadFile', 'EXECUTE', 'SAVE', 'SQL_EXPORT', 'EnableTrace']) {
    assert.equal(globalSpecs('upper').some(s => s.label === label), false, label);
  }
});

test('every generated snippet has well formed fields', () => {
  for (const s of [...globalSpecs('upper'), ...globalSpecs('lower'), ...methodSpecs('confML')]) {
    const opened = (s.snippet.match(/\$\{/g) ?? []).length;
    const fields = (s.snippet.match(/\$\{\d+:[^{}]*\}|\$\{\d+\}/g) ?? []).length;
    assert.equal(fields, opened, s.snippet);
    const numbers = [...s.snippet.matchAll(/\$\{?(\d+)/g)].map(m => Number(m[1])).filter(n => n > 0);
    assert.deepEqual([...new Set(numbers)].sort((a, b) => a - b), numbers.length ? Array.from({ length: Math.max(...numbers) }, (_, i) => i + 1) : [], s.snippet);
  }
});
