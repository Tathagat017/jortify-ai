# Auto Tag Generation Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**tags**

```sql
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3b82f6',
    description TEXT,
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, name)
);
```

- `name`: Tag name (unique per workspace)
- `color`: Hex color code for visual identification
- `description`: Optional tag description
- `workspace_id`: Isolates tags per workspace

**page_tags**

```sql
CREATE TABLE page_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    confidence_score FLOAT DEFAULT 1.0,
    auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    UNIQUE(page_id, tag_id)
);
```

- `confidence_score`: AI confidence in tag relevance (0.0-1.0)
- `auto_generated`: Distinguishes AI-generated from manual tags
- `created_by`: User who added tag (or system for auto-generated)

**tag_embeddings**

```sql
CREATE TABLE tag_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    embedding TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(tag_id)
);
```

- `embedding`: Vector representation of tag for semantic matching
- `tag_id`: Links embedding to specific tag

**ai_tag_suggestions**

```sql
CREATE TABLE ai_tag_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    suggested_tags JSONB NOT NULL,
    confidence_scores JSONB NOT NULL,
    content_analysis JSONB,
    model_used TEXT DEFAULT 'gpt-3.5-turbo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `suggested_tags`: Array of AI-suggested tag names
- `confidence_scores`: Corresponding confidence scores
- `content_analysis`: AI analysis of page content themes

## Detailed Step-by-Step Flow

### Step 1: Auto-Tag Trigger Events

**Page Content Change Detection:**

```typescript
// PageEditor.tsx - Content change handler
const handleContentChange = useCallback(
  debounce(async (newContent: any) => {
    // Save content to database
    await pageService.updatePageContent(pageId, newContent);

    // Check if auto-tagging should be triggered
    const shouldAutoTag = await shouldTriggerAutoTagging(pageId, newContent);

    if (shouldAutoTag) {
      // Trigger auto-tag generation
      autoTagService.generateTagsForPage(pageId, workspaceId);
    }
  }, 2000), // 2 second debounce
  [pageId, workspaceId]
);

// Auto-tag trigger conditions
const shouldTriggerAutoTagging = async (
  pageId: string,
  content: any
): Promise<boolean> => {
  // Get current page stats
  const { data: pageStats } = await supabase
    .from("pages")
    .select("content, updated_at")
    .eq("id", pageId)
    .single();

  // Calculate content change percentage
  const oldContentLength = JSON.stringify(pageStats?.content || {}).length;
  const newContentLength = JSON.stringify(content).length;
  const changePercentage =
    Math.abs(newContentLength - oldContentLength) / oldContentLength;

  // Trigger if content changed by more than 20%
  return changePercentage > 0.2;
};
```

**Manual Tag Generation Trigger:**

```typescript
// TagManager.tsx - Manual trigger
const handleGenerateAITags = async () => {
  setGeneratingTags(true);

  try {
    const suggestions = await autoTagService.generateTagsForPage(
      pageId,
      workspaceId
    );

    // Show suggestions to user
    setTagSuggestions(suggestions);
    setShowSuggestionModal(true);
  } catch (error) {
    showNotification({
      title: "Tag Generation Failed",
      message: "Failed to generate AI tags. Please try again.",
      color: "red",
    });
  } finally {
    setGeneratingTags(false);
  }
};
```

### Step 2: Content Analysis and Extraction

**Page Content Processing:**

```typescript
// AutoTagService.generateTagsForPage()
class AutoTagService {
  static async generateTagsForPage(
    pageId: string,
    workspaceId: string
  ): Promise<TagSuggestion[]> {
    // Extract page content and metadata
    const { data: page } = await supabase
      .from("pages")
      .select("title, content, parent_id")
      .eq("id", pageId)
      .single();

    if (!page) throw new Error("Page not found");

    // Convert BlockNote content to plain text
    const contentText = this.extractTextFromBlocks(page.content);
    const fullText = `${page.title}\n\n${contentText}`;

    // Get existing workspace tags for context
    const { data: existingTags } = await supabase
      .from("tags")
      .select("name, description, color")
      .eq("workspace_id", workspaceId)
      .order("name");

    // Analyze content with AI
    const analysis = await this.analyzeContentForTags(
      fullText,
      existingTags || [],
      workspaceId
    );

    // Store analysis results
    await this.storeTagAnalysis(pageId, analysis);

    return analysis.suggestions;
  }

