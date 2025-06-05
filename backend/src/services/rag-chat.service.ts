import OpenAI from "openai";
import { supabase } from "../lib/supabase";
import { EmbeddingService } from "./embedding.service";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations?: Array<{
    pageId: string;
    pageTitle: string;
    relevance: number;
    excerpt: string;
  }>;
}

export interface ChatConversation {
  id: string;
  title: string;
  workspaceId: string;
  userId?: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  helpMode?: boolean;
  metadata?: {
    webSearchEnabled?: boolean;
    [key: string]: any;
  };
}

export interface RAGResponse {
  answer: string;
  citations: Array<{
    pageId: string;
    pageTitle: string;
    relevance: number;
    excerpt: string;
  }>;
  conversationId: string;
  messageId: string;
}

export class RAGChatService {
  /**
   * Create a new chat conversation
   */
  static async createConversation(
    workspaceId: string,
    userId?: string,
    title: string = "New Chat",
    helpMode: boolean = false
  ): Promise<string> {
    try {
      console.log(
        `🆕 STEP 1: Creating new conversation - Help Mode: ${
          helpMode ? "ON" : "OFF"
        }`
      );

      const { data: conversation, error } = await supabase
        .from("chat_conversations")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title,
          help_mode: helpMode,
          metadata: {
            web_search_enabled: false,
          },
        })
        .select("id")
        .single();

      if (error || !conversation) {
        throw new Error(`Failed to create conversation: ${error?.message}`);
      }

