import { useState, useEffect } from "react";
import { useAppStore } from "../store/useAppStore";
import { Search, X, Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "../utils/cn";
import { COLORS } from "../constants/colors";

export function SearchPanel() {
  const {
    fuzzySearchResults,
    isSearching,
    searchIndexStats,
    isIndexing,
    indexingStats,
    isSearchPanelOpen,
    initSearchIndex,
    buildSearchIndex,
    searchMessagesFuzzy,
    getSearchIndexStats,
    setSearchPanelOpen,
    clearSearch,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize search index on first open
  useEffect(() => {
    if (isSearchPanelOpen && !isInitialized) {
      initSearchIndex().then(() => {
        getSearchIndexStats();
        setIsInitialized(true);
      });
    }
  }, [isSearchPanelOpen, isInitialized, initSearchIndex, getSearchIndexStats]);

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      await searchMessagesFuzzy(searchQuery);
    }
  };

  const handleClear = () => {
    setSearchQuery("");
    clearSearch();
  };

  const handleClose = () => {
    setSearchPanelOpen(false);
    handleClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    } else if (e.key === "Escape") {
      handleClear();
    }
  };

  if (!isSearchPanelOpen) return null;

  return (
    <div
      className={cn(
        "absolute top-0 left-0 right-0 z-50 shadow-lg border-b",
        COLORS.ui.background.secondary,
        COLORS.ui.border.light
      )}
    >
      <div className="p-4 space-y-4">
        {/* Search Input */}
        <div className="flex items-center space-x-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search messages (支持中文、日本語、한국어、English...)"
              className={cn(
                "w-full px-4 py-2 pl-10 pr-10 rounded-lg border focus:outline-none focus:ring-2",
                COLORS.ui.background.primary,
                COLORS.ui.border.light,
                COLORS.ui.text.primary,
                "focus:ring-claude-500"
              )}
              autoFocus
            />
            <Search
              className={cn(
                "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                COLORS.ui.text.muted
              )}
            />
            {searchQuery && (
              <button
                onClick={handleClear}
                className={cn(
                  "absolute right-3 top-1/2 -translate-y-1/2",
                  COLORS.ui.text.muted,
                  "hover:text-claude-600"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={handleSearch}
            disabled={!searchQuery.trim() || isSearching}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
              "bg-claude-500 text-white hover:bg-claude-600"
            )}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </button>

          <button
            onClick={handleClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              COLORS.ui.text.muted,
              "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Index Stats & Controls */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            {searchIndexStats ? (
              <>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className={cn("w-4 h-4", "text-green-500")} />
                  <span className={cn(COLORS.ui.text.secondary)}>
                    Indexed: {searchIndexStats.total_files.toLocaleString()} files,
                    {" "}{searchIndexStats.total_lines_indexed.toLocaleString()} lines
                  </span>
                </div>
                {indexingStats && (
                  <span className={cn(COLORS.ui.text.muted, "text-xs")}>
                    Last index: {indexingStats.messages_indexed.toLocaleString()} messages in{" "}
                    {indexingStats.duration_ms}ms
                    {indexingStats.files_incrementally_indexed > 0 &&
                      ` (${indexingStats.files_incrementally_indexed} incremental)`
                    }
                  </span>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <AlertCircle className={cn("w-4 h-4", "text-yellow-500")} />
                <span className={cn(COLORS.ui.text.secondary)}>
                  Index not built
                </span>
              </div>
            )}
          </div>

          <button
            onClick={buildSearchIndex}
            disabled={isIndexing}
            className={cn(
              "flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors",
              COLORS.ui.border.light,
              "border",
              "hover:bg-gray-100 dark:hover:bg-gray-800",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isIndexing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span className={cn(COLORS.ui.text.secondary)}>
              {isIndexing ? "Indexing..." : searchIndexStats ? "Rebuild Index" : "Build Index"}
            </span>
          </button>
        </div>

        {/* Results Summary */}
        {fuzzySearchResults.length > 0 && (
          <div className={cn("text-sm", COLORS.ui.text.secondary)}>
            Found {fuzzySearchResults.length} results
          </div>
        )}
      </div>
    </div>
  );
}