  private static extractTextFromBlocks(content: any): string {
    if (!content || !Array.isArray(content)) return "";

    return content
      .map((block) => {
        switch (block.type) {
          case "paragraph":
          case "heading":
            return (
              block.content?.map((item: any) => item.text || "").join("") || ""
            );
          case "bulletListItem":
          case "numberedListItem":
            return `• ${
              block.content?.map((item: any) => item.text || "").join("") || ""
            }`;
          case "table":
            return this.extractTableText(block);
          default:
            return "";
        }
      })
      .filter((text) => text.trim())
      .join("\n");
  }
}
```

**Database Query for Existing Tags:**

```sql
SELECT name, description, color,
       COUNT(pt.id) as usage_count
FROM tags t
LEFT JOIN page_tags pt ON t.id = pt.tag_id
WHERE t.workspace_id = $1
GROUP BY t.id, t.name, t.description, t.color
ORDER BY usage_count DESC, t.name ASC;
```

### Step 3: AI Content Analysis

**OpenAI Analysis Request:**

```typescript
private static async analyzeContentForTags(
  content: string,
  existingTags: Tag[],
  workspaceId: string
): Promise<TagAnalysis> {

  // Build context-aware prompt
  const systemPrompt = `You are an expert content analyzer that suggests relevant tags for documents.
Analyze the content and suggest 3-7 appropriate tags that capture the main themes, topics, and concepts.

Consider these existing workspace tags when possible: ${existingTags.map(t => t.name).join(', ')}

Respond with a JSON object containing:
- suggestions: array of tag objects with {name, confidence, reasoning}
- themes: array of main content themes identified
- categories: array of content categories (e.g., "technical", "business", "personal")`;

  const userPrompt = `Analyze this content and suggest relevant tags:

Title and Content:
${content.substring(0, 3000)} ${content.length > 3000 ? '...' : ''}

Existing workspace tags to consider: ${existingTags.map(t => `${t.name} (${t.description || 'no description'})`).join(', ')}

Please provide tag suggestions that are:
1. Relevant to the content themes
2. Consistent with existing workspace tags when appropriate
3. Specific enough to be useful for organization
4. General enough to apply to multiple pages`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 800,
      temperature: 0.3, // Lower temperature for more consistent results
      response_format: { type: "json_object" }
    });

    const analysisResult = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
      suggestions: analysisResult.suggestions || [],
      themes: analysisResult.themes || [],
      categories: analysisResult.categories || [],
      tokensUsed: response.usage?.total_tokens || 0
    };

  } catch (error) {
    console.error('AI tag analysis failed:', error);
    throw new Error('Failed to analyze content for tags');
  }
}
```

### Step 4: Tag Consistency and Color Assignment

**Tag Normalization and Matching:**

```typescript
private static async normalizeAndMatchTags(
  suggestions: RawTagSuggestion[],
  existingTags: Tag[],
  workspaceId: string
): Promise<NormalizedTagSuggestion[]> {

  const normalizedSuggestions: NormalizedTagSuggestion[] = [];

  for (const suggestion of suggestions) {
    // Normalize tag name (lowercase, trim, remove special chars)
    const normalizedName = this.normalizeTagName(suggestion.name);

    // Check for exact match with existing tags
    let matchedTag = existingTags.find(tag =>
      this.normalizeTagName(tag.name) === normalizedName
    );

    // Check for semantic similarity if no exact match
    if (!matchedTag && existingTags.length > 0) {
      matchedTag = await this.findSemanticMatch(suggestion.name, existingTags);
    }

    if (matchedTag) {
      // Use existing tag
      normalizedSuggestions.push({
        tagId: matchedTag.id,
        name: matchedTag.name,
        color: matchedTag.color,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        isExisting: true
      });
    } else {
      // Create new tag suggestion
      const assignedColor = this.assignTagColor(normalizedName, existingTags);

      normalizedSuggestions.push({
        tagId: null,
        name: this.capitalizeTagName(normalizedName),
        color: assignedColor,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning,
        isExisting: false
      });
    }
  }

  return normalizedSuggestions;
}

