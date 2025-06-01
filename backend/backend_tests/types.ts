export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface WorkspaceData {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PageData {
  id: string;
  title: string;
  content: any;
  workspace_id: string;
  parent_id?: string;
  icon_url?: string;
  cover_url?: string;
  summary?: string;
  summary_updated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TagData {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
  created_at: string;
}

export interface PaginationData {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  relevance: number;
  created_at: string;
}

export interface SearchResponse {
  results: SearchResult[];
  pagination: PaginationData;
}

export interface SemanticSearchResult {
  page_id: string;
  title: string;
  content: any;
  similarity: number;
  snippet: string;
}

export interface AITag {
  name: string;
  color: string;
  confidence: number;
}

export interface AIAnalysis {
  readabilityScore: number;
  sentimentScore: number;
  suggestions: string[];
  statistics: {
    wordCount: number;
    sentenceCount: number;
    avgWordsPerSentence: number;
  };
}

export interface ConversationData {
  id: string;
  title: string;
  workspaceId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  citations: any[];
}

export interface TestResponse {
  status: number;
  data: ApiResponse;
  headers: any;
}
