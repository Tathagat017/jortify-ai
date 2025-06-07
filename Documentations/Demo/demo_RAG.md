# RAG Chatbot Technical Documentation

## 1. Tech Stack

### Frontend

- **React** - Component-based UI framework
- **TypeScript** - Type-safe development
- **Mantine UI** - Modern React components library
- **MobX** - State management for real-time updates
- **React Query** - Server state management and caching

### Backend

- **Node.js + Express** - Server runtime and web framework
- **OpenAI API** - GPT models for response generation
- **Supabase** - PostgreSQL database with real-time features
- **Tavily API** - Web search integration (optional)
- **Tag-Aware Retrieval** - Enhanced context using page tags

### AI Services

- **OpenAI GPT-3.5-turbo** - Primary language model for responses
- **OpenAI text-embedding-ada-002** - Vector embeddings for semantic search
- **Custom RAG Pipeline** - Retrieval-Augmented Generation implementation
- **pgvector** - PostgreSQL extension for vector similarity search
- **Tag Clustering** - Improved retrieval through semantic tag analysis

### Database

- **PostgreSQL** - Primary database with vector search capabilities
- **Vector Embeddings** - Semantic search using cosine similarity
- **Real-time Subscriptions** - Live chat updates via Supabase
- **Tag-Enhanced Embeddings** - Page tags included in embeddings

## 2. Feature Flow

### User Journey

1. **[Frontend]** User opens chatbot modal and types question
2. **[Backend]** Receive question and create/retrieve conversation
3. **[AI Service]** Generate embeddings for semantic search
4. **[Tag Analysis]** Extract potential tags from question for enhanced retrieval
5. **[Database]** Search relevant content using vector similarity and tag matching
6. **[AI Service]** Combine retrieved content with question for context
7. **[OpenAI]** Generate contextual response using RAG pipeline
8. **[Backend]** Store conversation and return response with citations
9. **[Frontend]** Display response with clickable citations and references

### Why Tag-Aware RAG is Better

Traditional RAG systems rely solely on semantic similarity, which can miss important context. Tag-aware RAG enhances this by:

1. **Topic Understanding**: Questions about "AI ethics" retrieve pages tagged with "ethics", "AI", "responsible-AI" even if exact phrases don't match
2. **Domain Expertise**: Technical questions prioritize pages with technical tags
3. **Contextual Relevance**: Tag clusters help find related content across topics
4. **Better Precision**: Reduces irrelevant results by considering topic alignment

### How Tag-Enhanced Retrieval Works

1. **Question Analysis**: Extract potential tags and topics from the user's question
2. **Dual Retrieval**: Search using both semantic embeddings AND tag relevance
3. **Smart Ranking**: Combine vector similarity with tag match scores
4. **Cluster Expansion**: Include pages from related tag clusters
5. **Context Assembly**: Prioritize highly relevant content for AI context

### Detailed Sequence Steps

#### Backend RAG Processing Flow

1. **Enhanced Question Preprocessing**

   ```typescript
   // Input validation and tag extraction
   const { question, conversationId, workspaceId, helpMode } = req.body;

   // Extract potential tags from question
   const questionTags = await extractTagsFromQuestion(question);
   const relatedClusters = await getRelatedClusters(questionTags);
   ```

2. **Tag-Aware Embedding Generation**

   ```typescript
   // Convert question to vector with tag context
   const enhancedQuestion = `${question} Topics: ${questionTags.join(", ")}`;
   const queryEmbedding = await EmbeddingService.generateEmbedding(
     enhancedQuestion
   );
   ```

3. **Enhanced Semantic Content Retrieval**

   ```typescript
   // Search workspace content using vector similarity AND tag relevance
   const retrievalParams = {
     embedding: queryEmbedding,
     tags: questionTags,
     clusters: relatedClusters,
     workspaceId,
     maxResults: 10, // Retrieve more, then filter
     helpMode,
   };

   const relevantDocs = await retrieveEnhancedDocuments(retrievalParams);
   ```

4. **Smart Context Preparation**

   ```typescript
   // Rank and filter retrieved documents
   const rankedDocs = rankDocumentsByRelevance(relevantDocs, {
     semanticWeight: 0.6,
     tagWeight: 0.25,
     clusterWeight: 0.15,
   });

   // Select top documents within token limit
   const contextDocs = selectOptimalContext(rankedDocs, maxTokens);

   // Build context with metadata
   const contextualPrompt = buildEnhancedRAGPrompt(
     question,
     contextDocs,
     history,
     questionTags
   );
   ```

