import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import {
  type AppState,
  type ClaudeProject,
  type ClaudeSession,
  type ClaudeMessage,
  type MessagePage,
  type SearchFilters,
  type SessionTokenStats,
  type ProjectStatsSummary,
  type SessionComparison,
  type AppError,
  AppErrorType,
  type FtsSearchFilters,
  type SearchResult,
  type SyncStatus,
  type SyncProgress,
} from "../types";
import {
  type AnalyticsState,
  type AnalyticsViewType,
  initialAnalyticsState,
} from "../types/analytics";

// Tauri API가 사용 가능한지 확인하는 함수
const isTauriAvailable = () => {
  try {
    // Tauri v2에서는 invoke 함수가 바로 사용 가능합니다
    return typeof window !== "undefined" && typeof invoke === "function";
  } catch {
    return false;
  }
};

interface AppStore extends AppState {
  // Filter state
  excludeSidechain: boolean;

  // Analytics state
  analytics: AnalyticsState;

  // Actions
  initializeApp: () => Promise<void>;
  scanProjects: () => Promise<void>;
  selectProject: (project: ClaudeProject) => Promise<void>;
  selectSession: (session: ClaudeSession, pageSize?: number) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  refreshCurrentSession: () => Promise<void>;
  searchMessages: (query: string, filters?: SearchFilters) => Promise<void>;
  setSearchFilters: (filters: SearchFilters) => void;
  setError: (error: AppError | null) => void;
  setClaudePath: (path: string) => void;
  loadSessionTokenStats: (sessionPath: string) => Promise<void>;
  loadProjectTokenStats: (projectPath: string) => Promise<void>;
  loadProjectStatsSummary: (
    projectPath: string
  ) => Promise<ProjectStatsSummary>;
  loadSessionComparison: (
    sessionId: string,
    projectPath: string
  ) => Promise<SessionComparison>;
  clearTokenStats: () => void;
  setExcludeSidechain: (exclude: boolean) => void;

  // Analytics actions
  setAnalyticsCurrentView: (view: AnalyticsViewType) => void;
  setAnalyticsProjectSummary: (summary: ProjectStatsSummary | null) => void;
  setAnalyticsSessionComparison: (comparison: SessionComparison | null) => void;
  setAnalyticsLoadingProjectSummary: (loading: boolean) => void;
  setAnalyticsLoadingSessionComparison: (loading: boolean) => void;
  setAnalyticsProjectSummaryError: (error: string | null) => void;
  setAnalyticsSessionComparisonError: (error: string | null) => void;
  resetAnalytics: () => void;
  clearAnalyticsErrors: () => void;

  // FTS5 search and sync actions
  getSyncStatus: () => Promise<void>;
  syncToDatabase: () => Promise<void>;
  searchMessagesFts: (query: string, filters?: FtsSearchFilters) => Promise<void>;
  clearFtsSearch: () => void;
  setFtsSearchFilters: (filters: FtsSearchFilters) => void;
}

