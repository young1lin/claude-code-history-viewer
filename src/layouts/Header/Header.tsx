import {
  Loader2,
  RefreshCw,
  BarChart3,
  MessageSquare,
  Activity,
  Search,
  Database,
  X,
} from "lucide-react";
import { useState } from "react";

import { TooltipButton } from "@/shared/TooltipButton";
import { useAppStore } from "@/store/useAppStore";
import { useAnalytics } from "@/hooks/useAnalytics";

import { cn } from "@/utils/cn";
import { COLORS } from "@/constants/colors";
import { useTranslation } from "react-i18next";
import { SettingDropdown } from "./SettingDropdown";

export const Header = () => {
  const { t } = useTranslation("common");
  const { t: tComponents } = useTranslation("components");
  const { t: tMessages } = useTranslation("messages");

  const {
    selectedProject,
    selectedSession,
    isLoadingMessages,
    refreshCurrentSession,
    syncStatus,
    isSyncing,
    searchMessagesFts,
    clearFtsSearch,
    syncToDatabase,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchInput, setShowSearchInput] = useState(false);

  const {
    actions: analyticsActions,
    computed,
  } = useAnalytics();

  // 토큰 통계 로드
  const handleLoadTokenStats = async () => {
    if (!selectedProject) return;

    try {
      await analyticsActions.switchToTokenStats();
    } catch (error) {
      console.error("Failed to load token stats:", error);
    }
  };

  // 분석 대시보드 로드
  const handleLoadAnalytics = async () => {
    if (!selectedProject) return;

    try {
      await analyticsActions.switchToAnalytics();
    } catch (error) {
      console.error("Failed to load analytics:", error);
      // TODO: 토스트 메시지나 에러 상태 표시
      // toast.error(t("errors.failedToLoadAnalytics"));
    }
  };

  // Handle search
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    await searchMessagesFts(searchQuery);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    clearFtsSearch();
    setShowSearchInput(false);
  };

  // Sync to database
  const handleSync = async () => {
    await syncToDatabase();
  };

  return (
    <header
      className={cn(
        "px-6 py-4 border-b",
        COLORS.ui.background.secondary,
        COLORS.ui.border.light
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <img
            src="/app-icon.png"
            alt="Claude Code History Viewer"
            className="w-10 h-10"
          />
          <div>
            <h1 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
              {t("appName")}
            </h1>
            <p className={cn("text-sm", COLORS.ui.text.muted)}>
              {t("appDescription")}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search input */}
          {showSearchInput ? (
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tComponents("search.searchPlaceholder")}
                className={cn(
                  "px-3 py-1.5 rounded-lg border text-sm w-64",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  COLORS.ui.background.primary,
                  COLORS.ui.border.light,
                  COLORS.ui.text.primary
                )}
                autoFocus
              />
              <TooltipButton
                type="submit"
                content={tComponents("search.searchButton")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  COLORS.ui.interactive.hover
                )}
              >
                <Search className="w-4 h-4" />
              </TooltipButton>
              <TooltipButton
                type="button"
                onClick={handleClearSearch}
                content={tComponents("search.closeButton")}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  COLORS.ui.interactive.hover
                )}
              >
                <X className="w-4 h-4" />
              </TooltipButton>
            </form>
          ) : (
            <>
              {selectedProject && (
                <div className={cn("text-sm", COLORS.ui.text.tertiary)}>
                  <span className="font-medium">{selectedProject.name}</span>
                  {selectedSession && (
                    <>
                      <span className="mx-2">›</span>
                      <span>
                        {tComponents("session.title")}{" "}
                        {selectedSession.session_id.slice(-8)}
                      </span>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex items-center space-x-2">
            {/* Search button */}
            <TooltipButton
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showSearchInput
                  ? COLORS.semantic.info.bgDark
                  : COLORS.ui.interactive.hover
              )}
              content={tComponents("search.searchButton")}
            >
              <Search className={cn("w-5 h-5", COLORS.ui.text.primary)} />
            </TooltipButton>

            {/* Sync button */}
            <TooltipButton
              onClick={handleSync}
              disabled={isSyncing}
              className={cn(
                "p-2 rounded-lg transition-colors relative disabled:opacity-50 disabled:cursor-not-allowed",
                COLORS.ui.interactive.hover
              )}
              content={
                isSyncing
                  ? tComponents("search.syncing")
                  : syncStatus?.needs_sync
                  ? tComponents("search.needsSync", {
                      count: syncStatus.total_messages,
                    })
                  : tComponents("search.synced", {
                      count: syncStatus?.total_messages || 0,
                    })
              }
            >
              {isSyncing ? (
                <Loader2
                  className={cn("w-5 h-5 animate-spin", COLORS.ui.text.primary)}
                />
              ) : (
                <>
                  <Database className={cn("w-5 h-5", COLORS.ui.text.primary)} />
                  {syncStatus?.needs_sync && (
                    <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </>
              )}
            </TooltipButton>
            {selectedProject && (
              <>
                <TooltipButton
                  content={tComponents("analytics.dashboard")}
                  onClick={() => {
                    if (computed.isAnalyticsView) {
                      analyticsActions.switchToMessages();
                    } else {
                      handleLoadAnalytics();
                    }
                  }}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    computed.isAnalyticsView
                      ? COLORS.semantic.info.bgDark
                      : COLORS.ui.interactive.hover
                  )}
                >
                  <BarChart3
                    className={cn("w-5 h-5", COLORS.ui.text.primary)}
                  />
                </TooltipButton>
                <TooltipButton
                  onClick={() => {
                    if (computed.isTokenStatsView) {
                      analyticsActions.switchToMessages();
                    } else {
                      handleLoadTokenStats();
                    }
                  }}
                  disabled={computed.isAnyLoading}
                  className={cn(
                    "p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    computed.isTokenStatsView
                      ? COLORS.semantic.success.bgDark
                      : COLORS.ui.interactive.hover
                  )}
                  content={tMessages("tokenStats.existing")}
                >
                  {computed.isAnyLoading ? (
                    <Loader2
                      className={cn(
                        "w-5 h-5 animate-spin",
                        COLORS.ui.text.primary
                      )}
                    />
                  ) : (
                    <Activity
                      className={cn("w-5 h-5", COLORS.ui.text.primary)}
                    />
                  )}
                </TooltipButton>
              </>
            )}

            {selectedSession && (
              <>
                <TooltipButton
                  onClick={() => {
                    if (!computed.isMessagesView) {
                      analyticsActions.switchToMessages();
                    }
                  }}
                  disabled={computed.isMessagesView}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    computed.isMessagesView
                      ? cn(
                          COLORS.semantic.success.bgDark,
                          COLORS.semantic.success.text
                        )
                      : cn(
                          COLORS.ui.text.disabled,
                          "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                        )
                  )}
                  content={tComponents("message.view")}
                >
                  <MessageSquare
                    className={cn("w-5 h-5", COLORS.ui.text.primary)}
                  />
                </TooltipButton>
                <TooltipButton
                  onClick={() => refreshCurrentSession()}
                  disabled={isLoadingMessages}
                  className={cn(
                    "p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                    COLORS.ui.text.disabled,
                    "hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                  )}
                  content={tComponents("session.refresh")}
                >
                  <RefreshCw
                    className={cn(
                      "w-5 h-5",
                      isLoadingMessages ? "animate-spin" : "",
                      COLORS.ui.text.primary
                    )}
                  />
                </TooltipButton>
              </>
            )}

            {/* // 여기 다시 드롭다운 */}
            <SettingDropdown />
          </div>
        </div>
      </div>
    </header>
  );
};
