import { useAppStore } from "../store/useAppStore";
import { FileText, Clock, MessageSquare } from "lucide-react";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";
import { SearchResult } from "../types";
import { highlightSearchTerms } from "../utils/searchHighlight";

interface SearchResultItemProps {
  result: SearchResult;
  searchQuery: string;
  onSelect: (result: SearchResult) => void;
}

function SearchResultItem({ result, searchQuery, onSelect }: SearchResultItemProps) {
  const highlightedContent = highlightSearchTerms(result.content, searchQuery);

  return (
    <div
      onClick={() => onSelect(result)}
      className={cn(
        "p-4 border-b cursor-pointer transition-colors",
        COLORS.ui.border.light,
        "hover:bg-gray-50 dark:hover:bg-gray-800/50"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <MessageSquare className={cn("w-4 h-4", COLORS.ui.text.muted)} />
          <span className={cn("text-sm font-medium", COLORS.ui.text.primary)}>
            {result.message_type === "user" ? "User" : "Assistant"}
          </span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <Clock className={cn("w-3 h-3", COLORS.ui.text.muted)} />
          <span className={cn(COLORS.ui.text.muted)}>
            {new Date(result.timestamp).toLocaleString()}
          </span>
        </div>
      </div>

      <div
        className={cn("text-sm mb-2 line-clamp-3", COLORS.ui.text.secondary)}
        dangerouslySetInnerHTML={{ __html: highlightedContent }}
      />

      <div className="flex items-center space-x-2 text-xs">
        <FileText className={cn("w-3 h-3", COLORS.ui.text.muted)} />
        <span className={cn(COLORS.ui.text.muted, "truncate")}>
          {result.file_path.split("/").pop()} • Line {result.line_number}
        </span>
      </div>
    </div>
  );
}

export function SearchResults() {
  const {
    fuzzySearchResults,
    searchQuery,
    isSearching,
    isSearchPanelOpen,
    selectSession,
    sessions,
  } = useAppStore();

  const handleSelectResult = async (result: SearchResult) => {
    // Find the session that contains this result
    const session = sessions.find((s) => s.file_path === result.file_path);
    if (session) {
      await selectSession(session);
      // TODO: Scroll to the specific message with UUID
    }
  };

  if (!isSearchPanelOpen || isSearching) {
    return null;
  }

  if (searchQuery && fuzzySearchResults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <MessageSquare className={cn("w-16 h-16 mb-4", COLORS.ui.text.disabledDark)} />
        <p className={cn("text-lg", COLORS.ui.text.secondary)}>
          No results found for "{searchQuery}"
        </p>
        <p className={cn("text-sm mt-2", COLORS.ui.text.muted)}>
          Try different keywords or build the search index
        </p>
      </div>
    );
  }

  if (fuzzySearchResults.length === 0) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className={cn("divide-y", COLORS.ui.border.light)}>
        {fuzzySearchResults.map((result) => (
          <SearchResultItem
            key={`${result.file_path}-${result.line_number}`}
            result={result}
            searchQuery={searchQuery}
            onSelect={handleSelectResult}
          />
        ))}
      </div>
    </div>
  );
}
