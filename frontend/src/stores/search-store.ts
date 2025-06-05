import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import {
  SearchService,
  SearchFilters,
  SearchResult,
  SearchResponse,
} from "../services/search.service";

export class SearchStore {
  queryClient: QueryClient;

  // Search state
  query: string = "";
  results: SearchResult[] = [];
  loading: boolean = false;
  error: string | null = null;

  // Search configuration
  similarityThreshold: number = 0.3;

  // Filters
  filters: SearchFilters = {
    searchBehavior: "simple",
    searchIn: {
      pageName: true,
      subPageName: true,
      pageContent: true,
    },
    metadata: {
      tags: [],
      workspaceType: "all",
    },
  };

  // Pagination
  pagination = {
    limit: 20,
    offset: 0,
    total: 0,
    hasMore: false,
  };

  // UI state
  showFilters: boolean = false;
  suggestions: Array<{ id: string; title: string; icon_url?: string }> = [];
  showSuggestions: boolean = false;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  // =================== SEARCH ACTIONS ===================

  setQuery(query: string) {
    this.query = query;
    if (query.trim().length > 0) {
      this.loadSuggestions(query);
    } else {
      this.clearSuggestions();
    }
  }

  setFilters(filters: Partial<SearchFilters>) {
    this.filters = { ...this.filters, ...filters };
  }

  toggleFilter() {
    this.showFilters = !this.showFilters;
  }

  async performSearch(workspaceId: string, resetPagination: boolean = true) {
    if (!workspaceId) return;

    const hasTextQuery = this.query.trim().length > 0;
    const hasTagFilter = this.filters.metadata.tags.length > 0;
    const hasWorkspaceTypeFilter =
      this.filters.metadata.workspaceType !== "all";

    // If no text query and no filter-by filters, clear results
    if (!hasTextQuery && !hasTagFilter && !hasWorkspaceTypeFilter) {
      runInAction(() => {
        this.results = [];
        this.pagination = {
          limit: 20,
          offset: 0,
          total: 0,
          hasMore: false,
        };
      });
      return;
    }

    try {
      runInAction(() => {
        this.loading = true;
        this.error = null;
        if (resetPagination) {
          this.pagination.offset = 0;
        }
      });

      let searchResults: SearchResult[] = [];

      // STEP 1: Get search results (if there's a text query)
      if (hasTextQuery) {
        // Create search filters without metadata (tags, workspace type)
        const searchOnlyFilters = {
          searchBehavior: this.filters.searchBehavior,
          searchIn: this.filters.searchIn,
          metadata: {
            tags: [], // Don't send to backend
            workspaceType: "all" as const, // Don't send to backend
          },
        };

        let response: SearchResponse;
        if (this.filters.searchBehavior === "semantic") {
          response = await SearchService.semanticSearch(
            this.query,
            workspaceId,
            searchOnlyFilters,
            this.pagination.limit,
            this.pagination.offset,
            this.similarityThreshold
          );
        } else {
          response = await SearchService.fullTextSearch(
            this.query,
            workspaceId,
            searchOnlyFilters,
            this.pagination.limit,
            this.pagination.offset
          );
        }
        searchResults = response.results;
      } else if (hasTagFilter) {
        // STEP 1 Alternative: If no text query but has tag filter, get all pages with those tags
        const response = await SearchService.searchByTags(
          this.filters.metadata.tags,
          workspaceId,
          100, // Get more results since we'll filter them
          0
        );
        searchResults = response.results;
      }

      // STEP 2: Apply Filter By filters on the frontend
      let filteredResults = searchResults;

      // Filter by tags if specified
      if (hasTagFilter) {
        filteredResults = filteredResults.filter((page) =>
          page.tags?.some((tag) => this.filters.metadata.tags.includes(tag.id))
        );
      }

      // Filter by workspace type if specified
      if (hasWorkspaceTypeFilter) {
        // Note: This would require workspace data on pages
        // For now, we'll skip this filter as it's not commonly used
        // filteredResults = filteredResults.filter(page => page.workspaceType === this.filters.metadata.workspaceType);
      }

      runInAction(() => {
        if (resetPagination) {
          this.results = filteredResults;
        } else {
          this.results = [...this.results, ...filteredResults];
        }

        // Update pagination
        this.pagination = {
          limit: this.pagination.limit,
          offset: this.pagination.offset,
          total: filteredResults.length,
          hasMore: false, // Disable pagination for filtered results
        };

        this.loading = false;
        this.hideSuggestions();
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : "Search failed";
        this.loading = false;
      });
    }
  }

  async loadMore(workspaceId: string) {
    if (!this.pagination.hasMore || this.loading) return;

    runInAction(() => {
      this.pagination.offset += this.pagination.limit;
    });

    await this.performSearch(workspaceId, false);
  }

  async loadSuggestions(query: string, workspaceId?: string) {
    if (!workspaceId || query.length < 2) return;

    try {
      const response = await SearchService.getSuggestions(query, workspaceId);
      runInAction(() => {
        this.suggestions = response.suggestions;
        this.showSuggestions = true;
      });
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    }
  }

  // =================== FILTER ACTIONS ===================

  setSearchBehavior(behavior: "simple" | "semantic") {
    this.filters.searchBehavior = behavior;
  }

  toggleSearchIn(field: keyof SearchFilters["searchIn"]) {
    this.filters.searchIn[field] = !this.filters.searchIn[field];
  }

  setWorkspaceType(type: "public" | "private" | "all") {
    this.filters.metadata.workspaceType = type;
  }

  setSelectedTags(tags: string[]) {
    this.filters.metadata.tags = tags;
  }

  addTag(tagId: string) {
    if (!this.filters.metadata.tags.includes(tagId)) {
      this.filters.metadata.tags.push(tagId);
    }
  }

  removeTag(tagId: string) {
    this.filters.metadata.tags = this.filters.metadata.tags.filter(
      (id) => id !== tagId
    );
  }

  // =================== UI ACTIONS ===================

  clearSearch() {
    this.query = "";
    this.results = [];
    this.error = null;
    this.pagination = {
      limit: 20,
      offset: 0,
      total: 0,
      hasMore: false,
    };
    this.clearSuggestions();
  }

  clearSuggestions() {
    this.suggestions = [];
    this.showSuggestions = false;
  }

  hideSuggestions() {
    this.showSuggestions = false;
  }

  selectSuggestion(suggestion: {
    id: string;
    title: string;
    icon_url?: string;
  }) {
    this.query = suggestion.title;
    this.hideSuggestions();
  }

  clearError() {
    this.error = null;
  }

  resetFilters() {
    this.filters = {
      searchBehavior: "simple",
      searchIn: {
        pageName: true,
        subPageName: true,
        pageContent: true,
      },
      metadata: {
        tags: [],
        workspaceType: "all",
      },
    };
  }
}
