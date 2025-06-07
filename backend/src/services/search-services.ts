import { supabase } from "../lib/supabase";
import { AIService } from "./ai.service";
import { EmbeddingService } from "./embedding.service";
import { SummaryService } from "./summary.service";

// Simple in-memory cache for demonstration
class SimpleCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  async get(key: string): Promise<any> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  async set(key: string, data: any, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expiry });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

// Types and Interfaces
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  type: "page" | "block" | "tag";
  relevanceScore: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  query: string;
  type?: "semantic" | "keyword" | "ai-powered";
  filters?: {
    contentType?: string[];
    dateRange?: { start: Date; end: Date };
    tags?: string[];
    workspaceId?: string;
  };
  limit?: number;
  offset?: number;
}

// Abstract Base Search Service
abstract class BaseSearchService {
  protected cache: SimpleCache;

  constructor(cache: SimpleCache) {
    this.cache = cache;
  }

  abstract search(options: SearchOptions): Promise<SearchResult[]>;
  abstract indexContent(content: any): Promise<void>;
  abstract updateIndex(id: string, content: any): Promise<void>;
  abstract deleteFromIndex(id: string): Promise<void>;
}

// Keyword Search Service Implementation using real Supabase queries
class KeywordSearchService extends BaseSearchService {
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, filters, limit = 20, offset = 0 } = options;

    // Check cache first
    const cacheKey = `keyword_search_${JSON.stringify(options)}`;
    const cachedResults = await this.cache.get(cacheKey);

    if (cachedResults) {
      console.log("Returning cached keyword search results");
      return cachedResults;
    }

    try {
      // Build Supabase query for text search
      let supabaseQuery = supabase
        .from("pages")
        .select("id, title, content, workspace_id, created_at, updated_at")
        .or(`title.ilike.%${query}%, content->>blocks.ilike.%${query}%`)
        .order("updated_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Apply workspace filter if provided
      if (filters?.workspaceId) {
        supabaseQuery = supabaseQuery.eq("workspace_id", filters.workspaceId);
      }

      const { data: pages, error } = await supabaseQuery;

      if (error) {
        console.error("Keyword search error:", error);
        return [];
      }

      const searchResults: SearchResult[] = (pages || []).map((page: any) => {
        // Calculate relevance score based on title vs content match
        const titleMatch = page.title
          .toLowerCase()
          .includes(query.toLowerCase());
        const contentMatch = JSON.stringify(page.content)
          .toLowerCase()
          .includes(query.toLowerCase());
        const relevanceScore = titleMatch ? 0.9 : contentMatch ? 0.6 : 0.3;

        return {
          id: page.id,
          title: page.title,
          content: this.extractContentText(page.content),
          type: "page",
          relevanceScore,
          metadata: {
            searchMethod: "keyword",
            workspaceId: page.workspace_id,
            lastUpdated: page.updated_at,
          },
        };
      });

      // Cache results for 5 minutes
      await this.cache.set(cacheKey, searchResults, 300);

      return searchResults;
    } catch (error) {
      console.error("Keyword search failed:", error);
      return [];
    }
  }

  async indexContent(content: any): Promise<void> {
    // For keyword search, we rely on Supabase's built-in text search
    // No additional indexing needed as we search directly on columns
    console.log(
      `Keyword search indexing complete for content ID: ${content.id}`
    );
  }

  async updateIndex(id: string, content: any): Promise<void> {
    // No specific update needed for keyword search
    console.log(`Keyword search index updated for content ID: ${id}`);
  }

  async deleteFromIndex(id: string): Promise<void> {
    // Content deletion is handled at the database level
    console.log(`Content ${id} removed from keyword search (handled by DB)`);
  }

  private extractContentText(content: any): string {
    if (!content || !content.blocks) return "";

    return content.blocks
      .map((block: any) => {
        if (block.content && Array.isArray(block.content)) {
          return block.content.map((item: any) => item.text || "").join(" ");
        }
        return "";
      })
      .join(" ")
      .substring(0, 500); // Limit to first 500 chars for display
  }
}

