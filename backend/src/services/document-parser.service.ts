import pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { AppError } from "../middleware/error-handler";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { encoding_for_model } from "tiktoken";

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    characterCount: number;
  };
}

export interface ChunkingOptions {
  maxTokens?: number;
  overlapTokens?: number;
  useAdvancedChunking?: boolean;
  preserveCodeBlocks?: boolean;
  preserveMarkdown?: boolean;
}

export interface ChunkingResult {
  chunks: string[];
  metadata: {
    totalChunks: number;
    method: "advanced" | "basic";
    avgTokensPerChunk: number;
    avgCharsPerChunk: number;
    totalTokens: number;
    processingTime: number;
  };
}

export class DocumentParserService {
  /**
   * Parse a document file and extract text content
   */
  static async parseDocument(
    fileBuffer: Buffer,
    fileType: "pdf" | "docx"
  ): Promise<ParsedDocument> {
    try {
      switch (fileType) {
        case "pdf":
          return await this.parsePDF(fileBuffer);
        case "docx":
          return await this.parseDOCX(fileBuffer);
        default:
          throw new AppError(400, `Unsupported file type: ${fileType}`);
      }
    } catch (error) {
      console.error("Error parsing document:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(500, "Failed to parse document");
    }
  }

  /**
   * Parse PDF file
   */
  private static async parsePDF(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const data = await pdfParse(buffer);

      const text = data.text.trim();
      const wordCount = text
        .split(/\s+/)
        .filter((word: string) => word.length > 0).length;

      return {
        text,
        metadata: {
          pageCount: data.numpages,
          wordCount,
          characterCount: text.length,
        },
      };
    } catch (error) {
      console.error("PDF parsing error:", error);
      throw new AppError(500, "Failed to parse PDF file");
    }
  }

  /**
   * Parse DOCX file
   */
  private static async parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      if (result.messages.length > 0) {
        console.warn("DOCX parsing warnings:", result.messages);
      }

      const text = result.value.trim();
      const wordCount = text
        .split(/\s+/)
        .filter((word: string) => word.length > 0).length;

