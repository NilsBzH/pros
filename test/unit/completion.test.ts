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
  assert.equal(blockSnippet('DEFINE', 'upper'), 'DEFINE ${1:nom}(${2})\n$0\nEND_DEFINE');
  assert.equal(blockSnippet('DEFINITION', 'lower'), 'definition ${1:nom}(${2})\n$0\nfin_definition');
  assert.equal(spec('END_IF').snippet, 'END_IF');
  assert.equal(spec('fin_si', 'lower').snippet, 'fin_si');
});

test('calls with parentheses: one field per parameter', () => {
  assert.equal(spec('Lpad').snippet, 'Lpad(${1:string}, ${2:lengthString}, ${3:append})');
  assert.equal(spec('IsDefined', 'lower').snippet, 'IsDefined(${1:expr})');
  assert.equal(spec('DecimalRound').snippet, 'DecimalRound(${1:decimals}, ${2:value})');
  assert.equal(spec('sum_if').snippet, 'sum_if("${1:tab1}", ${2:cond}, "${3:tab2}", "${4:result}")');
  assert.equal(spec('ACDate').snippet, 'ACDate()');
  assert.equal(spec('opInside').snippet, 'opInside(${1:v1}, ${2:v2})');
  assert.equal(spec('opLike').snippet, 'opLike($1)');
  assert.equal(callSnippet(lookupMethods('getObjectByCPE', 'confML')[0], 'getObjectByCPE', 'upper'), 'getObjectByCPE(${1:cpe})');
  assert.equal(methodSpecs('confML').find(s => s.label === 'getBdtTableName')?.snippet, 'getBdtTableName(${1:bdtName})');
  assert.equal(macroSnippet('child', ['p1', 'p2']), 'child(${1:p1}, ${2:p2})');
});

test('command style calls follow the documented syntax, optional parts get no field', () => {
  assert.equal(spec('FIND_STR').snippet, 'FIND_STR ${1:chaîne} ${2:motif}');
  assert.equal(spec('trouver_chaine', 'lower').snippet, 'trouver_chaine ${1:chaîne} ${2:motif}');
  assert.equal(spec('SQL_QUERY').snippet, 'SQL_QUERY ${1:requête} IN "${2:tableau}"');
  assert.equal(spec('sql_query', 'lower').snippet, 'sql_query ${1:requête} in "${2:tableau}"');
  assert.equal(spec('DELETE').snippet, 'DELETE "${1:nom}"');
  assert.equal(spec('LET').snippet, 'LET ${1:nom} ${2:expression}');
  assert.equal(spec('LOCAL').snippet, 'LOCAL ${1:nom}');
  assert.equal(spec('TRIM').snippet, 'TRIM ${1:expr}');
  assert.equal(spec('TRACE').snippet, 'TRACE ${1:fichier}');
  assert.equal(spec('DISPLAY').snippet, 'DISPLAY ${1:expr}');
  assert.equal(spec('ERROR').snippet, 'ERROR ${1:statut} ${2:message}');
  assert.equal(spec('ATAN2').snippet, 'ATAN2 ${1:y} ${2:x}');
  assert.equal(spec('LIST').snippet, 'LIST');
  assert.equal(spec('TRACE_OFF').snippet, 'TRACE_OFF');
  assert.equal(spec('PI').snippet, 'PI');
});

test('multi-line IF variants and #region, found by typing IF, if, SI or si', () => {
  assert.equal(spec('IF … ELSE').snippet, 'IF ${1:condition}\n\t$2\nELSE\n\t$0\nEND_IF');
  assert.equal(spec('IF … ELSE_IF … ELSE').snippet, 'IF ${1:condition}\n\t$2\nELSE_IF ${3:condition}\n\t$4\nELSE\n\t$0\nEND_IF');
  assert.equal(spec('si … sinon', 'lower').snippet, 'si ${1:condition}\n\t$2\nsinon\n\t$0\nfin_si');
  assert.equal(spec('SI … SINON_SI … SINON').snippet, 'SI ${1:condition}\n\t$2\nSINON_SI ${3:condition}\n\t$4\nSINON\n\t$0\nFIN_SI');
  assert.equal(spec('#region').snippet, '/*#region:${1:nom}*/\n$0\n/*#endregion*/');
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

test('confML methods insert one field per parameter', () => {
  const methods = new Map(methodSpecs('confML').map(s => [s.label, s.snippet]));
  assert.equal(methods.get('getObjectByCPE'), 'getObjectByCPE(${1:cpe})');
  assert.equal(methods.get('raiseBusinessExplanation'), 'raiseBusinessExplanation(${1:message}, ${2:label}, ${3:cpe})');
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
