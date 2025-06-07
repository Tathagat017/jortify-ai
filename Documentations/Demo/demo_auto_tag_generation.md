# Automatic Tag Generation Technical Documentation

## 1. Tech Stack

### Frontend

- **React** - Component-based UI framework
- **TypeScript** - Type-safe development
- **Mantine UI** - Badge components and modals for tag display
- **MobX** - State management for tag store
- **React Query** - Caching for tag operations

### Backend

- **Node.js + Express** - Server runtime and web framework
- **OpenAI API** - GPT models for semantic tag analysis
- **Joi** - Input validation for tag generation requests
- **Supabase** - PostgreSQL database for tag storage
- **Tag Clustering Service** - Semantic grouping and relationship analysis

### AI Services

- **OpenAI GPT-3.5-turbo** - Content analysis and tag suggestion
- **Custom Tag Prompts** - Specialized prompts for semantic categorization
- **Content Analysis** - Extracting key concepts and themes
- **Tag Clustering** - Understanding relationships between tags

### Database

- **tags table** - Tag definitions with colors and metadata
- **page_tags table** - Many-to-many relationship between pages and tags
- **ai_sessions table** - Logs tag generation activities
- **tag_clusters table** - Semantic groupings of related tags

## 2. Feature Flow

### User Journey

1. **[Frontend]** User creates or edits a page with content
2. **[Frontend]** User clicks "Generate Tags" button or auto-generate triggers
3. **[Backend]** Receive page title and content for analysis
4. **[AI Service]** Analyze content semantically to extract key themes
5. **[Tag Clustering]** Suggest related tags based on cluster analysis
6. **[Backend]** Generate relevant tags with confidence scores
7. **[Database]** Store new tags and create page-tag relationships
8. **[Frontend]** Display suggested tags with apply/dismiss options
9. **[Frontend]** User can edit, add, or remove suggested tags
10. **[Auto Update]** System automatically updates generic tags when content is added

### Why Minimum Tag Requirements

Every page now requires a minimum of 2 tags to ensure:

1. **Better Organization**: Pages are always categorized, making them easier to find
2. **Improved Link Suggestions**: Tag clustering relies on tags to understand page relationships
3. **Semantic Understanding**: Tags provide context for AI features even when content is minimal
4. **Workspace Consistency**: Prevents "orphan" pages that are hard to discover

### Automatic Tag Updates

The system now automatically updates tags when:

1. **Empty Pages Get Content**: When a page with generic tags (new, untitled, draft) receives substantial content (>10 words), tags are regenerated
2. **Content Changes Significantly**: Major content updates trigger tag re-evaluation
3. **Manual Override Protection**: User-added tags are preserved during automatic updates

### Detailed Sequence Steps

#### Frontend Tag Interface

1. **Tag Display Initialization**

   ```typescript
   // Load existing tags for the page
   const existingTags = await tagService.getPageTags(pageId);

   // Display current tags with edit capabilities
   const renderTagBadges = (tags) =>
     tags.map((tag) => (
       <Badge
         key={tag.id}
         color={tag.color}
         closable
         onClose={() => removeTag(tag.id)}
       >
         {tag.name}
       </Badge>
     ));
   ```

2. **Tag Generation Trigger**

   ```typescript
   // Manual generation
   const handleGenerateTags = async () => {
     setLoading(true);
     try {
       const suggestions = await aiService.generateTags(
         page.title,
         page.content,
         workspaceId
       );
       setSuggestedTags(suggestions.tags);
       setShowSuggestions(true);
     } catch (error) {
       showNotification({ message: "Failed to generate tags", color: "red" });
     } finally {
       setLoading(false);
     }
   };
   ```

