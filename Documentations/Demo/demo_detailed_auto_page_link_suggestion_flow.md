# Auto Page Link Suggestion Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**pages**

```sql
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB DEFAULT '{}',
    summary TEXT,
    summary_updated_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `id`: Unique page identifier for link suggestions
- `workspace_id`: Isolates suggestions to specific workspace
- `title`: Primary matching field for link suggestions
- `content`: BlockNote JSON structure for context extraction
- `summary`: AI-generated summary for enhanced relevance scoring
- `summary_updated_at`: Tracks when summary was last generated
- `is_deleted`: Soft delete flag to exclude deleted pages

**page_links**

```sql
CREATE TABLE page_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    target_page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    link_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_page_id, target_page_id)
);
```

- `source_page_id`: Page containing the link (current page)
- `target_page_id`: Page being linked to (suggestion target)
- `workspace_id`: Workspace reference for isolation
- `link_text`: Context text around the link for analysis
- `UNIQUE constraint`: Prevents duplicate links between same pages

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

- `page_id`: Links embedding to source page
- `content_hash`: MD5 hash for change detection and cache invalidation
- `embedding`: JSON-serialized 1536-dimensional vector from OpenAI
- `metadata`: Additional context like chunk information and processing stats

**ai_sessions**

```sql
CREATE TABLE ai_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    session_type TEXT NOT NULL,
    input_data JSONB DEFAULT '{}',
    output_data JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `workspace_id`: Links session to workspace for analytics
- `session_type`: 'link_suggestion' for this feature
- `input_data`: JSON with text, context window, and page ID
- `output_data`: JSON with suggestions, scores, and processing method
- `metadata`: Page ID, suggestion count, and performance metrics

## Detailed Step-by-Step Flow

### Step 1: Frontend Link Trigger Detection

**@link Command Recognition:**

```typescript
// BlockNoteEditor.tsx - Slash command detection
const handleSlashCommand = useCallback(
  (editor: BlockNoteEditor) => {
    const selection = editor.getTextCursorPosition();
    const currentBlock = editor.getBlock(selection.block);

    // Extract current text content
    const blockText =
      currentBlock.content?.map((item: any) => item.text || "").join("") || "";

    // Check for @link trigger at the end of text
    if (blockText.endsWith("@link")) {
      console.log("🔗 @link trigger detected, showing suggestions");

      // Calculate popup position relative to cursor
      const cursorPosition = editor.getTextCursorPosition();
      const editorRect = editor.domElement?.getBoundingClientRect();

      const menuPosition = {
        x: (editorRect?.left || 0) + cursorPosition.x,
        y: (editorRect?.top || 0) + cursorPosition.y + 20,
      };

      // Extract surrounding context for better suggestions
      const contextText = extractSurroundingContext(editor, currentBlock);

      // Trigger link suggestion popup
      aiLinkStore.handleLinkTrigger(
        workspaceStore.selectedWorkspace?.id,
        pageStore.selectedPage?.id,
        menuPosition,
        pageStore
      );
    }
  },
  [editor, aiLinkStore, workspaceStore, pageStore]
);
```

**Context Extraction:**

```typescript
// Extract surrounding context for better AI suggestions
const extractSurroundingContext = (
  editor: BlockNoteEditor,
  currentBlock: any
): string => {
  const allBlocks = editor.document;
  const currentIndex = allBlocks.findIndex(
    (block) => block.id === currentBlock.id
  );

  // Get 2 blocks before and after current block
  const contextBlocks = allBlocks.slice(
    Math.max(0, currentIndex - 2),
    Math.min(allBlocks.length, currentIndex + 3)
  );

  return contextBlocks
    .map((block) => extractTextFromBlock(block))
    .filter((text) => text.trim())
    .join(" ")
    .slice(-500); // Limit to last 500 characters
};
```

### Step 2: Frontend State Management

**AILinkStore Initialization:**

