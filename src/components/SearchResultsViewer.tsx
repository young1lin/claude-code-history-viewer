import type { SearchResult } from "@/types";
import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { Clock, FileText, Folder, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SearchResultsViewerProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  onResultClick: (result: SearchResult) => void;
}

export function SearchResultsViewer({
  results,
  query,
  isLoading,
  onResultClick,
}: SearchResultsViewerProps) {
  const { t } = useTranslation("components");

  // Highlight search keywords
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    // Remove FTS5 operators
    const cleanQuery = query
      .replace(/\*/g, "")
      .replace(/"/g, "")
      .replace(/ AND | OR | NOT /gi, " ")
      .trim();

    const words = cleanQuery.split(/\s+/);
    let highlightedText = text;

    words.forEach((word) => {
      if (word.length > 0) {
        const regex = new RegExp(`(${word})`, "gi");
        highlightedText = highlightedText.replace(
          regex,
          '<mark class="bg-yellow-200 dark:bg-yellow-600">$1</mark>'
        );
      }
    });

    return highlightedText;
  };

  // Extract content snippet for display
  const getContentSnippet = (content: string, maxLength = 200) => {
    if (content.length <= maxLength) return content;

    // Try to find keyword position and show surrounding content
    const cleanQuery = query
      .replace(/\*/g, "")
      .replace(/"/g, "")
      .replace(/ AND | OR | NOT /gi, " ")
      .trim();

    const firstWord = cleanQuery.split(/\s+/)[0];
    if (!firstWord) return content.slice(0, maxLength) + "...";

    const index = content.toLowerCase().indexOf(firstWord.toLowerCase());

    if (index !== -1) {
      const start = Math.max(0, index - 50);
      const end = Math.min(content.length, index + maxLength - 50);
      const snippet = content.slice(start, end);
      return (start > 0 ? "..." : "") + snippet + (end < content.length ? "..." : "");
    }

    return content.slice(0, maxLength) + "...";
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={cn("text-center", COLORS.ui.text.muted)}>
          <MessageSquare className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p>{t("search.searching")}</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className={cn("text-center", COLORS.ui.text.muted)}>
          <MessageSquare className="w-12 h-12 mx-auto mb-4" />
          <p>
            {query
              ? t("search.noResults", { query })
              : t("search.noQuery")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4">
        <h3 className={cn("text-lg font-semibold", COLORS.ui.text.primary)}>
          {t("search.foundResults", { count: results.length })}
        </h3>
        <p className={cn("text-sm mt-1", COLORS.ui.text.muted)}>
          {t("search.searchQuery", { query })}
        </p>
      </div>

      <div className="space-y-4">
        {results.map((result, index) => {
          const snippet = getContentSnippet(result.content);
          const highlightedSnippet = highlightText(snippet, query);

          return (
            <div
              key={`${result.uuid}-${index}`}
              onClick={() => onResultClick(result)}
              className={cn(
                "p-4 rounded-lg border cursor-pointer transition-all",
                "hover:shadow-md hover:border-blue-400",
                COLORS.ui.background.secondary,
                COLORS.ui.border.light
              )}
            >
              {/* Project and session info */}
              <div className="flex items-center gap-2 mb-2 text-sm">
                <Folder className="w-4 h-4" />
                <span className={cn("font-medium", COLORS.ui.text.primary)}>
                  {result.project_name}
                </span>
                <span className={cn(COLORS.ui.text.muted)}>•</span>
                <FileText className="w-4 h-4" />
                <span className={cn(COLORS.ui.text.secondary)}>
                  {result.message_type === "user"
                    ? t("search.user")
                    : t("search.assistant")}
                </span>
              </div>

              {/* Content snippet */}
              <div
                className={cn(
                  "mb-2 line-clamp-3",
                  COLORS.ui.text.primary
                )}
                dangerouslySetInnerHTML={{ __html: highlightedSnippet }}
              />

              {/* Timestamp */}
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-3 h-3" />
                <span className={cn(COLORS.ui.text.muted)}>
                  {formatTime(result.timestamp)}
                </span>
                <span className={cn("ml-auto", COLORS.ui.text.muted)}>
                  {t("search.relevance", { rank: result.rank.toFixed(2) })}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
