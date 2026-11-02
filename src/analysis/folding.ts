// Folding ranges, independent from the VS Code API: blocks (each IF branch on its own), regions and multi-line comments.
import { Analysis, REGION_END, REGION_START } from './document';
import { Token } from './lexer';

export interface Fold {
  /** First and last folded lines (0-based); the first one stays visible. */
  start: number;
  end: number;
  kind?: 'comment' | 'region';
}

function lastLine(token: Token): number {
  return token.line + token.text.split('\n').length - 1;
}

export function foldingRanges(analysis: Analysis): Fold[] {
  const folds: Fold[] = [];

  // DEFINE … END_DEFINE, WHILE … END_WHILE, REPEAT … UNTIL; IF … ELSE_IF … ELSE … END_IF folds per branch.
  // The closing line stays visible.
  for (const block of analysis.blocks) {
    if (!block.close) {
      continue;
    }
    const bounds = [block.open, ...block.branches, block.close];
    for (let i = 0; i + 1 < bounds.length; i++) {
      const start = bounds[i].line;
      const end = bounds[i + 1].line - 1;
      if (end > start) {
        folds.push({ start, end });
      }
    }
  }

  for (const region of analysis.regions) {
    if (region.end && region.end.line > region.start.line) {
      folds.push({ start: region.start.line, end: region.end.line, kind: 'region' });
    }
  }

  for (const token of analysis.tokens) {
    if (token.kind === 'comment' && !REGION_START.test(token.text) && !REGION_END.test(token.text) && lastLine(token) > token.line) {
      folds.push({ start: token.line, end: lastLine(token), kind: 'comment' });
    }
  }

  return folds.sort((a, b) => a.start - b.start || b.end - a.end);
}
