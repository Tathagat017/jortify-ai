import { supabase } from "../lib/supabase";
import { EmbeddingService } from "./embedding.service";
import { DocumentParserService } from "./document-parser.service";
import { AppError } from "../middleware/error-handler";

export interface FileEmbeddingResult {
  fileId: string;
  chunks: number;
  success: boolean;
  error?: string;
}

export class FileEmbeddingService {
  /**
   * Process a file and generate embeddings for its chunks
   */
  static async processFileForEmbeddings(
    fileId: string,
    fileBuffer: Buffer,
    fileType: "pdf" | "docx"
  ): Promise<FileEmbeddingResult> {
    try {
      // Parse the document
      const parsedDoc = await DocumentParserService.parseDocument(
        fileBuffer,
        fileType
      );

      // Chunk the document using advanced chunking with fallback
      const chunks = await DocumentParserService.chunkDocument(parsedDoc.text, {
        maxTokens: 1000,
        overlapTokens: 200,
        useAdvancedChunking: true,
        preserveCodeBlocks: true,
        preserveMarkdown: true,
      });

      console.log(`📋 Generated ${chunks.length} chunks for file ${fileId}`);

      // Generate embeddings for each chunk
      const embeddingPromises = chunks.map(async (chunk, index) => {
        try {
          // Generate embedding
          const embedding = await EmbeddingService.generateEmbedding(chunk);

          // Store in database
          const { error } = await supabase.from("file_embeddings").insert({
            file_id: fileId,
            chunk_index: index,
            chunk_text: chunk,
            embedding: JSON.stringify(embedding),
            metadata: {
              chunk_length: chunk.length,
              chunk_words: chunk.split(/\s+/).length,
              token_count: DocumentParserService.getTokenCount(chunk),
              chunking_method: "langchain_tiktoken",
            },
          });

          if (error) {
            console.error(`Error storing embedding for chunk ${index}:`, error);
            throw error;
          }

          return { index, success: true };
        } catch (error) {
          console.error(`Error processing chunk ${index}:`, error);
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          return { index, success: false, error: errorMessage };
        }
      });

      // Wait for all embeddings to be processed
      const results = await Promise.all(embeddingPromises);

      // Check if all chunks were processed successfully
      const failedChunks = results.filter((r) => !r.success);
      if (failedChunks.length > 0) {
        console.warn(
          `Failed to process ${failedChunks.length} chunks for file ${fileId}`
        );
      }

      return {
        fileId,
        chunks: chunks.length,
        success: failedChunks.length === 0,
        error:
          failedChunks.length > 0
            ? `Failed to process ${failedChunks.length} out of ${chunks.length} chunks`
            : undefined,
      };
    } catch (error) {
      console.error("Error processing file for embeddings:", error);
      throw new AppError(500, "Failed to process file for embeddings");
    }
  }

  /**
   * Delete all embeddings for a file
   */
  static async deleteFileEmbeddings(fileId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("file_embeddings")
        .delete()
        .eq("file_id", fileId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Error deleting file embeddings:", error);
      throw new AppError(500, "Failed to delete file embeddings");
    }
  }

  /**
   * Get embeddings for a file
   */
  static async getFileEmbeddings(fileId: string): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from("file_embeddings")
        .select("*")
        .eq("file_id", fileId)
        .order("chunk_index", { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching file embeddings:", error);
      throw new AppError(500, "Failed to fetch file embeddings");
    }
  }

  /**
   * Search file embeddings for relevant chunks
   */
  static async searchFileEmbeddings(
    query: string,
    workspaceId: string,
    maxResults: number = 5,
    similarityThreshold: number = 0.7
  ): Promise<any[]> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // Use the enhanced semantic search function
      const { data, error } = await supabase.rpc("semantic_search_with_files", {
        query_embedding: JSON.stringify(queryEmbedding),
        workspace_filter: workspaceId,
        similarity_threshold: similarityThreshold,
        max_results: maxResults,
      });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error searching file embeddings:", error);
      throw new AppError(500, "Failed to search file embeddings");
    }
  }
}
