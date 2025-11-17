import { describe, it, expect } from 'vitest';
import {
  highlightSqlKeywords,
  isPositionInComment,
} from './DynamicSqlHighlighter';

describe('DynamicSqlHighlighter', () => {
  describe('highlightSqlKeywords', () => {
    it('should highlight SQL keywords in plain text', () => {
      const input = 'SELECT * FROM users WHERE id = 1';
      const result = highlightSqlKeywords(input);

      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">FROM</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">WHERE</span>');
    });

    it('should NOT highlight SQL keywords inside HTML/XML comments', () => {
      const input = '<!-- SELECT * FROM users -->';
      const result = highlightSqlKeywords(input);

      // The entire comment should be unchanged
      expect(result).toBe(input);
      // Should not contain any highlight spans
      expect(result).not.toContain('<span class="sql-keyword-highlight">');
    });

    it('should NOT highlight SQL keywords inside multi-line HTML/XML comments', () => {
      const input = `<!-- <select id="listAll" resultMap="RoleResultMap">
        SELECT
        <include refid="BaseColumns" />
        FROM
        \`role\`
    </select> -->`;

      const result = highlightSqlKeywords(input);

      // The entire comment should be unchanged
      expect(result).toBe(input);
      // Should not contain any highlight spans
      expect(result).not.toContain('<span class="sql-keyword-highlight">');
    });

    it('should highlight SQL keywords outside comments but not inside', () => {
      const input = `SELECT * FROM users
<!-- SELECT * FROM ignored -->
WHERE id = 1`;

      const result = highlightSqlKeywords(input);

      // Should highlight keywords outside comment
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">FROM</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">WHERE</span>');

      // Comment should remain unchanged
      expect(result).toContain('<!-- SELECT * FROM ignored -->');
    });

    it('should NOT highlight SQL keywords inside SQL single-line comments', () => {
      const input = `SELECT * FROM users
-- This is a comment with SELECT and FROM
WHERE id = 1`;

      const result = highlightSqlKeywords(input);

      // Should highlight keywords outside comment
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">WHERE</span>');

      // Comment line should remain unchanged (no highlights within it)
      const lines = result.split('\n');
      expect(lines[1]).toBe('-- This is a comment with SELECT and FROM');
    });

    it('should NOT highlight SQL keywords inside SQL multi-line comments', () => {
      const input = `SELECT * FROM users
/* This is a multi-line comment
   with SELECT and FROM keywords
   that should not be highlighted */
WHERE id = 1`;

      const result = highlightSqlKeywords(input);

      // Should highlight keywords outside comment
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">WHERE</span>');

      // Comment should remain unchanged
      expect(result).toContain('/* This is a multi-line comment');
      expect(result).toContain('   with SELECT and FROM keywords');
    });

    it('should handle multiple comment types in the same text', () => {
      const input = `SELECT * FROM users
<!-- HTML comment with SELECT -->
-- SQL comment with FROM
/* Multi-line comment
   with WHERE */
WHERE id = 1`;

      const result = highlightSqlKeywords(input);

      // Should highlight only the first SELECT and last WHERE
      const selectMatches = result.match(/<span class="sql-keyword-highlight">SELECT<\/span>/g);
      expect(selectMatches).toHaveLength(1);

      const whereMatches = result.match(/<span class="sql-keyword-highlight">WHERE<\/span>/g);
      expect(whereMatches).toHaveLength(1);

      // All comments should remain unchanged
      expect(result).toContain('<!-- HTML comment with SELECT -->');
      expect(result).toContain('-- SQL comment with FROM');
      expect(result).toContain('/* Multi-line comment');
    });

    it('should use custom CSS class when provided', () => {
      const input = 'SELECT * FROM users';
      const result = highlightSqlKeywords(input, {
        highlightClass: 'custom-highlight'
      });

      expect(result).toContain('<span class="custom-highlight">SELECT</span>');
      expect(result).toContain('<span class="custom-highlight">FROM</span>');
      expect(result).not.toContain('sql-keyword-highlight');
    });

    it('should use custom highlight function when provided', () => {
      const input = 'SELECT * FROM users';
      const result = highlightSqlKeywords(input, {
        customHighlight: (keyword) => `**${keyword}**`
      });

      expect(result).toContain('**SELECT**');
      expect(result).toContain('**FROM**');
      expect(result).not.toContain('<span');
    });

    it('should preserve case of SQL keywords', () => {
      const input = 'select * from Users WHERE id = 1';
      const result = highlightSqlKeywords(input);

      expect(result).toContain('<span class="sql-keyword-highlight">select</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">from</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">WHERE</span>');
    });

    it('should only highlight whole words, not partial matches', () => {
      const input = 'SELECTED items fromage SELECT FROM';
      const result = highlightSqlKeywords(input);

      // Should NOT highlight partial matches
      expect(result).toContain('SELECTED');
      expect(result).toContain('fromage');

      // Should highlight complete words
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">FROM</span>');
    });

    it('should handle empty string', () => {
      const input = '';
      const result = highlightSqlKeywords(input);
      expect(result).toBe('');
    });

    it('should handle text with no SQL keywords', () => {
      const input = 'This is just regular text without any keywords';
      const result = highlightSqlKeywords(input);
      expect(result).toBe(input);
    });

    it('should handle nested comment-like patterns correctly', () => {
      // Test case where comment syntax appears but isn't actually a comment
      const input = 'SELECT "<!--" AS comment_text FROM users';
      const result = highlightSqlKeywords(input);

      // Keywords should still be highlighted since the <!-- is in a string
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">FROM</span>');
    });

    it('should handle the exact MyBatis example from the issue', () => {
      const input = `    <!-- <select id="listAll" resultMap="RoleResultMap">
        SELECT
        <include refid="BaseColumns" />
        FROM
        \`role\`
    </select> -->`;

      const result = highlightSqlKeywords(input);

      // The entire XML comment should remain unchanged
      expect(result).toBe(input);

      // Should NOT contain any highlight spans for SELECT or FROM
      expect(result).not.toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).not.toContain('<span class="sql-keyword-highlight">FROM</span>');
    });

    it('should highlight keywords when comment is removed', () => {
      const input = `    <select id="listAll" resultMap="RoleResultMap">
        SELECT
        <include refid="BaseColumns" />
        FROM
        \`role\`
    </select>`;

      const result = highlightSqlKeywords(input);

      // Now keywords should be highlighted
      expect(result).toContain('<span class="sql-keyword-highlight">SELECT</span>');
      expect(result).toContain('<span class="sql-keyword-highlight">FROM</span>');
    });
  });

  describe('isPositionInComment', () => {
    it('should return true for position inside HTML comment', () => {
      const text = 'SELECT <!-- comment --> FROM users';
      const commentStart = text.indexOf('<!--');
      const commentEnd = text.indexOf('-->') + 3;

      expect(isPositionInComment(text, commentStart + 5)).toBe(true);
      expect(isPositionInComment(text, commentEnd - 1)).toBe(true);
    });

    it('should return false for position outside comment', () => {
      const text = 'SELECT <!-- comment --> FROM users';
      const commentStart = text.indexOf('<!--');

      expect(isPositionInComment(text, 0)).toBe(false);
      expect(isPositionInComment(text, commentStart - 1)).toBe(false);
      expect(isPositionInComment(text, text.length - 1)).toBe(false);
    });

    it('should return true for position inside SQL single-line comment', () => {
      const text = 'SELECT * -- comment\\nFROM users';
      const commentStart = text.indexOf('--');

      expect(isPositionInComment(text, commentStart + 5)).toBe(true);
    });

    it('should return true for position inside SQL multi-line comment', () => {
      const text = 'SELECT /* comment */ FROM users';
      const commentStart = text.indexOf('/*');

      expect(isPositionInComment(text, commentStart + 5)).toBe(true);
    });

    it('should handle multiple comments correctly', () => {
      const text = 'SELECT <!-- c1 --> * -- c2\\nFROM /* c3 */ users';

      const c1Start = text.indexOf('<!-- c1 -->');
      expect(isPositionInComment(text, c1Start + 5)).toBe(true);

      const c2Start = text.indexOf('-- c2');
      expect(isPositionInComment(text, c2Start + 3)).toBe(true);

      const c3Start = text.indexOf('/* c3 */');
      expect(isPositionInComment(text, c3Start + 3)).toBe(true);

      // Position between comments should be false
      const betweenPos = text.indexOf('*') - 1;
      expect(isPositionInComment(text, betweenPos)).toBe(false);
    });
  });
});
