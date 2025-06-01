const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
const TOKEN_KEY = "jortify_token";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: string;
  citations?: Array<{
    pageId: string;
    pageTitle: string;
    snippet: string;
  }>;
}

export interface Conversation {
  id: string;
  title: string;
  workspaceId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
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

export interface TagSuggestion {
  name: string;
  color: string;
  confidence: number;
}

export interface AISuggestion {
  type: "continuation" | "improvement" | "completion";
  content: string;
  confidence: number;
}

export interface WritingAnalysis {
  readabilityScore: number;
  sentimentScore: number;
  suggestions: string[];
  statistics: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
  };
}

class AIService {
  private async getAuthHeaders() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      throw new Error(
        "No authentication token available. Please sign in again."
      );
    }

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ error: "Unknown error" }));
      throw new Error(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.data || data;
  }

  // =================== CHAT ENDPOINTS ===================

  async createConversation(
    workspaceId: string,
    title?: string
  ): Promise<Conversation> {
    const response = await this.makeRequest<{
      conversationId: string;
      workspaceId: string;
      title: string;
    }>("/ai/conversations", {
      method: "POST",
      body: JSON.stringify({
        workspaceId,
        title: title || "New Chat",
      }),
    });

    // Transform backend response to frontend Conversation interface
    return {
      id: response.conversationId,
      title: response.title,
      workspaceId: response.workspaceId,
      userId: "", // Will be populated by backend
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async sendChatMessage(
    question: string,
    workspaceId: string,
    conversationId?: string
  ): Promise<{
    answer: string;
    conversationId: string;
    messageId: string;
    citations: Array<{
      pageId: string;
      pageTitle: string;
      snippet: string;
    }>;
  }> {
    return this.makeRequest("/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        question,
        workspaceId,
        conversationId,
      }),
    });
  }

  async getConversationHistory(conversationId: string): Promise<{
    conversation: Conversation;
    messages: ChatMessage[];
  }> {
    if (!conversationId || conversationId === "undefined") {
      throw new Error("Invalid conversation ID");
    }

    const response = await this.makeRequest<{
      conversation: {
        id: string;
        title: string;
        workspaceId: string;
        createdAt: string;
        updatedAt: string;
      };
      messages: Array<{
        role: "user" | "assistant";
        content: string;
        citations?: Array<{
          pageId: string;
          pageTitle: string;
          snippet: string;
        }>;
      }>;
    }>(`/ai/conversations/${conversationId}`);

    // Transform backend response to frontend interfaces
    return {
      conversation: {
        id: response.conversation.id,
        title: response.conversation.title,
        workspaceId: response.conversation.workspaceId,
        userId: "", // Will be populated by backend
        createdAt: response.conversation.createdAt,
        updatedAt: response.conversation.updatedAt,
      },
      messages: response.messages.map((msg, index) => ({
        id: `msg-${index}`, // Generate temporary ID
        content: msg.content,
        role: msg.role,
        timestamp: new Date().toISOString(),
        citations: msg.citations,
      })),
    };
  }

  async getWorkspaceConversations(
    workspaceId: string
  ): Promise<Conversation[]> {
    const response = await this.makeRequest<{
      conversations: Array<{
        id: string;
        title: string;
        updatedAt: string;
        createdAt: string;
        messageCount: number;
      }>;
    }>(`/ai/conversations/workspace/${workspaceId}`);

    // Transform backend response to frontend Conversation interface
    return response.conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      workspaceId: workspaceId,
      userId: "", // Will be populated by backend
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }));
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.makeRequest(`/ai/conversations/${conversationId}`, {
      method: "DELETE",
    });
  }

  async updateConversationTitle(
    conversationId: string,
    title: string
  ): Promise<void> {
    await this.makeRequest(`/ai/conversations/${conversationId}/title`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  // =================== AI SUGGESTIONS ===================

  async generateSuggestions(
    context: string,
    currentText: string,
    workspaceId: string,
    pageId?: string
  ): Promise<AISuggestion[]> {
    const response = await this.makeRequest<{
      suggestions: string[];
      type: string;
    }>("/ai/suggestions", {
      method: "POST",
      body: JSON.stringify({
        context,
        currentText,
        workspaceId,
        pageId,
      }),
    });

    return response.suggestions.map((content, index) => ({
      type: response.type as "continuation" | "improvement" | "completion",
      content,
      confidence: 0.8 - index * 0.1, // Mock confidence scores
    }));
  }

  async completeText(
    text: string,
    context?: string,
    maxTokens?: number
  ): Promise<string> {
    const response = await this.makeRequest<{ completion: string }>(
      "/ai/complete",
      {
        method: "POST",
        body: JSON.stringify({
          text,
          context: context || "",
          maxTokens: maxTokens || 150,
        }),
      }
    );

    return response.completion;
  }

  async analyzeWriting(text: string): Promise<WritingAnalysis> {
    const response = await this.makeRequest<{ analysis: WritingAnalysis }>(
      "/ai/analyze",
      {
        method: "POST",
        body: JSON.stringify({ text }),
      }
    );

    return response.analysis;
  }

  async summarizeContent(
    title: string,
    content: object,
    length: "short" | "medium" | "long" = "medium"
  ): Promise<string> {
    const response = await this.makeRequest<{ summary: string }>(
      "/ai/summarize",
      {
        method: "POST",
        body: JSON.stringify({
          title,
          content,
          length,
        }),
      }
    );

    return response.summary;
  }

  // =================== LINK SUGGESTIONS ===================

  async generateLinkSuggestions(
    text: string,
    workspaceId: string,
    pageId?: string,
    contextWindow?: number
  ): Promise<LinkSuggestion[]> {
    const response = await this.makeRequest<{ suggestions: LinkSuggestion[] }>(
      "/ai/link-suggestions",
      {
        method: "POST",
        body: JSON.stringify({
          text,
          workspaceId,
          pageId,
          contextWindow: contextWindow || 100,
        }),
      }
    );

    return response.suggestions;
  }

  // =================== TAG GENERATION ===================

  async generateTags(
    title: string,
    content: object,
    workspaceId: string
  ): Promise<{
    tags: TagSuggestion[];
    reasoning: string;
  }> {
    const response = await this.makeRequest<{
      tags: TagSuggestion[];
      reasoning: string;
    }>("/ai/generate-tags", {
      method: "POST",
      body: JSON.stringify({
        title,
        content,
        workspaceId,
      }),
    });

    return response;
  }
}

export const aiService = new AIService();
