import { supabase } from "../lib/supabase";
import { AIService } from "./ai.service";
import { EmbeddingService } from "./embedding.service";

export interface PageSummaryData {
  pageId: string;
  title: string;
  content: any;
  summary?: string;
  lastUpdated?: string;
  summaryUpdatedAt?: string;
}

export class SummaryService {
  /**
   * Generate and store summary for a page
   */
  static async generatePageSummary(
    pageId: string,
    forceRegenerate: boolean = false
  ): Promise<string> {
    try {
      // Fetch page data
      const { data: page, error: pageError } = await supabase
        .from("pages")
        .select("title, content, updated_at, summary, summary_updated_at")
        .eq("id", pageId)
        .single();

      if (pageError || !page) {
        throw new Error(`Page not found: ${pageId}`);
      }

      // Check if summary needs updating
      if (!forceRegenerate && page.summary && page.summary_updated_at) {
        const needsUpdate = await this.checkIfSummaryNeedsUpdate(
          page.content,
          page.title,
          page.summary_updated_at,
          page.updated_at
        );

        if (!needsUpdate) {
          console.log(`Summary for page ${pageId} is up to date`);
          return page.summary;
        }
      }

      // Generate new summary using AI
      const summary = await AIService.generateSummary(
        page.title,
        page.content,
        "medium"
      );

      // Store summary in database
      const { error: updateError } = await supabase
        .from("pages")
        .update({ summary })
        .eq("id", pageId);

      if (updateError) {
        throw new Error(`Failed to store summary: ${updateError.message}`);
      }

      // Also regenerate embeddings if content changed
      try {
        await EmbeddingService.generatePageEmbedding(pageId);
      } catch (embeddingError) {
        console.warn(
          `Failed to update embeddings for page ${pageId}:`,
          embeddingError
        );
      }

      console.log(`Generated summary for page ${pageId}`);
      return summary;
    } catch (error) {
      console.error(`Error generating summary for page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Check if summary needs updating using database function
   */
  private static async checkIfSummaryNeedsUpdate(
    content: any,
    title: string,
    lastSummaryUpdate: string,
    pageUpdatedAt: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc("page_needs_summary_update", {
        page_content: content,
        page_title: title,
        last_summary_update: lastSummaryUpdate,
        page_updated_at: pageUpdatedAt,
      });

      if (error) {
        console.warn("Error checking summary update status:", error);
        return true; // Default to updating if check fails
      }

      return data === true;
    } catch (error) {
      console.warn("Error in summary update check:", error);
      return true; // Default to updating if check fails
    }
  }

  /**
   * Generate summaries for all pages in a workspace
   */
  static async generateWorkspaceSummaries(workspaceId: string): Promise<void> {
    try {
      // Get all pages in workspace that need summary updates
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, content, updated_at, summary_updated_at")
        .eq("workspace_id", workspaceId);

      if (error) {
        throw new Error(`Failed to fetch workspace pages: ${error.message}`);
      }

      if (!pages || pages.length === 0) {
        console.log(`No pages found in workspace ${workspaceId}`);
        return;
      }

      console.log(
        `Processing summaries for ${pages.length} pages in workspace ${workspaceId}`
      );

      // Process pages in batches to avoid overwhelming the API
      const batchSize = 3; // Process 3 pages at a time

      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);

        await Promise.all(
          batch.map((page) => this.generatePageSummary(page.id, false))
        );

        // Add delay between batches to respect rate limits
        if (i + batchSize < pages.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
        }
      }

      console.log(`Completed summary generation for workspace ${workspaceId}`);
    } catch (error) {
      console.error(`Error generating workspace summaries:`, error);
      throw error;
    }
  }

  /**
   * Get enhanced link suggestions using page summaries
   */
  static async getEnhancedLinkSuggestions(
    text: string,
    workspaceId: string,
    pageId?: string,
    contextWindow: number = 100
  ): Promise<
    Array<{
      pageId: string;
      pageTitle: string;
      summary: string;
      relevanceScore: number;
      suggestedText: string;
      confidence: number;
    }>
  > {
    try {
      console.log("🔍 SummaryService.getEnhancedLinkSuggestions called with:", {
        text,
        workspaceId,
        pageId,
        contextWindow,
      });

      // Get pages with summaries in the workspace
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, summary")
        .eq("workspace_id", workspaceId)
        .neq("id", pageId || "")
        .not("summary", "is", null)
        .limit(20);

      console.log("📄 Query result for pages with summaries:", {
        error,
        pagesCount: pages?.length || 0,
        pages:
          pages?.map((p) => ({
            id: p.id,
            title: p.title,
            hasSummary: !!p.summary,
          })) || [],
      });

      if (error || !pages) {
        console.error("❌ Error fetching pages for link suggestions:", error);
        return [];
      }

      if (pages.length === 0) {
        console.log("⚠️ No pages with summaries found in workspace");
        return [];
      }

      // Use AI to analyze context and suggest relevant links
      const suggestions = await this.analyzeLinkRelevance(
        text,
        pages,
        contextWindow
      );

      console.log("🤖 analyzeLinkRelevance returned:", {
        suggestionsCount: suggestions.length,
        suggestions,
      });

      const filteredSuggestions = suggestions
        .filter((suggestion) => suggestion.confidence > 0.6) // Only return high-confidence suggestions
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 8); // Limit to top 8 suggestions

      console.log("📊 Final enhanced suggestions after filtering:", {
        originalCount: suggestions.length,
        filteredCount: filteredSuggestions.length,
        suggestions: filteredSuggestions,
      });

      return filteredSuggestions;
    } catch (error) {
      console.error("❌ Error getting enhanced link suggestions:", error);
      return [];
    }
  }

  /**
   * Use AI to analyze link relevance based on context and summaries
   */
  private static async analyzeLinkRelevance(
    text: string,
    pages: Array<{ id: string; title: string; summary: string }>,
    contextWindow: number
  ): Promise<
    Array<{
      pageId: string;
      pageTitle: string;
      summary: string;
      relevanceScore: number;
      suggestedText: string;
      confidence: number;
    }>
  > {
    // For now, implement a simpler approach that can be enhanced with more sophisticated AI later
    const suggestions = [];

    for (const page of pages) {
      const relevanceScore = this.calculateRelevanceScore(
        text,
        page.title,
        page.summary
      );

      if (relevanceScore > 0.3) {
        // Find the best text snippet to suggest for linking
        const suggestedText = this.findBestLinkText(text, page.title);

        suggestions.push({
          pageId: page.id,
          pageTitle: page.title,
          summary: page.summary,
          relevanceScore,
          suggestedText: suggestedText || page.title,
          confidence: Math.min(relevanceScore * 1.2, 1.0), // Boost confidence slightly
        });
      }
    }

    return suggestions;
  }

  /**
   * Calculate relevance score between current text and page
   */
  private static calculateRelevanceScore(
    text: string,
    pageTitle: string,
    pageSummary: string
  ): number {
    const textLower = text.toLowerCase();
    const titleLower = pageTitle.toLowerCase();
    const summaryLower = pageSummary.toLowerCase();

    let score = 0;

    // Exact title match gets highest score
    if (textLower.includes(titleLower)) {
      score += 0.8;
    }

    // Partial title word matches
    const titleWords = titleLower.split(" ").filter((word) => word.length > 3);
    const matchingTitleWords = titleWords.filter((word) =>
      textLower.includes(word)
    );
    score += (matchingTitleWords.length / Math.max(titleWords.length, 1)) * 0.4;

    // Summary keyword matches
    const summaryWords = summaryLower
      .split(" ")
      .filter((word) => word.length > 4)
      .slice(0, 20); // Take first 20 meaningful words

    const matchingSummaryWords = summaryWords.filter((word) =>
      textLower.includes(word)
    );
    score +=
      (matchingSummaryWords.length / Math.max(summaryWords.length, 1)) * 0.3;

    return Math.min(score, 1.0);
  }

  /**
   * Find the best text snippet in current text to suggest for linking
   */
  private static findBestLinkText(
    text: string,
    pageTitle: string
  ): string | null {
    const textLower = text.toLowerCase();
    const titleLower = pageTitle.toLowerCase();

    // Try exact title match first
    const exactIndex = textLower.indexOf(titleLower);
    if (exactIndex !== -1) {
      return text.substring(exactIndex, exactIndex + pageTitle.length);
    }

    // Try to find the longest matching word sequence
    const titleWords = pageTitle.split(" ");
    let bestMatch = "";

    for (let i = 0; i < titleWords.length; i++) {
      for (let j = i; j < titleWords.length; j++) {
        const phrase = titleWords.slice(i, j + 1).join(" ");
        const phraseIndex = textLower.indexOf(phrase.toLowerCase());

        if (phraseIndex !== -1 && phrase.length > bestMatch.length) {
          bestMatch = text.substring(phraseIndex, phraseIndex + phrase.length);
        }
      }
    }

    return bestMatch || null;
  }

  /**
   * Delete summary when page is deleted
   */
  static async deletePageSummary(pageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("pages")
        .update({ summary: null, summary_updated_at: null })
        .eq("id", pageId);

      if (error) {
        throw new Error(`Failed to delete summary: ${error.message}`);
      }

      console.log(`Deleted summary for page ${pageId}`);
    } catch (error) {
      console.error(`Error deleting summary for page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Get pages that need summary updates
   */
  static async getPagesNeedingSummaryUpdate(
    workspaceId: string
  ): Promise<string[]> {
    try {
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, content, updated_at, summary_updated_at")
        .eq("workspace_id", workspaceId);

      if (error || !pages) {
        return [];
      }

      const pageIds = [];

      for (const page of pages) {
        const needsUpdate = await this.checkIfSummaryNeedsUpdate(
          page.content,
          page.title,
          page.summary_updated_at,
          page.updated_at
        );

        if (needsUpdate) {
          pageIds.push(page.id);
        }
      }

      return pageIds;
    } catch (error) {
      console.error("Error checking pages for summary updates:", error);
      return [];
    }
  }
}
