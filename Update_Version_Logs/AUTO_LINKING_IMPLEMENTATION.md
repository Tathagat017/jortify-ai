# Auto-Linking Implementation Documentation

## Overview

The auto-linking feature provides intelligent, bidirectional page link suggestions using a combination of semantic search, content analysis, and link tracking. It helps users discover relevant connections between pages in their workspace.

## Architecture

### Tech Stack

- **Backend**: Node.js with Express
- **Database**: Supabase (PostgreSQL with pgvector)
- **AI/ML**: OpenAI Embeddings for semantic search
- **Frontend**: React with MobX state management
- **Editor**: BlockNote with custom link suggestions

### System Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Types    │────▶│  Frontend API   │────▶│ Summary Service │
│   @link         │     │     Call        │     │                 │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                        ┌─────────────────────────────────┴─────────────────────────┐
                        │                                                           │
                ┌───────▼────────┐                                         ┌────────▼────────┐
                │ Semantic Search │                                         │ Content Analysis│
                └───────┬────────┘                                         └────────┬────────┘
                        │                                                           │
                ┌───────▼────────┐                                         ┌────────▼────────┐
                │ Link Exclusion  │                                         │ Score Calculation│
                └───────┬────────┘                                         └────────┬────────┘
                        │                                                           │
                        └─────────────────────┬─────────────────────────────────────┘
                                              │
                                      ┌───────▼────────┐
                                      │ Ranked Results │
                                      └────────────────┘
```

## Database Schema

### page_links Table

Tracks all links between pages for bidirectional suggestions.

```sql
CREATE TABLE page_links (
    id UUID PRIMARY KEY,
    source_page_id UUID REFERENCES pages(id),
    target_page_id UUID REFERENCES pages(id),
    workspace_id UUID REFERENCES workspaces(id),
    link_text TEXT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(source_page_id, target_page_id)
);
```

### Database Functions

#### get_bidirectional_link_suggestions

Returns pages with bidirectional relevance scores.

```sql
Parameters:
- current_page_id: UUID
- workspace_filter: UUID
- max_results: INTEGER (default: 10)

Returns:
- page_id: UUID
- title: TEXT
- summary: TEXT
- link_count: INTEGER
- is_already_linked: BOOLEAN
- bidirectional_score: FLOAT
```

#### extract_page_links

Extracts and stores links from page content.

```sql
Parameters:
- page_id: UUID
- page_content: JSONB

Actions:
- Deletes existing links from the page
- Extracts new links from content
- Stores valid links in page_links table
```

## Service Implementation

### SummaryService.getEnhancedLinkSuggestions

The main service method that provides intelligent link suggestions.

#### Algorithm Steps

1. **Link Exclusion** (STEP 1)

   - Fetches already linked pages from `page_links` table
   - Excludes them from suggestions to avoid redundancy
   - Console: `📋 STEP 1.3: Found X already linked pages to exclude`

2. **Semantic Search** (STEP 2)

   - Generates embedding for the input text
   - Performs vector similarity search
   - Falls back to summary-based search if semantic search fails
   - Console: `🧠 STEP 2: Performing semantic search for relevant pages`

3. **Content Analysis** (STEP 3)

   - Extracts text content from BlockNote format
   - Calculates content-based relevance scores
   - Combines with semantic similarity scores
   - Console: `📊 STEP 3.1: Page "X" - Content: X, Semantic: X, Combined: X`

4. **Result Filtering** (STEP 4)
   - Filters suggestions by confidence threshold (> 0.6)
   - Sorts by relevance score
   - Limits to top 8 suggestions
   - Console: `📊 🤖 STEP 4: RAG FINAL RESULTS`

#### Scoring Algorithm

```typescript
// Content-based scoring
- Exact title match: +0.8
- Partial title word matches: +0.4 (proportional)
- Summary keyword matches: +0.3 (proportional)
- Phrase matches: +0.1 per match (max 0.3)

// Semantic scoring
- Semantic similarity: +0.5 * similarity_score

