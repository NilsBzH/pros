// Quick fixes for the issues found by the document analysis, independent from the VS Code API.
import { INVALID_FORMS, Issue } from './document';
import { keywordForm } from '../data/reference';

export interface TextChange {
  start: number;
  end: number;
  text: string;
}

export interface QuickFix {
  title: string;
  change: TextChange;
  preferred?: boolean;
}

/** Keyword written in the case of the original word (upper or lower case). */
function sameCase(original: string, keyword: string): string {
  return original === original.toLowerCase() ? keyword.toLowerCase() : keyword;
}

export function quickFixes(text: string, issue: Pick<Issue, 'start' | 'end' | 'code'>): QuickFix[] {
  const word = text.slice(issue.start, issue.end);
  const replace = (title: string, replacement: string, preferred = true): QuickFix =>
    ({ title, change: { start: issue.start, end: issue.end, text: replacement }, preferred });

  switch (issue.code) {
    case 'mixed-case': {
      const upper = word.toUpperCase();
      return [replace(`Change to ${upper}`, upper), replace(`Change to ${upper.toLowerCase()}`, upper.toLowerCase(), false)];
    }
    case 'invalid-form': {
      const valid = INVALID_FORMS[keywordForm(word) ?? ''];
      return valid ? [replace(`Change to ${sameCase(word, valid)}`, sameCase(word, valid))] : [];
    }
    case 'brc-header':
      return [replace(`Change to ${sameCase(word, 'DEFINE')}`, sameCase(word, 'DEFINE'))];
    case 'line-comment': {
      // "// text" up to the end of the line becomes "/* text */".
      let end = text.indexOf('\n', issue.end);
      end = end === -1 ? text.length : end;
      if (text[end - 1] === '\r') {
        end--;
      }
      const comment = text.slice(issue.end, end).trim();
      if (comment.includes('*/')) {
        return [];
      }
      const replacement = comment ? `/* ${comment} */` : '/* */';
      return [{ title: 'Convert to a /* … */ comment', change: { start: issue.start, end, text: replacement }, preferred: true }];
    }
    default:
      return [];
  }
}
