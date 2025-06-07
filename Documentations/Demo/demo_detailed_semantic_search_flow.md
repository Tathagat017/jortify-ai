# Semantic Search Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**page_embeddings**

```sql
CREATE TABLE page_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    content_hash TEXT NOT NULL,
    embedding TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(page_id)
);
```

- `content_hash`: MD5 hash to detect content changes and avoid re-embedding
- `embedding`: JSON-serialized 1536-dimensional vector from OpenAI
- `metadata`: Additional context like chunk information, processing stats

**search_analytics**

```sql
CREATE TABLE search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    query TEXT NOT NULL,
    search_type TEXT NOT NULL DEFAULT 'semantic',
    results_count INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    clicked_result_id UUID REFERENCES pages(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `query`: User's search query for analytics and improvement
- `search_type`: Type of search performed (semantic, text, hybrid)
- `results_count`: Number of results returned
- `execution_time_ms`: Search performance tracking
- `clicked_result_id`: Which result user clicked (for relevance feedback)

**file_embeddings**

```sql
CREATE TABLE file_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    source_id UUID NOT NULL,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    file_type TEXT,
    chunk_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `source_id`: Reference to uploaded file or external source
- `content`: Extracted text content from file
- `chunk_index`: For large files split into chunks
- `file_type`: MIME type or file extension

## Detailed Step-by-Step Flow

### Step 1: Search Query Processing

**Frontend Search Input:**

```typescript
// SearchBar.tsx
const SearchBar: React.FC<SearchBarProps> = ({ workspaceId, onResults }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState<"semantic" | "text" | "hybrid">(
    "semantic"
  );

  const handleSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        onResults([]);
        return;
      }

      setLoading(true);
      const startTime = Date.now();

      try {
        const results = await searchService.performSearch({
          query: searchQuery,
          workspaceId,
          searchType,
          maxResults: 20,
        });

        const executionTime = Date.now() - startTime;

        // Track search analytics
        await searchService.trackSearch({
          query: searchQuery,
          workspaceId,
          searchType,
          resultsCount: results.length,
          executionTime,
        });

        onResults(results);
      } catch (error) {
        showNotification({
          title: "Search Failed",
          message: "Failed to perform search. Please try again.",
          color: "red",
        });
      } finally {
        setLoading(false);
      }
    }, 300),
    [workspaceId, searchType, onResults]
  );

  useEffect(() => {
    handleSearch(query);
  }, [query, handleSearch]);

  return (
    <Group>
      <TextInput
        placeholder="Search pages, files, and content..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        icon={<IconSearch size={16} />}
        rightSection={loading ? <Loader size="xs" /> : null}
        style={{ flex: 1 }}
      />

      <SegmentedControl
        value={searchType}
        onChange={(value) => setSearchType(value as any)}
        data={[
          { label: "Semantic", value: "semantic" },
          { label: "Text", value: "text" },
          { label: "Hybrid", value: "hybrid" },
        ]}
        size="sm"
      />
    </Group>
  );
};
```

### Step 2: Query Embedding Generation

**Search Service Processing:**

```typescript
// SearchService.performSearch()
class SearchService {
  static async performSearch(params: SearchParams): Promise<SearchResult[]> {
    const { query, workspaceId, searchType, maxResults } = params;

    console.log(`🔍 Performing ${searchType} search for: "${query}"`);

    switch (searchType) {
      case "semantic":
        return this.performSemanticSearch(query, workspaceId, maxResults);
      case "text":
        return this.performTextSearch(query, workspaceId, maxResults);
      case "hybrid":
        return this.performHybridSearch(query, workspaceId, maxResults);
      default:
        throw new Error("Invalid search type");
    }
  }

  private static async performSemanticSearch(
    query: string,
    workspaceId: string,
    maxResults: number
  ): Promise<SearchResult[]> {
    // Generate embedding for search query
    const queryEmbedding = await EmbeddingService.generateEmbedding(query);
    console.log("✅ Generated query embedding");

    // Search page embeddings
    const pageResults = await this.searchPageEmbeddings(
      queryEmbedding,
      workspaceId,
      maxResults
    );

    // Search file embeddings
    const fileResults = await this.searchFileEmbeddings(
      queryEmbedding,
      workspaceId,
      maxResults
    );

    // Combine and rank results
    const allResults = [...pageResults, ...fileResults];
    allResults.sort((a, b) => b.similarity - a.similarity);

    return allResults.slice(0, maxResults);
  }
}
```

