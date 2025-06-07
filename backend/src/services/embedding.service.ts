import OpenAI from "openai";
import { supabase } from "../lib/supabase";
import crypto from "crypto";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface EmbeddingData {
  pageId: string;
  contentHash: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export class EmbeddingService {
  /**
   * Generate embedding for text content using OpenAI
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  /**
   * Calculate content hash for change detection
   */
  static calculateContentHash(title: string, content: any): string {
    const contentString = title + JSON.stringify(content || {});
    return crypto.createHash("md5").update(contentString).digest("hex");
  }

  /**
   * Extract text content from page for embedding
   */
  static extractTextFromPage(title: string, content: any): string {
    let text = title + "\n\n";

    if (content && typeof content === "object") {
      // If content is BlockNote format, extract text from blocks
      if (content.blocks && Array.isArray(content.blocks)) {
        for (const block of content.blocks) {
          if (block.content && Array.isArray(block.content)) {
            const blockText = block.content
              .map((item: any) => item.text || "")
              .join(" ");
            text += blockText + "\n";
          }
        }
      } else {
        // Fallback: convert entire content to string
        text += JSON.stringify(content);
      }
    }

    return text.trim();
  }

  /**
   * Generate and store embedding for a page
   */
  static async generatePageEmbedding(pageId: string): Promise<void> {
    try {
      // Fetch page data with tags
      const { data: page, error: pageError } = await supabase
        .from("pages")
        .select(
          `
          title, 
          content,
          page_tags (
            tags (
              name
            )
          )
        `
        )
        .eq("id", pageId)
        .single();

      if (pageError || !page) {
        throw new Error(`Page not found: ${pageId}`);
      }

      // Extract tags
      const tags =
        page.page_tags?.map((pt: any) => pt.tags?.name).filter(Boolean) || [];

      // Extract text and include tags
      let text = this.extractTextFromPage(page.title, page.content);

      // Add tags to the text for embedding
      if (tags.length > 0) {
        text += "\n\nTags: " + tags.join(", ");
      }

      const contentHash = this.calculateContentHash(
        page.title,
        page.content + tags.join(",")
      );

      // Check if embedding already exists and is up to date
      const { data: existingEmbedding, error: selectError } = await supabase
        .from("page_embeddings")
        .select("content_hash")
        .eq("page_id", pageId)
        .single();

      // Handle different error cases
      if (selectError) {
        console.log(`Select error details:`, {
          code: selectError.code,
          message: selectError.message,
          details: selectError.details,
          hint: selectError.hint,
        });

        // PGRST116 with "0 rows" means no existing embedding - this is normal
        if (
          selectError.code === "PGRST116" &&
          selectError.details?.includes("0 rows")
        ) {
          console.log(
            `No existing embedding found for page ${pageId}, will create new one`
          );
          // Continue to create new embedding
        } else if (selectError.code === "PGRST116") {
          // This would be the actual "table doesn't exist" case
          console.warn(
            `page_embeddings table does not exist. Skipping embedding generation for page ${pageId}`
          );
          return;
        } else {
          console.error(
            `Unexpected error checking existing embedding:`,
            selectError
          );
          // Continue anyway - we'll try to create the embedding
        }
      }

      if (existingEmbedding?.content_hash === contentHash) {
        console.log(`Embedding for page ${pageId} is already up to date`);
        return;
      }

      // Generate new embedding
      const embedding = await this.generateEmbedding(text);

      // Store or update embedding using proper upsert with conflict resolution
      const { error: upsertError } = await supabase
        .from("page_embeddings")
        .upsert(
          {
            page_id: pageId,
            content_hash: contentHash,
            embedding: JSON.stringify(embedding),
            metadata: {
              textLength: text.length,
              lastGenerated: new Date().toISOString(),
              tags: tags,
            },
          },
          {
            onConflict: "page_id", // Specify the conflict column explicitly
          }
        );

      if (upsertError) {
        console.log(`Upsert error details:`, {
          code: upsertError.code,
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
        });

        // Only skip if it's actually a table-not-found error (not a "no rows" error)
        if (
          upsertError.code === "PGRST116" &&
          !upsertError.details?.includes("0 rows")
        ) {
          console.warn(
            `page_embeddings table does not exist. Skipping embedding generation for page ${pageId}`
          );
          return;
        }
        throw new Error(
          `Failed to store embedding: ${upsertError.message || "Unknown error"}`
        );
      }

      console.log(
        `Generated embedding for page ${pageId} with ${tags.length} tags`
      );
    } catch (error) {
      console.error(`Error generating embedding for page ${pageId}:`, error);
      // Don't throw the error to prevent it from breaking page creation
      // throw error;
    }
  }

  /**
   * Batch generate embeddings for multiple pages
   */
  static async generateBatchEmbeddings(pageIds: string[]): Promise<void> {
    const batchSize = 5; // Process 5 pages at a time to avoid rate limits

    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map((pageId) => this.generatePageEmbedding(pageId))
      );

      // Add small delay between batches to respect rate limits
      if (i + batchSize < pageIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Generate embeddings for all pages in a workspace
   */
  static async generateWorkspaceEmbeddings(workspaceId: string): Promise<void> {
    try {
      // Get all pages in workspace
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id")
        .eq("workspace_id", workspaceId);

      if (error) {
        throw new Error(`Failed to fetch workspace pages: ${error.message}`);
      }

      if (!pages || pages.length === 0) {
        console.log(`No pages found in workspace ${workspaceId}`);
        return;
      }

      const pageIds = pages.map((page) => page.id);
      console.log(
        `Generating embeddings for ${pageIds.length} pages in workspace ${workspaceId}`
      );

      await this.generateBatchEmbeddings(pageIds);

      console.log(
        `Completed embedding generation for workspace ${workspaceId}`
      );
    } catch (error) {
      console.error(`Error generating workspace embeddings:`, error);
      throw error;
    }
  }

  /**
   * Perform semantic search using embeddings
   */
  static async semanticSearch(
    query: string,
    workspaceId?: string,
    limit: number = 20,
    similarityThreshold: number = 0.7
  ): Promise<any[]> {
    try {
      // Generate embedding for search query
      const queryEmbedding = await this.generateEmbedding(query);

      // Call database function for semantic search
      const { data, error } = await supabase.rpc("semantic_search", {
        query_embedding: JSON.stringify(queryEmbedding),
        workspace_filter: workspaceId || null,
        similarity_threshold: similarityThreshold,
        max_results: limit,
      });

      if (error) {
        throw new Error(`Semantic search failed: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error performing semantic search:", error);
      throw error;
    }
  }

  /**
   * Find similar pages to a given page
   */
  static async findSimilarPages(
    pageId: string,
    limit: number = 10,
    similarityThreshold: number = 0.7
  ): Promise<any[]> {
    try {
      // Call database function for finding similar pages
      const { data, error } = await supabase.rpc("find_similar_pages", {
        target_page_id: pageId,
        similarity_threshold: similarityThreshold,
        max_results: limit,
      });

      if (error) {
        throw new Error(`Failed to find similar pages: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error("Error finding similar pages:", error);
      throw error;
    }
  }

  /**
   * Delete embeddings for a page
   */
  static async deletePageEmbedding(pageId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("page_embeddings")
        .delete()
        .eq("page_id", pageId);

      if (error) {
        throw new Error(`Failed to delete embedding: ${error.message}`);
      }

      console.log(`Deleted embedding for page ${pageId}`);
    } catch (error) {
      console.error(`Error deleting embedding for page ${pageId}:`, error);
      throw error;
    }
  }
}
