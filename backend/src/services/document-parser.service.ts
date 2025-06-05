import pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import { AppError } from "../middleware/error-handler";

export interface ParsedDocument {
  text: string;
  metadata: {
    pageCount?: number;
    wordCount: number;
    characterCount: number;
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
   * Chunk document text into smaller pieces for embedding
   */
  static chunkDocument(
    text: string,
    maxTokens: number = 1000,
    overlapTokens: number = 200
  ): string[] {
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

    return chunks;
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
    };
  }
}