const DEFAULT_PAGE_SIZE = 20; // 초기 로딩 시 20개 메시지만 로드하여 빠른 로딩

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial state
  claudePath: "",
  projects: [],
  selectedProject: null,
  sessions: [],
  selectedSession: null,
  messages: [],
  pagination: {
    currentOffset: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    totalCount: 0,
    hasMore: false,
    isLoadingMore: false,
  },
  searchQuery: "",
  searchResults: [],
  searchFilters: {},
  // FTS5 search state
  ftsSearchQuery: "",
  ftsSearchResults: [],
  ftsSearchFilters: {},
  syncStatus: null,
  syncProgress: null,
  isSyncing: false,
  isSearching: false,
  isLoading: false,
  isLoadingProjects: false,
  isLoadingSessions: false,
  isLoadingMessages: false,
  isLoadingTokenStats: false,
  error: null,
  sessionTokenStats: null,
  projectTokenStats: [],
  excludeSidechain: true,

  // Analytics state
  analytics: initialAnalyticsState,

  // Actions
  initializeApp: async () => {
    set({ isLoading: true, error: null });
    try {
      if (!isTauriAvailable()) {
        throw new Error(
          "Tauri API를 사용할 수 없습니다. 데스크톱 앱에서 실행해주세요."
        );
      }

      // Try to load saved settings first
      try {
        const store = await load("settings.json", { autoSave: false });
        const savedPath = await store.get<string>("claudePath");

        if (savedPath) {
          // Validate saved path
          const isValid = await invoke<boolean>("validate_claude_folder", {
            path: savedPath,
          });
          if (isValid) {
            set({ claudePath: savedPath });
            await get().scanProjects();
            return;
          }
        }
      } catch {
        // Store doesn't exist yet, that's okay
        console.log("No saved settings found");
      }

      // Try default path
      const claudePath = await invoke<string>("get_claude_folder_path");
      set({ claudePath });
      await get().scanProjects();
    } catch (error) {
      console.error("Failed to initialize app:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Parse error type from message
      let errorType = AppErrorType.UNKNOWN;
      let message = errorMessage;

      if (errorMessage.includes("CLAUDE_FOLDER_NOT_FOUND:")) {
        errorType = AppErrorType.CLAUDE_FOLDER_NOT_FOUND;
        message = errorMessage.split(":")[1] || errorMessage;
      } else if (errorMessage.includes("PERMISSION_DENIED:")) {
        errorType = AppErrorType.PERMISSION_DENIED;
        message = errorMessage.split(":")[1] || errorMessage;
      } else if (errorMessage.includes("Tauri API")) {
        errorType = AppErrorType.TAURI_NOT_AVAILABLE;
      }

      set({ error: { type: errorType, message } });
    } finally {
      set({ isLoading: false });
    }
  },

  scanProjects: async () => {
    const { claudePath } = get();
    if (!claudePath) return;

    set({ isLoadingProjects: true, error: null });
    try {
      const start = performance.now();
      const projects = await invoke<ClaudeProject[]>("scan_projects", {
        claudePath,
      });
      const duration = performance.now() - start;
      if (import.meta.env.DEV) {
        console.log(
          `🚀 [Frontend] scanProjects: ${
            projects.length
          }개 프로젝트, ${duration.toFixed(1)}ms`
        );
      }

      set({ projects });
    } catch (error) {
      console.error("Failed to scan projects:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingProjects: false });
    }
  },

  selectProject: async (project: ClaudeProject) => {
    set({
      selectedProject: project,
      sessions: [],
      selectedSession: null,
      messages: [],
      isLoadingSessions: true,
    });
    try {
      const sessions = await invoke<ClaudeSession[]>("load_project_sessions", {
        projectPath: project.path,
        excludeSidechain: get().excludeSidechain,
      });
      set({ sessions });
    } catch (error) {
      console.error("Failed to load project sessions:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  selectSession: async (
    session: ClaudeSession,
    pageSize = DEFAULT_PAGE_SIZE
  ) => {
    set({
      selectedSession: session,
      messages: [],
      pagination: {
        currentOffset: 0,
        pageSize,
        totalCount: 0,
        hasMore: false,
        isLoadingMore: false,
      },
      isLoadingMessages: true,
    });

    try {
      // Use file_path from session directly
      const sessionPath = session.file_path;

      // 첫 페이지 로드
      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: 0,
          limit: pageSize,
          excludeSidechain: get().excludeSidechain,
        }
      );

      set({
        messages: messagePage.messages,
        pagination: {
          currentOffset: messagePage.next_offset,
          pageSize,
          totalCount: messagePage.total_count,
          hasMore: messagePage.has_more,
          isLoadingMore: false,
        },
        isLoadingMessages: false,
      });
    } catch (error) {
      console.error("Failed to load session messages:", error);
      set({
        error: { type: AppErrorType.UNKNOWN, message: String(error) },
        isLoadingMessages: false,
      });
    }
  },

  loadMoreMessages: async () => {
    const { selectedProject, selectedSession, pagination, messages } = get();

    if (
      !selectedProject ||
      !selectedSession ||
      !pagination.hasMore ||
      pagination.isLoadingMore
    ) {
      return;
    }

    set({
      pagination: {
        ...pagination,
        isLoadingMore: true,
      },
    });

    try {
      // Use file_path from session directly
      const sessionPath = selectedSession.file_path;

      const messagePage = await invoke<MessagePage>(
        "load_session_messages_paginated",
        {
          sessionPath,
          offset: pagination.currentOffset,
          limit: pagination.pageSize,
          excludeSidechain: get().excludeSidechain,
        }
      );

      set({
        messages: [...messagePage.messages, ...messages], // 더 오래된 메시지를 앞에 추가 (채팅 스타일)
        pagination: {
          ...pagination,
          currentOffset: messagePage.next_offset,
          hasMore: messagePage.has_more,
          isLoadingMore: false,
        },
      });
    } catch (error) {
      console.error("Failed to load more messages:", error);
      set({
        error: { type: AppErrorType.UNKNOWN, message: String(error) },
        pagination: {
          ...pagination,
          isLoadingMore: false,
        },
      });
    }
  },

  searchMessages: async (query: string, filters: SearchFilters = {}) => {
    const { claudePath } = get();
    if (!claudePath || !query.trim()) {
      set({ searchResults: [], searchQuery: "" });
      return;
    }

    set({ isLoadingMessages: true, searchQuery: query });
    try {
      const results = await invoke<ClaudeMessage[]>("search_messages", {
        claudePath,
        query,
        filters,
      });
      set({ searchResults: results });
    } catch (error) {
      console.error("Failed to search messages:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isLoadingMessages: false });
    }
  },

  refreshCurrentSession: async () => {
    const { selectedProject, selectedSession, pagination, analytics } = get();

    if (!selectedSession) {
      console.warn("No session selected for refresh");
      return;
    }

    console.log("새로고침 시작:", selectedSession.session_id);

    // 로딩 상태 설정 (selectSession이 내부적으로 isLoadingMessages를 관리함)
    set({ error: null });

    try {
      // 프로젝트 세션 목록도 새로고침하여 message_count 업데이트
      if (selectedProject) {
        const sessions = await invoke<ClaudeSession[]>(
          "load_project_sessions",
          {
            projectPath: selectedProject.path,
            excludeSidechain: get().excludeSidechain,
          }
        );
        set({ sessions });
      }

      // 현재 세션을 다시 로드 (첫 페이지부터)
      await get().selectSession(selectedSession, pagination.pageSize);
      
      // 분석 뷰일 때 분석 데이터도 새로고침
      if (selectedProject && (analytics.currentView === "tokenStats" || analytics.currentView === "analytics")) {
        console.log("분석 데이터 새로고침 시작:", analytics.currentView);
        
        if (analytics.currentView === "tokenStats") {
          // 토큰 통계 새로고침
          await get().loadProjectTokenStats(selectedProject.path);
          if (selectedSession?.file_path) {
            await get().loadSessionTokenStats(selectedSession.file_path);
          }
        } else if (analytics.currentView === "analytics") {
          // 분석 대시보드 새로고침
          const projectSummary = await invoke<ProjectStatsSummary>(
            "get_project_stats_summary",
            { projectPath: selectedProject.path }
          );
          get().setAnalyticsProjectSummary(projectSummary);
          
          // 세션 비교 데이터도 새로고침
          if (selectedSession) {
            const sessionComparison = await invoke<SessionComparison>(
              "get_session_comparison",
              { 
                sessionId: selectedSession.actual_session_id,
                projectPath: selectedProject.path 
              }
            );
            get().setAnalyticsSessionComparison(sessionComparison);
          }
        }
        
        console.log("분석 데이터 새로고침 완료");
      }
      
      console.log("새로고침 완료");
    } catch (error) {
      console.error("새로고침 실패:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    }
  },

  setSearchFilters: (filters: SearchFilters) => {
    set({ searchFilters: filters });
  },

  setError: (error: AppError | null) => {
    set({ error });
  },

  setClaudePath: async (path: string) => {
    set({ claudePath: path });

    // Save to persistent storage
    try {
      const store = await load("settings.json", { autoSave: false });
      await store.set("claudePath", path);
      await store.save();
    } catch (error) {
      console.error("Failed to save claude path:", error);
    }
  },

  loadSessionTokenStats: async (sessionPath: string) => {
    try {
      set({ isLoadingTokenStats: true, error: null });
      const stats = await invoke<SessionTokenStats>("get_session_token_stats", {
        sessionPath,
      });
      set({ sessionTokenStats: stats });
    } catch (error) {
      console.error("Failed to load session token stats:", error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to load token stats: ${error}`,
        },
        sessionTokenStats: null,
      });
    } finally {
      set({ isLoadingTokenStats: false });
    }
  },

  loadProjectTokenStats: async (projectPath: string) => {
    try {
      set({ isLoadingTokenStats: true, error: null });
      const stats = await invoke<SessionTokenStats[]>(
        "get_project_token_stats",
        {
          projectPath,
        }
      );
      set({ projectTokenStats: stats });
    } catch (error) {
      console.error("Failed to load project token stats:", error);
      set({
        error: {
          type: AppErrorType.UNKNOWN,
          message: `Failed to load project token stats: ${error}`,
        },
        projectTokenStats: [],
      });
    } finally {
      set({ isLoadingTokenStats: false });
    }
  },

  loadProjectStatsSummary: async (projectPath: string) => {
    try {
      const summary = await invoke("get_project_stats_summary", {
        projectPath,
      });
      return summary as ProjectStatsSummary;
    } catch (error) {
      console.error("Failed to load project stats summary:", error);
      throw error;
    }
  },

  loadSessionComparison: async (sessionId: string, projectPath: string) => {
    try {
      const comparison = await invoke("get_session_comparison", {
        sessionId,
        projectPath,
      });
      return comparison as SessionComparison;
    } catch (error) {
      console.error("Failed to load session comparison:", error);
      throw error;
    }
  },

  clearTokenStats: () => {
    set({ sessionTokenStats: null, projectTokenStats: [] });
  },

  setExcludeSidechain: (exclude: boolean) => {
    set({ excludeSidechain: exclude });
    // 필터 변경 시 현재 프로젝트와 세션 새로고침
    const { selectedProject, selectedSession } = get();
    if (selectedProject) {
      // 프로젝트 다시 로드하여 세션 목록의 message_count 업데이트
      get().selectProject(selectedProject);
    }
    if (selectedSession) {
      get().selectSession(selectedSession);
    }
  },

  // Analytics actions
  setAnalyticsCurrentView: (view: AnalyticsViewType) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        currentView: view,
      },
    }));
  },

  setAnalyticsProjectSummary: (summary: ProjectStatsSummary | null) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        projectSummary: summary,
      },
    }));
  },

  setAnalyticsSessionComparison: (comparison: SessionComparison | null) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        sessionComparison: comparison,
      },
    }));
  },

  setAnalyticsLoadingProjectSummary: (loading: boolean) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        isLoadingProjectSummary: loading,
      },
    }));
  },

  setAnalyticsLoadingSessionComparison: (loading: boolean) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        isLoadingSessionComparison: loading,
      },
    }));
  },

  setAnalyticsProjectSummaryError: (error: string | null) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        projectSummaryError: error,
      },
    }));
  },

  setAnalyticsSessionComparisonError: (error: string | null) => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        sessionComparisonError: error,
      },
    }));
  },

  resetAnalytics: () => {
    set({ analytics: initialAnalyticsState });
  },

  clearAnalyticsErrors: () => {
    set((state) => ({
      analytics: {
        ...state.analytics,
        projectSummaryError: null,
        sessionComparisonError: null,
      },
    }));
  },

  // FTS5 search and sync actions
  getSyncStatus: async () => {
    const { claudePath } = get();
    if (!claudePath) return;

    try {
      const status = await invoke<SyncStatus>("get_sync_status", {
        claudePath,
      });
      set({ syncStatus: status });
    } catch (error) {
      console.error("Failed to get sync status:", error);
    }
  },

  syncToDatabase: async () => {
    const { claudePath } = get();
    if (!claudePath) return;

    set({ isSyncing: true, error: null });
    try {
      const progress = await invoke<SyncProgress>("sync_messages_to_db", {
        claudePath,
      });
      set({ syncProgress: progress, isSyncing: false });

      // Update status after sync completes
      await get().getSyncStatus();
    } catch (error) {
      console.error("Failed to sync messages:", error);
      set({
        error: { type: AppErrorType.UNKNOWN, message: String(error) },
        isSyncing: false,
      });
    }
  },

  searchMessagesFts: async (query: string, filters: FtsSearchFilters = {}) => {
    const { claudePath } = get();
    if (!claudePath || !query.trim()) {
      set({ ftsSearchResults: [], ftsSearchQuery: "" });
      return;
    }

    set({ isSearching: true, ftsSearchQuery: query });
    try {
      const results = await invoke<SearchResult[]>("search_messages_fts", {
        claudePath,
        query,
        filters,
        limit: 100,
      });
      set({ ftsSearchResults: results });
    } catch (error) {
      console.error("Failed to search messages:", error);
      set({ error: { type: AppErrorType.UNKNOWN, message: String(error) } });
    } finally {
      set({ isSearching: false });
    }
  },

  clearFtsSearch: () => {
    set({
      ftsSearchQuery: "",
      ftsSearchResults: [],
      ftsSearchFilters: {},
    });
  },

  setFtsSearchFilters: (filters: FtsSearchFilters) => {
    set({ ftsSearchFilters: filters });
  },
}));
