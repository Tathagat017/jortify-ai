# RAG Chatbot Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**chat_conversations**

```sql
CREATE TABLE chat_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    help_mode BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `id`: Unique conversation identifier
- `workspace_id`: Links conversation to specific workspace
- `user_id`: User who owns the conversation
- `title`: Display name for conversation (auto-generated or user-set)
- `help_mode`: Boolean flag - TRUE for help documentation search, FALSE for workspace content search
- `metadata`: Additional conversation settings and context
- `created_at/updated_at`: Timestamps for conversation lifecycle

**chat_messages**

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `conversation_id`: Links message to parent conversation
- `role`: Either 'user' (human input) or 'assistant' (AI response)
- `content`: The actual message text
- `citations`: JSON array of source references for AI responses
- `created_at`: Message timestamp for ordering

**page_embeddings**

```sql
CREATE TABLE page_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    embedding TEXT NOT NULL, -- JSON string of 1536D vector
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_id)
);
```

- `page_id`: Links to the source page
- `content_hash`: MD5 hash to detect content changes
- `embedding`: JSON-serialized 1536-dimensional vector from OpenAI
- `metadata`: Additional embedding context and processing info

**help_content**

```sql
CREATE TABLE help_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    section TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT, -- JSON string of embedding vector
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `section`: Help category (e.g., "Getting Started", "Advanced Features")
- `title`: Specific help topic title
- `content`: Full help documentation text
- `embedding`: Pre-computed vector for semantic search

## Detailed Step-by-Step Flow

### Step 1: Conversation Initialization

**Frontend Action (ChatbotModal.tsx):**

```typescript
const initializeChat = async () => {
  // Check for existing conversations
  const conversations = await aiService.getWorkspaceConversations(workspaceId);

  if (conversations.length === 0) {
    const newConversation = await aiService.createConversation(
      workspaceId,
      "New Chat",
      helpMode
    );
    setCurrentConversationId(newConversation.id);
  } else {
    setCurrentConversationId(conversations[0].id);
    loadConversationHistory(conversations[0].id);
  }
};
```

**Database Operations:**

1. **Query existing conversations:**

   ```sql
   SELECT id, title, updated_at, help_mode, metadata
   FROM chat_conversations
   WHERE workspace_id = $1 AND user_id = $2
   ORDER BY updated_at DESC
   LIMIT 10;
   ```

2. **Create new conversation if needed:**

   ```sql
   INSERT INTO chat_conversations (workspace_id, user_id, title, help_mode, metadata)
   VALUES ($1, $2, $3, $4, $5)
   RETURNING id, created_at;
   ```

### Step 2: User Message Processing

**Frontend Submission (MessageInput.tsx):**

```typescript
const handleSubmitMessage = async (question: string) => {
  // Optimistic UI update
  const userMessage = {
    id: generateTempId(),
    role: "user" as const,
    content: question,
    timestamp: new Date().toISOString(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setLoading(true);

  // API call to backend
  const response = await aiService.sendChatMessage(
    question,
    workspaceId,
    currentConversationId,
    helpMode,
    webSearchEnabled
  );
};
```

**Backend Processing (AIController.chatWithRAG):**

```typescript
export class AIController {
  static async chatWithRAG(req: Request, res: Response) {
    const { question, conversationId, workspaceId, helpMode } = req.body;
    const userId = req.user!.id;

    // Store user message immediately
    const { data: userMessage } = await supabase
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        role: "user",
        content: question,
      })
      .select("id")
      .single();

    // Generate RAG response
    const response = await RAGChatService.generateRAGResponse(
      question,
      conversationId,
      workspaceId,
      5, // maxResults
      helpMode || false,
      webSearchEnabled || false
    );

    res.json(response);
  }
}
```

**User Message Storage:**

```sql
INSERT INTO chat_messages (conversation_id, role, content)
VALUES ($1, 'user', $2)
RETURNING id, created_at;
```

### Step 3: Query Embedding Generation

**EmbeddingService Implementation:**

```typescript
class EmbeddingService {
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-ada-002",
        input: text.trim(),
        encoding_format: "float",
      });

      return response.data[0].embedding; // 1536-dimensional vector
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }
}
```

**Processing Steps:**

1. Clean and trim input text
2. Call OpenAI Embeddings API with text-embedding-ada-002 model
3. Receive 1536-dimensional float array
4. Return vector for similarity search

### Step 4: Document Retrieval (Semantic Search)

**Mode-Based Search Logic:**

