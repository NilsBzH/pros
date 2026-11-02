// Parameter name hints for calls without parentheses (SUBSTR s start: 2 length: 3), independent from the VS Code API.
import { Analysis } from './document';
import { Token } from './lexer';
import { signaturesOf, spaceAssignment, spaceCalls } from './calls';

/** none: no hint; literals: before numbers and strings only; all: before every argument. */
export type HintMode = 'none' | 'literals' | 'all';

export interface ParameterHint {
  /** The hint is shown before this token. */
  token: Token;
  label: string;
}

/** LET name value, LOCAL name value (SOIT is a synonym of LET): the declared name needs no hint. */
const DECLARATIONS = new Set(['LET', 'LOCAL']);

function isLiteral(item: Token[]): boolean {
  const value = item[0]?.text === '-' ? item.slice(1) : item;
  return value.length === 1 && (value[0].kind === 'number' || value[0].kind === 'string');
}

export function parameterHints(analysis: Analysis, mode: HintMode): ParameterHint[] {
  if (mode === 'none') {
    return [];
  }
  const hints: ParameterHint[] = [];
  for (const call of spaceCalls(analysis.code)) {
    if (DECLARATIONS.has(call.entry.name)) {
      continue;
    }
    const signatures = signaturesOf(call.entry);
    const assignments = signatures.map(s => spaceAssignment(s, call.items));
    const active = Math.max(0, assignments.findIndex(a => a.fits));
    const signature = signatures[active];
    // With a single parameter, the name adds nothing (STR x, DISPLAY "text").
    if (signature.parts.filter(p => p.kind !== 'literal').length < 2) {
      continue;
    }
    assignments[active].parts.forEach((part, i) => {
      const item = call.items[i];
      const param = part.kind === 'param' && part.param !== undefined ? signature.params[part.param] : undefined;
      if (!param || (mode === 'literals' && !isLiteral(item)) || (item.length === 1 && item[0].text === param.name)) {
        return;
      }
      hints.push({ token: item[0], label: `${param.name}:` });
    });
  }
  return hints;
}