### Step 3: Vector Similarity Search

**Page Embeddings Search:**

```typescript
private static async searchPageEmbeddings(
  queryEmbedding: number[],
  workspaceId: string,
  maxResults: number
): Promise<SearchResult[]> {

  // Use Supabase RPC function for efficient similarity search
  const { data: results } = await supabase.rpc(
    'semantic_search_pages',
    {
      query_embedding: JSON.stringify(queryEmbedding),
      workspace_filter: workspaceId,
      similarity_threshold: 0.3,
      max_results: maxResults
    }
  );

  return (results || []).map(result => ({
    id: result.page_id,
    title: result.title,
    content: result.content,
    similarity: result.similarity,
    type: 'page',
    excerpt: this.extractExcerpt(result.content, 200),
    lastUpdated: result.updated_at,
    tags: result.tags || []
  }));
}
```

**Database Function for Semantic Search:**

```sql
CREATE OR REPLACE FUNCTION semantic_search_pages(
  query_embedding TEXT,
  workspace_filter UUID,
  similarity_threshold FLOAT DEFAULT 0.3,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  page_id UUID,
  title TEXT,
  content JSONB,
  similarity FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE,
  tags JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as page_id,
    p.title,
    p.content,
    cosine_similarity(pe.embedding, query_embedding) as similarity,
    p.updated_at,
    COALESCE(
      json_agg(
        json_build_object('name', t.name, 'color', t.color)
      ) FILTER (WHERE t.id IS NOT NULL),
      '[]'::json
    ) as tags
  FROM pages p
  JOIN page_embeddings pe ON p.id = pe.page_id
  LEFT JOIN page_tags pt ON p.id = pt.page_id
  LEFT JOIN tags t ON pt.tag_id = t.id
  WHERE
    p.workspace_id = workspace_filter
    AND p.is_deleted = false
    AND cosine_similarity(pe.embedding, query_embedding) >= similarity_threshold
  GROUP BY p.id, p.title, p.content, pe.embedding, p.updated_at
  ORDER BY cosine_similarity(pe.embedding, query_embedding) DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

**File Embeddings Search:**

```typescript
private static async searchFileEmbeddings(
  queryEmbedding: number[],
  workspaceId: string,
  maxResults: number
): Promise<SearchResult[]> {

  const { data: results } = await supabase.rpc(
    'semantic_search_files',
    {
      query_embedding: JSON.stringify(queryEmbedding),
      workspace_filter: workspaceId,
      similarity_threshold: 0.3,
      max_results: maxResults
    }
  );

  return (results || []).map(result => ({
    id: result.source_id,
    title: result.filename,
    content: result.content,
    similarity: result.similarity,
    type: 'file',
    excerpt: this.extractExcerpt(result.content, 200),
    fileType: result.file_type,
    chunkIndex: result.chunk_index
  }));
}
```

### Step 4: Text-Based Search (Fallback)

**PostgreSQL Full-Text Search:**

```typescript
private static async performTextSearch(
  query: string,
  workspaceId: string,
  maxResults: number
): Promise<SearchResult[]> {

  // Use PostgreSQL full-text search as fallback
  const { data: pageResults } = await supabase.rpc(
    'text_search_pages',
    {
      search_query: query,
      workspace_filter: workspaceId,
      max_results: maxResults
    }
  );

  const { data: fileResults } = await supabase.rpc(
    'text_search_files',
    {
      search_query: query,
      workspace_filter: workspaceId,
      max_results: maxResults
    }
  );

  const allResults = [
    ...(pageResults || []).map(r => ({ ...r, type: 'page' })),
    ...(fileResults || []).map(r => ({ ...r, type: 'file' }))
  ];

  // Sort by text search rank
  allResults.sort((a, b) => b.rank - a.rank);

  return allResults.slice(0, maxResults);
}
```

**Text Search Database Functions:**

```sql
CREATE OR REPLACE FUNCTION text_search_pages(
  search_query TEXT,
  workspace_filter UUID,
  max_results INTEGER DEFAULT 20
)
RETURNS TABLE (
  page_id UUID,
  title TEXT,
  content JSONB,
  rank FLOAT,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as page_id,
    p.title,
    p.content,
    ts_rank(
      to_tsvector('english', p.title || ' ' || p.content::text),
      plainto_tsquery('english', search_query)
    ) as rank,
    p.updated_at
  FROM pages p
  WHERE
    p.workspace_id = workspace_filter
    AND p.is_deleted = false
    AND (
      to_tsvector('english', p.title || ' ' || p.content::text)
      @@ plainto_tsquery('english', search_query)
    )
  ORDER BY rank DESC
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

### Step 5: Hybrid Search Implementation

**Combining Semantic and Text Search:**

```typescript
private static async performHybridSearch(
  query: string,
  workspaceId: string,
  maxResults: number
): Promise<SearchResult[]> {

  // Perform both searches in parallel
  const [semanticResults, textResults] = await Promise.all([
    this.performSemanticSearch(query, workspaceId, maxResults),
    this.performTextSearch(query, workspaceId, maxResults)
  ]);

  // Combine results with weighted scoring
  const combinedResults = this.combineSearchResults(
    semanticResults,
    textResults,
    {
      semanticWeight: 0.7,
      textWeight: 0.3
    }
  );

  return combinedResults.slice(0, maxResults);
}

private static combineSearchResults(
  semanticResults: SearchResult[],
  textResults: SearchResult[],
  weights: { semanticWeight: number; textWeight: number }
): SearchResult[] {

  const resultMap = new Map<string, SearchResult>();

  // Add semantic results
  for (const result of semanticResults) {
    const score = result.similarity * weights.semanticWeight;
    resultMap.set(result.id, {
      ...result,
      combinedScore: score,
      searchTypes: ['semantic']
    });
  }

  // Add or merge text results
  for (const result of textResults) {
    const textScore = (result.rank || 0) * weights.textWeight;

    if (resultMap.has(result.id)) {
      // Merge with existing semantic result
      const existing = resultMap.get(result.id)!;
      existing.combinedScore += textScore;
      existing.searchTypes.push('text');
    } else {
      // Add as new result
      resultMap.set(result.id, {
        ...result,
        combinedScore: textScore,
        searchTypes: ['text']
      });
    }
  }

  // Sort by combined score
  const combinedResults = Array.from(resultMap.values());
  combinedResults.sort((a, b) => b.combinedScore - a.combinedScore);

  return combinedResults;
}
```

### Step 6: Result Enhancement and Excerpt Generation

**Excerpt Extraction:**

```typescript
private static extractExcerpt(content: any, maxLength: number): string {
  let text = '';

  if (typeof content === 'string') {
    text = content;
  } else if (content && Array.isArray(content)) {
    // Extract text from BlockNote content
    text = content.map(block => {
      if (block.type === 'paragraph' || block.type === 'heading') {
        return block.content?.map((item: any) => item.text || '').join('') || '';
      }
      return '';
    }).filter(t => t.trim()).join(' ');
  }

  if (text.length <= maxLength) {
    return text;
  }

  // Find a good breaking point near the limit
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

private static highlightSearchTerms(text: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/);
  let highlightedText = text;

  for (const term of terms) {
    if (term.length > 2) { // Only highlight meaningful terms
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    }
  }

  return highlightedText;
}
```

### Step 7: Search Analytics and Tracking

**Analytics Storage:**

```typescript
static async trackSearch(params: SearchAnalytics): Promise<void> {
  const { query, workspaceId, searchType, resultsCount, executionTime } = params;

  try {
    await supabase
      .from('search_analytics')
      .insert({
        workspace_id: workspaceId,
        user_id: getCurrentUserId(),
        query: query.substring(0, 500), // Limit query length
        search_type: searchType,
        results_count: resultsCount,
        execution_time_ms: executionTime
      });
  } catch (error) {
    console.error('Failed to track search analytics:', error);
  }
}

static async trackResultClick(resultId: string, searchQuery: string): Promise<void> {
  try {
    // Update the most recent search record with clicked result
    await supabase
      .from('search_analytics')
      .update({ clicked_result_id: resultId })
      .eq('user_id', getCurrentUserId())
      .eq('query', searchQuery)
      .order('created_at', { ascending: false })
      .limit(1);
  } catch (error) {
    console.error('Failed to track result click:', error);
  }
}
```

### Step 8: Frontend Result Display

**Search Results Component:**

```typescript
// SearchResults.tsx
const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  query,
  loading,
  onResultClick,
}) => {
  const handleResultClick = (result: SearchResult) => {
    // Track click analytics
    SearchService.trackResultClick(result.id, query);

    // Navigate to result
    onResultClick(result);
  };

  if (loading) {
    return (
      <Stack spacing="md">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} height={80} />
        ))}
      </Stack>
    );
  }

  if (results.length === 0) {
    return (
      <Center py="xl">
        <Stack align="center" spacing="md">
          <IconSearchOff size={48} color="gray" />
          <Text color="dimmed">No results found for "{query}"</Text>
          <Text size="sm" color="dimmed">
            Try different keywords or check your spelling
          </Text>
        </Stack>
      </Center>
    );
  }

  return (
    <Stack spacing="md">
      <Text size="sm" color="dimmed">
        Found {results.length} results for "{query}"
      </Text>

      {results.map((result) => (
        <Card
          key={result.id}
          padding="md"
          shadow="sm"
          style={{ cursor: "pointer" }}
          onClick={() => handleResultClick(result)}
        >
          <Group position="apart" align="flex-start">
            <Stack spacing="xs" style={{ flex: 1 }}>
              <Group spacing="xs">
                <Text weight="bold" size="md">
                  {result.title}
                </Text>

                <Badge
                  size="xs"
                  color={result.type === "page" ? "blue" : "green"}
                  variant="light"
                >
                  {result.type}
                </Badge>

                {result.similarity && (
                  <Badge size="xs" color="gray" variant="outline">
                    {Math.round(result.similarity * 100)}% match
                  </Badge>
                )}
              </Group>

              <Text
                size="sm"
                color="dimmed"
                dangerouslySetInnerHTML={{
                  __html: SearchService.highlightSearchTerms(
                    result.excerpt,
                    query
                  ),
                }}
              />

              {result.tags && result.tags.length > 0 && (
                <Group spacing="xs">
                  {result.tags.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.name}
                      size="xs"
                      color={tag.color}
                      variant="filled"
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>

            <Stack align="flex-end" spacing="xs">
              <Text size="xs" color="dimmed">
                {formatDistanceToNow(new Date(result.lastUpdated))} ago
              </Text>

              {result.searchTypes && (
                <Group spacing="xs">
                  {result.searchTypes.map((type) => (
                    <Badge key={type} size="xs" variant="dot">
                      {type}
                    </Badge>
                  ))}
                </Group>
              )}
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  );
};
```

## Key Packages Used

**Backend:**

- `@supabase/supabase-js`: Database operations and vector search functions
- `openai`: Query embedding generation
- `pg`: PostgreSQL client for custom search functions

**Frontend:**

- `@mantine/core`: UI components (TextInput, Card, Badge, Skeleton)
- `@tabler/icons-react`: Search and result icons
- `react`: Core framework for search components
- `date-fns`: Date formatting for result timestamps

## Performance Optimizations

**Search Performance:**

- Query embedding caching for repeated searches
- Database indexes on embedding similarity functions
- Parallel execution of semantic and text searches in hybrid mode

**Result Processing:**

- Excerpt generation with intelligent truncation
- Lazy loading of search results for large result sets
- Debounced search input to reduce API calls

**Database Optimizations:**

- Specialized indexes for vector similarity search
- Full-text search indexes for PostgreSQL text search
- Query result caching for popular searches

**Analytics Optimization:**

- Asynchronous analytics tracking to not block search
- Batched analytics insertion for high-volume searches
- Data retention policies for search analytics