      return {
        text,
        metadata: {
          wordCount,
          characterCount: text.length,
        },
      };
    } catch (error) {
      console.error("DOCX parsing error:", error);
      throw new AppError(500, "Failed to parse DOCX file");
    }
  }

  /**
   * Enhanced chunk document with detailed metadata
   */
  static async chunkDocumentWithMetadata(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<ChunkingResult> {
    const startTime = Date.now();
    const chunks = await this.chunkDocument(text, options);
    const processingTime = Date.now() - startTime;

    // Calculate metadata
    const totalTokens = chunks.reduce(
      (sum, chunk) => sum + this.getTokenCount(chunk),
      0
    );
    const avgTokensPerChunk = Math.round(totalTokens / chunks.length);
    const avgCharsPerChunk = Math.round(
      chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length
    );

    return {
      chunks,
      metadata: {
        totalChunks: chunks.length,
        method: options.useAdvancedChunking !== false ? "advanced" : "basic",
        avgTokensPerChunk,
        avgCharsPerChunk,
        totalTokens,
        processingTime,
      },
    };
  }

  /**
   * Enhanced chunk document text using LangChain with tiktoken tokenization
   * Falls back to basic chunking if advanced chunking fails
   */
  static async chunkDocument(
    text: string,
    options: ChunkingOptions = {}
  ): Promise<string[]> {
    const {
      maxTokens = 1000,
      overlapTokens = 200,
      useAdvancedChunking = true,
      preserveCodeBlocks = true,
      preserveMarkdown = true,
    } = options;

    console.log("🔄 Starting chunking process...");
    console.log(`📊 Text length: ${text.length} characters`);
    console.log(`⚙️ Max tokens: ${maxTokens}, Overlap: ${overlapTokens}`);
    console.log(`🚀 Advanced chunking: ${useAdvancedChunking}`);

    if (useAdvancedChunking) {
      try {
        return await this.advancedChunkDocument(
          text,
          maxTokens,
          overlapTokens,
          {
            preserveCodeBlocks,
            preserveMarkdown,
          }
        );
      } catch (error) {
        console.warn(
          "🚨 Advanced chunking failed, falling back to basic chunking:",
          error
        );
        return this.basicChunkDocument(text, maxTokens, overlapTokens);
      }
    } else {
      return this.basicChunkDocument(text, maxTokens, overlapTokens);
    }
  }

  /**
   * Advanced chunking using LangChain RecursiveCharacterTextSplitter with tiktoken
   */
  private static async advancedChunkDocument(
    text: string,
    maxTokens: number,
    overlapTokens: number,
    options: { preserveCodeBlocks: boolean; preserveMarkdown: boolean }
  ): Promise<string[]> {
    console.log("🚀 Using advanced LangChain + tiktoken chunking");

    try {
      // Initialize tiktoken encoder for accurate token counting
      const encoder = encoding_for_model("gpt-3.5-turbo");

      // Custom length function using tiktoken
      const lengthFunction = (text: string): number => {
        return encoder.encode(text).length;
      };

      // Configure separators based on content type
      const separators = this.buildSeparators(options);

      // Create RecursiveCharacterTextSplitter with tiktoken
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: maxTokens,
        chunkOverlap: overlapTokens,
        lengthFunction,
        separators,
        keepSeparator: true,
      });

      // Split the text
      const chunks = await splitter.splitText(text);

      // Clean up encoder
      encoder.free();

      console.log(`✅ Advanced chunking completed: ${chunks.length} chunks`);
      console.log(
        `📊 Average chunk size: ${Math.round(
          chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length
        )} characters`
      );

      return chunks.filter((chunk) => chunk.trim().length > 0);
    } catch (error) {
      console.error("❌ Advanced chunking error:", error);
      throw error;
    }
  }

  /**
   * Basic chunking method (fallback) - Original implementation
   */
  private static basicChunkDocument(
    text: string,
    maxTokens: number,
    overlapTokens: number
  ): string[] {
    console.log("🔄 Using basic word-based chunking (fallback)");

    // Simple word-based chunking (approximating 1 token ≈ 0.75 words)
    const wordsPerChunk = Math.floor(maxTokens * 0.75);
    const overlapWords = Math.floor(overlapTokens * 0.75);

    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += wordsPerChunk - overlapWords) {
      const chunkWords = words.slice(i, i + wordsPerChunk);
      const chunk = chunkWords.join(" ");

      if (chunk.trim().length > 0) {
        chunks.push(chunk);
      }

      // Stop if we've processed all words
      if (i + wordsPerChunk >= words.length) break;
    }

    console.log(`✅ Basic chunking completed: ${chunks.length} chunks`);
    return chunks;
  }

  /**
   * Build separators for RecursiveCharacterTextSplitter based on content type
   */
  private static buildSeparators(options: {
    preserveCodeBlocks: boolean;
    preserveMarkdown: boolean;
  }): string[] {
    const separators: string[] = [];

    if (options.preserveMarkdown) {
      // Markdown-specific separators
      separators.push(
        "\n## ", // H2 headers
        "\n### ", // H3 headers
        "\n#### ", // H4 headers
        "\n# ", // H1 headers
        "\n---", // Horizontal rules
        "\n```" // Code blocks
      );
    }

    if (options.preserveCodeBlocks) {
      // Code block separators
      separators.push("\n```\n", "\n```", "```\n");
    }

    // Standard separators (in order of preference)
    separators.push(
      "\n\n", // Double newlines (paragraphs)
      "\n", // Single newlines
      ". ", // Sentence endings
      "! ", // Exclamation endings
      "? ", // Question endings
      "; ", // Semicolons
      ", ", // Commas
      " ", // Spaces
      "" // Characters (last resort)
    );

    return separators;
  }

  /**
   * Get accurate token count using tiktoken
   */
  static getTokenCount(text: string, model: string = "gpt-3.5-turbo"): number {
    try {
      const encoder = encoding_for_model(model as any);
      const tokenCount = encoder.encode(text).length;
      encoder.free();
      return tokenCount;
    } catch (error) {
      console.warn(
        "Failed to get accurate token count, using approximation:",
        error
      );
      // Fallback to approximation: 1 token ≈ 0.75 words
      return Math.ceil(text.split(/\s+/).length / 0.75);
    }
  }

  /**
   * Extract metadata from document for better context
   */
  static extractMetadata(text: string, fileName: string): Record<string, any> {
    // Extract potential title from first line
    const lines = text.split("\n").filter((line) => line.trim().length > 0);
    const potentialTitle = lines[0]?.trim() || fileName;

    // Extract summary (first 500 characters)
    const summary = text.substring(0, 500).replace(/\s+/g, " ").trim();

    return {
      extractedTitle: potentialTitle,
      summary,
      hasHeaders: /^#{1,6}\s+/m.test(text) || /^[A-Z][A-Z\s]{2,}$/m.test(text),
      hasBulletPoints: /^[\-\*\•]/m.test(text),
      hasNumberedList: /^\d+\./m.test(text),
      tokenCount: this.getTokenCount(text),
      isMarkdown: /^#{1,6}\s+/m.test(text) || /```/.test(text),
      hasCodeBlocks: /```/.test(text),
    };
  }
}