      console.log(
        `✅ STEP 1 COMPLETE: Created conversation ${conversation.id} with help mode: ${helpMode}`
      );
      return conversation.id;
    } catch (error) {
      console.error("❌ Error creating conversation:", error);
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  static async getConversationHistory(
    conversationId: string
  ): Promise<ChatMessage[]> {
    try {
      const { data: messages, error } = await supabase
        .from("chat_messages")
        .select("role, content, citations, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        throw new Error(
          `Failed to fetch conversation history: ${error.message}`
        );
      }

      return (
        messages?.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
          citations: msg.citations || [],
        })) || []
      );
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      throw error;
    }
  }

  /**
   * Get all conversations for a workspace
   */
  static async getWorkspaceConversations(workspaceId: string): Promise<
    Array<{
      id: string;
      title: string;
      updatedAt: string;
      messageCount: number;
      helpMode?: boolean;
      metadata?: any;
    }>
  > {
    try {
      const { data: conversations, error } = await supabase
        .from("chat_conversations")
        .select(
          `
          id,
          title,
          updated_at,
          help_mode,
          metadata,
          chat_messages(count)
        `
        )
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }

      return (
        conversations?.map((conv) => ({
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updated_at,
          helpMode: conv.help_mode,
          metadata: conv.metadata,
          messageCount: Array.isArray(conv.chat_messages)
            ? conv.chat_messages.length
            : 0,
        })) || []
      );
    } catch (error) {
      console.error("Error fetching workspace conversations:", error);
      throw error;
    }
  }

  /**
   * Delete a conversation and all its messages
   */
  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from("chat_conversations")
        .delete()
        .eq("id", conversationId);

      if (error) {
        throw new Error(`Failed to delete conversation: ${error.message}`);
      }

      console.log(`Deleted conversation ${conversationId}`);
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  }

  /**
   * Generate RAG response using workspace knowledge
   */
  static async generateRAGResponse(
    question: string,
    conversationId: string,
    workspaceId: string,
    maxResults: number = 5,
    helpMode: boolean = false,
    webSearchEnabled: boolean = false
  ): Promise<RAGResponse> {
    try {
      console.log(
        `🤖 STEP 2: Generating RAG response - Help Mode: ${
          helpMode ? "ON" : "OFF"
        }, Web Search: ${webSearchEnabled ? "ON" : "OFF"}`
      );

      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured");
      }

      // Step 1: Store user message
      console.log(
        `💬 STEP 2.1: Storing user message in conversation ${conversationId}`
      );
      const { data: userMessage, error: userError } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          role: "user",
          content: question,
        })
        .select("id")
        .single();

      if (userError) {
        throw new Error(`Failed to store user message: ${userError.message}`);
      }

      // Step 2: Retrieve relevant documents using semantic search
      console.log(
        `🔍 STEP 2.2: Retrieving relevant documents - Mode: ${
          helpMode ? "HELP" : "WORKSPACE"
        }`
      );
      const relevantDocs = await this.retrieveRelevantDocuments(
        question,
        workspaceId,
        maxResults,
        helpMode
      );

      // Step 3: Get conversation context
      console.log(`📝 STEP 2.3: Getting conversation history for context`);
      const conversationHistory = await this.getConversationHistory(
        conversationId
      );
      const recentHistory = conversationHistory.slice(-6); // Last 6 messages for context

      // Step 4: Perform web search if enabled
      let webSearchResults = null;
      if (webSearchEnabled && !helpMode) {
        console.log(`🌐 STEP 2.4: Performing web search for: "${question}"`);
        webSearchResults = await this.performWebSearch(question);
      }

      // Step 5: Generate response using retrieved documents
      console.log(
        `🧠 STEP 2.5: Generating contextual answer with ${relevantDocs.length} documents`
      );
      const { answer, citations } = await this.generateContextualAnswer(
        question,
        relevantDocs,
        recentHistory,
        helpMode,
        webSearchResults
      );

      // Step 6: Store assistant response
      console.log(`💾 STEP 2.6: Storing assistant response`);
      const { data: assistantMessage, error: assistantError } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          role: "assistant",
          content: answer,
          citations: citations,
        })
        .select("id")
        .single();

      if (assistantError) {
        throw new Error(
          `Failed to store assistant message: ${assistantError.message}`
        );
      }

      // Step 7: Update conversation title if it's the first exchange
      if (recentHistory.length <= 1) {
        console.log(
          `📝 STEP 2.7: Updating conversation title based on first question`
        );
        await this.updateConversationTitle(conversationId, question);
      }

      console.log(`✅ STEP 2 COMPLETE: RAG response generated successfully`);
      return {
        answer,
        citations,
        conversationId,
        messageId: assistantMessage.id,
      };
    } catch (error) {
      console.error("❌ Error generating RAG response:", error);
      throw error;
    }
  }

  /**
   * Retrieve relevant documents using semantic search
   */
  private static async retrieveRelevantDocuments(
    query: string,
    workspaceId: string,
    maxResults: number,
    helpMode: boolean = false
  ): Promise<
    Array<{
      pageId: string;
      title: string;
      content: any;
      summary: string;
      similarity: number;
      sourceType?: string;
    }>
  > {
    try {
      // Generate embedding for the query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);
      console.log(
        `🔍 STEP 3: RAG Search - Query: "${query}", Mode: ${
          helpMode ? "HELP" : "WORKSPACE"
        }`
      );
      console.log(
        `📊 STEP 3.1: Generated embedding length: ${queryEmbedding.length}`
      );

      if (helpMode) {
        // Search only in help content
        console.log(`📚 STEP 3.2: Searching HELP CONTENT ONLY`);
        const { data: searchResults, error: searchError } = await supabase.rpc(
          "semantic_search_help_only",
          {
            query_embedding: JSON.stringify(queryEmbedding),
            similarity_threshold: 0.5,
            max_results: maxResults,
          }
        );

        if (searchError) {
          console.error("❌ Help content search error:", searchError);
          return [];
        }

        console.log(
          `✅ STEP 3.3: Found ${
            searchResults?.length || 0
          } help content results`
        );

        return (searchResults || []).map((result: any) => ({
          pageId: result.source_id,
          title: result.section,
          content: result.content,
          summary: result.content?.substring(0, 200) || "",
          similarity: result.similarity,
          sourceType: "help",
        }));
      } else {
        // Search only in workspace content
        console.log(`📄 STEP 3.2: Searching WORKSPACE CONTENT ONLY`);
        const { data: searchResults, error: searchError } = await supabase.rpc(
          "semantic_search_workspace_only",
          {
            query_embedding: JSON.stringify(queryEmbedding),
            workspace_filter: workspaceId,
            similarity_threshold: 0.3,
            max_results: maxResults * 2,
          }
        );

        if (searchError) {
          console.error("❌ Workspace content search error:", searchError);
          // Fallback to original semantic search
          console.log("🔄 STEP 3.3: Falling back to page-only search");
          const semanticResults = await EmbeddingService.semanticSearch(
            query,
            workspaceId,
            maxResults,
            0.3
          );

          return semanticResults.map((result) => ({
            pageId: result.page_id || result.pageId,
            title: result.title,
            content: result.content,
            summary: "",
            similarity: result.similarity,
            sourceType: "page",
          }));
        }

        console.log(
          `✅ STEP 3.3: Found ${
            searchResults?.length || 0
          } workspace content results`
        );

        // Process search results
        const processedResults = (searchResults || []).map((result: any) => ({
          pageId: result.page_id || result.source_id,
          title: result.title,
          content: result.content,
          summary: result.content?.substring(0, 200) || "",
          similarity: result.similarity,
          sourceType: result.source_type,
        }));

        // Also get pages with summaries as fallback
        const { data: summaryPages, error } = await supabase
          .from("pages")
          .select("id, title, content, summary")
          .eq("workspace_id", workspaceId)
          .not("summary", "is", null)
          .limit(maxResults);

        if (error) {
          console.warn("⚠️ Error fetching summary pages:", error);
        }

        // Combine and deduplicate results
        const combined = new Map();

        // Add search results (priority)
        processedResults.forEach((result: any) => {
          const key =
            result.sourceType === "file"
              ? `file_${result.pageId}`
              : result.pageId;
          combined.set(key, result);
        });

        // Add summary pages if not already included
        (summaryPages || []).forEach((page: any) => {
          if (!combined.has(page.id)) {
            combined.set(page.id, {
              pageId: page.id,
              title: page.title,
              content: page.content,
              summary: page.summary || "",
              similarity: 0.5,
              sourceType: "page",
            });
          }
        });

        // Return top results
        const finalResults = Array.from(combined.values())
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, maxResults);

        console.log(
          `🏆 STEP 3.4: Final results for RAG:`,
          finalResults.map((r) => ({
            title: r.title,
            sourceType: r.sourceType,
            similarity: r.similarity,
          }))
        );

        return finalResults;
      }
    } catch (error) {
      console.error("💥 Error retrieving documents:", error);
      return [];
    }
  }

  /**
   * Perform web search using Tavily API
   */
  private static async performWebSearch(query: string): Promise<any> {
    try {
      // TODO: Implement Tavily web search integration
      console.log(`🌐 Web search for: "${query}" - NOT YET IMPLEMENTED`);
      return null;
    } catch (error) {
      console.error("Error performing web search:", error);
      return null;
    }
  }

  /**
   * Generate answer using retrieved documents and conversation context
   */
  private static async generateContextualAnswer(
    question: string,
    relevantDocs: Array<{
      pageId: string;
      title: string;
      content: any;
      summary: string;
      similarity: number;
      sourceType?: string;
    }>,
    conversationHistory: ChatMessage[],
    helpMode: boolean = false,
    webSearchResults: any = null
  ): Promise<{
    answer: string;
    citations: Array<{
      pageId: string;
      pageTitle: string;
      relevance: number;
      excerpt: string;
      sourceType?: string;
    }>;
  }> {
    try {
      console.log(
        `🧠 STEP 4: Generating answer with ${
          relevantDocs.length
        } documents, Mode: ${helpMode ? "HELP" : "WORKSPACE"}`
      );

      // Prepare context from relevant documents
      const documentContext = relevantDocs
        .map((doc, index) => {
          const sourceLabel =
            doc.sourceType === "file"
              ? "[File]"
              : doc.sourceType === "help"
              ? "[Help]"
              : "[Page]";
          const textContent =
            typeof doc.content === "string"
              ? doc.content
              : this.extractTextFromPage(doc.title, doc.content);
          const summary = doc.summary || textContent.slice(0, 200);
          return `${sourceLabel} Document ${index + 1}: "${doc.title}"
${summary}
---`;
        })
        .join("\n");

      // Prepare conversation context
      const historyContext = conversationHistory
        .slice(-4) // Last 4 messages for context
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");

      // Prepare web search context if available
      const webContext = webSearchResults
        ? `\nWEB SEARCH RESULTS:\n${JSON.stringify(
            webSearchResults,
            null,
            2
          )}\n`
        : "";

      const systemPrompt = helpMode
        ? "You are a helpful AI assistant that answers questions about how to use this application based on the help documentation. Focus on providing clear, step-by-step instructions."
        : "You are a helpful AI assistant that answers questions based on a workspace's knowledge base. Focus on the specific content and context of the workspace.";

      const prompt = `${systemPrompt}

CONVERSATION HISTORY:
${historyContext}

${helpMode ? "HELP DOCUMENTATION:" : "WORKSPACE DOCUMENTS:"}
${documentContext}
${webContext}

CURRENT QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using the provided ${
        helpMode ? "help documentation" : "workspace documents"
      } as your primary source
2. If the documents don't contain enough information, acknowledge this limitation
3. Be concise but thorough
4. Reference specific ${helpMode ? "help sections" : "documents"} when relevant
5. If building on conversation history, acknowledge previous context
6. Use a helpful, professional tone
${
  helpMode
    ? "7. Focus on explaining HOW to use features, not WHAT content is in the workspace"
    : "7. Focus on the actual content and knowledge in the workspace"
}

Please provide a comprehensive answer:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I apologize, but I couldn't generate a response at this time.";

      console.log(`✅ STEP 4.1: Generated answer successfully`);

      // Generate citations from relevant documents
      const citations = relevantDocs.slice(0, 3).map((doc) => ({
        pageId: doc.pageId,
        pageTitle: doc.title,
        relevance: doc.similarity,
        excerpt:
          doc.summary ||
          (typeof doc.content === "string"
            ? doc.content.slice(0, 150)
            : this.extractTextFromPage(doc.title, doc.content).slice(0, 150)) +
            "...",
        sourceType: doc.sourceType,
      }));

      return { answer, citations };
    } catch (error) {
      console.error("Error generating contextual answer:", error);
      return {
        answer:
          "I apologize, but I encountered an error while generating a response. Please try again.",
        citations: [],
      };
    }
  }

  /**
   * Extract text content from page for processing
   */
  private static extractTextFromPage(title: string, content: any): string {
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
   * Calculate simple text relevance score
   */
  private static calculateTextRelevance(query: string, text: string): number {
    const queryWords = query
      .toLowerCase()
      .split(" ")
      .filter((w) => w.length > 2);
    const textLower = text.toLowerCase();

    let matches = 0;
    for (const word of queryWords) {
      if (textLower.includes(word)) {
        matches++;
      }
    }

    return matches / Math.max(queryWords.length, 1);
  }

  /**
   * Update conversation title based on first question
   */
  private static async updateConversationTitle(
    conversationId: string,
    firstQuestion: string
  ): Promise<void> {
    try {
      // Generate a concise title from the first question
      let title = firstQuestion.slice(0, 50);
      if (firstQuestion.length > 50) {
        title += "...";
      }

      const { error } = await supabase
        .from("chat_conversations")
        .update({ title })
        .eq("id", conversationId);

      if (error) {
        console.warn("Failed to update conversation title:", error);
      }
    } catch (error) {
      console.warn("Error updating conversation title:", error);
    }
  }

  /**
   * Stream response for real-time chat (placeholder for future enhancement)
   */
  static async *streamRAGResponse(
    question: string,
    conversationId: string,
    workspaceId: string
  ): AsyncGenerator<string, void, unknown> {
    // This is a placeholder for streaming functionality
    // In a full implementation, you would use OpenAI's streaming API
    const response = await this.generateRAGResponse(
      question,
      conversationId,
      workspaceId
    );

    // Simulate streaming by yielding chunks of the response
    const words = response.answer.split(" ");
    for (let i = 0; i < words.length; i++) {
      yield words.slice(0, i + 1).join(" ");
      // Small delay to simulate streaming
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