private static normalizeTagName(name: string): string {
  return name.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
    .replace(/\s+/g, ' ') // Normalize whitespace
    .substring(0, 50); // Limit length
}

private static assignTagColor(tagName: string, existingTags: Tag[]): string {
  // Color palette for new tags
  const colorPalette = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
    '#ec4899', '#6366f1', '#14b8a6', '#eab308'
  ];

  // Use existing colors to avoid duplicates
  const usedColors = existingTags.map(tag => tag.color);
  const availableColors = colorPalette.filter(color => !usedColors.includes(color));

  if (availableColors.length > 0) {
    // Hash tag name to consistently assign same color
    const hash = this.hashString(tagName);
    return availableColors[hash % availableColors.length];
  }

  // Fallback to default blue if all colors used
  return '#3b82f6';
}
```

**Semantic Similarity Matching:**

```typescript
private static async findSemanticMatch(
  newTagName: string,
  existingTags: Tag[]
): Promise<Tag | null> {

  // Generate embedding for new tag name
  const newTagEmbedding = await EmbeddingService.generateEmbedding(newTagName);

  // Get embeddings for existing tags
  const { data: tagEmbeddings } = await supabase
    .from('tag_embeddings')
    .select('tag_id, embedding')
    .in('tag_id', existingTags.map(t => t.id));

  let bestMatch: Tag | null = null;
  let highestSimilarity = 0;

  for (const tagEmb of tagEmbeddings || []) {
    const existingEmbedding = JSON.parse(tagEmb.embedding);
    const similarity = this.cosineSimilarity(newTagEmbedding, existingEmbedding);

    // Consider it a match if similarity > 0.8
    if (similarity > 0.8 && similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = existingTags.find(t => t.id === tagEmb.tag_id) || null;
    }
  }

  return bestMatch;
}
```

### Step 5: Tag Creation and Storage

**New Tag Creation:**

```typescript
private static async createNewTags(
  suggestions: NormalizedTagSuggestion[],
  workspaceId: string,
  userId: string
): Promise<Tag[]> {

  const newTags = suggestions.filter(s => !s.isExisting);
  const createdTags: Tag[] = [];

  for (const suggestion of newTags) {
    // Create tag in database
    const { data: newTag } = await supabase
      .from('tags')
      .insert({
        workspace_id: workspaceId,
        name: suggestion.name,
        color: suggestion.color,
        description: `Auto-generated tag: ${suggestion.reasoning}`,
        created_by: userId
      })
      .select('*')
      .single();

    if (newTag) {
      // Generate and store embedding for new tag
      const embedding = await EmbeddingService.generateEmbedding(newTag.name);

      await supabase
        .from('tag_embeddings')
        .insert({
          tag_id: newTag.id,
          embedding: JSON.stringify(embedding)
        });

      createdTags.push(newTag);
    }
  }

  return createdTags;
}
```

**SQL Queries:**

```sql
-- Create new tag
INSERT INTO tags (workspace_id, name, color, description, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- Create tag embedding
INSERT INTO tag_embeddings (tag_id, embedding)
VALUES ($1, $2);

-- Store tag analysis
INSERT INTO ai_tag_suggestions (page_id, suggested_tags, confidence_scores, content_analysis, model_used)
VALUES ($1, $2, $3, $4, $5);
```

### Step 6: Page-Tag Association

**Auto-Apply High-Confidence Tags:**

```typescript
private static async applyTagsToPage(
  pageId: string,
  suggestions: NormalizedTagSuggestion[],
  userId: string,
  autoApplyThreshold: number = 0.8
): Promise<void> {

  const tagsToApply = suggestions.filter(s => s.confidence >= autoApplyThreshold);

  for (const suggestion of tagsToApply) {
    try {
      await supabase
        .from('page_tags')
        .insert({
          page_id: pageId,
          tag_id: suggestion.tagId,
          confidence_score: suggestion.confidence,
          auto_generated: true,
          created_by: userId
        });

      console.log(`Auto-applied tag "${suggestion.name}" with confidence ${suggestion.confidence}`);

    } catch (error) {
      // Handle duplicate key errors (tag already applied)
      if (error.code !== '23505') {
        console.error('Failed to apply tag:', error);
      }
    }
  }
}
```

**Store Suggestions for User Review:**

```typescript
private static async storeSuggestionsForReview(
  pageId: string,
  suggestions: NormalizedTagSuggestion[]
): Promise<void> {

  const suggestionData = {
    pageId,
    suggestions: suggestions.map(s => ({
      name: s.name,
      color: s.color,
      confidence: s.confidence,
      reasoning: s.reasoning,
      isExisting: s.isExisting,
      tagId: s.tagId
    })),
    timestamp: new Date().toISOString()
  };

  // Store in user's suggestion queue
  await supabase
    .from('ai_tag_suggestions')
    .insert({
      page_id: pageId,
      suggested_tags: JSON.stringify(suggestions.map(s => s.name)),
      confidence_scores: JSON.stringify(suggestions.map(s => s.confidence)),
      content_analysis: JSON.stringify(suggestionData)
    });
}
```

### Step 7: User Interface and Review

**Tag Suggestion Display:**

```typescript
// TagSuggestionModal.tsx
const TagSuggestionModal: React.FC<TagSuggestionModalProps> = ({
  suggestions,
  onApply,
  onDismiss,
}) => {
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);

  const handleApplySelected = async () => {
    const tagsToApply = suggestions.filter((s) =>
      selectedSuggestions.includes(s.name)
    );

    for (const tag of tagsToApply) {
      await onApply(tag);
    }

    showNotification({
      title: "Tags Applied",
      message: `Applied ${tagsToApply.length} tags to page`,
      color: "green",
    });

    onDismiss();
  };

  return (
    <Modal opened={true} onClose={onDismiss} title="AI Tag Suggestions">
      <Stack spacing="md">
        {suggestions.map((suggestion) => (
          <Group key={suggestion.name} position="apart">
            <Group>
              <Checkbox
                checked={selectedSuggestions.includes(suggestion.name)}
                onChange={(event) => {
                  if (event.currentTarget.checked) {
                    setSelectedSuggestions((prev) => [
                      ...prev,
                      suggestion.name,
                    ]);
                  } else {
                    setSelectedSuggestions((prev) =>
                      prev.filter((name) => name !== suggestion.name)
                    );
                  }
                }}
              />
              <Badge color={suggestion.color} variant="filled">
                {suggestion.name}
              </Badge>
              <Text size="sm" color="dimmed">
                {Math.round(suggestion.confidence * 100)}% confidence
              </Text>
            </Group>
            <Tooltip label={suggestion.reasoning}>
              <ActionIcon size="sm">
                <IconInfoCircle />
              </ActionIcon>
            </Tooltip>
          </Group>
        ))}

        <Group position="right">
          <Button variant="subtle" onClick={onDismiss}>
            Cancel
          </Button>
          <Button
            onClick={handleApplySelected}
            disabled={selectedSuggestions.length === 0}
          >
            Apply Selected ({selectedSuggestions.length})
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};
```

## Key Packages Used

**Backend:**

- `openai`: Content analysis and tag suggestion generation
- `@supabase/supabase-js`: Database operations for tags and associations
- `lodash`: Utility functions for text processing and normalization

**Frontend:**

- `@mantine/core`: UI components (Modal, Badge, Checkbox, Button)
- `@mantine/notifications`: User feedback for tag operations
- `@tabler/icons-react`: Icons for tag interface
- `react`: Core framework for tag management components

## Performance Optimizations

**Content Analysis:**

- Content truncation to 3000 characters for AI analysis
- Debounced auto-tag triggers to prevent excessive API calls
- Caching of existing tag embeddings

**Tag Matching:**

- Semantic similarity caching for frequently compared tags
- Normalized tag name indexing for fast exact matches
- Color assignment algorithm to minimize duplicates

**Database Operations:**

- Batch tag creation and association operations
- Indexes on tag names and workspace associations
- Efficient queries for tag usage statistics