```typescript
// AILinkStore.handleLinkTrigger()
handleLinkTrigger = async (
  workspaceId: string,
  pageId?: string,
  position?: { x: number; y: number },
  pageStore?: { pages: Array<Page> }
) => {
  console.log("🚀 handleLinkTrigger called with:", {
    workspaceId,
    pageId,
    position,
    currentText: this.currentText,
    pageStorePages: pageStore?.pages?.length || 0,
  });

  // Set initial loading state
  runInAction(() => {
    this.isLoading = true;
    this.error = null;
    this.triggerType = "manual";
    this.position = position || null;
    this.isVisible = true;
    this.selectedIndex = 0;
    this.showAllPages = true;
    this.suggestions = [];
    this.allPages = [];
  });

  // Load all workspace pages for fallback display
  if (pageStore) {
    this.loadPagesFromStore(pageStore, pageId);
  }

  // Generate AI suggestions with current context
  const textForSuggestions =
    this.currentText.length >= this.MIN_TEXT_LENGTH
      ? this.currentText
      : "link to relevant page"; // Default context for AI

  console.log("📝 Text for AI suggestions:", textForSuggestions);

  await this.generateSuggestions(textForSuggestions, workspaceId, pageId);
};
```

**Page Store Integration:**

```typescript
// Load pages from page store for immediate display
private loadPagesFromStore = (
  pageStore: { pages: Array<Page> },
  currentPageId?: string
) => {
  const filteredPages = pageStore.pages
    .filter(page => page.id !== currentPageId) // Exclude current page
    .map(page => ({
      id: page.id,
      title: page.title,
      icon_url: page.icon_url,
      summary: page.summary
    }));

  runInAction(() => {
    this.allPages = filteredPages;
  });

  console.log('📄 Loaded pages from store:', {
    totalPages: filteredPages.length,
    pagesWithSummaries: filteredPages.filter(p => p.summary).length
  });
};
```

### Step 3: Backend API Request Processing

**Route Handler:**

```typescript
// ai.routes.ts
router.post(
  "/link-suggestions",
  asyncHandler(AIController.generateLinkSuggestions)
);
```

**Controller Validation:**

```typescript
// AIController.generateLinkSuggestions()
static async generateLinkSuggestions(req: Request, res: Response) {
  // Validate request schema
  const { error: validationError, value } = linkSuggestionSchema.validate(req.body);
  if (validationError) {
    throw new AppError(400, `Validation error: ${validationError.details[0].message}`);
  }

  const { text, workspaceId, pageId, contextWindow } = value;

  console.log('🔍 Link suggestion request:', {
    textLength: text.length,
    textPreview: text.substring(0, 100),
    workspaceId,
    pageId,
    contextWindow
  });

  // Generate enhanced link suggestions
  const linkSuggestions = await AIService.generateLinkSuggestions(
    text,
    workspaceId,
    pageId
  );

  // Log AI interaction for analytics
  try {
    await supabase.from("ai_sessions").insert({
      workspace_id: workspaceId,
      session_type: "link_suggestion",
      input_data: { text, contextWindow },
      output_data: { suggestions: linkSuggestions },
      metadata: { pageId, suggestionCount: linkSuggestions.length }
    });
  } catch (logError) {
    console.warn("Failed to log AI interaction:", logError);
  }

  res.json({
    success: true,
    suggestions: linkSuggestions,
    text,
    timestamp: new Date().toISOString()
  });
}
```

**Validation Schema:**

```typescript
// Joi validation schema for link suggestions
const linkSuggestionSchema = Joi.object({
  text: Joi.string().required().min(3),
  workspaceId: Joi.string().uuid().required(),
  pageId: Joi.string().uuid().optional(),
  contextWindow: Joi.number().integer().min(50).max(500).default(100),
});
```

### Step 4: AI Service Processing

**Primary Method Selection:**

