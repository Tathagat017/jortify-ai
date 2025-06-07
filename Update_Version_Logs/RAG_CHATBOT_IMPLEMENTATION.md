# RAG Chatbot Implementation Documentation

## Overview

The RAG (Retrieval-Augmented Generation) chatbot is a sophisticated AI-powered assistant that can answer questions based on workspace content or application help documentation. It uses semantic search to find relevant documents and generates contextual answers using OpenAI's GPT models.

## Architecture

### Tech Stack

- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: OpenAI GPT-3.5-turbo, OpenAI Embeddings
- **Vector Search**: PostgreSQL with pgvector extension
- **Frontend**: React with MobX state management
- **Real-time**: WebSocket (planned)
- **Web Search**: Tavily API (implemented)

### System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend UI   │────▶│  API Gateway    │────▶│  RAG Service    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                          │
                                ┌─────────────────────────┴─────────────────────────┐
                                │                                                   │
                        ┌───────▼────────┐                                 ┌────────▼────────┐
                        │ Semantic Search │                                 │   OpenAI API    │
                        └───────┬────────┘                                 └────────┬────────┘
                                │                                                   │
                        ┌───────▼────────┐                                         │
                        │   Supabase DB  │◀────────────────────────────────────────┘
                        └────────────────┘
```

## Database Schema

### Tables

#### chat_conversations

```sql
- id: UUID (Primary Key)
- workspace_id: UUID (Foreign Key)
- user_id: UUID (Foreign Key)
- title: TEXT
- help_mode: BOOLEAN (default: false)
- metadata: JSONB
  - web_search_enabled: BOOLEAN
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

#### chat_messages

```sql
- id: UUID (Primary Key)
- conversation_id: UUID (Foreign Key)
- role: TEXT ('user' | 'assistant')
- content: TEXT
- citations: JSONB
- created_at: TIMESTAMP
```

#### help_content

```sql
- id: UUID (Primary Key)
- section: TEXT (UNIQUE)
- content: TEXT
- embedding: TEXT (JSON array)
- metadata: JSONB
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Database Functions

#### semantic_search_workspace_only

Searches only within workspace content (pages and files).

```sql
Parameters:
- query_embedding: TEXT
- workspace_filter: UUID
- similarity_threshold: FLOAT (default: 0.7)
- max_results: INTEGER (default: 20)

Returns:
- source_type: TEXT
- source_id: UUID
- page_id: UUID
- title: TEXT
- similarity: FLOAT
- content: TEXT
- metadata: JSONB
- created_at: TIMESTAMP
```

#### semantic_search_help_only

Searches only within help documentation.

```sql
Parameters:
- query_embedding: TEXT
- similarity_threshold: FLOAT (default: 0.5)
- max_results: INTEGER (default: 10)

