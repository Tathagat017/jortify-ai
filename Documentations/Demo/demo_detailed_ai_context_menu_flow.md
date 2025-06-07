# AI Context Menu Detailed Flow Documentation

## Database Schema Usage

### Core Tables

**pages**

```sql
CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content JSONB DEFAULT '{}',
    parent_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID NOT NULL,
    last_edited_by UUID NOT NULL
);
```

- `id`: Unique page identifier
- `workspace_id`: Links page to workspace for context isolation
- `title`: Page title used for AI context understanding
- `content`: BlockNote JSON structure containing all page blocks
- `parent_id`: Hierarchical page relationships for context
- `is_deleted`: Soft delete flag
- `created_by/last_edited_by`: User tracking for permissions

**ai_generations**

```sql
CREATE TABLE ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    generation_type TEXT NOT NULL CHECK (generation_type IN ('continue', 'improve', 'summarize', 'custom')),
    block_position INTEGER,
    context_before TEXT,
    context_after TEXT,
    model_used TEXT DEFAULT 'gpt-3.5-turbo',
    tokens_used INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `page_id`: Links generation to specific page
- `user_id`: User who triggered the AI generation
- `prompt`: The actual prompt sent to AI model
- `generated_content`: AI response content
- `generation_type`: Type of AI operation (continue, improve, summarize, custom)
- `block_position`: Position in page where generation occurred
- `context_before/context_after`: Surrounding content for context
- `model_used`: AI model identifier
- `tokens_used`: Token consumption tracking

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
- `content_hash`: MD5 hash for change detection
- `embedding`: JSON-serialized vector for semantic operations
- `metadata`: Additional context and processing information

## Detailed Step-by-Step Flow

### Step 1: Context Menu Trigger

**Frontend Action (BlockNoteEditor.tsx):**

```typescript
const handleSlashCommand = useCallback((editor: BlockNoteEditor) => {
  const selection = editor.getTextCursorPosition();
  const currentBlock = editor.getBlock(selection.block);

  // Get cursor position for menu placement
  const cursorPosition = editor.getTextCursorPosition();
  const domRect = editor.domElement?.getBoundingClientRect();

  // Calculate menu position
  const menuPosition = {
    x: domRect?.left + cursorPosition.x,
    y: domRect?.top + cursorPosition.y + 20,
  };

  // Show AI context menu
  setAiMenuVisible(true);
  setAiMenuPosition(menuPosition);
  setCurrentBlock(currentBlock);
  setCurrentEditor(editor);
}, []);

// Listen for slash commands
useEffect(() => {
  if (!editor) return;

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "/" && !event.ctrlKey && !event.metaKey) {
      setTimeout(() => handleSlashCommand(editor), 0);
    }
  };

  editor.domElement?.addEventListener("keydown", handleKeyDown);
  return () => editor.domElement?.removeEventListener("keydown", handleKeyDown);
}, [editor, handleSlashCommand]);
```

**Menu Component Rendering (AIContextMenu.tsx):**

```typescript
const AIContextMenu: React.FC<AIContextMenuProps> = ({
  visible,
  position,
  onClose,
  onSelect,
  currentBlock,
  editor,
}) => {
  const menuOptions = [
    {
      id: "continue",
      label: "Continue writing",
      icon: <IconPencil size={16} />,
      description: "AI will continue the current thought",
    },
    {
      id: "improve",
      label: "Improve writing",
      icon: <IconSparkles size={16} />,
      description: "Enhance clarity and style",
    },
    {
      id: "summarize",
      label: "Summarize",
      icon: <IconFileText size={16} />,
      description: "Create a concise summary",
    },
    {
      id: "custom",
      label: "Custom prompt",
      icon: <IconWand size={16} />,
      description: "Enter your own instruction",
    },
  ];

  return (
    <Portal>
      <div
        className="ai-context-menu"
        style={{
          position: "fixed",
          left: position.x,
          top: position.y,
          zIndex: 1000,
        }}
      >
        {menuOptions.map((option) => (
          <div
            key={option.id}
            className="menu-option"
            onClick={() => onSelect(option.id)}
          >
            {option.icon}
            <div>
              <div className="option-label">{option.label}</div>
              <div className="option-description">{option.description}</div>
            </div>
          </div>
        ))}
      </div>
    </Portal>
  );
};
```

### Step 2: Context Extraction and Analysis

**Context Gathering (AIEditorService.tsx):**

```typescript
class AIEditorService {
  static async extractPageContext(
    pageId: string,
    currentBlockId: string,
    editor: BlockNoteEditor
  ): Promise<PageContext> {
    // Get all blocks from editor
    const allBlocks = editor.document;
    const currentBlockIndex = allBlocks.findIndex(
      (block) => block.id === currentBlockId
    );

    // Extract context before and after current block
    const contextBefore = allBlocks
      .slice(Math.max(0, currentBlockIndex - 3), currentBlockIndex)
      .map((block) => this.blockToText(block))
      .join("\n");

    const contextAfter = allBlocks
      .slice(
        currentBlockIndex + 1,
        Math.min(allBlocks.length, currentBlockIndex + 4)
      )
      .map((block) => this.blockToText(block))
      .join("\n");

    const currentBlockText = this.blockToText(allBlocks[currentBlockIndex]);

    // Get page metadata from database
    const { data: pageData } = await supabase
      .from("pages")
      .select("title, content, parent_id, workspace_id")
      .eq("id", pageId)
      .single();

    return {
      pageId,
      pageTitle: pageData?.title || "Untitled",
      workspaceId: pageData?.workspace_id,
      currentBlock: currentBlockText,
      contextBefore,
      contextAfter,
      blockPosition: currentBlockIndex,
      totalBlocks: allBlocks.length,
    };
  }

