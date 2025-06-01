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
        workspaceId,
        pageId,
      });

      // Import SummaryService dynamically to avoid circular dependencies
      const { SummaryService } = await import("./summary.service");

      // Use the enhanced summary-based link suggestions
      const enhancedSuggestions =
        await SummaryService.getEnhancedLinkSuggestions(
          text,
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
          const startIndex = text
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
        console.log("✅ Returning enhanced suggestions:", linkSuggestions);
        return linkSuggestions;
      }

      console.log(
        "⚠️ No enhanced suggestions found, falling back to basic method"
      );
      // Fallback to basic link suggestions if no enhanced suggestions found
      const basicSuggestions = await this.generateBasicLinkSuggestions(
        text,
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
      // Fallback to basic suggestions
      console.log("🔄 Falling back to basic suggestions due to error");
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
   * Basic link suggestions (fallback method)
   */
  private static async generateBasicLinkSuggestions(
    text: string,
    workspaceId: string,
    pageId?: string
  ): Promise<LinkSuggestion[]> {
    try {
      console.log("🔧 generateBasicLinkSuggestions called with:", {
        text,
        workspaceId,
        pageId,
      });

      // Get all pages in workspace for potential linking
      const { data: pages, error } = await supabase
        .from("pages")
        .select("id, title, content")
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
      });

      const suggestions: LinkSuggestion[] = [];
      const textLower = text.toLowerCase();

      for (const page of pages) {
        const pageTitle = page.title.toLowerCase();

        console.log(`🔍 Checking page "${page.title}" against text "${text}"`);

        // Check if page title appears in text (exact match)
        const titleIndex = textLower.indexOf(pageTitle);
        if (titleIndex !== -1 && pageTitle.length > 2) {
          console.log(`✅ Found exact title match: "${page.title}"`);
          suggestions.push({
            text: page.title,
            pageId: page.id,
            pageTitle: page.title,
            confidence: pageTitle.length > 5 ? 0.9 : 0.7,
            startIndex: titleIndex,
            endIndex: titleIndex + pageTitle.length,
          });
        }

        // Check for partial matches and synonyms
        const words = pageTitle.split(" ");
        for (const word of words) {
          if (word.length > 3 && textLower.includes(word.toLowerCase())) {
            const wordIndex = textLower.indexOf(word.toLowerCase());
            if (wordIndex !== -1) {
              console.log(
                `✅ Found word match: "${word}" from page "${page.title}"`
              );
              suggestions.push({
                text: word,
                pageId: page.id,
                pageTitle: page.title,
                confidence: 0.6,
                startIndex: wordIndex,
                endIndex: wordIndex + word.length,
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
            `🔗 Generic link text detected, suggesting page: "${page.title}"`
          );
          suggestions.push({
            text: page.title,
            pageId: page.id,
            pageTitle: page.title,
            confidence: 0.5, // Lower confidence for generic suggestions
            startIndex: 0,
            endIndex: page.title.length,
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
                `🏢 Business term match: "${textWord}" matches "${titleWord}" in page "${page.title}"`
              );
              suggestions.push({
                text: page.title,
                pageId: page.id,
                pageTitle: page.title,
                confidence: 0.7,
                startIndex: 0,
                endIndex: page.title.length,
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

      console.log("📊 Final basic suggestions:", {
        totalSuggestions: suggestions.length,
        uniqueSuggestions: uniqueSuggestions.length,
        suggestions: uniqueSuggestions,
      });

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
}
