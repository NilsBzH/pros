// Signature help model (label, parameter ranges, documentation, active parameter), independent from the VS Code API.
import { Analysis, MacroInfo } from './document';
import { Entry } from '../data/reference';
import { ParsedSignature, findCall, parenActivity, parenEntry, signaturesOf, spaceActivity } from './calls';

export interface ParameterModel {
  /** Offsets of the parameter in the label. */
  start: number;
  end: number;
  documentation: string;
}

export interface SignatureModel {
  label: string;
  /** Markdown. */
  documentation: string;
  parameters: ParameterModel[];
}

export interface SignatureHelpModel {
  signatures: SignatureModel[];
  activeSignature: number;
  activeParameter: number;
}

function entrySignature(signature: ParsedSignature, entry: Entry): SignatureModel {
  const parameters = signature.parts
    .filter(p => p.param !== undefined)
    .map(p => {
      const param = signature.params[p.param!];
      const optional = p.optional || param?.optional ? '(optional) ' : '';
      return { start: p.start, end: p.end, documentation: `${optional}${param?.description ?? ''}` };
    });
  const returns = entry.returns ? `\n\n**Returns** ${entry.returns}` : '';
  return { label: signature.label, documentation: `${entry.description}${returns}`, parameters };
}

function macroSignature(macro: MacroInfo): SignatureModel {
  let label = `${macro.name}(`;
  const parameters: ParameterModel[] = macro.params.map((p, i) => {
    label += i > 0 ? ', ' : '';
    const start = label.length;
    label += p.text;
    return { start, end: label.length, documentation: '' };
  });
  label += ')';
  return { label, documentation: `Macro defined on line ${macro.start.line + 1}.`, parameters };
}

export function signatureHelpAt(analysis: Analysis, offset: number, line: number): SignatureHelpModel | undefined {
  const call = findCall(analysis.code, offset, line);
  if (!call) {
    return undefined;
  }

  if (call.style === 'space') {
    const signatures = signaturesOf(call.entry);
    const activities = signatures.map(s => spaceActivity(s, call));
    const active = Math.max(0, activities.findIndex(a => a.fits));
    const param = activities[active].param;
    return {
      signatures: signatures.map(s => entrySignature(s, call.entry)),
      activeSignature: active,
      activeParameter: param === -1 ? signatures[active].params.length : param,
    };
  }

  const entry = parenEntry(call);
  if (entry) {
    const signatures = signaturesOf(entry);
    const activities = signatures.map(s => parenActivity(s, call));
    const active = Math.max(0, activities.findIndex(a => a.fits));
    return {
      signatures: signatures.map(s => entrySignature(s, entry)),
      activeSignature: active,
      activeParameter: activities[active].param,
    };
  }

  const macro = call.receiver ? undefined : analysis.macros.find(m => m.name === call.name.text);
  if (!macro) {
    return undefined;
  }
  return { signatures: [macroSignature(macro)], activeSignature: 0, activeParameter: call.argIndex };
}