```typescript
// AIService.generateLinkSuggestions()
static async generateLinkSuggestions(
  text: string,
  workspaceId: string,
  pageId?: string
): Promise<LinkSuggestion[]> {
  console.log('🔍 AIService.generateLinkSuggestions called with:', {
    text,
    textLength: text.length,
    workspaceId,
    pageId
  });

  try {
    // ENHANCED: Context augmentation for short text
    let enhancedText = text;
    if (text.length < 100 && pageId) {
      console.log('📄 Text too short, fetching additional context from current page...');

      const { data: currentPage, error } = await supabase
        .from("pages")
        .select("title, content")
        .eq("id", pageId)
        .single();

      if (!error && currentPage) {
        const pageText = this.extractTextFromPageContent(
          currentPage.title,
          currentPage.content
        );
        const additionalContext = pageText.slice(-500);
        enhancedText = additionalContext + " " + text;

        console.log('📄 Enhanced text with page context:', {
          originalLength: text.length,
          enhancedLength: enhancedText.length,
          additionalContext: additionalContext.substring(0, 200) + "..."
        });
      }
    }

    console.log('🤖 ATTEMPTING RAG (AI-ENHANCED) SUGGESTIONS FIRST...');

    // Primary method: RAG-enhanced suggestions
    const enhancedSuggestions = await SummaryService.getEnhancedLinkSuggestions(
      enhancedText,
      workspaceId,
      pageId
    );

    // Convert to LinkSuggestion format
    const linkSuggestions: LinkSuggestion[] = enhancedSuggestions.map(suggestion => {
      const startIndex = enhancedText
        .toLowerCase()
        .indexOf(suggestion.suggestedText.toLowerCase());

      return {
        text: suggestion.suggestedText,
        pageId: suggestion.pageId,
        pageTitle: suggestion.pageTitle,
        confidence: suggestion.confidence,
        startIndex: startIndex !== -1 ? startIndex : 0,
        endIndex: startIndex !== -1
          ? startIndex + suggestion.suggestedText.length
          : suggestion.suggestedText.length,
        summary: suggestion.summary,
        relevanceScore: suggestion.relevanceScore
      };
    });

    if (linkSuggestions.length > 0) {
      console.log('✅ 🤖 USING RAG (AI-ENHANCED) SUGGESTIONS - AI summaries found and processed successfully!');
      return linkSuggestions;
    }

    console.log('⚠️ 🤖 RAG (AI-ENHANCED) SUGGESTIONS FAILED - No AI summaries available or no matches found');
    console.log('🔄 FALLING BACK TO STRING MATCHING ALGORITHM...');

    // Fallback method: String matching
    const basicSuggestions = await this.generateBasicLinkSuggestions(
      enhancedText,
      workspaceId,
      pageId
    );

    return basicSuggestions;

  } catch (error) {
    console.error('❌ Error generating enhanced link suggestions:', error);
    console.log('🔄 🤖 RAG (AI-ENHANCED) SUGGESTIONS ERROR - Falling back to string matching due to error');

    // Final fallback
    const basicSuggestions = await this.generateBasicLinkSuggestions(
      text,
      workspaceId,
      pageId
    );

    return basicSuggestions;
  }
}
```

### Step 5: RAG-Enhanced Processing

**Link Exclusion (Step 1):**

```typescript
// SummaryService.getEnhancedLinkSuggestions()
static async getEnhancedLinkSuggestions(
  text: string,
  workspaceId: string,
  pageId?: string,
  contextWindow: number = 100
): Promise<EnhancedSuggestion[]> {
  console.log('🔍 🤖 STEP 1: RAG (AI-ENHANCED) PROCESSING - SummaryService.getEnhancedLinkSuggestions called');

  // Step 1: Get already linked pages to exclude them
  let alreadyLinkedPageIds: string[] = [];
  if (pageId) {
    console.log('🔗 STEP 1.2: Fetching already linked pages for exclusion');

    const { data: linkedPages, error: linkError } = await supabase
      .from("page_links")
      .select("target_page_id")
      .eq("source_page_id", pageId);

    if (!linkError && linkedPages) {
      alreadyLinkedPageIds = linkedPages.map(link => link.target_page_id);
      console.log(`📋 STEP 1.3: Found ${alreadyLinkedPageIds.length} already linked pages to exclude`);
    }
  }
}
```

**Semantic Search (Step 2):**

