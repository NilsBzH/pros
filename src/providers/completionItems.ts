// Completion items built from the language reference, independent from the VS Code API.
// Block keywords insert the whole block; functions and commands insert their name only, the signature help does the rest.
import { Entry, EntryKind, entries, lookup, methodsOf } from '../data/reference';

export type CaseMode = 'upper' | 'lower';

export interface CompletionSpec {
  label: string;
  kind: EntryKind | 'block';
  /** VS Code snippet syntax. */
  snippet: string;
  detail: string;
  sortText: string;
  entry?: Entry;
  /** Open the signature help once the item is inserted. */
  signatureHelp?: boolean;
}

/** Lower case when the typed prefix is all lower case, upper case otherwise (keywords are never written in mixed case). */
export function caseModeFor(prefix: string): CaseMode {
  return prefix !== '' && prefix === prefix.toLowerCase() && prefix !== prefix.toUpperCase() ? 'lower' : 'upper';
}

/** Upper case names follow the case mode; other names (IsDefined, confML, sum…) keep their exact spelling. */
export function applyCase(word: string, mode: CaseMode): string {
  const isUpperName = word === word.toUpperCase() && word !== word.toLowerCase();
  return isUpperName && mode === 'lower' ? word.toLowerCase() : word;
}

type Keyword = (word: string) => string;

/** Whole blocks inserted by the block keywords; the macro body stays at the DEFINE level. */
const BLOCKS: Record<string, (k: Keyword) => string> = {
  DEFINE: k => `${k('DEFINE')} \${1:name}(\${2})\n$0\n${k('END_DEFINE')}`,
  DEFINITION: k => `${k('DEFINITION')} \${1:name}(\${2})\n$0\n${k('FIN_DEFINITION')}`,
  IF: k => `${k('IF')} \${1:condition}\n\t$0\n${k('END_IF')}`,
  SI: k => `${k('SI')} \${1:condition}\n\t$0\n${k('FIN_SI')}`,
  ELSE_IF: k => `${k('ELSE_IF')} \${1:condition}\n\t$0`,
  SINON_SI: k => `${k('SINON_SI')} \${1:condition}\n\t$0`,
  ELSE: k => `${k('ELSE')}\n\t$0`,
  SINON: k => `${k('SINON')}\n\t$0`,
  WHILE: k => `${k('WHILE')} \${1:condition}\n\t$0\n${k('END_WHILE')}`,
  TANT_QUE: k => `${k('TANT_QUE')} \${1:condition}\n\t$0\n${k('FIN_TANT_QUE')}`,
  REPEAT: k => `${k('REPEAT')}\n\t$1\n${k('UNTIL')} (\${2:condition})$0`,
  REPETER: k => `${k('REPETER')}\n\t$1\n${k('JUSQU_A')} (\${2:condition})$0`,
  UNTIL: k => `${k('UNTIL')} (\${1:condition})$0`,
  JUSQU_A: k => `${k('JUSQU_A')} (\${1:condition})$0`,
};

export function blockSnippet(keyword: string, mode: CaseMode): string | undefined {
  const block = BLOCKS[keyword];
  return block ? block(word => applyCase(word, mode)) : undefined;
}

/** Multi-line IF blocks with their ELSE parts in place; the label starts with IF/SI so that typing the keyword finds them. */
const BLOCK_VARIANTS: { words: string[]; build: (k: Keyword) => string }[] = [
  { words: ['IF', 'ELSE'], build: k => `${k('IF')} \${1:condition}\n\t$2\n${k('ELSE')}\n\t$0\n${k('END_IF')}` },
  { words: ['IF', 'ELSE_IF', 'ELSE'], build: k => `${k('IF')} \${1:condition}\n\t$2\n${k('ELSE_IF')} \${3:condition}\n\t$4\n${k('ELSE')}\n\t$0\n${k('END_IF')}` },
  { words: ['SI', 'SINON'], build: k => `${k('SI')} \${1:condition}\n\t$2\n${k('SINON')}\n\t$0\n${k('FIN_SI')}` },
  { words: ['SI', 'SINON_SI', 'SINON'], build: k => `${k('SI')} \${1:condition}\n\t$2\n${k('SINON_SI')} \${3:condition}\n\t$4\n${k('SINON')}\n\t$0\n${k('FIN_SI')}` },
];