Returns:
- source_type: TEXT
- source_id: UUID
- section: TEXT
- similarity: FLOAT
- content: TEXT
- metadata: JSONB
- created_at: TIMESTAMP
```

## API Endpoints

### Chat Endpoints

#### POST /api/ai/conversations

Create a new conversation.

**Request Body:**

```json
{
  "workspaceId": "uuid",
  "title": "string (optional)",
  "helpMode": "boolean (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "conversationId": "uuid",
  "workspaceId": "uuid",
  "title": "string",
  "helpMode": false,
  "timestamp": "ISO 8601"
}
```

#### POST /api/ai/chat

Send a message and get AI response.

**Request Body:**

```json
{
  "question": "string",
  "workspaceId": "uuid",
  "conversationId": "uuid (optional)",
  "helpMode": "boolean (optional)",
  "webSearchEnabled": "boolean (optional)"
}
```

**Response:**

```json
{
  "success": true,
  "answer": "string",
  "citations": [
    {
      "pageId": "uuid",
      "pageTitle": "string",
      "snippet": "string",
      "sourceType": "page|file|help"
    }
  ],
  "conversationId": "uuid",
  "messageId": "uuid",
  "timestamp": "ISO 8601"
}
```

#### GET /api/ai/conversations/:conversationId

Get conversation history.

**Response:**

```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "title": "string",
    "workspaceId": "uuid",
    "createdAt": "ISO 8601",
    "updatedAt": "ISO 8601",
    "helpMode": false,
    "metadata": {}
  },
  "messages": [
    {
      "role": "user|assistant",
      "content": "string",
      "citations": []
    }
  ],
  "messageCount": 0,
  "timestamp": "ISO 8601"
}
```

#### GET /api/ai/conversations/workspace/:workspaceId

Get all conversations for a workspace.

**Query Parameters:**

- limit: number (default: 20)
- offset: number (default: 0)

**Response:**

```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "title": "string",
      "updatedAt": "ISO 8601",
      "createdAt": "ISO 8601",
      "messageCount": 0,
      "helpMode": false,
      "metadata": {}
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 100,
    "hasMore": true
  },
  "timestamp": "ISO 8601"
}
```

#### DELETE /api/ai/conversations/:conversationId

Delete a conversation.

#### PATCH /api/ai/conversations/:conversationId/title

Update conversation title.

## Service Implementation

### RAGChatService

The core service handles all RAG operations:

1. **Document Retrieval**

   - Generates embeddings for user queries
   - Performs semantic search based on mode:
     - Help Mode: Searches only help_content table
     - Workspace Mode: Searches pages and file_embeddings
   - Returns top K most relevant documents

2. **Context Building**

   - Combines retrieved documents with conversation history
   - Formats documents with source labels ([Page], [File], [Help])
   - Maintains conversation context (last 6 messages)

3. **Answer Generation**
   - Uses GPT-3.5-turbo with specific system prompts
   - Different prompts for help mode vs workspace mode
   - Includes citations from source documents

### Key Features

#### Help Mode Separation

- Toggle between workspace content and help documentation
- Prevents mixing of help content with workspace queries
- Dedicated UI indicator for active mode

#### Web Search Integration

- **Tavily API**: Advanced web search with AI-generated answers
  - Requires `TAVILY_API_KEY` environment variable
  - Returns top 5 search results with content snippets
  - Includes AI-generated answer for the query
  - Provides follow-up questions for deeper exploration
- **Fallback Search**: DuckDuckGo instant answers

  - Activates when Tavily API key not configured or on error
  - Provides instant answers, definitions, and summaries
  - Limited compared to full web search but requires no API key

- **Search Result Processing**:
  - Results are formatted and included in AI context
  - AI clearly distinguishes between workspace and web sources
  - URLs and relevance scores included for transparency

#### Optimizations

1. **Caching**: Embeddings are cached in database
2. **Batch Processing**: Multiple documents processed together
3. **Similarity Threshold**: Configurable per search type
4. **Result Limiting**: Prevents overwhelming context

#### Console Logging

Detailed step-by-step logging for debugging:

```
🆕 STEP 1: Creating new conversation - Help Mode: ON
✅ STEP 1 COMPLETE: Created conversation with help mode: true
🤖 STEP 2: Generating RAG response - Help Mode: ON, Web Search: OFF
💬 STEP 2.1: Storing user message
🔍 STEP 2.2: Retrieving relevant documents - Mode: HELP
📚 STEP 3.2: Searching HELP CONTENT ONLY
✅ STEP 3.3: Found 5 help content results
🧠 STEP 4: Generating answer with 5 documents, Mode: HELP
✅ STEP 4.1: Generated answer successfully
```

## Frontend Implementation

### ChatStore (MobX)

State management for chat functionality:

```typescript
class ChatStore {
  // State
  helpMode: boolean = false;
  webSearchEnabled: boolean = false;
  conversations: Conversation[] = [];
  messages: ChatMessage[] = [];

  // Actions
  toggleHelpMode();
  toggleWebSearch();
  createNewConversation(workspaceId, title?);
  sendMessage(workspaceId, message?);

  // Computed
  get currentPrompts(); // Returns help or workspace prompts
}
```

### UI Components

1. **ChatbotModal**: Main chat interface

   - Mode toggles (Help/Workspace, Web Search)
   - Conversation list with indicators
   - Message area with citations
   - Context-aware input placeholder

2. **MessageList**: Displays chat messages

   - User/Assistant message styling
   - Citation rendering
   - Loading states

3. **SuggestedPrompts**: Initial conversation prompts
   - Different prompts for help vs workspace mode

## Planned Enhancements

### 1. WebSocket Integration

- Real-time message streaming
- Reduced latency
- Better user experience

### 2. Langchain Agent Integration

- Page creation/deletion actions
- Content manipulation
- Workflow automation

### 3. Tavily Web Search (Implemented)

- External knowledge augmentation with real web search results
- Real-time information retrieval from current web sources
- Source attribution with URLs and relevance scores
- Fallback to DuckDuckGo instant answers if Tavily unavailable
- AI-generated answers from web search results

### 4. Performance Optimizations

- Response streaming
- Embedding cache improvements
- Query optimization

## Environment Variables

### Required

- `OPENAI_API_KEY`: OpenAI API key for embeddings and chat completion
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key

### Optional

- `TAVILY_API_KEY`: Tavily API key for web search (falls back to DuckDuckGo if not provided)

## Security Considerations

1. **Authentication**: All endpoints require valid JWT
2. **Authorization**: Users can only access their own workspaces/conversations
3. **Input Validation**: Joi schemas for all inputs
4. **Rate Limiting**: Prevents abuse
5. **Data Isolation**: Workspace content is strictly isolated

## Error Handling

1. **Graceful Degradation**: Falls back to basic search if semantic search fails
2. **User-Friendly Messages**: Clear error messages for common issues
3. **Logging**: Comprehensive error logging for debugging
4. **Recovery**: Automatic retry for transient failures

## Best Practices

1. **Keep conversations focused**: One topic per conversation
2. **Use help mode for app questions**: Better accuracy for how-to questions
3. **Provide context**: More context leads to better answers
4. **Review citations**: Always check source documents
5. **Regular cleanup**: Delete old conversations to improve performance