  private static blockToText(block: any): string {
    if (!block) return "";

    switch (block.type) {
      case "paragraph":
        return (
          block.content?.map((item: any) => item.text || "").join("") || ""
        );
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
        return "[Table content]";
      case "image":
        return "[Image]";
      default:
        return block.content?.toString() || "";
    }
  }
}
```

**Database Query for Page Context:**

```sql
SELECT
  p.title,
  p.content,
  p.parent_id,
  p.workspace_id,
  parent.title as parent_title
FROM pages p
LEFT JOIN pages parent ON p.parent_id = parent.id
WHERE p.id = $1 AND p.is_deleted = false;
```

### Step 3: AI Generation Request Processing

**Frontend Request (AIContextMenu.tsx):**

```typescript
const handleOptionSelect = async (optionId: string) => {
  setLoading(true);
  setAiMenuVisible(false);

  try {
    // Extract context from current editor state
    const context = await AIEditorService.extractPageContext(
      pageId,
      currentBlock.id,
      editor
    );

    // Show loading indicator in editor
    const loadingBlock = {
      id: generateId(),
      type: "paragraph",
      content: [{ type: "text", text: "✨ AI is generating content..." }],
    };

    editor.insertBlocks([loadingBlock], currentBlock.id, "after");

    // Make API request
    const response = await aiService.generateContent({
      pageId,
      generationType: optionId,
      context,
      customPrompt: optionId === "custom" ? customPrompt : undefined,
    });

    // Replace loading block with generated content
    editor.removeBlocks([loadingBlock.id]);

    const generatedBlocks = parseContentToBlocks(response.generatedContent);
    editor.insertBlocks(generatedBlocks, currentBlock.id, "after");

    // Show success notification
    showNotification({
      title: "Content Generated",
      message: `AI ${optionId} completed successfully`,
      color: "green",
    });
  } catch (error) {
    console.error("AI generation failed:", error);
    showNotification({
      title: "Generation Failed",
      message: "Failed to generate AI content. Please try again.",
      color: "red",
    });
  } finally {
    setLoading(false);
  }
};
```

**Backend Processing (AIController.generateContent):**

```typescript
export class AIController {
  static async generateContent(req: Request, res: Response) {
    const { pageId, generationType, context, customPrompt } = req.body;
    const userId = req.user!.id;

    try {
      // Validate page access
      const { data: page } = await supabase
        .from("pages")
        .select("workspace_id, title, content")
        .eq("id", pageId)
        .single();

      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }

      // Check user permissions for workspace
      const hasAccess = await WorkspaceService.checkUserAccess(
        userId,
        page.workspace_id
      );

      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Generate AI content
      const result = await AIEditorService.generateContextualContent(
        generationType,
        context,
        customPrompt
      );

      // Store generation record
      const { data: generation } = await supabase
        .from("ai_generations")
        .insert({
          page_id: pageId,
          user_id: userId,
          prompt: result.prompt,
          generated_content: result.content,
          generation_type: generationType,
          block_position: context.blockPosition,
          context_before: context.contextBefore,
          context_after: context.contextAfter,
          model_used: result.modelUsed,
          tokens_used: result.tokensUsed,
        })
        .select("id")
        .single();

      res.json({
        success: true,
        generatedContent: result.content,
        generationId: generation.id,
        tokensUsed: result.tokensUsed,
      });
    } catch (error) {
      console.error("Content generation error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  }
}
```

### Step 4: Prompt Engineering and AI Model Interaction

**Prompt Construction (AIEditorService.generateContextualContent):**

```typescript
static async generateContextualContent(
  generationType: string,
  context: PageContext,
  customPrompt?: string
): Promise<AIGenerationResult> {

  // Build context-aware prompt based on generation type
  const systemPrompt = this.buildSystemPrompt(generationType);
  const userPrompt = this.buildUserPrompt(generationType, context, customPrompt);

  console.log('🤖 Generating content with prompt:', { generationType, context });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: this.getMaxTokens(generationType),
      temperature: this.getTemperature(generationType),
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const generatedContent = response.choices[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    return {
      content: generatedContent,
      prompt: userPrompt,
      modelUsed: 'gpt-3.5-turbo',
      tokensUsed
    };

  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error('Failed to generate content with AI');
  }
}

private static buildSystemPrompt(generationType: string): string {
  const basePrompt = "You are a helpful writing assistant integrated into a Notion-like editor. ";

  switch (generationType) {
    case 'continue':
      return basePrompt + "Continue the user's writing in a natural, coherent way that matches their tone and style. Keep the same perspective and voice.";

    case 'improve':
      return basePrompt + "Improve the given text by enhancing clarity, flow, grammar, and style while preserving the original meaning and intent.";

    case 'summarize':
      return basePrompt + "Create a concise, well-structured summary that captures the key points and main ideas of the provided content.";

    case 'custom':
      return basePrompt + "Follow the user's specific instructions while maintaining high quality and relevance to the context.";

    default:
      return basePrompt + "Assist with the user's writing task in a helpful and contextually appropriate way.";
  }
}

private static buildUserPrompt(
  generationType: string,
  context: PageContext,
  customPrompt?: string
): string {

  let prompt = `Page Title: "${context.pageTitle}"\n\n`;

  if (context.contextBefore) {
    prompt += `Previous content:\n${context.contextBefore}\n\n`;
  }

  if (context.currentBlock) {
    prompt += `Current block:\n${context.currentBlock}\n\n`;
  }

  if (context.contextAfter) {
    prompt += `Following content:\n${context.contextAfter}\n\n`;
  }

  switch (generationType) {
    case 'continue':
      prompt += "Please continue writing from where the current block left off. Write 1-3 paragraphs that naturally follow the existing content.";
      break;

    case 'improve':
      prompt += "Please improve the current block by enhancing its clarity, style, and impact while maintaining the original meaning.";
      break;

    case 'summarize':
      prompt += "Please create a concise summary of all the content provided above. Focus on the main points and key takeaways.";
      break;

    case 'custom':
      prompt += `Custom instruction: ${customPrompt}\n\nPlease follow this instruction while considering the context provided above.`;
      break;
  }

  return prompt;
}

private static getMaxTokens(generationType: string): number {
  switch (generationType) {
    case 'continue': return 300;
    case 'improve': return 400;
    case 'summarize': return 200;
    case 'custom': return 500;
    default: return 300;
  }
}

private static getTemperature(generationType: string): number {
  switch (generationType) {
    case 'continue': return 0.8;
    case 'improve': return 0.7;
    case 'summarize': return 0.5;
    case 'custom': return 0.7;
    default: return 0.7;
  }
}
```

### Step 5: Content Integration and Editor Updates

**Content Parsing and Block Creation:**

```typescript
const parseContentToBlocks = (content: string): Block[] => {
  const lines = content.split("\n").filter((line) => line.trim());
  const blocks: Block[] = [];

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("# ")) {
      // Heading 1
      blocks.push({
        id: generateId(),
        type: "heading",
        props: { level: 1 },
        content: [{ type: "text", text: trimmedLine.substring(2) }],
      });
    } else if (trimmedLine.startsWith("## ")) {
      // Heading 2
      blocks.push({
        id: generateId(),
        type: "heading",
        props: { level: 2 },
        content: [{ type: "text", text: trimmedLine.substring(3) }],
      });
    } else if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* ")) {
      // Bullet list
      blocks.push({
        id: generateId(),
        type: "bulletListItem",
        content: [{ type: "text", text: trimmedLine.substring(2) }],
      });
    } else if (/^\d+\.\s/.test(trimmedLine)) {
      // Numbered list
      blocks.push({
        id: generateId(),
        type: "numberedListItem",
        content: [{ type: "text", text: trimmedLine.replace(/^\d+\.\s/, "") }],
      });
    } else if (trimmedLine) {
      // Regular paragraph
      blocks.push({
        id: generateId(),
        type: "paragraph",
        content: [{ type: "text", text: trimmedLine }],
      });
    }
  });

  return blocks;
};
```

**Editor Integration:**

```typescript
const insertGeneratedContent = (
  editor: BlockNoteEditor,
  content: string,
  insertAfterBlockId: string
) => {
  // Parse content into BlockNote blocks
  const newBlocks = parseContentToBlocks(content);

  // Insert blocks into editor
  editor.insertBlocks(newBlocks, insertAfterBlockId, "after");

  // Focus on first new block
  if (newBlocks.length > 0) {
    editor.setTextCursorPosition(newBlocks[0].id, "end");
  }

  // Trigger content change event for auto-save
  editor.onEditorContentChange?.(editor.document);
};
```

### Step 6: Database Storage and Tracking

**AI Generation Record Storage:**

```sql
INSERT INTO ai_generations (
  page_id,
  user_id,
  prompt,
  generated_content,
  generation_type,
  block_position,
  context_before,
  context_after,
  model_used,
  tokens_used
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING id, created_at;
```

**Page Content Update:**

```typescript
// Update page content with new blocks
const updatePageContent = async (pageId: string, newContent: any) => {
  const { data, error } = await supabase
    .from("pages")
    .update({
      content: newContent,
      updated_at: new Date().toISOString(),
      last_edited_by: userId,
    })
    .eq("id", pageId)
    .select("updated_at")
    .single();

  if (error) {
    throw new Error("Failed to update page content");
  }

  return data;
};
```

**Usage Analytics Update:**

```sql
-- Update user token usage
UPDATE user_usage_stats
SET
  ai_tokens_used = ai_tokens_used + $1,
  ai_generations_count = ai_generations_count + 1,
  last_ai_usage = NOW()
WHERE user_id = $2;

-- Insert if not exists
INSERT INTO user_usage_stats (user_id, ai_tokens_used, ai_generations_count, last_ai_usage)
VALUES ($2, $1, 1, NOW())
ON CONFLICT (user_id) DO UPDATE SET
  ai_tokens_used = user_usage_stats.ai_tokens_used + $1,
  ai_generations_count = user_usage_stats.ai_generations_count + 1,
  last_ai_usage = NOW();
```

### Step 7: Real-time Updates and Collaboration

**Real-time Content Sync:**

```typescript
// Listen for page content changes
useEffect(() => {
  if (!pageId) return;

  const subscription = supabase
    .channel(`page-${pageId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "pages",
        filter: `id=eq.${pageId}`,
      },
      (payload) => {
        const updatedPage = payload.new;

        // Only update if change came from another user
        if (updatedPage.last_edited_by !== currentUserId) {
          // Merge content changes
          mergeContentChanges(updatedPage.content);

          // Show collaboration indicator
          showCollaborationNotification(updatedPage.last_edited_by);
        }
      }
    )
    .subscribe();

  return () => subscription.unsubscribe();
}, [pageId, currentUserId]);
```

**Conflict Resolution:**

```typescript
const mergeContentChanges = (incomingContent: any) => {
  const currentContent = editor.document;
  const mergedContent = ContentMerger.merge(currentContent, incomingContent);

  // Apply merged changes to editor
  editor.replaceBlocks(editor.document, mergedContent);

  // Show merge notification
  showNotification({
    title: "Content Updated",
    message: "Page was updated by another user",
    color: "blue",
  });
};
```

## Key Packages Used

**Backend:**

- `openai`: Official OpenAI SDK for content generation
- `@supabase/supabase-js`: Database operations and real-time subscriptions
- `express`: Web framework for API endpoints
- `express-rate-limit`: Rate limiting for AI API protection
- `uuid`: Unique identifier generation

**Frontend:**

- `@blocknote/core`: Core editor functionality and block management
- `@blocknote/react`: React components for BlockNote editor
- `@mantine/core`: UI components (Portal, Menu, Button, Loader)
- `@mantine/notifications`: Toast notifications for user feedback
- `@tabler/icons-react`: Icons for menu options
- `react`: Core framework for components
- `@tanstack/react-query`: State management and caching

## Database Indexes for Performance

```sql
-- Optimize AI generation queries
CREATE INDEX idx_ai_generations_page_user
ON ai_generations(page_id, user_id, created_at DESC);

-- Optimize generation type queries
CREATE INDEX idx_ai_generations_type_created
ON ai_generations(generation_type, created_at DESC);

-- Optimize page content queries
CREATE INDEX idx_pages_workspace_updated
ON pages(workspace_id, updated_at DESC) WHERE is_deleted = false;

-- Optimize user usage tracking
CREATE INDEX idx_user_usage_stats_user_id
ON user_usage_stats(user_id);
```

## Performance Optimizations

**Context Extraction:**

- Limited to 3 blocks before/after current position
- Text extraction optimized for different block types
- Caching of frequently accessed page metadata

**AI Generation:**

- Token limits based on generation type
- Temperature settings optimized for each use case
- Prompt engineering to minimize token usage

**Editor Integration:**

- Optimistic UI updates with loading states
- Efficient block parsing and insertion
- Minimal DOM manipulation for performance

**Real-time Collaboration:**

- Selective subscriptions to relevant page changes
- Conflict resolution with content merging
- Debounced auto-save to prevent excessive updates

This detailed flow demonstrates how the AI context menu integrates deeply with the editor, database, and AI services to provide contextual content generation while maintaining performance and collaboration features.
