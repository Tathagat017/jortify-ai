import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import { aiService, LinkSuggestion } from "../services/ai.service";

export interface LinkSuggestionState {
  suggestions: LinkSuggestion[];
  allPages: Array<{
    id: string;
    title: string;
    icon_url?: string;
    summary?: string | null;
  }>;
  isLoading: boolean;
  error: string | null;
  currentText: string;
  position: { x: number; y: number } | null;
  isVisible: boolean;
  selectedIndex: number;
  triggerType: "manual"; // Only manual @link triggers now
  showAllPages: boolean;
}

export class AILinkStore {
  queryClient: QueryClient;

  // State
  suggestions: LinkSuggestion[] = [];
  allPages: Array<{
    id: string;
    title: string;
    icon_url?: string;
    summary?: string | null;
  }> = [];
  isLoading = false;
  error: string | null = null;
  currentText = "";
  position: { x: number; y: number } | null = null;
  isVisible = false;
  selectedIndex = 0;
  triggerType = "manual" as const; // Only manual triggers
  showAllPages = false;

  // Debouncing
  private debounceTimeout: NodeJS.Timeout | null = null;

  // Configuration
  private readonly MIN_TEXT_LENGTH = 3;
  private readonly MAX_SUGGESTIONS = 5;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  // =================== ACTIONS ===================