```typescript
// Step 2: Use semantic search to find relevant pages
console.log("🧠 STEP 2: Performing semantic search for relevant pages");

const queryEmbedding = await EmbeddingService.generateEmbedding(text);

const { data: searchResults, error: searchError } = await supabase.rpc(
  "semantic_search_workspace_only",
  {
    query_embedding: JSON.stringify(queryEmbedding),
    workspace_filter: workspaceId,
    similarity_threshold: 0.5, // Lower threshold for better recall
    max_results: 30, // Get more results to filter
  }
);

if (searchError || !searchResults) {
  console.error("❌ STEP 2.1: Semantic search failed:", searchError);

  // Fallback to summary-based search
  console.log("🔄 STEP 2.2: Falling back to summary-based search");

  const { data: pages, error } = await supabase
    .from("pages")
    .select("id, title, summary, content")
    .eq("workspace_id", workspaceId)
    .neq("id", pageId || "")
    .not("summary", "is", null)
    .limit(20);

  if (error || !pages) {
    console.error(
      "❌ 🤖 RAG FAILED - Error fetching pages for link suggestions:",
      error
    );
    return [];
  }

  if (pages.length === 0) {
    console.log(
      "⚠️ 🤖 RAG FAILED - No pages with AI-generated summaries found in workspace"
    );
    return [];
  }
}
```

**Database Function for Semantic Search:**

```sql
CREATE OR REPLACE FUNCTION semantic_search_workspace_only(
    query_embedding TEXT,
    workspace_filter UUID,
    similarity_threshold FLOAT DEFAULT 0.5,
    max_results INTEGER DEFAULT 30
)
RETURNS TABLE (
    source_type TEXT,
    source_id UUID,
    page_id UUID,
    title TEXT,
    similarity FLOAT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    -- Search in page embeddings
    SELECT
        'page'::TEXT as source_type,
        p.id as source_id,
        p.id as page_id,
        p.title,
        cosine_similarity(pe.embedding, query_embedding) as similarity,
        COALESCE(p.summary, LEFT(p.content::TEXT, 500)) as content,
        pe.metadata,
        p.created_at
    FROM pages p
    JOIN page_embeddings pe ON p.id = pe.page_id
    WHERE
        p.workspace_id = workspace_filter
        AND p.is_deleted = false
        AND cosine_similarity(pe.embedding, query_embedding) >= similarity_threshold

    ORDER BY similarity DESC
    LIMIT max_results;
END;
$$ LANGUAGE plpgsql;
```

### Step 6: AI Relevance Analysis

**Enhanced Relevance Scoring:**

```typescript
// SummaryService.analyzeEnhancedLinkRelevance()
private static async analyzeEnhancedLinkRelevance(
  text: string,
  pages: Array<{
    id: string;
    title: string;
    summary: string;
    content?: any;
    semanticSimilarity?: number;
  }>,
  contextWindow: number
): Promise<EnhancedSuggestion[]> {
  const suggestions: EnhancedSuggestion[] = [];

  for (const page of pages) {
    console.log(`🧮 STEP 3.1: Analyzing page "${page.title}"`);

    // Calculate content-based relevance score
    const contentRelevance = this.calculateRelevanceScore(
      text,
      page.title,
      page.summary
    );

    // Combine with semantic similarity if available
    const semanticBoost = page.semanticSimilarity ? page.semanticSimilarity * 0.3 : 0;
    const combinedScore = Math.min(contentRelevance + semanticBoost, 1.0);

    console.log(`📊 STEP 3.1: Page "${page.title}" - Content: ${contentRelevance.toFixed(3)}, Semantic: ${(page.semanticSimilarity || 0).toFixed(3)}, Combined: ${combinedScore.toFixed(3)}`);

    if (combinedScore > 0.3) {
      const suggestedText = this.findBestLinkText(text, page.title);
      const confidence = Math.min(combinedScore * 1.2, 1.0);

      suggestions.push({
        pageId: page.id,
        pageTitle: page.title,
        summary: page.summary,
        relevanceScore: combinedScore,
        suggestedText: suggestedText || page.title,
        confidence
      });

      console.log(`✅ STEP 3.1: Added suggestion for "${page.title}" with confidence ${confidence.toFixed(3)}`);
    }
  }

  return suggestions;
}
```

