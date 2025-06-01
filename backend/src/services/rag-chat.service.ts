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
    title: string = "New Chat"
  ): Promise<string> {
    try {
      const { data: conversation, error } = await supabase
        .from("chat_conversations")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          title,
        })
        .select("id")
        .single();

      if (error || !conversation) {
        throw new Error(`Failed to create conversation: ${error?.message}`);
      }

      return conversation.id;
    } catch (error) {
      console.error("Error creating conversation:", error);
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
    maxResults: number = 5
  ): Promise<RAGResponse> {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OpenAI API key not configured");
      }

      // Step 1: Store user message
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
      const relevantDocs = await this.retrieveRelevantDocuments(
        question,
        workspaceId,
        maxResults
      );

      // Step 3: Get conversation context
      const conversationHistory = await this.getConversationHistory(
        conversationId
      );
      const recentHistory = conversationHistory.slice(-6); // Last 6 messages for context

      // Step 4: Generate response using retrieved documents
      const { answer, citations } = await this.generateContextualAnswer(
        question,
        relevantDocs,
        recentHistory
      );

      // Step 5: Store assistant response
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

      // Step 6: Update conversation title if it's the first exchange
      if (recentHistory.length <= 1) {
        await this.updateConversationTitle(conversationId, question);
      }

      return {
        answer,
        citations,
        conversationId,
        messageId: assistantMessage.id,
      };
    } catch (error) {
      console.error("Error generating RAG response:", error);
      throw error;
    }
  }

  /**
   * Retrieve relevant documents using semantic search
   */
  private static async retrieveRelevantDocuments(
    query: string,
    workspaceId: string,
    maxResults: number
  ): Promise<
    Array<{
      pageId: string;
      title: string;
      content: any;
      summary: string;
      similarity: number;
    }>
  > {
    try {
      // Use existing semantic search functionality
      const semanticResults = await EmbeddingService.semanticSearch(
        query,
        workspaceId,
        maxResults,
        0.6 // Lower threshold for chat to get more context
      );

      // Also get pages with summaries as fallback
      const { data: summaryPages, error } = await supabase
        .from("pages")
        .select("id, title, content, summary")
        .eq("workspace_id", workspaceId)
        .not("summary", "is", null)
        .limit(maxResults * 2);

      if (error) {
        console.warn("Error fetching summary pages:", error);
      }

      // Combine and deduplicate results
      const combined = new Map();

      // Add semantic search results (priority)
      semanticResults.forEach((result) => {
        combined.set(result.page_id || result.pageId, {
          pageId: result.page_id || result.pageId,
          title: result.title,
          content: result.content,
          summary: "", // Will be filled from summaryPages if available
          similarity: result.similarity,
        });
      });

      // Add summary-based results
      summaryPages?.forEach((page) => {
        if (!combined.has(page.id)) {
          // Calculate simple relevance score for summary pages
          const relevance = this.calculateTextRelevance(
            query,
            page.title + " " + page.summary
          );
          if (relevance > 0.3) {
            combined.set(page.id, {
              pageId: page.id,
              title: page.title,
              content: page.content,
              summary: page.summary,
              similarity: relevance,
            });
          }
        } else {
          // Update existing entry with summary
          const existing = combined.get(page.id);
          existing.summary = page.summary;
        }
      });

      // Convert to array and sort by relevance
      return Array.from(combined.values())
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);
    } catch (error) {
      console.error("Error retrieving relevant documents:", error);
      return [];
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
    }>,
    conversationHistory: ChatMessage[]
  ): Promise<{
    answer: string;
    citations: Array<{
      pageId: string;
      pageTitle: string;
      relevance: number;
      excerpt: string;
    }>;
  }> {
    try {
      // Prepare context from relevant documents
      const documentContext = relevantDocs
        .map((doc, index) => {
          const textContent = this.extractTextFromPage(doc.title, doc.content);
          const summary = doc.summary || textContent.slice(0, 200);
          return `[Document ${index + 1}: "${doc.title}"]
${summary}
---`;
        })
        .join("\n");

      // Prepare conversation context
      const historyContext = conversationHistory
        .slice(-4) // Last 4 messages for context
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join("\n");

      const prompt = `You are a helpful AI assistant that answers questions based on a workspace's knowledge base. 

CONVERSATION HISTORY:
${historyContext}

RELEVANT DOCUMENTS:
${documentContext}

CURRENT QUESTION: ${question}

INSTRUCTIONS:
1. Answer the question using the provided documents as your primary source
2. If the documents don't contain enough information, acknowledge this limitation
3. Be concise but thorough
4. Reference specific documents when relevant
5. If building on conversation history, acknowledge previous context
6. Use a helpful, professional tone

Please provide a comprehensive answer based on the available workspace knowledge:`;

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a knowledgeable workspace assistant. Always base your answers on the provided documents and conversation context. Be helpful and accurate.",
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

      // Generate citations from relevant documents
      const citations = relevantDocs.slice(0, 3).map((doc) => ({
        pageId: doc.pageId,
        pageTitle: doc.title,
        relevance: doc.similarity,
        excerpt:
          doc.summary ||
          this.extractTextFromPage(doc.title, doc.content).slice(0, 150) +
            "...",
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