```typescript
private static async retrieveRelevantDocuments(
  query: string,
  workspaceId: string,
  maxResults: number,
  helpMode: boolean = false
): Promise<RelevantDocument[]> {

  const queryEmbedding = await EmbeddingService.generateEmbedding(query);

  if (helpMode) {
    // Search help documentation only
    const { data: helpResults } = await supabase.rpc(
      'semantic_search_help_only',
      {
        query_embedding: JSON.stringify(queryEmbedding),
        similarity_threshold: 0.5,
        max_results: maxResults
      }
    );

    return (helpResults || []).map(result => ({
      pageId: result.source_id,
      title: result.section,
      content: result.content,
      summary: result.content?.substring(0, 200) || '',
      similarity: result.similarity,
      sourceType: 'help'
    }));

  } else {
    // Search workspace content
    const { data: workspaceResults } = await supabase.rpc(
      'semantic_search_workspace_only',
      {
        query_embedding: JSON.stringify(queryEmbedding),
        workspace_filter: workspaceId,
        similarity_threshold: 0.3,
        max_results: maxResults * 2
      }
    );

    return (workspaceResults || []).map(result => ({
      pageId: result.page_id || result.source_id,
      title: result.title,
      content: result.content,
      summary: result.content?.substring(0, 200) || '',
      similarity: result.similarity,
      sourceType: result.source_type || 'page'
    }));
  }
}
```

**Database Functions:**