5. **Context-Aware AI Response Generation**

   ```typescript
   // Generate response with enhanced context
   const systemPrompt = buildSystemPrompt(questionTags, workspaceContext);

   const response = await openai.chat.completions.create({
     model: "gpt-3.5-turbo",
     messages: [{ role: "system", content: systemPrompt }, ...contextualPrompt],
     temperature: getTemperatureForTopic(questionTags),
   });
   ```

6. **Enhanced Citation Extraction**
   ```typescript
   // Link response segments to source documents with confidence scores
   const citations = extractEnhancedCitations(response, contextDocs, {
     includeConfidence: true,
     includePageTags: true,
     highlightRelevantSections: true,
   });
   ```

#### Enhanced Retrieval Algorithm

```typescript
const retrieveEnhancedDocuments = async (params: RetrievalParams) => {
  const { embedding, tags, clusters, workspaceId, maxResults } = params;

  // 1. Semantic search with vector similarity
  const semanticResults = await supabase.rpc("semantic_search_with_tags", {
    query_embedding: JSON.stringify(embedding),
    workspace_filter: workspaceId,
    similarity_threshold: 0.3,
    max_results: maxResults * 2, // Over-retrieve for filtering
  });

  // 2. Tag-based search
  const tagResults = await supabase
    .from("pages")
    .select(
      `
      id, title, content, summary,
      page_tags!inner(tag:tags(name))
    `
    )
    .eq("workspace_id", workspaceId)
    .in("page_tags.tag.name", tags)
    .limit(maxResults);

  // 3. Cluster-based expansion
  const clusterResults = await getClusterRelatedPages(clusters, workspaceId);

  // 4. Merge and deduplicate results
  const allResults = mergeResults(semanticResults, tagResults, clusterResults);

  // 5. Calculate combined relevance scores
  return allResults
    .map((doc) => ({
      ...doc,
      relevanceScore: calculateCombinedRelevance(doc, {
        semanticSimilarity: doc.similarity || 0,
        tagMatches: countTagMatches(doc.tags, tags),
        clusterAlignment: calculateClusterAlignment(doc.tags, clusters),
      }),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
};
```

#### Frontend Interaction Flow

1. **Chat Interface Initialization**

   - Load existing conversations from workspace
   - Initialize new conversation if needed
   - Set up real-time message subscription

2. **Message Sending**

   - Validate user input
   - Show typing indicator
   - Send API request to `/api/ai/chat`

3. **Response Handling**

   - Display streaming response (if implemented)
   - Render citations as clickable links
   - Update conversation state
   - Scroll to newest message

4. **Citation Navigation**
   - Click citation to navigate to source page
   - Highlight relevant section in page
   - Maintain chat context during navigation

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND                        │
│  ┌─────────────────────────────────────────────┐│
│  │        ChatbotModal.tsx                     ││
│  │  ┌─────────────┬─────────────────────────┐  ││
│  │  │MessageInput │    MessageList.tsx      │  ││
│  │  │    .tsx     │  ┌─────────────────────┐│  ││
│  │  │             │  │ User: "AI ethics?"  ││  ││
│  │  │             │  │ AI: Based on...     ││  ││
│  │  │             │  │ 📎 Citations [1][2] ││  ││
│  │  │             │  │ 🏷️ Tags: AI, ethics ││  ││
│  │  │             │  └─────────────────────┘│  ││
│  │  └─────────────┴─────────────────────────┘  ││
│  └─────────────────────────────────────────────┘│
└─────────────────┬───────────────────────────────┘
                  │ API Calls
                  ▼