**Detailed Confidence Calculation:**

```typescript
// SummaryService.calculateRelevanceScore()
private static calculateRelevanceScore(
  text: string,
  pageTitle: string,
  pageSummary: string
): number {
  let score = 0;
  const textLower = text.toLowerCase();
  const titleLower = pageTitle.toLowerCase();
  const summaryLower = pageSummary.toLowerCase();

  console.log(`🧮 Calculating relevance for "${pageTitle}" against context:`, {
    textLength: text.length,
    textPreview: text.substring(0, 100) + "...",
    pageTitle,
    summaryPreview: pageSummary.substring(0, 100) + "..."
  });

  // 1. Exact title match gets highest score (0.8 points)
  if (textLower.includes(titleLower)) {
    score += 0.8;
    console.log(`✅ Exact title match found for "${pageTitle}" - adding 0.8 to score`);
  }

  // 2. Partial title word matches (0.4 points max)
  const titleWords = titleLower.split(" ").filter(word => word.length > 3);
  const matchingTitleWords = titleWords.filter(word => textLower.includes(word));
  const titleWordScore = (matchingTitleWords.length / Math.max(titleWords.length, 1)) * 0.4;
  score += titleWordScore;

  if (matchingTitleWords.length > 0) {
    console.log(`✅ Title word matches for "${pageTitle}":`, {
      matchingWords: matchingTitleWords,
      scoreAdded: titleWordScore
    });
  }

  // 3. Enhanced summary keyword matches (0.2 points + bonuses)
  const commonWords = new Set([
    'amazing', 'great', 'good', 'nice', 'awesome', 'wonderful', 'beautiful',
    'interesting', 'important', 'useful', 'helpful', 'simple', 'easy',
    'type', 'text', 'styles', 'content', 'page', 'document', 'link'
  ]);

  const summaryWords = summaryLower
    .split(" ")
    .filter(word => word.length > 4 && !commonWords.has(word))
    .slice(0, 30);

  const matchingSummaryWords = summaryWords.filter(word => textLower.includes(word));
  const meaningfulMatches = matchingSummaryWords.filter(
    word => !commonWords.has(word) && word.length > 5
  );

  const summaryWordScore =
    (matchingSummaryWords.length / Math.max(summaryWords.length, 1)) * 0.2 +
    meaningfulMatches.length * 0.05; // Bonus for meaningful words

  score += summaryWordScore;

  // 4. Contextual phrase matching (0.3 points max)
  const textPhrases = this.extractPhrases(textLower, 2, 3);
  const summaryPhrases = this.extractPhrases(summaryLower, 2, 3);
  const titlePhrases = this.extractPhrases(titleLower, 2, 3);

  const phraseMatches = textPhrases.filter(phrase =>
    summaryPhrases.includes(phrase) || titlePhrases.includes(phrase)
  );

  if (phraseMatches.length > 0) {
    const phraseScore = Math.min(phraseMatches.length * 0.1, 0.3);
    score += phraseScore;
    console.log(`✅ Phrase matches for "${pageTitle}":`, {
      matchingPhrases: phraseMatches.slice(0, 3),
      scoreAdded: phraseScore
    });
  }

  // 5. Topic relevance check (penalty for unrelated topics)
  const topicRelevance = this.checkTopicRelevance(text, pageTitle, pageSummary);
  if (!topicRelevance.isRelevant) {
    score *= 0.5; // Reduce score by 50% if topics are unrelated
    console.log(`⚠️ Topic mismatch for "${pageTitle}":`, topicRelevance.reason);
  }

  const finalScore = Math.min(score, 1.0);
  console.log(`📊 Final relevance score for "${pageTitle}": ${finalScore.toFixed(3)}`);

  return finalScore;
}
```

**Topic Relevance Analysis:**