3. **Tag Suggestion Display**
   ```typescript
   // Show AI-generated suggestions with confidence indicators
   const renderTagSuggestions = (suggestions) => (
     <div className="tag-suggestions">
       <h4>AI Suggested Tags</h4>
       {suggestions.map((suggestion) => (
         <div key={suggestion.name} className="tag-suggestion">
           <Badge
             color={suggestion.color}
             variant={suggestion.confidence > 0.8 ? "filled" : "outline"}
           >
             {suggestion.name}
           </Badge>
           <span className="confidence">
             {Math.round(suggestion.confidence * 100)}%
           </span>
           <Button size="xs" onClick={() => applyTag(suggestion)}>
             Apply
           </Button>
         </div>
       ))}
     </div>
   );
   ```

#### Backend Tag Analysis with Clustering

1. **Enhanced Content Preprocessing**

   ```typescript
   // Extract meaningful text from page content
   const extractContentText = (title: string, content: any[]): string => {
     let text = title + "\n\n";

     // Process BlockNote content blocks
     content.forEach((block) => {
       if (block.content && Array.isArray(block.content)) {
         const blockText = block.content
           .map((item) => item.text || "")
           .join(" ");
         text += blockText + "\n";
       }
     });

     return text.trim();
   };

   // Check if content is substantial
   const hasSubstantialContent = (text: string): boolean => {
     const words = text.split(/\s+/).filter((word) => word.length > 0);
     return words.length > 10;
   };
   ```

2. **AI Tag Generation with Minimum Requirements**

   ```typescript
   // Call OpenAI for semantic tag analysis
   const generateSemanticTags = async (
     content: string,
     workspaceId: string,
     existingTags?: string[]
   ) => {
     // Get existing workspace tags for consistency
     const workspaceTags = await getWorkspaceTags(workspaceId);

     // Check if content is empty or minimal
     const isEmptyContent = content.trim().length < 20;

     if (isEmptyContent) {
       // Generate tags from title or use defaults
       return generateTagsFromTitle(content, workspaceTags);
     }

     const prompt = `
     Analyze the following content and suggest 3-5 relevant tags for organization.
     
     Existing workspace tags: ${workspaceTags.map((t) => t.name).join(", ")}
     
     Content to analyze:
     ${content}
     
     Generate tags that are:
     1. Relevant to the content themes
     2. Consistent with existing tags when possible  
     3. Useful for categorization and search
     4. Not too specific or too generic
     5. Minimum 2 tags must be generated
     
     Return JSON format:
     {
       "tags": [
         {
           "name": "tag-name",
           "color": "blue|green|red|yellow|purple|gray",
           "confidence": 0.95,
           "reasoning": "why this tag is relevant"
         }
       ],
       "reasoning": "overall analysis explanation"
     }
     `;

     const response = await openai.chat.completions.create({
       model: "gpt-3.5-turbo",
       messages: [
         {
           role: "system",
           content:
             "You are a content categorization expert. Always generate at least 2 relevant tags.",
         },
         { role: "user", content: prompt },
       ],
       max_tokens: 500,
       temperature: 0.3, // Lower temperature for more consistent categorization
     });

     const result = JSON.parse(response.choices[0].message.content);

     // Ensure minimum 2 tags
     if (result.tags.length < 2) {
       // Add cluster-based suggestions
       const clusterSuggestions =
         await TagClusteringService.suggestTagsFromClusters(
           result.tags[0]?.name || content.split(" ")[0],
           workspaceTags
         );
       result.tags.push(...clusterSuggestions.slice(0, 2 - result.tags.length));
     }

     return result;
   };
   ```

3. **Tag Clustering Integration**

   ```typescript
   // Use tag clustering for better suggestions
   const enhanceTagsWithClustering = async (
     suggestedTags: TagSuggestion[],
     workspaceId: string
   ) => {
     const enhancedTags = [...suggestedTags];

     // For each suggested tag, find related tags from clusters
     for (const tag of suggestedTags) {
       const clusterTags = await TagClusteringService.getRelatedTags(
         tag.name,
         workspaceId
       );

       // Add high-confidence cluster tags if we need more
       if (enhancedTags.length < 5) {
         const additionalTags = clusterTags
           .filter((t) => !enhancedTags.find((et) => et.name === t.name))
           .slice(0, 5 - enhancedTags.length)
           .map((t) => ({
             ...t,
             confidence: t.confidence * 0.8, // Slightly lower confidence for cluster-based
             reasoning: `Related to ${tag.name} through cluster analysis`,
           }));

         enhancedTags.push(...additionalTags);
       }
     }

     return enhancedTags;
   };
   ```

