import OpenAI from "openai";
import { supabase } from "../lib/supabase";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface SuggestionRequest {
  context: string;
  currentText: string;
  pageId?: string;
  workspaceId: string;
}

export interface LinkSuggestion {
  text: string;
  pageId: string;
  pageTitle: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  summary?: string;
  relevanceScore?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class AIService {
  /**
   * Generate content suggestions for in-editor AI assistance
   */
  static async generateSuggestions(request: SuggestionRequest): Promise<{
    suggestions: string[];
    type: "completion" | "enhancement" | "continuation";
  }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const { context, currentText, workspaceId } = request;

      // Get workspace context for better suggestions
      const { data: recentPages } = await supabase
        .from("pages")
        .select("title, content")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(3);

      const workspaceContext =
        recentPages
          ?.map(
            (p) => `${p.title}: ${JSON.stringify(p.content).slice(0, 200)}...`
          )
          .join("\n") || "";

      const prompt = `
You are an AI writing assistant for a Notion-like workspace. Help the user continue or improve their writing.

Workspace context (recent pages):
${workspaceContext}

Current context: ${context}
Current text being written: "${currentText}"

Based on the context, provide 3 helpful suggestions:
1. A completion of the current sentence/paragraph
2. An enhancement or rewording of the current text
3. A logical next sentence or paragraph

Respond with only the suggestions in JSON format:
{
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"],
  "type": "completion" | "enhancement" | "continuation"
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful writing assistant. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error("No response from AI");
      }

      return JSON.parse(result);
    } catch (error) {
      console.error("Error generating suggestions:", error);
      throw new Error("Failed to generate AI suggestions");
    }
  }

  /**
   * Generate smart link suggestions based on current text using summaries
   * This is the enhanced version that uses the SummaryService
   */
  static async generateLinkSuggestions(
    text: string,
    workspaceId: string,
    pageId?: string
  ): Promise<LinkSuggestion[]> {
    try {
      console.log("🔍 AIService.generateLinkSuggestions called with:", {
        text,
        textLength: text.length,
        workspaceId,
        pageId,
      });

      // ENHANCED: If the provided text is too short, try to get more context from the current page
      let enhancedText = text;
      if (text.length < 100 && pageId) {
        console.log(
          "📄 Text too short, fetching additional context from current page..."
        );
        try {
          const { data: currentPage, error } = await supabase
            .from("pages")
            .select("title, content")
            .eq("id", pageId)
            .single();

          if (!error && currentPage) {
            // Extract text from current page content
            const pageText = this.extractTextFromPageContent(
              currentPage.title,
              currentPage.content
            );

            // Use the last 500 characters of the page as additional context
            const additionalContext = pageText.slice(-500);
            enhancedText = additionalContext + " " + text;

            console.log("📄 Enhanced text with page context:", {
              originalLength: text.length,
              enhancedLength: enhancedText.length,
              additionalContext: additionalContext.substring(0, 200) + "...",
            });
          }
        } catch (error) {
          console.warn("Could not fetch additional page context:", error);
        }
      }

      console.log("🤖 ATTEMPTING RAG (AI-ENHANCED) SUGGESTIONS FIRST...");

      // Import SummaryService dynamically to avoid circular dependencies
      const { SummaryService } = await import("./summary.service");

      // Use the enhanced summary-based link suggestions with enhanced text
      const enhancedSuggestions =
        await SummaryService.getEnhancedLinkSuggestions(
          enhancedText,
          workspaceId,
          pageId
        );

      console.log("📊 Enhanced suggestions from SummaryService:", {
        count: enhancedSuggestions.length,
        suggestions: enhancedSuggestions,
      });

      // Convert to LinkSuggestion format
      const linkSuggestions: LinkSuggestion[] = enhancedSuggestions.map(
        (suggestion) => {
          const startIndex = enhancedText
            .toLowerCase()
            .indexOf(suggestion.suggestedText.toLowerCase());

          return {
            text: suggestion.suggestedText,
            pageId: suggestion.pageId,
            pageTitle: suggestion.pageTitle,
            confidence: suggestion.confidence,
            startIndex: startIndex !== -1 ? startIndex : 0,
            endIndex:
              startIndex !== -1
                ? startIndex + suggestion.suggestedText.length
                : suggestion.suggestedText.length,
            summary: suggestion.summary,
            relevanceScore: suggestion.relevanceScore,
          };
        }
      );

      // If we have enhanced suggestions, return them
      if (linkSuggestions.length > 0) {
        console.log(
          "✅ 🤖 USING RAG (AI-ENHANCED) SUGGESTIONS - AI summaries found and processed successfully!"
        );
        console.log("✅ Returning enhanced suggestions:", linkSuggestions);
        return linkSuggestions;
      }

      console.log(
        "⚠️ 🤖 RAG (AI-ENHANCED) SUGGESTIONS FAILED - No AI summaries available or no matches found"
      );
      console.log("🔄 FALLING BACK TO STRING MATCHING ALGORITHM...");

      // Fallback to basic link suggestions if no enhanced suggestions found
      const basicSuggestions = await this.generateBasicLinkSuggestions(
        enhancedText, // Use enhanced text for better string matching too
        workspaceId,
        pageId
      );
      console.log("📋 Basic suggestions result:", {
        count: basicSuggestions.length,
        suggestions: basicSuggestions,
      });

      return basicSuggestions;
    } catch (error) {
      console.error("❌ Error generating enhanced link suggestions:", error);
      console.log(
        "🔄 🤖 RAG (AI-ENHANCED) SUGGESTIONS ERROR - Falling back to string matching due to error"
      );

      // Fallback to basic suggestions
      console.log("🔄 FALLING BACK TO STRING MATCHING ALGORITHM...");
      const basicSuggestions = await this.generateBasicLinkSuggestions(
        text,
        workspaceId,
        pageId
      );
      console.log("📋 Fallback basic suggestions result:", {
        count: basicSuggestions.length,
        suggestions: basicSuggestions,
      });
      return basicSuggestions;
    }
  }

  /**
   * Extract text content from page content (similar to EmbeddingService but simpler)
   */
  private static extractTextFromPageContent(
    title: string,
    content: any
  ): string {
    let text = title + "\n\n";

    if (content && typeof content === "object") {
      // If content is BlockNote format, extract text from blocks
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.content && Array.isArray(block.content)) {
            const blockText = block.content
              .map((item: any) => item.text || "")
              .join(" ");
            text += blockText + "\n";
          } else if (block.type === "heading" && block.content) {
            // Handle heading blocks
            const headingText = Array.isArray(block.content)
              ? block.content.map((item: any) => item.text || "").join(" ")
              : String(block.content);
            text += headingText + "\n";
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
   * Basic link suggestions (fallback method)
   */
  private static async generateBasicLinkSuggestions(
    text: string,
    workspaceId: string,
    pageId?: string
  ): Promise<LinkSuggestion[]> {
    try {
      console.log("🔧 📝 USING STRING MATCHING ALGORITHM (FALLBACK METHOD)");
      console.log("🔧 generateBasicLinkSuggestions called with:", {
        text,
        workspaceId,
        pageId,
      });

      // FIXED: Include summary in the query so we can show summaries in fallback suggestions
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, content, summary")
        .eq("workspace_id", workspaceId)
        .neq("id", pageId || "") // Exclude current page
        .limit(50);

      if (error || !pages) {
        console.log("❌ Error fetching pages or no pages found:", error);
        return [];
      }

      console.log("📄 Found pages for linking:", {
        count: pages.length,
        titles: pages.map((p) => p.title),
        pagesWithSummaries: pages.filter((p) => p.summary).length,
      });

      const suggestions: LinkSuggestion[] = [];
      const textLower = text.toLowerCase();

      for (const page of pages) {
        const pageTitle = page.title.toLowerCase();

        console.log(`🔍 Checking page "${page.title}" against text "${text}"`);

        // Check if page title appears in text (exact match)
        const titleIndex = textLower.indexOf(pageTitle);
        if (titleIndex !== -1 && pageTitle.length > 2) {
          console.log(
            `✅ 📝 STRING MATCH FOUND - Exact title match: "${page.title}"`
          );
          suggestions.push({
            text: page.title,
            pageId: page.id,
            pageTitle: page.title,
            confidence: pageTitle.length > 5 ? 0.9 : 0.7,
            startIndex: titleIndex,
            endIndex: titleIndex + pageTitle.length,
            summary: page.summary || undefined, // FIXED: Include summary from database
          });
        }

        // Check for partial matches and synonyms
        const words = pageTitle.split(" ");
        for (const word of words) {
          if (word.length > 3 && textLower.includes(word.toLowerCase())) {
            const wordIndex = textLower.indexOf(word.toLowerCase());
            if (wordIndex !== -1) {
              console.log(
                `✅ 📝 STRING MATCH FOUND - Word match: "${word}" from page "${page.title}"`
              );
              suggestions.push({
                text: word,
                pageId: page.id,
                pageTitle: page.title,
                confidence: 0.6,
                startIndex: wordIndex,
                endIndex: wordIndex + word.length,
                summary: page.summary || undefined, // FIXED: Include summary from database
              });
            }
          }
        }

        // NEW: More flexible matching for @link trigger
        // If the text is generic (like "link to relevant page"), suggest all pages
        if (
          text.toLowerCase().includes("link") ||
          text.toLowerCase().includes("relevant") ||
          text.toLowerCase().includes("page")
        ) {
          console.log(
            `🔗 📝 STRING MATCH FOUND - Generic link text detected, suggesting page: "${page.title}"`
          );
          suggestions.push({
            text: page.title,
            pageId: page.id,
            pageTitle: page.title,
            confidence: 0.5, // Lower confidence for generic suggestions
            startIndex: 0,
            endIndex: page.title.length,
            summary: page.summary || undefined, // FIXED: Include summary from database
          });
        }

        // NEW: Semantic matching for common business terms
        const businessTerms = [
          "sales",
          "marketing",
          "product",
          "channel",
          "customer",
          "revenue",
          "strategy",
        ];
        const textWords = textLower.split(/\s+/);
        const titleWords = pageTitle.split(/\s+/);

        for (const textWord of textWords) {
          for (const titleWord of titleWords) {
            if (
              businessTerms.includes(textWord) &&
              businessTerms.includes(titleWord)
            ) {
              console.log(
                `🏢 📝 STRING MATCH FOUND - Business term match: "${textWord}" matches "${titleWord}" in page "${page.title}"`
              );
              suggestions.push({
                text: page.title,
                pageId: page.id,
                pageTitle: page.title,
                confidence: 0.7,
                startIndex: 0,
                endIndex: page.title.length,
                summary: page.summary || undefined, // FIXED: Include summary from database
              });
            }
          }
        }
      }

      // Remove duplicates and sort by confidence
      const uniqueSuggestions = suggestions
        .filter(
          (suggestion, index, self) =>
            index ===
            self.findIndex(
              (s) =>
                s.pageId === suggestion.pageId && s.text === suggestion.text
            )
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Limit to top 10 suggestions

      console.log("📊 📝 STRING MATCHING ALGORITHM RESULTS:", {
        totalSuggestions: suggestions.length,
        uniqueSuggestions: uniqueSuggestions.length,
        suggestions: uniqueSuggestions,
        suggestionsWithSummaries: uniqueSuggestions.filter((s) => s.summary)
          .length,
      });

      if (uniqueSuggestions.length > 0) {
        console.log(
          "✅ 📝 STRING MATCHING SUCCESSFUL - Returning string-based suggestions with summaries"
        );
      } else {
        console.log("❌ 📝 STRING MATCHING FAILED - No string matches found");
      }

      return uniqueSuggestions;
    } catch (error) {
      console.error("❌ Error generating basic link suggestions:", error);
      return [];
    }
  }

  /**
   * Generate semantic tags for a page using AI
   */
  static async generateTags(
    title: string,
    content: any,
    workspaceId: string
  ): Promise<{
    tags: Array<{ name: string; color: string; confidence: number }>;
    reasoning: string;
  }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Get existing tags in workspace for consistency
      const { data: existingTags } = await supabase
        .from("tags")
        .select("name, color")
        .eq("workspace_id", workspaceId);

      const existingTagNames = existingTags?.map((t) => t.name) || [];

      // Extract text content
      let textContent = title + "\n";
      if (content && typeof content === "object") {
        textContent += JSON.stringify(content);
      }

      const prompt = `
Analyze the following page content and suggest 3-5 relevant tags.

Existing tags in workspace: ${existingTagNames.join(", ")}

Page title: ${title}
Page content: ${textContent.slice(0, 1000)}...

Generate tags that are:
1. Relevant to the content
2. Consistent with existing tags when possible
3. Useful for organization and search

Respond with JSON only:
{
  "tags": [
    {"name": "tag_name", "color": "blue|green|yellow|red|purple|gray", "confidence": 0.1-1.0}
  ],
  "reasoning": "Brief explanation of tag choices"
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a content categorization expert. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
        temperature: 0.5,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error("No response from AI");
      }

      return JSON.parse(result);
    } catch (error) {
      console.error("Error generating tags:", error);
      throw new Error("Failed to generate AI tags");
    }
  }

  /**
   * Generate page summary
   */
  static async generateSummary(
    title: string,
    content: any,
    length: "short" | "medium" | "long" = "medium"
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Extract text content
      let textContent = title + "\n";
      if (content && typeof content === "object") {
        textContent += JSON.stringify(content);
      }

      const lengthInstructions = {
        short: "1-2 sentences",
        medium: "3-4 sentences",
        long: "1-2 paragraphs",
      };

      const prompt = `
Summarize the following page content in ${lengthInstructions[length]}:

Title: ${title}
Content: ${textContent.slice(0, 2000)}...

Provide a clear, concise summary that captures the main points and purpose of the page.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a professional content summarizer.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: length === "long" ? 200 : 100,
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content;
      if (!summary) {
        throw new Error("No response from AI");
      }

      return summary.trim();
    } catch (error) {
      console.error("Error generating summary:", error);
      throw new Error("Failed to generate AI summary");
    }
  }

  /**
   * Complete text based on context
   */
  static async completeText(
    text: string,
    context: string,
    maxTokens: number = 150
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const prompt = `
Context: ${context}

Continue the following text naturally and coherently:
"${text}"

Complete the thought or sentence in a way that flows naturally with the context.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful writing assistant. Continue the user's text naturally.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const completion = response.choices[0]?.message?.content;
      if (!completion) {
        throw new Error("No response from AI");
      }

      return completion.trim();
    } catch (error) {
      console.error("Error completing text:", error);
      throw new Error("Failed to complete text");
    }
  }

  /**
   * Analyze text for writing improvements
   */
  static async analyzeWriting(text: string): Promise<{
    suggestions: Array<{
      type: "grammar" | "style" | "clarity" | "tone";
      message: string;
      severity: "low" | "medium" | "high";
      startIndex?: number;
      endIndex?: number;
    }>;
    score: number; // 0-100
  }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const prompt = `
Analyze the following text for writing quality and provide improvement suggestions:

"${text}"

Analyze for:
1. Grammar and spelling errors
2. Style and readability
3. Clarity and coherence
4. Tone consistency

Respond with JSON only:
{
  "suggestions": [
    {
      "type": "grammar|style|clarity|tone",
      "message": "specific suggestion",
      "severity": "low|medium|high"
    }
  ],
  "score": 0-100
}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional writing editor. Always respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error("No response from AI");
      }

      return JSON.parse(result);
    } catch (error) {
      console.error("Error analyzing writing:", error);
      throw new Error("Failed to analyze writing");
    }
  }

  /**
   * Generate content based on suggestions and block context
   */
  static async generateContentFromSuggestion(
    suggestion: string,
    blockContext: string,
    workspaceId: string,
    pageId?: string
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      // Get workspace context for better content generation
      const { data: recentPages } = await supabase
        .from("pages")
        .select("title, content")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(3);

      const workspaceContext =
        recentPages
          ?.map(
            (p) => `${p.title}: ${JSON.stringify(p.content).slice(0, 200)}...`
          )
          .join("\n") || "";

      // Get current page context if pageId is provided
      let currentPageContext = "";
      if (pageId) {
        const { data: currentPage } = await supabase
          .from("pages")
          .select("title, content")
          .eq("id", pageId)
          .single();

        if (currentPage) {
          currentPageContext = `Current page: ${
            currentPage.title
          }\n${JSON.stringify(currentPage.content).slice(0, 500)}...`;
        }
      }

      const prompt = `