```typescript
// Check if topics are related based on content analysis
private static checkTopicRelevance(
  text: string,
  pageTitle: string,
  pageSummary: string
): { isRelevant: boolean; reason?: string } {
  const textLower = text.toLowerCase();
  const titleLower = pageTitle.toLowerCase();
  const summaryLower = pageSummary.toLowerCase();

  // Define topic categories
  const topicCategories = {
    sports: ['cricket', 'football', 'soccer', 'tennis', 'basketball', 'game', 'match', 'player', 'team', 'sport'],
    countries: ['india', 'pakistan', 'england', 'australia', 'america', 'country', 'nation', 'capital', 'population'],
    technology: ['software', 'hardware', 'computer', 'programming', 'code', 'developer', 'tech', 'digital', 'ai'],
    business: ['sales', 'marketing', 'channel', 'customer', 'revenue', 'business', 'strategy', 'market']
  };

  // Find which categories the current text belongs to
  const textCategories = new Set<string>();
  const pageCategories = new Set<string>();

  for (const [category, keywords] of Object.entries(topicCategories)) {
    // Check text categories
    if (keywords.some(keyword => textLower.includes(keyword))) {
      textCategories.add(category);
    }

    // Check page categories (title + summary)
    if (keywords.some(keyword =>
      titleLower.includes(keyword) || summaryLower.includes(keyword)
    )) {
      pageCategories.add(category);
    }
  }

  // If both have categories, check for overlap
  if (textCategories.size > 0 && pageCategories.size > 0) {
    const hasOverlap = [...textCategories].some(cat => pageCategories.has(cat));

    if (!hasOverlap) {
      return {
        isRelevant: false,
        reason: `Topic mismatch: text is about ${[...textCategories].join(', ')} while page is about ${[...pageCategories].join(', ')}`
      };
    }
  }

  return { isRelevant: true };
}
```

### Step 7: Filtering and Ranking

**Final Processing:**

```typescript
// SummaryService.filterAndSortSuggestions()
private static filterAndSortSuggestions(
  suggestions: EnhancedSuggestion[]
): EnhancedSuggestion[] {
  const filteredSuggestions = suggestions
    .filter(suggestion => suggestion.confidence > 0.6) // Only high-confidence suggestions
    .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance
    .slice(0, 8); // Limit to top 8 suggestions

  console.log('📊 🤖 STEP 4: RAG FINAL RESULTS - Enhanced suggestions after filtering:', {
    originalCount: suggestions.length,
    filteredCount: filteredSuggestions.length,
    suggestions: filteredSuggestions.map(s => ({
      title: s.pageTitle,
      score: s.relevanceScore.toFixed(3),
      confidence: s.confidence.toFixed(3)
    }))
  });

  if (filteredSuggestions.length > 0) {
    console.log('✅ 🤖 RAG SUCCESS - AI-enhanced suggestions generated successfully!');
  } else {
    console.log('❌ 🤖 RAG FAILED - No high-confidence AI suggestions found (confidence < 0.6)');
  }

  return filteredSuggestions;
}
```

### Step 8: Fallback String Matching

**Basic Algorithm Implementation:**

