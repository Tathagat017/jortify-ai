import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { supabase } from "../lib/supabase";
import { EmbeddingService } from "./embedding.service";

export interface HelpSection {
  section: string;
  content: string;
  embedding?: number[];
}

export class HelpContentService {
  private static readonly HELP_FILE_PATH = join(
    process.cwd(),
    "api",
    "help.md"
  );

  /**
   * Initialize help content on server start
   */
  static async initializeHelpContent(): Promise<void> {
    try {
      console.log("Initializing help content...");

      // Read help.md file
      const helpContent = this.readHelpFile();

      // Parse into sections
      const sections = this.parseHelpContent(helpContent);

      // Process each section
      for (const section of sections) {
        await this.upsertHelpSection(section);
      }

      console.log(`Successfully initialized ${sections.length} help sections`);
    } catch (error) {
      console.error("Error initializing help content:", error);
      // Don't throw - help content is not critical for app startup
    }
  }

  /**
   * Read help.md file
   */
  private static readHelpFile(): string {
    try {
      return readFileSync(this.HELP_FILE_PATH, "utf-8");
    } catch (error) {
      console.error("Error reading help.md file:", error);
      throw new Error("Failed to read help documentation file");
    }
  }

  /**
   * Parse help content into sections
   */
  private static parseHelpContent(content: string): HelpSection[] {
    const sections: HelpSection[] = [];

    // Split by ## headers (main sections)
    const sectionRegex = /^## (.+)$/gm;
    const matches = Array.from(content.matchAll(sectionRegex));

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const sectionTitle = match[1].trim();
      const startIndex = match.index! + match[0].length;
      const endIndex =
        i < matches.length - 1 ? matches[i + 1].index! : content.length;

      const sectionContent = content.substring(startIndex, endIndex).trim();

      if (sectionContent) {
        sections.push({
          section: sectionTitle,
          content: sectionContent,
        });
      }
    }

    // Also add the introduction (content before first ##)
    const firstSectionIndex = matches[0]?.index || content.length;
    const introContent = content.substring(0, firstSectionIndex).trim();

    if (introContent) {
      sections.unshift({
        section: "Introduction",
        content: introContent,
      });
    }

    return sections;
  }

  /**
   * Upsert a help section with embedding
   */
  private static async upsertHelpSection(section: HelpSection): Promise<void> {
    try {
      // Generate embedding for the section
      const embedding = await EmbeddingService.generateEmbedding(
        `${section.section}\n\n${section.content}`
      );

      // Upsert into database
      const { error } = await supabase.from("help_content").upsert(
        {
          section: section.section,
          content: section.content,
          embedding: JSON.stringify(embedding),
          metadata: {
            word_count: section.content.split(/\s+/).length,
            character_count: section.content.length,
            has_code_examples: /```/.test(section.content),
            has_lists: /^[\-\*\d+\.]/m.test(section.content),
          },
        },
        {
          onConflict: "section",
        }
      );

      if (error) {
        console.error(
          `Error upserting help section "${section.section}":`,
          error
        );
        throw error;
      }

      console.log(`✓ Processed help section: ${section.section}`);
    } catch (error) {
      console.error(
        `Failed to process help section "${section.section}":`,
        error
      );
      // Continue with other sections even if one fails
    }
  }

  /**
   * Get all help sections
   */
  static async getAllHelpSections(): Promise<HelpSection[]> {
    try {
      const { data, error } = await supabase
        .from("help_content")
        .select("section, content")
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error("Error fetching help sections:", error);
      return [];
    }
  }

  /**
   * Search help content
   */
  static async searchHelpContent(
    query: string,
    maxResults: number = 3
  ): Promise<
    Array<{
      section: string;
      content: string;
      relevance: number;
    }>
  > {
    try {
      // Generate embedding for query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);

      // Search using the semantic search function
      const { data, error } = await supabase.rpc("semantic_search_with_files", {
        query_embedding: JSON.stringify(queryEmbedding),
        workspace_filter: null, // No workspace filter for help content
        similarity_threshold: 0.5,
        max_results: maxResults,
      });

      if (error) {
        throw error;
      }

      // Filter for help content only
      const helpResults = (data || [])
        .filter((result: any) => result.source_type === "help")
        .map((result: any) => ({
          section: result.title,
          content: result.content,
          relevance: result.similarity,
        }));

      return helpResults;
    } catch (error) {
      console.error("Error searching help content:", error);
      return [];
    }
  }
}
