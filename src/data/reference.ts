// Access to the language reference (functions.json): lookup by spelling, methods by receiver.
// Spelling rule: keywords are written all upper or all lower case, so an upper case name also accepts its lower case form; any other name is exact.
import data from './functions.json';

export type EntryKind =
  | 'keyword' | 'command' | 'function' | 'command-function' | 'operator'
  | 'constant' | 'method' | 'class' | 'object';
export type EntryStatus = 'documented' | 'undocumented' | 'legacy' | 'excluded';

export interface Param {
  name: string;
  description: string;
  optional?: boolean;
}

export interface Signature {
  syntax: string;
  params?: Param[];
}

export interface Entry extends Signature {
  name: string;
  synonyms?: string[];
  extraSpellings?: string[];
  kind: EntryKind;
  category: string;
  style: 'space' | 'paren' | 'none';
  overloads?: Signature[];
  returns?: string;
  description: string;
  source: string;
  status: EntryStatus;
  receiver?: string;
  reason?: string;
  replacement?: string;
}

export const entries: Entry[] = (data as { entries: Entry[] }).entries;

/** All accepted spellings of a name: upper case names also accept lower case. */
export function spellingsOf(name: string): string[] {
  return name === name.toUpperCase() && name !== name.toLowerCase() ? [name, name.toLowerCase()] : [name];
}

/** Every spelling of an entry (name, synonyms and their lower case forms, extra spellings). */
export function allSpellings(entry: Entry): string[] {
  const names = [entry.name, ...(entry.synonyms ?? [])].flatMap(spellingsOf);
  return [...names, ...(entry.extraSpellings ?? [])];
}

const globalIndex = new Map<string, Entry>();
const methodIndex = new Map<string, Entry[]>();

for (const entry of entries) {
  if (entry.receiver) {
    const list = methodIndex.get(entry.name) ?? [];
    list.push(entry);
    methodIndex.set(entry.name, list);
    continue;
  }
  for (const spelling of allSpellings(entry)) {
    if (!globalIndex.has(spelling)) {
      globalIndex.set(spelling, entry);
    }
  }
}

/** Entry for a word used outside a member access (keyword, function, constant, class). */
export function lookup(word: string): Entry | undefined {
  return globalIndex.get(word);
}

/** Methods named `name`, optionally restricted to a receiver (confML, ACDate…). */
export function lookupMethods(name: string, receiver?: string): Entry[] {
  const list = methodIndex.get(name) ?? [];
  return receiver ? list.filter(e => e.receiver === receiver) : list;
}

export function methodsOf(receiver: string): Entry[] {
  return entries.filter(e => e.receiver === receiver);
}

/** Upper case form of a keyword written all upper or all lower case; undefined for mixed case. */
export function keywordForm(word: string): string | undefined {
  if (word === word.toUpperCase()) {
    return word;
  }
  if (word === word.toLowerCase()) {
    return word.toUpperCase();
  }
  return undefined;
}

/** Spellings that exist only as upper case names, used to detect mixed case keywords (Display). */
const upperCaseNames = new Map<string, Entry>();
for (const entry of entries) {
  if (entry.receiver) {
    continue;
  }
  for (const name of [entry.name, ...(entry.synonyms ?? [])]) {
    if (name === name.toUpperCase() && name !== name.toLowerCase()) {
      upperCaseNames.set(name, entry);
    }
  }
}

/** Entry whose upper case name matches a mixed case word (e.g. "Display" → DISPLAY). */
export function mixedCaseMatch(word: string): { entry: Entry; upper: string } | undefined {
  if (keywordForm(word) !== undefined) {
    return undefined;
  }
  const upper = word.toUpperCase();
  const entry = upperCaseNames.get(upper);
  return entry ? { entry, upper } : undefined;
}