// Final score
combinedScore = min(contentScore + semanticBoost, 1.0)
confidence = min(combinedScore * 1.2, 1.0)
```

## API Endpoints

### POST /api/ai/link-suggestions

Generate link suggestions for given text.

**Request Body:**

```json
{
  "text": "string",
  "workspaceId": "uuid",
  "pageId": "uuid (optional)",
  "contextWindow": "number (optional, default: 100)"
}
```

**Response:**

```json
{
  "suggestions": [
    {
      "text": "suggested link text",
      "pageId": "uuid",
      "pageTitle": "string",
      "confidence": 0.0-1.0,
      "startIndex": "number",
      "endIndex": "number",
      "summary": "string",
      "relevanceScore": 0.0-1.0
    }
  ]
}
```

## Frontend Implementation

### AILinkStore

Manages link suggestion state and API calls.

```typescript
class AILinkStore {
  // State
  suggestions: LinkSuggestion[] = [];
  isLoading: boolean = false;

  // Actions
  async fetchSuggestions(text: string, workspaceId: string, pageId?: string);
  applySuggestion(suggestion: LinkSuggestion);
  clearSuggestions();
}
```

### BlockNote Integration

Custom slash command handler for link suggestions:

1. User types `@link` or `/link`
2. Frontend calls API with surrounding text context
3. Suggestions displayed in dropdown
4. User selects suggestion
5. Link inserted into editor

## Key Features

### 1. Bidirectional Relevance

- Considers both outgoing and incoming links
- Calculates mutual connection scores
- Prioritizes pages with shared connections

### 2. Already Linked Exclusion

- Tracks existing links in `page_links` table
- Excludes already linked pages from suggestions
- Prevents redundant linking

### 3. Hybrid Scoring

- Combines semantic similarity with content analysis
- Uses both AI embeddings and keyword matching
- Provides more accurate and relevant suggestions

### 4. Fallback Mechanisms

- Falls back to summary-based search if semantic search fails
- Uses content extraction if summaries unavailable
- Ensures suggestions always available

## Console Logging

Detailed step-by-step logging for debugging:

```
🔍 🤖 STEP 1: RAG (AI-ENHANCED) PROCESSING - SummaryService.getEnhancedLinkSuggestions called
🔍 STEP 1.1: Input parameters: { text, workspaceId, pageId, contextWindow }
🔗 STEP 1.2: Fetching already linked pages for exclusion
📋 STEP 1.3: Found X already linked pages to exclude
🧠 STEP 2: Performing semantic search for relevant pages
✅ STEP 2.4: Semantic search returned X results
✅ STEP 3: Analyzing X semantically relevant pages
📊 STEP 3.1: Page "Title" - Content: 0.XXX, Semantic: 0.XXX, Combined: 0.XXX
📊 🤖 STEP 4: RAG FINAL RESULTS - Enhanced suggestions after filtering
✅ 🤖 RAG SUCCESS - AI-enhanced suggestions generated successfully!
```

## Optimizations

### 1. Performance

- Semantic search with configurable similarity threshold
- Result limiting at multiple stages
- Efficient content extraction
- Cached embeddings and summaries

### 2. Accuracy

- Multiple scoring factors
- Contextual phrase matching
- Bidirectional link analysis
- Confidence thresholds

### 3. User Experience

- Fast response times
- Relevant suggestions
- No duplicate links
- Clear confidence indicators

## Best Practices

### For Users

1. **Generate summaries**: Pages with AI summaries get better suggestions
2. **Use descriptive titles**: Clear page titles improve matching
3. **Add context**: More surrounding text leads to better suggestions
4. **Review confidence**: Higher confidence suggestions are more relevant

### For Developers

1. **Monitor logs**: Use console logs to debug suggestion quality
2. **Tune thresholds**: Adjust similarity and confidence thresholds as needed
3. **Update embeddings**: Regenerate embeddings when content changes significantly
4. **Track metrics**: Monitor suggestion acceptance rates

## Troubleshooting

### Common Issues

1. **No suggestions appearing**

   - Check if pages have summaries
   - Verify semantic search is working
   - Check console logs for errors

2. **Irrelevant suggestions**

   - Regenerate page summaries
   - Update embeddings
   - Check scoring algorithm logs

3. **Already linked pages appearing**
   - Verify page_links table is updated
   - Check link extraction function
   - Ensure proper page ID filtering

## Future Enhancements

1. **Machine Learning**

   - Learn from user selections
   - Personalized scoring weights
   - Adaptive thresholds

2. **Advanced Features**

   - Multi-hop link suggestions
   - Topic clustering
   - Link strength visualization

3. **Performance**
   - Real-time link tracking
   - Incremental embedding updates
   - Suggestion caching