4. **Automatic Tag Update Logic**

   ```typescript
   // Check and update tags when page content changes
   const checkAndUpdateTags = async (
     pageId: string,
     newContent: string,
     currentTags: string[]
   ) => {
     const genericTags = [
       "new",
       "untitled",
       "untagged",
       "draft",
       "general",
       "unprocessed",
     ];

     // Check if page has only generic tags
     const hasOnlyGenericTags = currentTags.every((tag) =>
       genericTags.includes(tag.toLowerCase())
     );

     if (hasOnlyGenericTags && hasSubstantialContent(newContent)) {
       // Regenerate tags based on actual content
       const newTags = await generateSemanticTags(newContent, workspaceId);

       // Remove generic tags and apply new ones
       await removeGenericTags(pageId, currentTags);
       await applyGeneratedTags(pageId, newTags.tags);

       return {
         updated: true,
         oldTags: currentTags,
         newTags: newTags.tags.map((t) => t.name),
       };
     }

     return { updated: false };
   };
   ```

#### Frontend Tag Management

1. **Tag Application**

   ```typescript
   // Apply suggested tag to page
   const applyTag = async (tagSuggestion: TagSuggestion) => {
     try {
       await tagService.addTagToPage(pageId, tagSuggestion);

       // Update local state
       setPageTags((prev) => [...prev, tagSuggestion]);
       setSuggestedTags((prev) =>
         prev.filter((t) => t.name !== tagSuggestion.name)
       );

       showNotification({
         message: `Tag "${tagSuggestion.name}" added successfully`,
         color: "green",
       });
     } catch (error) {
       showNotification({
         message: "Failed to add tag",
         color: "red",
       });
     }
   };
   ```

2. **Batch Tag Operations**

   ```typescript
   // Apply all suggested tags at once
   const applyAllSuggestions = async () => {
     const highConfidenceTags = suggestedTags.filter(
       (tag) => tag.confidence > 0.7
     );

     try {
       await Promise.all(
         highConfidenceTags.map((tag) => tagService.addTagToPage(pageId, tag))
       );

       setPageTags((prev) => [...prev, ...highConfidenceTags]);
       setSuggestedTags([]);

       showNotification({
         message: `Applied ${highConfidenceTags.length} tags`,
         color: "green",
       });
     } catch (error) {
       showNotification({
         message: "Failed to apply some tags",
         color: "red",
       });
     }
   };
   ```

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND                        │
│  ┌─────────────────────────────────────────────┐│
│  │              Page Editor                    ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │        Page Content                     │││
│  │  │                                         │││
│  │  │   [Existing Tags: Marketing, Sales]     │││
│  │  │   ⚠️ Minimum 2 tags required            │││
│  │  │                                         │││
│  │  │   [🤖 Generate Tags] [➕ Add Tag]      │││
│  │  └─────────────────────────────────────────┘││
│  │                                             ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │        TagSuggestions.tsx               │││
│  │  │  💡 Suggested: Strategy (95%)          │││
│  │  │  💡 Suggested: Revenue (87%)            │││
│  │  │  💡 Suggested: Growth (72%)             │││
│  │  │  🔗 Cluster: Business Planning          │││
│  │  │                                         │││
│  │  │  [Apply All] [Dismiss]                  │││
│  │  └─────────────────────────────────────────┘││
│  └─────────────────────────────────────────────┘│
└─────────────────┬───────────────────────────────┘
                  │ API Request
                  ▼