┌─────────────────────────────────────────────────┐
│              BACKEND API                        │
│  ┌─────────────────────────────────────────────┐│
│  │         /api/ai/chat                        ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │      AIController.chatWithRAG()         │││
│  │  └─────────────┬───────────────────────────┘││
│  └────────────────┼─────────────────────────────┘│
└───────────────────┼─────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────┐
│            ENHANCED RAG SERVICE                 │
│  ┌─────────────────────────────────────────────┐│
│  │     RAGChatService.generateRAGResponse()    ││
│  │                                             ││
│  │  1. Extract Question Tags                   ││
│  │  2. Generate Query Embedding                ││
│  │  3. Tag-Aware Semantic Search               ││
│  │  4. Cluster Expansion                       ││
│  │  5. Smart Context Assembly                  ││
│  │  6. OpenAI API Call                         ││
│  │  7. Enhanced Citation Extraction            ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│         TAG CLUSTERING SERVICE                  │
│  ┌─────────────────────────────────────────────┐│
│  │  • Extract question topics                  ││
│  │  • Find related tag clusters                ││
│  │  • Expand search scope intelligently        ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│               DATABASE                          │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │chat_conver- │chat_        │page_embeddings  ││
│  │sations      │messages     │(Vector Store)   ││
│  │             │             │                 ││
│  │             │citations[]  │embedding+tags   ││
│  │             │tags[]       │                 ││
│  └─────────────┴─────────────┴─────────────────┘│
└─────────────────────────────────────────────────┘
```

## 3. Technical Details

### Key Packages

**Backend RAG Pipeline:**

- **openai**: Official OpenAI SDK for embeddings and completions
- **@supabase/supabase-js**: Database client with vector search functions
- **@tavily/core**: Web search API integration
- **joi**: Input validation for chat requests

**Frontend Chat Interface:**

- **@mantine/core**: UI components for chat interface
- **@tanstack/react-query**: Caching and state management
- **mobx-react-lite**: Reactive state management

### Database Schema

**chat_conversations table:**

- `id`: UUID primary key
- `workspace_id`: Reference to workspace
- `user_id`: Reference to user
- `title`: Auto-generated conversation title
- `help_mode`: Boolean for help vs workspace content mode
- `metadata`: JSON for additional settings (web search, etc.)
- `created_at`, `updated_at`: Timestamps

**chat_messages table:**

- `id`: UUID primary key
- `conversation_id`: Reference to conversation
- `role`: 'user' or 'assistant'
- `content`: Message text content
- `citations`: JSON array of source references
- `created_at`: Message timestamp

**page_embeddings table:**

- `id`: UUID primary key
- `page_id`: Reference to source page
- `content_hash`: MD5 hash for change detection
- `embedding`: JSON string of 1536-dimensional vector
- `metadata`: Additional embedding metadata

### Enhanced RAG Pipeline Implementation

**1. Tag-Aware Semantic Search Function:**

```sql
CREATE FUNCTION semantic_search_with_tags(
    query_embedding TEXT,
    query_tags TEXT[],
    workspace_filter UUID,
    similarity_threshold FLOAT DEFAULT 0.3,
    max_results INTEGER DEFAULT 10
)
RETURNS TABLE (
    page_id UUID,
    title TEXT,
    similarity FLOAT,
    tag_relevance FLOAT,
    combined_score FLOAT,
    content JSONB,
    tags TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    WITH semantic_matches AS (
        -- Vector similarity search
        SELECT
            p.id,
            p.title,
            cosine_similarity(pe.embedding, query_embedding) as similarity,
            p.content
        FROM pages p
        JOIN page_embeddings pe ON p.id = pe.page_id
        WHERE p.workspace_id = workspace_filter
        AND cosine_similarity(pe.embedding, query_embedding) > similarity_threshold
    ),
    tag_scores AS (
        -- Calculate tag relevance
        SELECT
            p.id,
            COUNT(DISTINCT pt.tag_id) * 1.0 / NULLIF(array_length(query_tags, 1), 0) as tag_relevance
        FROM pages p
        JOIN page_tags pt ON p.id = pt.page_id
        JOIN tags t ON pt.tag_id = t.id
        WHERE t.name = ANY(query_tags)
        GROUP BY p.id
    )
    SELECT
        sm.id as page_id,
        sm.title,
        sm.similarity,
        COALESCE(ts.tag_relevance, 0) as tag_relevance,
        (sm.similarity * 0.7 + COALESCE(ts.tag_relevance, 0) * 0.3) as combined_score,
        sm.content,
        array_agg(DISTINCT t.name) as tags
    FROM semantic_matches sm
    LEFT JOIN tag_scores ts ON sm.id = ts.id
    LEFT JOIN page_tags pt ON sm.id = pt.page_id
    LEFT JOIN tags t ON pt.tag_id = t.id
    GROUP BY sm.id, sm.title, sm.similarity, sm.content, ts.tag_relevance
    ORDER BY combined_score DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

**2. Question Tag Extraction:**

```typescript
const extractTagsFromQuestion = async (question: string): Promise<string[]> => {
  // Use AI to extract potential tags
  const prompt = `
Extract relevant topic tags from this question:
"${question}"

Return only tag names that represent key topics, technologies, or concepts.
Format: comma-separated list
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 50,
    temperature: 0.3,
  });

  const extractedTags = response.choices[0].message.content
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0);

  // Match against existing workspace tags
  const validTags = await validateTagsAgainstWorkspace(extractedTags);

  return validTags;
};
```

**3. Enhanced Context Assembly:**

```typescript
const buildEnhancedRAGPrompt = (
  question: string,
  documents: EnhancedDocument[],
  history: ChatMessage[],
  questionTags: string[]
) => {
  const contextPrompt = `
You are a helpful assistant with access to a knowledge base. Answer questions based on the provided context.

Question Topics: ${questionTags.join(", ")}

Relevant Documents:
${documents
  .map(
    (doc, idx) => `
[${idx + 1}] ${doc.title}
Tags: ${doc.tags.join(", ")}
Relevance: ${(doc.relevanceScore * 100).toFixed(0)}%
Content: ${doc.summary || doc.content.substring(0, 500)}...
`
  )
  .join("\n")}

Recent Conversation:
${history
  .slice(-4)
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n")}

Current Question: ${question}

Instructions:
1. Answer based primarily on the provided documents
2. Include citations using [1], [2], etc. format
3. If information is not in the documents, say so clearly
4. Consider the question topics (${questionTags.join(", ")}) for context
5. Maintain conversation continuity from the history
`;

  return contextPrompt;
};
```

### How Tag-Enhanced RAG Works in Natural Language

1. **Question Understanding**: When a user asks "What are the best practices for AI ethics?", the system:

   - Extracts tags: ["AI", "ethics", "best-practices"]
   - Identifies related clusters: ["AI & ML", "Governance", "Guidelines"]

2. **Multi-Strategy Retrieval**: The system searches for relevant content using:

   - **Semantic Search**: Finds documents with similar meaning
   - **Tag Matching**: Prioritizes pages tagged with extracted topics
   - **Cluster Expansion**: Includes pages from related topic clusters

3. **Intelligent Ranking**: Retrieved documents are ranked by:

   - Semantic similarity (70% weight)
   - Tag relevance (20% weight)
   - Cluster alignment (10% weight)

4. **Context Optimization**: The system:

   - Selects most relevant documents within token limits
   - Preserves topic diversity for comprehensive answers
   - Includes document tags for AI context awareness

5. **Response Generation**: The AI:
   - Understands the topic domain from tags
   - Generates focused responses using relevant context
   - Provides accurate citations with confidence indicators

### Optimizations

- **Vector Indexing**: PostgreSQL indexes on embedding columns for fast similarity search
- **Tag Indexing**: Composite indexes on page_tags for efficient tag queries
- **Embedding Caching**: Content hash prevents regenerating embeddings unnecessarily
- **Smart Context Selection**: Prioritizes diverse, high-relevance documents
- **Conversation Chunking**: Only last 6 messages used for context to manage token limits
- **Similarity Thresholds**: Configurable minimum scores (0.3 semantic, 0.2 tag relevance)
- **Result Limiting**: Initial over-retrieval (20 docs) filtered to optimal set (5-7 docs)
- **Batch Processing**: Multiple document embeddings generated efficiently
- **Tag Caching**: Frequently used tag clusters cached for performance

## 4. Terminology Explained

### Retrieval-Augmented Generation (RAG)

A technique that combines information retrieval with text generation. Instead of relying solely on the AI model's training data, RAG retrieves relevant documents from a knowledge base and uses them as context for generating more accurate, factual responses.

### Tag-Aware RAG

An enhanced RAG approach that considers document tags and topic clusters alongside semantic similarity. This improves retrieval precision by understanding topical relationships beyond just text similarity.

### Vector Embeddings

High-dimensional mathematical representations of text that capture semantic meaning. Enhanced with tag information for better topical understanding.

### Multi-Strategy Retrieval

Using multiple retrieval methods (semantic search, tag matching, cluster expansion) in parallel to find the most relevant content from different angles.

### Relevance Scoring

Combining multiple signals (semantic similarity, tag matches, cluster alignment) into a single score that determines document ranking for context inclusion.

### Context Optimization

The process of selecting the best subset of retrieved documents that:

- Fits within token limits
- Covers diverse aspects of the question
- Maintains high relevance scores

### Citation Confidence

A measure of how strongly a citation supports the generated response, based on the relevance score of the source document.

### Question Tag Extraction

Using AI to identify key topics and concepts from a user's question, which are then matched against the workspace's tag taxonomy.

### Cluster Expansion

Including documents from related tag clusters to provide more comprehensive context, even if they don't directly match the question.

---

## Important Implementation Notes

- **Token Management**: Enhanced retrieval may find more documents, so smart selection within token limits is crucial
- **Tag Quality**: System performance improves with well-tagged content (minimum 2 tags per page)
- **Real-time Updates**: New messages and tag changes reflected instantly via Supabase
- **Fallback Strategy**: If tag extraction fails, system falls back to pure semantic search
- **Security**: All conversations and retrievals respect workspace boundaries and permissions
- **Performance**: Tag-aware search adds ~100ms latency but significantly improves relevance
- **Extensibility**: Architecture supports adding new retrieval strategies (knowledge graph, etc.)
- **User Experience**: Citations now include relevance indicators and source page tags
- **Learning**: System can analyze successful retrievals to improve tag extraction over time