/** Region markers folded by the editor (language-configuration.json); not a language construct. */
export const REGION_LABEL = '#region';
const REGION_SNIPPET = '/*#region:${1:name}*/\n$0\n/*#endregion*/';

function variantSpecs(mode: CaseMode): CompletionSpec[] {
  const keyword: Keyword = word => applyCase(word, mode);
  const specs: CompletionSpec[] = BLOCK_VARIANTS.map(variant => ({
    label: variant.words.map(keyword).join(' … '),
    kind: 'block',
    snippet: variant.build(keyword),
    detail: `${variant.words.join(' … ')} … ${variant.words[0] === 'IF' ? 'END_IF' : 'FIN_SI'}`,
    sortText: `1${variant.words.join(' ')}`,
    entry: lookup(variant.words[0]),
  }));
  specs.push({ label: REGION_LABEL, kind: 'block', snippet: REGION_SNIPPET, detail: 'foldable region /*#region:name*/ … /*#endregion*/', sortText: '4#region' });
  return specs;
}

/** True when the entry takes arguments: Name(…) with something between the parentheses, or NAME followed by parameters. */
export function takesArguments(entry: Entry): boolean {
  return [entry, ...(entry.overloads ?? [])].some(s => {
    const syntax = entry.receiver ? s.syntax.slice(s.syntax.indexOf('.') + 1) : s.syntax;
    return entry.style === 'paren' ? !/\(\s*\)/.test(syntax) : entry.style === 'space' && /\s\S/.test(syntax.trim());
  });
}

/**
 * Text inserted for a function, command or method: only its name, followed by parentheses (cursor inside)
 * or by a space when it takes arguments. The parameters are then shown by the signature help.
 */
export function callSnippet(entry: Entry, spelling: string, mode: CaseMode): string {
  const name = applyCase(spelling, mode);
  if (entry.style === 'paren') {
    return takesArguments(entry) ? `${name}($0)` : `${name}()`;
  }
  return entry.style === 'space' && takesArguments(entry) ? `${name} ` : name;
}

const SORT: Record<Entry['status'], string> = { documented: '1', undocumented: '2', legacy: '3', excluded: '9' };

function specsOf(entry: Entry, mode: CaseMode): CompletionSpec[] {
  return [entry.name, ...(entry.synonyms ?? [])].map(spelling => {
    const block = blockSnippet(spelling, mode);
    const detail = spelling === entry.name ? entry.syntax : `${entry.syntax}  (synonym of ${entry.name})`;
    return {
      label: applyCase(spelling, mode),
      kind: block ? 'block' : entry.kind,
      snippet: block ?? callSnippet(entry, spelling, mode),
      detail,
      sortText: `${SORT[entry.status]}${spelling}`,
      entry,
      signatureHelp: !block && entry.style !== 'none' && takesArguments(entry),
    };
  });
}

const globalCache = new Map<CaseMode, CompletionSpec[]>();

/** One item per spelling (name and synonyms) of every non excluded global entry, plus the IF variants and #region. */
export function globalSpecs(mode: CaseMode): CompletionSpec[] {
  let specs = globalCache.get(mode);
  if (!specs) {
    specs = [
      ...entries.filter(e => !e.receiver && e.status !== 'excluded').flatMap(e => specsOf(e, mode)),
      ...variantSpecs(mode),
    ];
    globalCache.set(mode, specs);
  }
  return specs;
}

/** Methods of a known receiver (confML). */
export function methodSpecs(receiver: string): CompletionSpec[] {
  return methodsOf(receiver).filter(e => e.status !== 'excluded').flatMap(e => specsOf(e, 'upper'));
}

/** Call of a macro defined in the document: name and parentheses, the cursor inside when it has parameters. */
export function macroSnippet(name: string, params: string[]): string {
  return params.length > 0 ? `${name}($0)` : `${name}()`;
}