1. **Help Content Search:**

   ```sql
   CREATE OR REPLACE FUNCTION semantic_search_help_only(
     query_embedding TEXT,
     similarity_threshold FLOAT DEFAULT 0.5,
     max_results INTEGER DEFAULT 5
   )
   RETURNS TABLE (
     source_id UUID,
     section TEXT,
     content TEXT,
     similarity FLOAT
   ) AS $$
   BEGIN
     RETURN QUERY
     SELECT
       hc.id as source_id,
       hc.section,
       hc.content,
       cosine_similarity(hc.embedding, query_embedding) as similarity
     FROM help_content hc
     WHERE
       hc.embedding IS NOT NULL
       AND cosine_similarity(hc.embedding, query_embedding) >= similarity_threshold
     ORDER BY similarity DESC
     LIMIT max_results;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Workspace Content Search:**

   ```sql
   CREATE OR REPLACE FUNCTION semantic_search_workspace_only(
     query_embedding TEXT,
     workspace_filter UUID,
     similarity_threshold FLOAT DEFAULT 0.3,
     max_results INTEGER DEFAULT 10
   )
   RETURNS TABLE (
     page_id UUID,
     title TEXT,
     content JSONB,
     similarity FLOAT,
     source_type TEXT
   ) AS $$
   BEGIN
     RETURN QUERY
     -- Search page embeddings
     SELECT
       p.id as page_id,
       p.title,
       p.content,
       cosine_similarity(pe.embedding, query_embedding) as similarity,
       'page'::TEXT as source_type
     FROM pages p
     JOIN page_embeddings pe ON p.id = pe.page_id
     WHERE
       p.workspace_id = workspace_filter
       AND p.is_deleted = false
       AND cosine_similarity(pe.embedding, query_embedding) >= similarity_threshold

     UNION ALL

     -- Search file embeddings
     SELECT
       fe.source_id as page_id,
       fe.filename as title,
       jsonb_build_object('text', fe.content) as content,
       cosine_similarity(fe.embedding, query_embedding) as similarity,
       'file'::TEXT as source_type
     FROM file_embeddings fe
     WHERE
       fe.workspace_id = workspace_filter
       AND cosine_similarity(fe.embedding, query_embedding) >= similarity_threshold

     ORDER BY similarity DESC
     LIMIT max_results;
   END;
   $$ LANGUAGE plpgsql;
   ```

### Step 5: Context Assembly and Prompt Building

**Conversation History Retrieval:**

```typescript
static async getConversationHistory(conversationId: string): Promise<ChatMessage[]> {
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('role, content, citations, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20); // Last 20 messages

  return (messages || []).map(msg => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    citations: msg.citations || []
  }));
}
```

**SQL Query:**

```sql
SELECT role, content, citations, created_at
FROM chat_messages
WHERE conversation_id = $1
ORDER BY created_at ASC
LIMIT 20;
```

**Prompt Construction:**

```typescript
private static async generateContextualAnswer(
  question: string,
  relevantDocs: RelevantDocument[],
  conversationHistory: ChatMessage[],
  helpMode: boolean = false
): Promise<{ answer: string; citations: Citation[] }> {

  // Build document context
  const documentContext = relevantDocs.map((doc, index) =>
    `[${index + 1}] ${doc.title}\n${doc.summary || doc.content?.substring(0, 300)}`
  ).join('\n\n');

  // Build conversation context (last 4 messages)
  const conversationContext = conversationHistory
    .slice(-4)
    .map(msg => `${msg.role}: ${msg.content}`)
    .join('\n');

  // Mode-specific system prompts
  const systemPrompt = helpMode ?
    `You are a helpful assistant for a Notion-like application. Answer questions about how to use the application based on the provided documentation. Always cite your sources using [1], [2], etc.` :
    `You are a knowledgeable assistant helping with questions about the user's workspace content. Provide accurate answers based on the provided context and cite your sources using [1], [2], etc.`;

  const userPrompt = `
Context from ${helpMode ? 'documentation' : 'workspace'}:
${documentContext}

${conversationHistory.length > 0 ? `Previous conversation:\n${conversationContext}\n` : ''}

Question: ${question}

Please provide a helpful answer based on the context above. Include citations [1], [2], etc. for specific information.
`;

  // OpenAI API call
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: 500,
    temperature: 0.7,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0
  });

  const answer = response.choices[0]?.message?.content || "I couldn't generate a response.";

  // Extract citations
  const citations = this.extractCitations(answer, relevantDocs);

  return { answer, citations };
}
```

### Step 6: Citation Extraction and Response Storage

**Citation Processing:**

```typescript
private static extractCitations(
  answer: string,
  relevantDocs: RelevantDocument[]
): Citation[] {
  const citations: Citation[] = [];
  const citationRegex = /\[(\d+)\]/g;
  let match;

  while ((match = citationRegex.exec(answer)) !== null) {
    const citationNumber = parseInt(match[1]) - 1; // Convert to 0-based index

    if (citationNumber >= 0 && citationNumber < relevantDocs.length) {
      const doc = relevantDocs[citationNumber];

      citations.push({
        pageId: doc.pageId,
        pageTitle: doc.title,
        relevance: doc.similarity,
        excerpt: doc.summary || doc.content?.substring(0, 200) || '',
        sourceType: doc.sourceType
      });
    }
  }

  // Remove duplicates
  return citations.filter((citation, index, self) =>
    index === self.findIndex(c => c.pageId === citation.pageId)
  );
}
```

**Store Assistant Response:**

```sql
INSERT INTO chat_messages (conversation_id, role, content, citations)
VALUES ($1, 'assistant', $2, $3)
RETURNING id, created_at;
```

**Update Conversation Timestamp:**

```sql
UPDATE chat_conversations
SET updated_at = NOW()
WHERE id = $1;
```

### Step 7: Response Delivery and Real-time Updates

**Backend Response Format:**

```typescript
return {
  success: true,
  answer: response.answer,
  citations: response.citations,
  conversationId: conversationId,
  messageId: assistantMessage.id,
  timestamp: new Date().toISOString(),
};
```

**Frontend Real-time Subscription:**

```typescript
useEffect(() => {
  if (!currentConversationId) return;

  const subscription = supabase
    .channel("chat-messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${currentConversationId}`,
      },
      (payload) => {
        const newMessage = payload.new as ChatMessage;
        setMessages((prev) => [...prev, newMessage]);
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [currentConversationId]);
```

## Key Packages Used

**Backend:**

- `openai`: Official OpenAI SDK for embeddings and chat completions
- `@supabase/supabase-js`: Database client for all SQL operations and real-time subscriptions
- `@tavily/core`: Web search API integration for enhanced context (optional)
- `express`: Web framework for API endpoints
- `express-rate-limit`: Rate limiting for API protection

**Frontend:**

- `@mantine/core`: UI components for chat interface (Modal, TextInput, Button, ScrollArea)
- `@mantine/notifications`: Toast notifications for errors and success messages
- `@tanstack/react-query`: Caching and state management for chat data
- `react`: Core framework for chat components
- `@tabler/icons-react`: Icons for UI elements

## Database Indexes for Performance

```sql
-- Optimize conversation queries by workspace and user
CREATE INDEX idx_chat_conversations_workspace_user
ON chat_conversations(workspace_id, user_id, updated_at DESC);

-- Optimize message queries by conversation
CREATE INDEX idx_chat_messages_conversation_created
ON chat_messages(conversation_id, created_at ASC);

-- Optimize embedding searches
CREATE INDEX idx_page_embeddings_page_id
ON page_embeddings(page_id);

-- Optimize help content searches
CREATE INDEX idx_help_content_embedding
ON help_content(id) WHERE embedding IS NOT NULL;

-- Optimize workspace page searches
CREATE INDEX idx_pages_workspace_deleted
ON pages(workspace_id, is_deleted) WHERE is_deleted = false;
```

## Performance Optimizations

**Embedding Caching:**

- Page embeddings are cached and only regenerated when content changes (using content_hash)
- Help content embeddings are pre-computed and stored

**Query Optimization:**

- Similarity thresholds filter out irrelevant results early
- LIMIT clauses prevent excessive data retrieval
- Indexes on frequently queried columns

**Memory Management:**

- Conversation history limited to last 20 messages
- Document context truncated to prevent token limit issues
- Citations deduplicated to reduce response size

**Real-time Efficiency:**

- Supabase subscriptions only listen to specific conversation changes
- Optimistic UI updates for immediate user feedback
- Background cleanup of old conversations and messages

This detailed flow shows exactly how each database table is used throughout the RAG chatbot process, from conversation initialization through response delivery and real-time updates.