```typescript
// AIService.generateBasicLinkSuggestions()
private static async generateBasicLinkSuggestions(
  text: string,
  workspaceId: string,
  pageId?: string
): Promise<LinkSuggestion[]> {
  console.log('🔧 📝 USING STRING MATCHING ALGORITHM (FALLBACK METHOD)');

  const { data: pages, error } = await supabase
    .from("pages")
    .select("id, title, content, summary")
    .eq("workspace_id", workspaceId)
    .neq("id", pageId || "")
    .limit(50);

  if (error || !pages) {
    console.log('❌ Error fetching pages or no pages found:', error);
    return [];
  }

  const suggestions: LinkSuggestion[] = [];
  const textLower = text.toLowerCase();

  for (const page of pages) {
    const pageTitle = page.title.toLowerCase();

    // 1. Exact title match
    const titleIndex = textLower.indexOf(pageTitle);
    if (titleIndex !== -1 && pageTitle.length > 2) {
      console.log(`✅ 📝 STRING MATCH FOUND - Exact title match: "${page.title}"`);
      suggestions.push({
        text: page.title,
        pageId: page.id,
        pageTitle: page.title,
        confidence: pageTitle.length > 5 ? 0.9 : 0.7,
        startIndex: titleIndex,
        endIndex: titleIndex + pageTitle.length,
        summary: page.summary
      });
    }

    // 2. Word-level matches
    const words = pageTitle.split(" ");
    for (const word of words) {
      if (word.length > 3 && textLower.includes(word.toLowerCase())) {
        const wordIndex = textLower.indexOf(word.toLowerCase());
        suggestions.push({
          text: word,
          pageId: page.id,
          pageTitle: page.title,
          confidence: 0.6,
          startIndex: wordIndex,
          endIndex: wordIndex + word.length,
          summary: page.summary
        });
      }
    }

    // 3. Generic @link handling
    if (text.toLowerCase().includes('link') ||
        text.toLowerCase().includes('relevant') ||
        text.toLowerCase().includes('page')) {
      suggestions.push({
        text: page.title,
        pageId: page.id,
        pageTitle: page.title,
        confidence: 0.5,
        startIndex: 0,
        endIndex: page.title.length,
        summary: page.summary
      });
    }
  }

  // Remove duplicates and sort by confidence
  const uniqueSuggestions = suggestions
    .filter((suggestion, index, self) =>
      index === self.findIndex(s =>
        s.pageId === suggestion.pageId && s.text === suggestion.text
      )
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);

  console.log('📊 📝 STRING MATCHING ALGORITHM RESULTS:', {
    totalSuggestions: suggestions.length,
    uniqueSuggestions: uniqueSuggestions.length,
    suggestionsWithSummaries: uniqueSuggestions.filter(s => s.summary).length
  });

  return uniqueSuggestions;
}
```

### Step 9: Frontend Display and Interaction

**Suggestion Popup Rendering:**

```typescript
// LinkSuggestionPopup.tsx
const LinkSuggestionPopup: React.FC<LinkSuggestionPopupProps> = ({
  onAccept,
  onReject,
}) => {
  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return "green";
    if (confidence >= 0.6) return "yellow";
    return "gray";
  };

  const renderSuggestionItem = (
    item: LinkSuggestion,
    index: number,
    isAISuggestion: boolean
  ) => {
    const isSelected = index === aiLinkStore.selectedIndex;
    const confidence = item.confidence || 1.0;

    return (
      <Box
        key={item.pageId}
        className={`suggestion-item ${isSelected ? "selected" : ""}`}
        onClick={() => onAccept(item)}
      >
        <Group position="apart" align="flex-start" spacing="xs">
          <Group spacing="xs" align="center" style={{ flex: 1 }}>
            <FontAwesomeIcon
              icon={isAISuggestion ? faRobot : faFile}
              size="sm"
              className="item-icon"
            />
            <Stack spacing={2} style={{ flex: 1 }}>
              <Text size="sm" weight={500}>
                {item.pageTitle}
              </Text>

              {/* Show AI suggestion context */}
              {isAISuggestion && item.text && (
                <Text size="xs" color="dimmed">
                  "{item.text}"
                </Text>
              )}

              {/* Show page summary */}
              {item.summary && (
                <Text size="xs" color="dimmed">
                  {item.summary}
                </Text>
              )}
            </Stack>
          </Group>

          {/* Confidence badge for AI suggestions */}
          {isAISuggestion && (
            <Badge
              size="xs"
              color={getConfidenceColor(confidence)}
              variant="light"
            >
              {getConfidenceLabel(confidence)}
            </Badge>
          )}
        </Group>
      </Box>
    );
  };

  return (
    <Portal>
      <div
        className="ai-context-menu"
        style={{
          position: "fixed",
          left: aiLinkStore.position?.x || 0,
          top: aiLinkStore.position?.y || 0,
          zIndex: 1000,
        }}
      >
        <Stack spacing="xs">
          {/* AI Suggestions Section */}
          {aiLinkStore.hasSuggestions && (
            <>
              <Group spacing="xs" align="center">
                <FontAwesomeIcon icon={faRobot} size="xs" />
                <Text size="xs" weight={500}>
                  AI Suggestions
                </Text>
              </Group>

              <Stack spacing={2}>
                {aiLinkStore.suggestions.map((suggestion, index) =>
                  renderSuggestionItem(suggestion, index, true)
                )}
              </Stack>
            </>
          )}

          {/* All Pages Section */}
          {aiLinkStore.hasPages && (
            <>
              <Divider />
              <Group spacing="xs" align="center">
                <FontAwesomeIcon icon={faFile} size="xs" />
                <Text size="xs" weight={500}>
                  All Pages
                </Text>
              </Group>

              <Stack spacing={2}>
                {aiLinkStore.allPages.map((page, index) =>
                  renderSuggestionItem(
                    page,
                    aiLinkStore.suggestions.length + index,
                    false
                  )
                )}
              </Stack>
            </>
          )}
        </Stack>
      </div>
    </Portal>
  );
};
```