// Semantic Search Service Implementation using real EmbeddingService
class SemanticSearchService extends BaseSearchService {
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, filters, limit = 20, offset = 0 } = options;

    // Check cache first
    const cacheKey = `semantic_search_${JSON.stringify(options)}`;
    const cachedResults = await this.cache.get(cacheKey);

    if (cachedResults) {
      console.log("Returning cached semantic search results");
      return cachedResults;
    }

    try {
      // Use the real EmbeddingService for semantic search
      const results = await EmbeddingService.semanticSearch(
        query,
        filters?.workspaceId,
        limit,
        0.7 // similarity threshold
      );

      const searchResults: SearchResult[] = results.map((result: any) => ({
        id: result.page_id,
        title: result.title,
        content:
          result.content_preview || this.extractContentText(result.content),
        type: "page",
        relevanceScore: result.similarity,
        metadata: {
          searchMethod: "semantic",
          similarity: result.similarity,
          workspaceId: result.workspace_id,
        },
      }));

      // Cache results for 10 minutes
      await this.cache.set(cacheKey, searchResults, 600);

      return searchResults.slice(offset, offset + limit);
    } catch (error) {
      console.error("Semantic search failed:", error);
      // Fallback to keyword search
      const keywordService = new KeywordSearchService(this.cache);
      return keywordService.search({ ...options, type: "keyword" });
    }
  }

  async indexContent(content: any): Promise<void> {
    try {
      // Use the real EmbeddingService to generate embeddings
      await EmbeddingService.generatePageEmbedding(content.id);
      console.log(`Generated embeddings for content ID: ${content.id}`);
    } catch (error) {
      console.error("Failed to index content for semantic search:", error);
    }
  }

  async updateIndex(id: string, content: any): Promise<void> {
    // Re-generate embeddings for updated content
    await this.indexContent({ ...content, id });
  }

  async deleteFromIndex(id: string): Promise<void> {
    try {
      await EmbeddingService.deletePageEmbedding(id);
      console.log(
        `Removed embeddings for content ${id} from semantic search index`
      );
    } catch (error) {
      console.error("Failed to delete from semantic search index:", error);
    }
  }

  private extractContentText(content: any): string {
    if (!content || !content.blocks) return "";

    return content.blocks
      .map((block: any) => {
        if (block.content && Array.isArray(block.content)) {
          return block.content.map((item: any) => item.text || "").join(" ");
        }
        return "";
      })
      .join(" ")
      .substring(0, 500);
  }
}

// AI-Powered Search Service Implementation using real AIService
class AIPoweredSearchService extends BaseSearchService {
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const { query, filters, limit = 20, offset = 0 } = options;

    // Check cache first
    const cacheKey = `ai_search_${JSON.stringify(options)}`;
    const cachedResults = await this.cache.get(cacheKey);

    if (cachedResults) {
      console.log("Returning cached AI-powered search results");
      return cachedResults;
    }

    try {
      // Use real AIService for link suggestions as a form of intelligent search
      const linkSuggestions = await AIService.generateLinkSuggestions(
        query,
        filters?.workspaceId || "",
        undefined
      );

      // Convert link suggestions to search results
      let searchResults: SearchResult[] = linkSuggestions.map(
        (suggestion: any) => ({
          id: suggestion.pageId,
          title: suggestion.pageTitle,
          content: suggestion.summary || "",
          type: "page" as const,
          relevanceScore: suggestion.confidence,
          metadata: {
            searchMethod: "ai-powered",
            confidence: suggestion.confidence,
            aiSuggestion: true,
            summary: suggestion.summary,
          },
        })
      );

      // Enhance with semantic search results
      const semanticService = new SemanticSearchService(this.cache);
      const semanticResults = await semanticService.search({
        ...options,
        type: "semantic",
        limit: Math.max(10, limit - searchResults.length),
      });

      // Merge results and remove duplicates
      const mergedResults = this.mergeSearchResults(
        searchResults,
        semanticResults
      );

      // Sort by relevance score
      const sortedResults = mergedResults.sort(
        (a, b) => b.relevanceScore - a.relevanceScore
      );

      const finalResults = sortedResults.slice(offset, offset + limit);

      // Cache results for 15 minutes
      await this.cache.set(cacheKey, finalResults, 900);

      return finalResults;
    } catch (error) {
      console.error("AI-powered search failed:", error);
      // Fallback to semantic search
      const semanticService = new SemanticSearchService(this.cache);
      return semanticService.search({ ...options, type: "semantic" });
    }
  }

  async indexContent(content: any): Promise<void> {
    try {
      // Use real AIService to generate tags and summary for better search
      const tags = await AIService.generateTags(
        content.title,
        content.content,
        content.workspaceId || ""
      );

      const summary = await AIService.generateSummary(
        content.title,
        content.content,
        "short"
      );

      // Store AI-enhanced metadata in the database
      const { error } = await supabase
        .from("pages")
        .update({
          ai_summary: summary,
          ai_tags: tags.tags.map((tag) => tag.name),
          updated_at: new Date().toISOString(),
        })
        .eq("id", content.id);

      if (error) {
        console.error("Failed to store AI metadata:", error);
      }

      // Also index in semantic search
      const semanticService = new SemanticSearchService(this.cache);
      await semanticService.indexContent(content);

      console.log(
        `AI-enhanced indexing completed for content ID: ${content.id}`
      );
    } catch (error) {
      console.error("Failed to AI-index content:", error);
    }
  }

  async updateIndex(id: string, content: any): Promise<void> {
    await this.indexContent({ ...content, id });
  }

  async deleteFromIndex(id: string): Promise<void> {
    // Clean up AI-specific metadata
    const { error } = await supabase
      .from("pages")
      .update({
        ai_summary: null,
        ai_tags: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      console.error("Failed to cleanup AI metadata:", error);
    }

    // Also clean up semantic search
    const semanticService = new SemanticSearchService(this.cache);
    await semanticService.deleteFromIndex(id);

    console.log(`Removed content ${id} from AI-powered search indices`);
  }

  private mergeSearchResults(
    aiResults: SearchResult[],
    semanticResults: SearchResult[]
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>();

    // Add AI results (higher priority)
    aiResults.forEach((result) => {
      merged.set(result.id, result);
    });

    // Add semantic results if not already present
    semanticResults.forEach((result) => {
      if (!merged.has(result.id)) {
        merged.set(result.id, {
          ...result,
          metadata: { ...result.metadata, enhancedWithSemantic: true },
        });
      }
    });

    return Array.from(merged.values());
  }
}