  /**
   * Handle @link trigger - show all pages with AI suggestions
   */
  handleLinkTrigger = async (
    workspaceId: string,
    pageId?: string,
    position?: { x: number; y: number },
    pageStore?: {
      pages: Array<{
        id: string;
        title: string;
        icon_url?: string;
        summary?: string | null;
      }>;
    }
  ) => {
    try {
      console.log("🚀 handleLinkTrigger called with:", {
        workspaceId,
        pageId,
        position,
        currentText: this.currentText,
        pageStorePages: pageStore?.pages?.length || 0,
      });

      runInAction(() => {
        this.isLoading = true;
        this.error = null;
        this.triggerType = "manual";
        this.position = position || null;
        this.isVisible = true;
        this.selectedIndex = 0;
        this.showAllPages = true;
      });

      // Get all pages from page store instead of API
      if (pageStore) {
        this.loadPagesFromStore(pageStore, pageId);
      }

      // Always try to get AI suggestions when manually triggered with @link
      // Use currentText if available, otherwise use a default context
      const textForSuggestions =
        this.currentText.length >= this.MIN_TEXT_LENGTH
          ? this.currentText
          : "link to relevant page"; // Default context for AI suggestions

      console.log("📝 Text for AI suggestions:", textForSuggestions);

      await this.generateSuggestions(textForSuggestions, workspaceId, pageId);

      runInAction(() => {
        this.isLoading = false;
      });
    } catch (error) {
      console.error("❌ Error in handleLinkTrigger:", error);
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : "Failed to load pages";
        this.isLoading = false;
      });
    }
  };

  /**
   * Load pages from page store instead of API
   */
  loadPagesFromStore = (
    pageStore: {
      pages: Array<{
        id: string;
        title: string;
        icon_url?: string;
        summary?: string | null;
      }>;
    },
    excludePageId?: string
  ) => {
    try {
      const pages = pageStore.pages || [];

      runInAction(() => {
        this.allPages = pages
          .filter(
            (page: {
              id: string;
              title: string;
              icon_url?: string;
              summary?: string | null;
            }) => page.id !== excludePageId
          )
          .map(
            (page: {
              id: string;
              title: string;
              icon_url?: string;
              summary?: string | null;
            }) => ({
              id: page.id,
              title: page.title,
              icon_url: page.icon_url,
              summary: page.summary, // Include summary from page store
            })
          );
      });
    } catch (error) {
      console.error("Error loading pages from store:", error);
      runInAction(() => {
        this.allPages = [];
      });
    }
  };

  /**
   * Generate link suggestions for the given text (only for @link trigger)
   */
  generateSuggestions = async (
    text: string,
    workspaceId: string,
    pageId?: string
  ) => {
    try {
      console.log("🔍 generateSuggestions called with:", {
        text,
        workspaceId,
        pageId,
      });

      runInAction(() => {
        this.isLoading = true;
        this.error = null;
      });

      const suggestions = await aiService.generateLinkSuggestions(
        text,
        workspaceId,
        pageId,
        100 // context window
      );

      console.log("🤖 AI service returned suggestions:", suggestions);

      // DEBUG: Log summary information for each suggestion
      console.log("🔍 Debugging suggestion summaries:", {
        totalSuggestions: suggestions.length,
        suggestionsWithSummaries: suggestions.filter((s) => s.summary).length,
        summaryDetails: suggestions.map((s) => ({
          pageTitle: s.pageTitle,
          hasSummary: !!s.summary,
          summaryLength: s.summary?.length || 0,
          summaryPreview: s.summary?.substring(0, 50) + "..." || "No summary",
        })),
      });

      runInAction(() => {
        this.suggestions = suggestions.slice(0, this.MAX_SUGGESTIONS);
        this.isLoading = false;
        this.isVisible = suggestions.length > 0 || this.showAllPages;
        this.selectedIndex = 0;

        console.log("📊 Store state after setting suggestions:", {
          suggestionsCount: this.suggestions.length,
          isVisible: this.isVisible,
          showAllPages: this.showAllPages,
          hasSuggestions: this.hasSuggestions,
        });
      });
    } catch (error) {
      console.error("❌ Error generating AI suggestions:", error);
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to generate suggestions";
        this.isLoading = false;
        this.isVisible = this.showAllPages; // Keep visible if showing all pages
      });
    }
  };

  /**
   * Accept a link suggestion or page selection
   */
  acceptSuggestion = (
    item:
      | LinkSuggestion
      | {
          id: string;
          title: string;
          icon_url?: string;
          summary?: string | null;
        }
  ): void => {
    this.hideSuggestions();

    // Emit event for editor to handle
    window.dispatchEvent(
      new CustomEvent("ai-link-accepted", {
        detail: {
          suggestion:
            "pageId" in item
              ? item
              : {
                  pageId: item.id,
                  pageTitle: item.title,
                  confidence: 1.0,
                  text: item.title,
                  startIndex: 0,
                  endIndex: item.title.length,
                  summary: item.summary || "",
                },
        },
      })
    );
  };

  /**
   * Navigate suggestions with keyboard
   */
  navigateSuggestions = (direction: "up" | "down"): void => {
    if (!this.isVisible) return;

    const totalItems =
      this.suggestions.length + (this.showAllPages ? this.allPages.length : 0);
    if (totalItems === 0) return;

    runInAction(() => {
      if (direction === "down") {
        this.selectedIndex = (this.selectedIndex + 1) % totalItems;
      } else {
        this.selectedIndex =
          this.selectedIndex === 0 ? totalItems - 1 : this.selectedIndex - 1;
      }
    });
  };

  /**
   * Accept currently selected suggestion
   */
  acceptSelectedSuggestion = (): void => {
    if (!this.isVisible) return;

    const totalSuggestions = this.suggestions.length;

    if (this.selectedIndex < totalSuggestions) {
      // Selected item is an AI suggestion
      this.acceptSuggestion(this.suggestions[this.selectedIndex]);
    } else if (this.showAllPages) {
      // Selected item is from all pages list
      const pageIndex = this.selectedIndex - totalSuggestions;
      if (pageIndex < this.allPages.length) {
        this.acceptSuggestion(this.allPages[pageIndex]);
      }
    }
  };

  /**
   * Hide suggestions popup
   */
  hideSuggestions = (): void => {
    runInAction(() => {
      this.isVisible = false;
      this.suggestions = [];
      this.allPages = [];
      this.selectedIndex = 0;
      this.currentText = "";
      this.position = null;
      this.error = null;
      this.showAllPages = false;
      this.triggerType = "manual";
    });

    // Clear any pending debounce
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    // Emit event to remove @link from editor
    window.dispatchEvent(
      new CustomEvent("ai-link-cleanup", {
        detail: { action: "remove-link-trigger" },
      })
    );
  };

  /**
   * Update suggestion position
   */
  updatePosition = (position: { x: number; y: number }): void => {
    runInAction(() => {
      this.position = position;
    });
  };

  /**
   * Set current text for AI suggestions
   */
  setCurrentText = (text: string): void => {
    runInAction(() => {
      this.currentText = text;
    });
  };

  // =================== COMPUTED ===================

  /**
   * Get current suggestion state
   */
  get suggestionState(): LinkSuggestionState {
    return {
      suggestions: this.suggestions,
      allPages: this.allPages,
      isLoading: this.isLoading,
      error: this.error,
      currentText: this.currentText,
      position: this.position,
      isVisible: this.isVisible,
      selectedIndex: this.selectedIndex,
      triggerType: this.triggerType,
      showAllPages: this.showAllPages,
    };
  }

  /**
   * Get currently selected item (suggestion or page)
   */
  get selectedItem():
    | (
        | LinkSuggestion
        | {
            id: string;
            title: string;
            icon_url?: string;
            summary?: string | null;
          }
      )
    | null {
    const totalSuggestions = this.suggestions.length;

    if (this.selectedIndex < totalSuggestions) {
      return this.suggestions[this.selectedIndex];
    } else if (this.showAllPages) {
      const pageIndex = this.selectedIndex - totalSuggestions;
      return this.allPages[pageIndex] || null;
    }

    return null;
  }

  /**
   * Check if suggestions are available
   */
  get hasSuggestions(): boolean {
    return this.suggestions.length > 0;
  }

  /**
   * Check if pages are available
   */
  get hasPages(): boolean {
    return this.allPages.length > 0;
  }

  /**
   * Get total items count
   */
  get totalItems(): number {
    return (
      this.suggestions.length + (this.showAllPages ? this.allPages.length : 0)
    );
  }

  // =================== CLEANUP ===================

  /**
   * Cleanup method for component unmount
   */
  cleanup = (): void => {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }
    this.hideSuggestions();
  };
}
