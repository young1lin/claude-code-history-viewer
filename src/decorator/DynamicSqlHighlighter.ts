// DynamicSqlHighlighter - Highlights SQL keywords in text while respecting comments
//
// This module provides functionality to highlight SQL keywords in mixed content
// (e.g., MyBatis XML files) while properly excluding content within comments.
//
// Supported comment types:
// - HTML/XML comments: <!-- ... -->
// - SQL single-line comments: -- ...
// - SQL multi-line comments: /* ... */

// Configuration for SQL keyword highlighting
interface HighlightConfig {
  highlightClass?: string; // CSS class to apply to highlighted keywords
  customHighlight?: (keyword: string) => string; // Custom highlight function
}

// SQL keywords to highlight (case-insensitive)
const SQL_KEYWORDS = [
  // DML (Data Manipulation Language)
  'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE',
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS',
  'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN',
  'LIKE', 'IS', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING',
  'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT',
  // DDL (Data Definition Language)
  'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW',
  'DATABASE', 'SCHEMA', 'CONSTRAINT', 'PRIMARY', 'FOREIGN',
  'KEY', 'REFERENCES', 'UNIQUE', 'CHECK', 'DEFAULT',
  // DCL (Data Control Language)
  'GRANT', 'REVOKE',
  // TCL (Transaction Control Language)
  'COMMIT', 'ROLLBACK', 'SAVEPOINT',
  // Other common keywords
  'SET', 'VALUES', 'INTO', 'CASE', 'WHEN', 'THEN', 'ELSE',
  'END', 'WITH', 'RECURSIVE', 'RETURN', 'RETURNING'
];

// Represents a text segment with its type
interface TextSegment {
  content: string;
  type: 'code' | 'comment';
  startIndex: number;
  endIndex: number;
}

// Extracts all comment regions from the text
function extractCommentRegions(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Pattern for HTML/XML comments: <!-- ... -->
  const xmlCommentPattern = /<!--[\s\S]*?-->/g;
  // Pattern for SQL multi-line comments: /* ... */
  const sqlMultiLineCommentPattern = /\/\*[\s\S]*?\*\//g;
  // Pattern for SQL single-line comments: -- ... (until newline)
  const sqlSingleLineCommentPattern = /--[^\n]*/g;

  // Extract XML/HTML comments first (highest priority)
  let match;
  while ((match = xmlCommentPattern.exec(text)) !== null) {
    segments.push({
      content: match[0],
      type: 'comment',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Extract SQL multi-line comments
  while ((match = sqlMultiLineCommentPattern.exec(text)) !== null) {
    segments.push({
      content: match[0],
      type: 'comment',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Extract SQL single-line comments
  while ((match = sqlSingleLineCommentPattern.exec(text)) !== null) {
    segments.push({
      content: match[0],
      type: 'comment',
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }

  // Sort by start index
  segments.sort((a, b) => a.startIndex - b.startIndex);

  // Remove overlapping segments (keep the first one in sorted order)
  const nonOverlapping: TextSegment[] = [];
  for (const segment of segments) {
    const hasOverlap = nonOverlapping.some(
      existing =>
        (segment.startIndex >= existing.startIndex && segment.startIndex < existing.endIndex) ||
        (segment.endIndex > existing.startIndex && segment.endIndex <= existing.endIndex) ||
        (segment.startIndex <= existing.startIndex && segment.endIndex >= existing.endIndex)
    );
    if (!hasOverlap) {
      nonOverlapping.push(segment);
    }
  }

  return nonOverlapping;
}

// Splits text into code and comment segments
function segmentText(text: string): TextSegment[] {
  const commentSegments = extractCommentRegions(text);
  const allSegments: TextSegment[] = [];
  let currentIndex = 0;

  for (const comment of commentSegments) {
    // Add code segment before comment (if any)
    if (currentIndex < comment.startIndex) {
      allSegments.push({
        content: text.substring(currentIndex, comment.startIndex),
        type: 'code',
        startIndex: currentIndex,
        endIndex: comment.startIndex
      });
    }
    // Add comment segment
    allSegments.push(comment);
    currentIndex = comment.endIndex;
  }

  // Add remaining code segment (if any)
  if (currentIndex < text.length) {
    allSegments.push({
      content: text.substring(currentIndex),
      type: 'code',
      startIndex: currentIndex,
      endIndex: text.length
    });
  }

  return allSegments;
}

// Highlights SQL keywords in a code segment
function highlightKeywordsInCode(
  codeText: string,
  config: HighlightConfig
): string {
  let result = codeText;

  // Build regex pattern for SQL keywords (word boundaries to match whole words only)
  const keywordPattern = new RegExp(
    `\\b(${SQL_KEYWORDS.join('|')})\\b`,
    'gi'
  );

  if (config.customHighlight) {
    // Use custom highlight function
    result = result.replace(keywordPattern, (match) =>
      config.customHighlight!(match)
    );
  } else {
    // Use CSS class
    const className = config.highlightClass || 'sql-keyword-highlight';
    result = result.replace(keywordPattern, (match) =>
      `<span class="${className}">${match}</span>`
    );
  }

  return result;
}

// Highlights SQL keywords in text while preserving comments
export function highlightSqlKeywords(
  text: string,
  config: HighlightConfig = {}
): string {
  const segments = segmentText(text);

  return segments.map(segment => {
    if (segment.type === 'comment') {
      // Return comment unchanged
      return segment.content;
    } else {
      // Highlight keywords in code segments
      return highlightKeywordsInCode(segment.content, config);
    }
  }).join('');
}

// Checks if a position in text is within a comment
export function isPositionInComment(text: string, position: number): boolean {
  const commentSegments = extractCommentRegions(text);
  return commentSegments.some(
    segment => position >= segment.startIndex && position < segment.endIndex
  );
}

// Export all SQL keywords for external use
export { SQL_KEYWORDS };