// Search Service Factory
export class SearchServiceFactory {
  private static cache: SimpleCache = new SimpleCache();

  static createSearchService(
    type: "keyword" | "semantic" | "ai-powered"
  ): BaseSearchService {
    switch (type) {
      case "keyword":
        return new KeywordSearchService(this.cache);

      case "semantic":
        return new SemanticSearchService(this.cache);

      case "ai-powered":
        return new AIPoweredSearchService(this.cache);

      default:
        throw new Error(`Unsupported search service type: ${type}`);
    }
  }

  // Convenience method to get the best search service based on query complexity
  static createOptimalSearchService(query: string): BaseSearchService {
    const queryComplexity = this.analyzeQueryComplexity(query);

    if (queryComplexity === "simple") {
      return this.createSearchService("keyword");
    } else if (queryComplexity === "moderate") {
      return this.createSearchService("semantic");
    } else {
      return this.createSearchService("ai-powered");
    }
  }

  private static analyzeQueryComplexity(
    query: string
  ): "simple" | "moderate" | "complex" {
    const words = query.split(/\s+/);
    const hasComplexPhrases =
      /\b(how|what|why|when|where|explain|compare|analyze)\b/i.test(query);
    const hasMultipleConcepts = words.length > 5;

    if (hasComplexPhrases || hasMultipleConcepts) {
      return "complex";
    } else if (words.length > 2) {
      return "moderate";
    } else {
      return "simple";
    }
  }
}

// Search Manager - Orchestrates multiple search services
export class SearchManager {
  private searchServiceFactory = SearchServiceFactory;

  async search(options: SearchOptions): Promise<SearchResult[]> {
    const searchType = options.type || "ai-powered";
    const searchService =
      this.searchServiceFactory.createSearchService(searchType);

    console.log(`Executing ${searchType} search for query: "${options.query}"`);

    const startTime = Date.now();
    const results = await searchService.search(options);
    const endTime = Date.now();

    console.log(
      `Search completed in ${endTime - startTime}ms, found ${
        results.length
      } results`
    );

    return results;
  }

  async smartSearch(
    query: string,
    options?: Partial<SearchOptions>
  ): Promise<SearchResult[]> {
    const searchService =
      this.searchServiceFactory.createOptimalSearchService(query);

    const searchOptions: SearchOptions = {
      query,
      ...options,
    };

    return searchService.search(searchOptions);
  }

  async indexContent(
    content: any,
    searchTypes: ("keyword" | "semantic" | "ai-powered")[] = ["ai-powered"]
  ): Promise<void> {
    const indexPromises = searchTypes.map((type) => {
      const searchService = this.searchServiceFactory.createSearchService(type);
      return searchService.indexContent(content);
    });

    await Promise.all(indexPromises);
  }

  async updateContent(
    id: string,
    content: any,
    searchTypes: ("keyword" | "semantic" | "ai-powered")[] = ["ai-powered"]
  ): Promise<void> {
    const updatePromises = searchTypes.map((type) => {
      const searchService = this.searchServiceFactory.createSearchService(type);
      return searchService.updateIndex(id, content);
    });

    await Promise.all(updatePromises);
  }

  async deleteContent(
    id: string,
    searchTypes: ("keyword" | "semantic" | "ai-powered")[] = ["ai-powered"]
  ): Promise<void> {
    const deletePromises = searchTypes.map((type) => {
      const searchService = this.searchServiceFactory.createSearchService(type);
      return searchService.deleteFromIndex(id);
    });

    await Promise.all(deletePromises);
  }
}

// Convenience function to create and return a SearchManager instance
export const createSearchManager = (): SearchManager => {
  return new SearchManager();
};

// Example usage with real workspace data
export const searchWorkspacePages = async (
  query: string,
  workspaceId: string,
  searchType: "keyword" | "semantic" | "ai-powered" = "ai-powered"
): Promise<SearchResult[]> => {
  const searchManager = createSearchManager();

  return searchManager.search({
    query,
    type: searchType,
    filters: { workspaceId },
    limit: 20,
  });
};

// Export types and classes for external use
export {
  BaseSearchService,
  KeywordSearchService,
  SemanticSearchService,
  AIPoweredSearchService,
};
