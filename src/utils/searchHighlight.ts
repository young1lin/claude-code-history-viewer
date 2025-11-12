/**
 * Highlight search terms in text content
 * Supports multilingual fuzzy matching
 */
export function highlightSearchTerms(content: string, searchQuery: string): string {
  if (!searchQuery.trim() || !content) {
    return escapeHtml(content);
  }

  // Split query into tokens (words)
  const tokens = searchQuery
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => escapeRegExp(t));

  if (tokens.length === 0) {
    return escapeHtml(content);
  }

  // Create regex pattern that matches any of the tokens (case-insensitive)
  const pattern = new RegExp(`(${tokens.join("|")})`, "gi");

  // Escape HTML and highlight matches
  const escapedContent = escapeHtml(content);
  const highlighted = escapedContent.replace(pattern, (match) => {
    return `<mark class="bg-yellow-200 dark:bg-yellow-800 text-gray-900 dark:text-gray-100 font-medium">${match}</mark>`;
  });

  return highlighted;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get snippet around matched term with context
 */
export function getSearchSnippet(
  content: string,
  searchQuery: string,
  contextLength = 100
): string {
  if (!searchQuery.trim()) {
    return content.slice(0, contextLength * 2) + "...";
  }

  const tokens = searchQuery.trim().split(/\s+/);
  const pattern = new RegExp(tokens.map(escapeRegExp).join("|"), "i");
  const match = content.match(pattern);

  if (!match) {
    return content.slice(0, contextLength * 2) + "...";
  }

  const matchIndex = match.index || 0;
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(content.length, matchIndex + match[0].length + contextLength);

  let snippet = content.slice(start, end);

  if (start > 0) {
    snippet = "..." + snippet;
  }
  if (end < content.length) {
    snippet = snippet + "...";
  }

  return snippet;
}
