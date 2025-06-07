import { supabase } from "../lib/supabase";
import { AIService } from "./ai.service";
import { EmbeddingService } from "./embedding.service";
import { TagClusteringService } from "./tag-clustering.service";

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
      console.log(
        "🔍 🤖 STEP 1: RAG (AI-ENHANCED) PROCESSING - SummaryService.getEnhancedLinkSuggestions called"
      );
      console.log("🔍 STEP 1.1: Input parameters:", {
        text,
        workspaceId,
        pageId,
        contextWindow,
      });

      // First, get already linked pages to exclude them
      let alreadyLinkedPageIds: string[] = [];
      if (pageId) {
        console.log("🔗 STEP 1.2: Fetching already linked pages for exclusion");

        // Get pages linked FROM the current page
        const { data: outgoingLinks, error: outgoingError } = await supabase
          .from("page_links")
          .select("target_page_id")
          .eq("source_page_id", pageId);

        if (!outgoingError && outgoingLinks) {
          alreadyLinkedPageIds = outgoingLinks.map(
            (link) => link.target_page_id
          );
        }

        // Also get pages that are already linked within the current page's content
        // This ensures we don't suggest pages that are already linked elsewhere in the document
        const { data: currentPage, error: pageError } = await supabase
          .from("pages")
          .select("content")
          .eq("id", pageId)
          .single();

        if (!pageError && currentPage && currentPage.content) {
          const linkedPageIds = this.extractLinkedPageIds(currentPage.content);
          alreadyLinkedPageIds = [
            ...new Set([...alreadyLinkedPageIds, ...linkedPageIds]),
          ];
        }

        console.log(
          `📋 STEP 1.3: Found ${alreadyLinkedPageIds.length} already linked pages to exclude:`,
          alreadyLinkedPageIds
        );
      }

      // Use semantic search to find relevant pages
      console.log("🧠 STEP 2: Performing semantic search for relevant pages");
      const queryEmbedding = await EmbeddingService.generateEmbedding(text);

      const { data: searchResults, error: searchError } = await supabase.rpc(
        "semantic_search_workspace_only",
        {
          query_embedding: JSON.stringify(queryEmbedding),
          workspace_filter: workspaceId,
          similarity_threshold: 0.65, // Lowered slightly for better recall
          max_results: 30, // Increased to have more candidates before filtering
        }
      );

      if (searchError || !searchResults) {
        console.error("❌ STEP 2.1: Semantic search failed:", searchError);

        // Fallback to summary-based search
        console.log("🔄 STEP 2.2: Falling back to summary-based search");
        const { data: pages, error } = await supabase
          .from("pages")
          .select("id, title, summary, content")
          .eq("workspace_id", workspaceId)
          .not(
            "id",
            "in",
            `(${[pageId, ...alreadyLinkedPageIds].filter(Boolean).join(",")})`
          )
          .not("summary", "is", null)
          .limit(30);

        if (error || !pages) {
          console.error(
            "❌ 🤖 RAG FAILED - Error fetching pages for link suggestions:",
            error
          );
          return [];
        }

        if (pages.length === 0) {
          console.log(
            "⚠️ 🤖 RAG FAILED - No pages with AI-generated summaries found in workspace"
          );
          return [];
        }

        console.log(
          `✅ STEP 2.3: Found ${pages.length} pages after filtering already linked pages`
        );

        // Use AI to analyze context and suggest relevant links
        const suggestions = await this.analyzeLinkRelevance(
          text,
          pages,
          contextWindow,
          pageId
        );

        return this.filterAndSortSuggestions(suggestions);
      }

      // Process semantic search results
      console.log(
        `✅ STEP 2.4: Semantic search returned ${searchResults.length} results`
      );

      // Get full page data for search results, excluding already linked pages
      const pageIds = searchResults
        .map((result: any) => result.page_id)
        .filter(
          (id: string) =>
            id && id !== pageId && !alreadyLinkedPageIds.includes(id)
        );

      console.log(
        `📋 STEP 2.5: After filtering current page and already linked pages: ${pageIds.length} candidates remain`
      );

      if (pageIds.length === 0) {
        console.log(
          "⚠️ STEP 2.6: No valid pages after filtering current page and already linked pages"
        );
        return [];
      }

      const { data: pages, error: pagesError } = await supabase
        .from("pages")
        .select("id, title, summary, content")
        .in("id", pageIds);

      if (pagesError || !pages) {
        console.error("❌ STEP 2.6: Error fetching page details:", pagesError);
        return [];
      }

      // Combine semantic similarity with content analysis
      const enhancedPages = pages.map((page) => {
        const searchResult = searchResults.find(
          (r: any) => r.page_id === page.id
        );
        return {
          ...page,
          semanticSimilarity: searchResult?.similarity || 0,
        };
      });

      console.log(
        `✅ STEP 3: Analyzing ${enhancedPages.length} semantically relevant pages`
      );

      // Analyze relevance with both semantic and content-based scoring
      const suggestions = await this.analyzeEnhancedLinkRelevance(
        text,
        enhancedPages,
        contextWindow,
        pageId
      );

      return this.filterAndSortSuggestions(suggestions);
    } catch (error) {
      console.error(
        "❌ 🤖 RAG ERROR - Error getting enhanced link suggestions:",
        error
      );
      return [];
    }
  }

  /**
   * Extract linked page IDs from BlockNote content
   */
  private static extractLinkedPageIds(content: any): string[] {
    const linkedPageIds: string[] = [];

    const traverseContent = (blocks: any[]) => {
      if (!Array.isArray(blocks)) return;

      for (const block of blocks) {
        // Check inline content for links
        if (block.content && Array.isArray(block.content)) {
          for (const inline of block.content) {
            if (inline.type === "link" && inline.href) {
              // Extract page ID from internal links (format: /page/{pageId})
              const match = inline.href.match(/\/page\/([a-f0-9-]+)/);
              if (match && match[1]) {
                linkedPageIds.push(match[1]);
              }
            }
          }
        }

        // Recursively check children blocks
        if (block.children && Array.isArray(block.children)) {
          traverseContent(block.children);
        }
      }
    };

    if (Array.isArray(content)) {
      traverseContent(content);
    }

    return [...new Set(linkedPageIds)]; // Remove duplicates
  }

  /**
   * Analyze link relevance with semantic similarity boost
   */
  private static async analyzeEnhancedLinkRelevance(
    text: string,
    pages: Array<{
      id: string;
      title: string;
      summary: string;
      content?: any;
      semanticSimilarity?: number;
    }>,
    contextWindow: number,
    currentPageId?: string
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
    const suggestions = [];

    // Get linked pages information for confidence boost
    const linkedPagesInfo = await this.getLinkedPagesInfo(
      pages.map((p) => p.id)
    );

    // Get reverse links if we have a current page
    let reverseLinks = new Set<string>();
    if (currentPageId) {
      const { data: links, error } = await supabase
        .from("page_links")
        .select("source_page_id")
        .eq("target_page_id", currentPageId)
        .in(
          "source_page_id",
          pages.map((p) => p.id)
        );

      if (!error && links) {
        reverseLinks = new Set(links.map((link) => link.source_page_id));
      }
    }

    // Get tags for all pages including current page
    const allPageIds = currentPageId
      ? [...pages.map((p) => p.id), currentPageId]
      : pages.map((p) => p.id);
    const { data: pageTags, error: tagsError } = await supabase
      .from("page_tags")
      .select(
        `
        page_id,
        tags (
          id,
          name
        )
      `
      )
      .in("page_id", allPageIds);

    const pageTagsMap = new Map<string, Array<{ id: string; name: string }>>();
    if (!tagsError && pageTags) {
      for (const pt of pageTags) {
        if (!pageTagsMap.has(pt.page_id)) {
          pageTagsMap.set(pt.page_id, []);
        }
        if (
          pt.tags &&
          typeof pt.tags === "object" &&
          "id" in pt.tags &&
          "name" in pt.tags
        ) {
          pageTagsMap.get(pt.page_id)!.push({
            id: (pt.tags as any).id,
            name: (pt.tags as any).name,
          });
        }
      }
    }

    // Get current page tags for cluster comparison
    const currentPageTags = currentPageId
      ? pageTagsMap.get(currentPageId) || []
      : [];
    const currentPageTagIds = currentPageTags.map((t) => t.id);

    // Get workspace ID for clustering
    let workspaceId: string | null = null;
    if (pages.length > 0) {
      const { data: pageData } = await supabase
        .from("pages")
        .select("workspace_id")
        .eq("id", pages[0].id)
        .single();

      workspaceId = pageData?.workspace_id || null;
    }

    for (const page of pages) {
      // Extract text content if available
      let pageContent = page.summary || "";
      if (page.content) {
        try {
          pageContent = this.extractTextFromContent(page.content).slice(
            0,
            1000
          );
        } catch (e) {
          console.warn(`Failed to extract content for page ${page.id}`);
        }
      }

      // Get tags for this page
      const pageTags = pageTagsMap.get(page.id) || [];
      const pageTagNames = pageTags.map((t) => t.name);
      const pageTagIds = pageTags.map((t) => t.id);

      // Calculate content relevance score (decreased importance)
      const contentScore =
        this.calculateRelevanceScore(text, page.title, pageContent) * 0.3; // Reduced from 1.0 to 0.3 (30% weight)

      // Calculate tag relevance score
      const tagScore = this.calculateTagRelevance(text, pageTagNames);

      // Calculate cluster relevance score
      let clusterScore = 0;
      if (
        workspaceId &&
        currentPageTagIds.length > 0 &&
        pageTagIds.length > 0
      ) {
        clusterScore = await TagClusteringService.calculateClusterRelevance(
          currentPageTagIds,
          pageTagIds,
          workspaceId
        );
      }

      // Check if this page already links to the current page
      const hasReverseLink = reverseLinks.has(page.id);

      // Calculate enhanced confidence score with tags and clusters
      const confidence = this.calculateEnhancedConfidence(
        contentScore,
        page.semanticSimilarity || 0,
        linkedPagesInfo.get(page.id) || {
          incomingLinks: 0,
          outgoingLinks: 0,
          mutualConnections: 0,
        },
        hasReverseLink,
        tagScore,
        clusterScore
      );

      if (confidence > 0.3) {
        // Find the best text snippet to suggest for linking
        const suggestedText = this.findBestLinkText(text, page.title);

        suggestions.push({
          pageId: page.id,
          pageTitle: page.title,
          summary: page.summary || pageContent.slice(0, 200) + "...",
          relevanceScore: contentScore,
          suggestedText: suggestedText || page.title,
          confidence: confidence,
        });
      }
    }

    return suggestions;
  }

  /**
   * Calculate tag relevance score
   */
  private static calculateTagRelevance(text: string, tags: string[]): number {
    if (tags.length === 0) return 0;

    const textLower = text.toLowerCase();
    const textWords = this.extractKeywords(textLower);

    let matchCount = 0;
    for (const tag of tags) {
      const tagLower = tag.toLowerCase();

      // Check exact tag match in text
      if (textLower.includes(tagLower)) {
        matchCount += 2; // Higher weight for exact match
      } else {
        // Check if any tag words appear in text keywords
        const tagWords = tagLower.split(/\s+/);
        for (const tagWord of tagWords) {
          if (tagWord.length > 3 && textWords.includes(tagWord)) {
            matchCount += 1;
          }
        }
      }
    }

    // Normalize score (max 1.0)
    return Math.min(matchCount / (tags.length * 2), 1.0);
  }

  /**
   * Calculate enhanced confidence score based on multiple factors
   * Updated algorithm with decreased string match importance:
   * - Base: Heavily weighted towards semantic similarity (70%)
   * - Content relevance: Reduced to 30% weight
   * - Tag relevance: Bonus up to +0.15
   * - Cluster relevance: Bonus up to +0.3
   * - Link relationships: Bonus up to +0.15
   * - Reverse link: Bonus +0.1
   */
  private static calculateEnhancedConfidence(
    contentScore: number,
    semanticSimilarity: number,
    linkInfo: {
      incomingLinks: number;
      outgoingLinks: number;
      mutualConnections: number;
    },
    hasReverseLink: boolean = false,
    tagScore: number = 0,
    clusterScore: number = 0
  ): number {
    // UPDATED: Semantic similarity is now the primary factor

    // If semantic similarity is too low, cap confidence
    if (semanticSimilarity < 0.5) {
      return Math.min(semanticSimilarity, 0.3);
    }

    // Calculate base confidence with heavy semantic weighting
    // 70% semantic, 30% content (string match)
    let confidence = semanticSimilarity * 0.7 + contentScore * 0.3;

    // Add tag relevance bonus (up to +0.15)
    const tagBonus = tagScore * 0.15;
    confidence += tagBonus;

    // Add cluster relevance bonus (up to +0.3)
    confidence += clusterScore;

    // Add link relationship bonus (up to +0.15)
    const linkScore = Math.min(
      linkInfo.incomingLinks * 0.02 +
        linkInfo.outgoingLinks * 0.02 +
        linkInfo.mutualConnections * 0.04,
      0.15
    );
    confidence += linkScore;

    // Add reverse link bonus (+10% if the suggested page already links to current page)
    if (hasReverseLink) {
      confidence += 0.1;
    }

    // Apply confidence levels based on final score
    if (confidence >= 0.8) {
      // High confidence - strong semantic match
      confidence = Math.min(confidence, 0.95);
    } else if (confidence >= 0.6) {
      // Good confidence - decent semantic match
      confidence = Math.min(confidence, 0.79);
    } else if (confidence >= 0.4) {
      // Medium confidence - moderate match
      confidence = Math.min(confidence, 0.59);
    } else {
      // Low confidence - weak match
      confidence = Math.min(confidence, 0.39);
    }

    return confidence;
  }

  /**
   * Get linked pages information for confidence calculation
   */
  private static async getLinkedPagesInfo(pageIds: string[]): Promise<
    Map<
      string,
      {
        incomingLinks: number;
        outgoingLinks: number;
        mutualConnections: number;
      }
    >
  > {
    const linkInfo = new Map();

    try {
      // Get all links involving these pages
      const { data: links, error } = await supabase
        .from("page_links")
        .select("source_page_id, target_page_id")
        .or(
          `source_page_id.in.(${pageIds.join(
            ","
          )}),target_page_id.in.(${pageIds.join(",")})`
        );

      if (error) {
        console.warn(
          "Failed to fetch page links for confidence calculation:",
          error
        );
        return linkInfo;
      }

      // Initialize link counts
      for (const pageId of pageIds) {
        linkInfo.set(pageId, {
          incomingLinks: 0,
          outgoingLinks: 0,
          mutualConnections: 0,
        });
      }

      // Count links
      const outgoingMap = new Map<string, Set<string>>();
      const incomingMap = new Map<string, Set<string>>();

      for (const link of links || []) {
        // Outgoing links
        if (pageIds.includes(link.source_page_id)) {
          if (!outgoingMap.has(link.source_page_id)) {
            outgoingMap.set(link.source_page_id, new Set());
          }
          outgoingMap.get(link.source_page_id)!.add(link.target_page_id);
        }

        // Incoming links
        if (pageIds.includes(link.target_page_id)) {
          if (!incomingMap.has(link.target_page_id)) {
            incomingMap.set(link.target_page_id, new Set());
          }
          incomingMap.get(link.target_page_id)!.add(link.source_page_id);
        }
      }

      // Calculate mutual connections
      for (const pageId of pageIds) {
        const outgoing = outgoingMap.get(pageId) || new Set();
        const incoming = incomingMap.get(pageId) || new Set();

        // Count mutual connections (pages that both link to and from this page)
        let mutualCount = 0;
        for (const targetId of outgoing) {
          if (incoming.has(targetId)) {
            mutualCount++;
          }
        }

        linkInfo.set(pageId, {
          incomingLinks: incoming.size,
          outgoingLinks: outgoing.size,
          mutualConnections: mutualCount,
        });
      }
    } catch (error) {
      console.error("Error fetching linked pages info:", error);
    }

    return linkInfo;
  }

  /**
   * Extract text from BlockNote content
   */
  private static extractTextFromContent(content: any): string {
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((block) => this.extractTextFromBlock(block))
        .filter(Boolean)
        .join(" ");
    }

    return "";
  }

  /**
   * Extract text from a single block
   */
  private static extractTextFromBlock(block: any): string {
    if (!block) return "";

    // Handle text content
    if (block.type === "text" && block.text) {
      return block.text;
    }

    // Handle paragraph/heading blocks
    if (
      (block.type === "paragraph" || block.type === "heading") &&
      block.content
    ) {
      if (Array.isArray(block.content)) {
        return block.content.map((inline: any) => inline.text || "").join("");
      }
    }

    // Handle nested content
    if (block.content && Array.isArray(block.content)) {
      return block.content
        .map((child: any) => this.extractTextFromBlock(child))
        .join(" ");
    }

    if (block.children && Array.isArray(block.children)) {
      return block.children
        .map((child: any) => this.extractTextFromBlock(child))
        .join(" ");
    }

    return "";
  }

  /**
   * Filter and sort suggestions with improved confidence thresholds
   */
  private static filterAndSortSuggestions(
    suggestions: Array<{
      pageId: string;
      pageTitle: string;
      summary: string;
      relevanceScore: number;
      suggestedText: string;
      confidence: number;
    }>
  ): Array<{
    pageId: string;
    pageTitle: string;
    summary: string;
    relevanceScore: number;
    suggestedText: string;
    confidence: number;
  }> {
    // Remove duplicates based on pageId
    const uniqueSuggestions = new Map<string, (typeof suggestions)[0]>();

    for (const suggestion of suggestions) {
      // If we already have this page, keep the one with higher confidence
      if (uniqueSuggestions.has(suggestion.pageId)) {
        const existing = uniqueSuggestions.get(suggestion.pageId)!;
        if (suggestion.confidence > existing.confidence) {
          uniqueSuggestions.set(suggestion.pageId, suggestion);
        }
      } else {
        uniqueSuggestions.set(suggestion.pageId, suggestion);
      }
    }

    // Convert back to array and filter/sort
    const filteredSuggestions = Array.from(uniqueSuggestions.values())
      .filter((suggestion) => suggestion.confidence > 0.3) // Lower threshold to show more suggestions
      .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
      .slice(0, 10); // Show up to 10 suggestions

    // Log confidence distribution
    const confidenceLevels = {
      high: filteredSuggestions.filter((s) => s.confidence >= 0.8).length,
      good: filteredSuggestions.filter(
        (s) => s.confidence >= 0.6 && s.confidence < 0.8
      ).length,
      medium: filteredSuggestions.filter(
        (s) => s.confidence >= 0.4 && s.confidence < 0.6
      ).length,
      low: filteredSuggestions.filter((s) => s.confidence < 0.4).length,
    };

    console.log(
      "📊 🤖 STEP 4: RAG FINAL RESULTS - Enhanced suggestions after filtering:",
      {
        originalCount: suggestions.length,
        uniqueCount: uniqueSuggestions.size,
        filteredCount: filteredSuggestions.length,
        confidenceLevels,
        suggestions: filteredSuggestions.map((s) => ({
          title: s.pageTitle,
          score: s.relevanceScore.toFixed(3),
          confidence: s.confidence.toFixed(3),
          level:
            s.confidence >= 0.8
              ? "High"
              : s.confidence >= 0.6
              ? "Good"
              : s.confidence >= 0.4
              ? "Medium"
              : "Low",
        })),
      }
    );

    if (filteredSuggestions.length > 0) {
      console.log(
        "✅ 🤖 RAG SUCCESS - AI-enhanced suggestions generated successfully!"
      );
    } else {
      console.log("❌ 🤖 RAG FAILED - No suggestions found (confidence < 0.3)");
    }

    return filteredSuggestions;
  }

  /**
   * Use AI to analyze link relevance based on context and summaries
   * This is used when semantic search is not available (fallback mode)
   */
  private static async analyzeLinkRelevance(
    text: string,
    pages: Array<{ id: string; title: string; summary: string }>,
    contextWindow: number,
    currentPageId?: string
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
    const suggestions = [];

    // Get linked pages information for confidence boost
    const linkedPagesInfo = await this.getLinkedPagesInfo(
      pages.map((p) => p.id)
    );

    // Get reverse links if we have a current page
    let reverseLinks = new Set<string>();
    if (currentPageId) {
      const { data: links, error } = await supabase
        .from("page_links")
        .select("source_page_id")
        .eq("target_page_id", currentPageId)
        .in(
          "source_page_id",
          pages.map((p) => p.id)
        );

      if (!error && links) {
        reverseLinks = new Set(links.map((link) => link.source_page_id));
      }
    }

    // Get tags for all pages including current page
    const allPageIds = currentPageId
      ? [...pages.map((p) => p.id), currentPageId]
      : pages.map((p) => p.id);
    const { data: pageTags, error: tagsError } = await supabase
      .from("page_tags")
      .select(
        `
        page_id,
        tags (
          id,
          name
        )
      `
      )
      .in("page_id", allPageIds);

    const pageTagsMap = new Map<string, Array<{ id: string; name: string }>>();
    if (!tagsError && pageTags) {
      for (const pt of pageTags) {
        if (!pageTagsMap.has(pt.page_id)) {
          pageTagsMap.set(pt.page_id, []);
        }
        if (
          pt.tags &&
          typeof pt.tags === "object" &&
          "id" in pt.tags &&
          "name" in pt.tags
        ) {
          pageTagsMap.get(pt.page_id)!.push({
            id: (pt.tags as any).id,
            name: (pt.tags as any).name,
          });
        }
      }
    }

    // Get current page tags for cluster comparison
    const currentPageTags = currentPageId
      ? pageTagsMap.get(currentPageId) || []
      : [];
    const currentPageTagIds = currentPageTags.map((t) => t.id);

    // Get workspace ID for clustering
    let workspaceId: string | null = null;
    if (pages.length > 0) {
      const { data: pageData } = await supabase
        .from("pages")
        .select("workspace_id")
        .eq("id", pages[0].id)
        .single();

      workspaceId = pageData?.workspace_id || null;
    }

    for (const page of pages) {
      // Get tags for this page
      const pageTags = pageTagsMap.get(page.id) || [];
      const pageTagNames = pageTags.map((t) => t.name);
      const pageTagIds = pageTags.map((t) => t.id);

      // Calculate relevance score (reduced importance)
      const relevanceScore =
        this.calculateRelevanceScore(text, page.title, page.summary) * 0.3; // Reduced from 1.0 to 0.3

      // Calculate tag relevance
      const tagScore = this.calculateTagRelevance(text, pageTagNames);

      // Calculate cluster relevance score
      let clusterScore = 0;
      if (
        workspaceId &&
        currentPageTagIds.length > 0 &&
        pageTagIds.length > 0
      ) {
        clusterScore = await TagClusteringService.calculateClusterRelevance(
          currentPageTagIds,
          pageTagIds,
          workspaceId
        );
      }

      // Check if this page already links to the current page
      const hasReverseLink = reverseLinks.has(page.id);

      // For fallback mode, we don't have semantic similarity, so we use tag score as a proxy
      const confidence = this.calculateEnhancedConfidence(
        relevanceScore,
        tagScore * 0.5, // Use tag score as partial semantic proxy in fallback mode
        linkedPagesInfo.get(page.id) || {
          incomingLinks: 0,
          outgoingLinks: 0,
          mutualConnections: 0,
        },
        hasReverseLink,
        tagScore,
        clusterScore
      );

      if (confidence > 0.3) {
        // Find the best text snippet to suggest for linking
        const suggestedText = this.findBestLinkText(text, page.title);

        suggestions.push({
          pageId: page.id,
          pageTitle: page.title,
          summary: page.summary,
          relevanceScore,
          suggestedText: suggestedText || page.title,
          confidence: confidence,
        });
      }
    }

    return suggestions;
  }

  /**
   * Calculate relevance score between current text and page
   * More strict string matching that better validates relevance
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

    // Check for exact title match (highest signal)
    if (textLower.includes(titleLower)) {
      score = 1.0; // Maximum score for exact match
      return score;
    }

    // Check for significant title word matches
    const titleWords = titleLower
      .split(/\s+/)
      .filter((word) => word.length > 3);

    if (titleWords.length > 0) {
      const matchingWords = titleWords.filter((word) =>
        textLower.includes(word)
      );

      // Calculate title match score
      const titleMatchRatio = matchingWords.length / titleWords.length;

      // If most title words match, it's a strong signal
      if (titleMatchRatio >= 0.7) {
        score = 0.8;
        return score;
      } else if (titleMatchRatio >= 0.5) {
        score = Math.max(score, 0.5);
      } else if (titleMatchRatio >= 0.3) {
        score = Math.max(score, 0.3);
      }
    }

    // Check for meaningful keyword matches from summary
    const keywords = this.extractKeywords(summaryLower);
    const textKeywords = this.extractKeywords(textLower);

    // Find common keywords between text and summary
    const commonKeywords = keywords.filter((keyword) =>
      textKeywords.includes(keyword)
    );

    if (commonKeywords.length > 0) {
      // Score based on percentage of keywords matched
      const keywordScore = Math.min(
        (commonKeywords.length /
          Math.max(Math.min(keywords.length, textKeywords.length), 1)) *
          0.6,
        0.6
      );
      score = Math.max(score, keywordScore);
    }

    return score;
  }

  /**
   * Extract meaningful keywords from text
   */
  private static extractKeywords(text: string): string[] {
    // Common words to exclude
    const stopWords = new Set([
      "the",
      "is",
      "at",
      "which",
      "on",
      "and",
      "a",
      "an",
      "as",
      "are",
      "was",
      "were",
      "been",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "should",
      "could",
      "may",
      "might",
      "must",
      "can",
      "this",
      "that",
      "these",
      "those",
      "with",
      "from",
      "about",
      "into",
      "through",
      "during",
      "before",
      "after",
      "above",
      "below",
      "between",
      "under",
      "over",
      "but",
      "by",
      "for",
      "of",
      "to",
      "in",
      "it",
      "its",
    ]);

    return text
      .split(/\s+/)
      .filter((word) => word.length > 4 && !stopWords.has(word))
      .slice(0, 15); // Top 15 keywords
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