You are an AI content generator for a Notion-like workspace. Your task is to generate new content based on a suggestion and the existing block context.

IMPORTANT INSTRUCTIONS:
1. DO NOT LOSE ANY EXISTING DATA from the block context
2. ENHANCE and EXPAND the existing content based on the suggestion
3. Maintain the original structure and flow
4. Add new relevant information that complements the existing content
5. Keep the tone and style consistent with the existing content

Workspace context (recent pages):
${workspaceContext}

${currentPageContext}

Current block context (PRESERVE ALL THIS DATA):
"${blockContext}"

Suggestion to implement:
"${suggestion}"

Generate enhanced content that:
- Keeps all existing information intact
- Incorporates the suggestion naturally
- Adds valuable new content based on the suggestion
- Maintains logical flow and structure
- Expands on the existing ideas

Return only the enhanced content as plain text, ready to replace the current block content.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful content generator. Generate enhanced content that preserves existing information while implementing the given suggestion. Return only the enhanced content as plain text.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const generatedContent = response.choices[0]?.message?.content;
      if (!generatedContent) {
        throw new Error("No response from AI");
      }

      return generatedContent.trim();
    } catch (error) {
      console.error("Error generating content from suggestion:", error);
      throw new Error("Failed to generate content from suggestion");
    }
  }
}
