import axios, { AxiosResponse } from "axios";

export interface SearchFilters {
  searchBehavior: "simple" | "semantic";
  searchIn: {
    pageName: boolean;
    subPageName: boolean;
    pageContent: boolean;
  };
  metadata: {
    tags: string[];
    workspaceType: "public" | "private" | "all";
  };
}

export interface SearchResult {
  id: string;
  title: string;
  content?: object;
  created_at: string;
  updated_at: string;
  icon_url?: string;
  cover_url?: string;
  summary?: string;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  rank?: number;
  similarity?: number;
  parent_id?: string | null;
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  query: string;
  similarity_threshold?: number;
}

export class SearchService {
  private static baseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  private static async getAuthHeaders() {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Perform full-text search across pages
   */
  static async fullTextSearch(
    query: string,
    workspaceId: string,
    filters?: Partial<SearchFilters>,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchResponse> {
    const headers = await this.getAuthHeaders();

    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${this.baseUrl}/api/search/text`,
      {
        query,
        workspace_id: workspaceId,
        limit,
        offset,
        filters,
      },
      { headers }
    );

    return response.data;
  }

  /**
   * Perform semantic search using embeddings
   */
  static async semanticSearch(
    query: string,
    workspaceId: string,
    filters?: Partial<SearchFilters>,
    limit: number = 20,
    offset: number = 0,
    similarityThreshold: number = 0.7
  ): Promise<SearchResponse> {
    const headers = await this.getAuthHeaders();

    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${this.baseUrl}/api/search/semantic`,
      {
        query,
        workspace_id: workspaceId,
        limit,
        offset,
        filters,
        similarity_threshold: similarityThreshold,
      },
      { headers }
    );

    return response.data;
  }

  /**
   * Search pages by tags only
   */
  static async searchByTags(
    tagIds: string[],
    workspaceId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchResponse> {
    const headers = await this.getAuthHeaders();

    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${this.baseUrl}/api/search/tags`,
      {
        tag_ids: tagIds,
        workspace_id: workspaceId,
        limit,
        offset,
      },
      { headers }
    );

    return response.data;
  }

  /**
   * Get search suggestions/autocomplete
   */
  static async getSuggestions(
    query: string,
    workspaceId: string,
    limit: number = 10
  ): Promise<{
    suggestions: Array<{ id: string; title: string; icon_url?: string }>;
  }> {
    const headers = await this.getAuthHeaders();

    const response = await axios.get(`${this.baseUrl}/api/search/suggestions`, {
      headers,
      params: {
        query,
        workspace_id: workspaceId,
        limit,
      },
    });

    return response.data;
  }

  /**
   * Find similar pages using embeddings
   */
  static async findSimilarPages(
    pageId: string,
    workspaceId: string,
    limit: number = 10,
    similarityThreshold: number = 0.7
  ): Promise<SearchResponse> {
    const headers = await this.getAuthHeaders();

    const response: AxiosResponse<SearchResponse> = await axios.post(
      `${this.baseUrl}/api/search/similar/${pageId}`,
      {
        workspace_id: workspaceId,
        limit,
        similarity_threshold: similarityThreshold,
      },
      { headers }
    );

    return response.data;
  }

  /**
   * Generate embeddings for a workspace (admin endpoint)
   */
  static async generateEmbeddings(
    workspaceId: string
  ): Promise<{ message: string }> {
    const headers = await this.getAuthHeaders();

    const response = await axios.post(
      `${this.baseUrl}/api/search/embeddings`,
      { workspace_id: workspaceId },
      { headers }
    );

    return response.data;
  }
}