**Link Insertion:**

```typescript
// BlockNoteEditor.tsx - Handle link acceptance
const handleLinkAccept = useCallback(
  (item: LinkSuggestion | { id: string; title: string; summary?: string }) => {
    if (!editor) return;

    try {
      const isLinkSuggestion = "pageId" in item;
      const pageId = isLinkSuggestion ? item.pageId : item.id;
      const pageTitle = isLinkSuggestion ? item.pageTitle : item.title;

      // Remove @link and insert the actual link
      removeAtLinkAndInsertLink(pageId, pageTitle);

      aiLinkStore.hideSuggestions();
    } catch (error) {
      console.error("Error inserting link:", error);
    }
  },
  [editor, aiLinkStore]
);

const removeAtLinkAndInsertLink = (pageId: string, pageTitle: string) => {
  const selection = editor.getTextCursorPosition();
  const currentBlock = editor.getBlock(selection.block);

  // Find and remove @link from current block
  const updatedContent = currentBlock.content?.map((item: any) => {
    if (item.text && item.text.endsWith("@link")) {
      return {
        ...item,
        text: item.text.replace("@link", ""),
        link: `/page/${pageId}`,
      };
    }
    return item;
  });

  // Insert the link
  editor.insertInlineContent([
    {
      type: "text",
      text: pageTitle,
      styles: {
        textColor: "blue",
        underline: true,
      },
      link: `/page/${pageId}`,
    },
  ]);
};
```

## Key Packages Used

**Backend:**

- `@supabase/supabase-js`: Database operations and vector search functions
- `openai`: Text embeddings and semantic analysis
- `joi`: Input validation for link suggestion requests
- `express`: Web framework for API endpoints

**Frontend:**

- `@blocknote/core`: Editor integration and link insertion
- `@blocknote/react`: React components for BlockNote editor
- `mobx-react-lite`: Reactive state management for link store
- `@mantine/core`: UI components for suggestion popup
- `@tabler/icons-react`: Icons for suggestion interface

## Performance Optimizations

**Backend Optimizations:**

- Context enhancement for short text inputs
- Semantic search with configurable similarity thresholds
- Link exclusion to avoid duplicate suggestions
- Fallback algorithms for comprehensive coverage
- Efficient database queries with proper indexing

**Frontend Optimizations:**

- Debounced @link detection to prevent excessive API calls
- Optimistic UI updates with loading states
- Keyboard navigation for accessibility
- Portal rendering for proper z-index management
- Efficient re-rendering with MobX reactive state

**Database Optimizations:**

- Indexes on page_links for fast exclusion queries
- Vector similarity search with PostgreSQL functions
- Content hash-based embedding caching
- Batch operations for multiple suggestions

This detailed flow demonstrates how the auto page link suggestion feature integrates AI-powered semantic search with fallback string matching to provide contextually relevant page suggestions while maintaining performance and user experience.