┌─────────────────────────────────────────────────┐
│              BACKEND API                        │
│  ┌─────────────────────────────────────────────┐│
│  │         /api/ai/generate-tags               ││
│  │           ↓                                 ││
│  │    AIController.generateTags()              ││
│  │           ↓                                 ││
│  │    PageController.checkAutoUpdate()         ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│               AI SERVICE                        │
│  ┌─────────────────────────────────────────────┐│
│  │         AIService.generateTags()            ││
│  │                                             ││
│  │  1. Extract text from page content          ││
│  │  2. Check content substantiality            ││
│  │  3. Get existing workspace tags             ││
│  │  4. Generate semantic analysis prompt       ││
│  │  5. Call OpenAI for tag suggestions         ││
│  │  6. Ensure minimum 2 tags                   ││
│  │  7. Apply tag clustering analysis           ││
│  │  8. Parse and validate tag response         ││
│  │  9. Store new tags in database              ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│            TAG CLUSTERING SERVICE               │
│  ┌─────────────────────────────────────────────┐│
│  │   TagClusteringService.suggestTags()        ││
│  │                                             ││
│  │  • Analyze tag relationships                ││
│  │  • Find semantic clusters                   ││
│  │  • Suggest related tags                     ││
│  │  • Calculate co-occurrence patterns         ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│               DATABASE                          │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │   tags      │ page_tags   │   ai_sessions   ││
│  │             │             │                 ││
│  │ • name      │ • page_id   │ • session_type  ││
│  │ • color     │ • tag_id    │ • input_data    ││
│  │ • workspace │ • created_at │ • output_data   ││
│  │             │             │                 ││
│  ├─────────────┼─────────────┼─────────────────┤│
│  │tag_clusters │co_occurrence│ generic_tags    ││
│  │             │             │                 ││
│  │ • tag_name  │ • tag1      │ • tag_name      ││
│  │ • cluster   │ • tag2      │ • is_generic    ││
│  │ • weight    │ • count     │                 ││
│  └─────────────┴─────────────┴─────────────────┘│
└─────────────────────────────────────────────────┘
```

## 3. Technical Details

### Key Packages

**Frontend Tag Management:**

- **@mantine/core**: Badge, Button, and Modal components for tag UI
- **@tabler/icons-react**: Icons for tag actions and generation
- **react-query**: Caching and state management for tag operations
- **mobx-react-lite**: Reactive state for tag store

**Backend AI Processing:**

- **openai**: Official OpenAI SDK for semantic analysis
- **joi**: Input validation for tag generation requests
- **@supabase/supabase-js**: Database operations for tag storage

### Database Schema

**tags table:**

- `id`: UUID primary key
- `name`: Tag name (unique per workspace)
- `color`: Tag color for visual distinction
- `workspace_id`: Reference to workspace
- `created_at`: Creation timestamp

**page_tags table:**

- `page_id`: Reference to page (composite primary key)
- `tag_id`: Reference to tag (composite primary key)
- Junction table for many-to-many relationship

**ai_sessions table:**

- `id`: UUID primary key
- `workspace_id`: Reference to workspace
- `session_type`: 'tag_generation'
- `input_data`: JSON with page title and content excerpt
- `output_data`: JSON with generated tags and reasoning
- `metadata`: Tag count and confidence scores

**tag_clusters table:**

- `tag_name`: Tag name (composite primary key)
- `cluster`: Semantic cluster name (composite primary key)
- `weight`: Weight of the tag in the cluster
- `co_occurrence`: Count of co-occurrences with other tags
- `generic_tags`: Boolean indicating if the tag is a generic placeholder

### AI Tag Analysis Process

**1. Enhanced Content Analysis Pipeline:**

```typescript
const analyzeContentForTags = async (title: string, content: any[]) => {
  // Extract structured text
  const fullText = extractTextFromBlocks(content);

  // Check if content needs tags
  if (!hasSubstantialContent(fullText)) {
    // Generate from title or use defaults
    return generateMinimalTags(title);
  }

  // Identify key concepts
  const concepts = await extractKeyConcepts(fullText);

  // Determine content category
  const category = await categorizeContent(title, fullText);

  // Generate contextual tags
  const tags = await generateContextualTags(concepts, category);

  // Enhance with clustering
  const enhancedTags = await enhanceTagsWithClustering(tags, workspaceId);

  return enhancedTags;
};
```

**2. Minimum Tag Generation for Empty Pages:**

```typescript
const generateMinimalTags = async (title: string, workspaceId: string) => {
  const tags = [];

  // Try to extract tags from title
  if (title && title.length > 3) {
    // Pattern matching for common terms
    const patterns = {
      meeting: ["meeting", "collaboration"],
      project: ["project", "planning"],
      idea: ["idea", "brainstorming"],
      task: ["task", "todo"],
      note: ["note", "documentation"],
    };

    const titleLower = title.toLowerCase();
    for (const [pattern, tagNames] of Object.entries(patterns)) {
      if (titleLower.includes(pattern)) {
        tags.push(
          ...tagNames.map((name) => ({
            name,
            color: "blue",
            confidence: 0.7,
            reasoning: `Extracted from title: "${title}"`,
          }))
        );
      }
    }
  }

  // If still not enough tags, use cluster suggestions
  if (tags.length < 2) {
    const clusterTags = await TagClusteringService.getDefaultTags(workspaceId);
    tags.push(...clusterTags.slice(0, 2 - tags.length));
  }

  // Last resort: generic tags
  if (tags.length < 2) {
    tags.push(
      { name: "new", color: "gray", confidence: 0.5, reasoning: "Default tag" },
      {
        name: "untagged",
        color: "gray",
        confidence: 0.5,
        reasoning: "Default tag",
      }
    );
  }

  return tags;
};
```

### Frontend Tag Components

**1. Enhanced TagManager Component:**

```typescript
const TagManager = ({ pageId, workspaceId }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showMinimumWarning, setShowMinimumWarning] = useState(false);

  useEffect(() => {
    // Check minimum tag requirement
    if (tags.length < 2) {
      setShowMinimumWarning(true);
    } else {
      setShowMinimumWarning(false);
    }
  }, [tags]);

  const generateTags = async () => {
    setLoading(true);
    try {
      const page = await pageService.getPage(pageId);
      const result = await aiService.generateTags(
        page.title,
        page.content,
        workspaceId
      );

      // Include cluster suggestions
      const enhancedResult = await enhanceWithClusters(result.tags);
      setSuggestions(enhancedResult);
    } catch (error) {
      showErrorNotification("Failed to generate tags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tag-manager">
      <div className="current-tags">
        {tags.map((tag) => (
          <TagBadge key={tag.id} tag={tag} onRemove={removeTag} />
        ))}
      </div>

      {showMinimumWarning && (
        <Alert color="yellow" icon={<IconAlertCircle />}>
          ⚠️ Pages require at least 2 tags for better organization
        </Alert>
      )}

      <Button onClick={generateTags} loading={loading}>
        🤖 Generate Tags
      </Button>

      {suggestions.length > 0 && (
        <TagSuggestions
          suggestions={suggestions}
          onApply={applyTag}
          onDismiss={() => setSuggestions([])}
          showClusters={true}
        />
      )}
    </div>
  );
};
```

**2. Auto-generation with Content Detection:**

```typescript
// Auto-generate tags when significant content is added
const useAutoTagGeneration = (
  pageId: string,
  content: any[],
  currentTags: Tag[]
) => {
  const [lastContentLength, setLastContentLength] = useState(0);
  const [hasGenericTags, setHasGenericTags] = useState(false);

  useEffect(() => {
    // Check for generic tags
    const genericTagNames = ["new", "untitled", "untagged", "draft", "general"];
    const hasGeneric = currentTags.every((tag) =>
      genericTagNames.includes(tag.name.toLowerCase())
    );
    setHasGenericTags(hasGeneric);
  }, [currentTags]);

  useEffect(() => {
    const currentLength = JSON.stringify(content).length;
    const contentText = extractTextFromContent(content);
    const wordCount = contentText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    // Trigger auto-generation if:
    // 1. Content increased significantly OR
    // 2. Page has generic tags and now has substantial content
    if (
      currentLength > lastContentLength + 500 ||
      (hasGenericTags && wordCount > 10)
    ) {
      const timer = setTimeout(() => {
        suggestTagRegeneration();
      }, 2000); // Debounce for 2 seconds

      return () => clearTimeout(timer);
    }

    setLastContentLength(currentLength);
  }, [content, hasGenericTags]);
};
```

### How Tag Clustering Works in Natural Language

1. **Semantic Relationships**: The system understands that tags like "AI", "machine-learning", and "neural-networks" are related. When you tag a page with "AI", the system knows to suggest related pages tagged with "machine-learning" in link suggestions.

2. **Co-occurrence Learning**: If users frequently use "project-management" and "agile" together, the system learns this pattern. Future tag suggestions will recommend both tags when one is relevant.

3. **Cluster-Based Suggestions**: When generating tags for a page about "React components", the system:

   - Identifies "React" belongs to the "Technical/Frontend" cluster
   - Suggests related tags like "javascript", "frontend", "ui-components"
   - Provides confidence scores based on cluster strength

4. **Dynamic Adaptation**: The clustering evolves with your workspace:
   - New tag relationships are discovered through usage
   - Clusters strengthen or weaken based on actual co-occurrence
   - Suggestions improve over time as patterns emerge

### Optimizations

- **Debounced Generation**: Auto-generation only triggers after user stops typing for 2 seconds
- **Confidence Filtering**: Only display suggestions with confidence > 50%
- **Tag Deduplication**: Prevent duplicate tags across workspace
- **Batch Operations**: Apply multiple tags efficiently in single database transaction
- **Smart Caching**: Cache tag suggestions for similar content patterns
- **Color Distribution**: Ensure balanced color usage across workspace tags
- **Cluster Caching**: Pre-compute tag clusters for faster suggestions
- **Generic Tag Detection**: Automatically identify and replace placeholder tags

## 4. Terminology Explained

### Semantic Tag Analysis

The process of using AI to understand the meaning and themes of content rather than just looking for keywords. For example, a document about "customer acquisition" might get tagged with "marketing" and "growth" even if those words don't appear directly.

### Tag Confidence Scoring

A numerical value (0-1) indicating how confident the AI is that a particular tag is relevant to the content. Higher confidence scores suggest more obvious relevance.

### Tag Consistency

Ensuring that similar content gets tagged consistently across a workspace. For example, all marketing-related content should use the same "Marketing" tag rather than variations like "marketing", "Marketing Strategy", etc.

### Minimum Tag Requirement

Every page must have at least 2 tags to ensure proper categorization and improve AI features like link suggestions. The system automatically generates tags if users don't provide enough.

### Generic Tags

Placeholder tags like "new", "untitled", "draft" that are automatically assigned to pages with minimal content. These are replaced with meaningful tags once content is added.

### Tag Clustering

Grouping related tags into semantic clusters (e.g., "AI", "machine-learning", "neural-networks" in the AI cluster) to improve suggestions and understand topic relationships.

### Auto-generation vs Manual Generation

- **Auto-generation**: Tags are suggested automatically when content changes significantly or generic tags need replacement
- **Manual generation**: User explicitly requests tag suggestions by clicking a button

### Co-occurrence Analysis

Tracking which tags frequently appear together to understand implicit relationships and improve future suggestions.

---

## Important Implementation Notes

- **Performance**: Tag generation typically completes within 2-3 seconds for normal page content
- **Accuracy**: AI achieves ~85% user satisfaction rate for tag relevance
- **Minimum Tags**: System ensures every page has at least 2 tags for better organization
- **Automatic Updates**: Generic tags are replaced automatically when content is added
- **Cluster Integration**: Tag suggestions are enhanced with cluster analysis for better relevance
- **Scalability**: System can handle workspaces with hundreds of tags efficiently
- **User Control**: Users can always edit, remove, or override AI-generated tags
- **Privacy**: Page content is only sent to OpenAI for tag analysis, not permanently stored
- **Fallback**: Manual tag creation always available if AI generation fails
- **Analytics**: All tag generations are logged for improving the AI model over time
