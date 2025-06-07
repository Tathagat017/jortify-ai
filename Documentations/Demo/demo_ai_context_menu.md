# AI Context Menu Technical Documentation

## 1. Tech Stack

### Frontend

- **React** - Component-based UI framework
- **BlockNote Editor** - Rich text editor with block-based structure
- **TypeScript** - Type-safe development
- **Mantine UI** - Modal and popup components
- **CSS Modules** - Scoped styling for menu components

### Backend

- **Node.js + Express** - Server runtime and web framework
- **OpenAI API** - GPT models for content generation and suggestions
- **Joi** - Input validation for AI requests
- **Supabase** - Database for logging AI interactions
- **Context Analysis** - Enhanced understanding of document structure

### AI Services

- **OpenAI GPT-3.5-turbo** - Text generation and completion
- **Custom AI Prompts** - Tailored prompts for different content types
- **Context-Aware Processing** - Considers surrounding text and page content
- **Tag-Based Context** - Uses page tags to improve AI suggestions

### Database

- **ai_sessions table** - Logs all AI interactions for analytics
- **pages table** - Source of context for AI suggestions
- **page_tags table** - Tags provide semantic context for better AI responses

## 2. Feature Flow

### User Journey

1. **[Frontend]** User selects text or clicks in editor block
2. **[Frontend]** User presses `/` (slash command) or right-clicks for context menu
3. **[Frontend]** AI menu popup appears with available options
4. **[Frontend]** User selects AI action (continue writing, improve, summarize, etc.)
5. **[Backend]** Receive request with context and current text
6. **[Context Analysis]** Analyze page tags and content structure
7. **[AI Service]** Generate appropriate response based on action type and context
8. **[Backend]** Log AI interaction and return generated content
9. **[Frontend]** Insert or replace content in editor block
10. **[Frontend]** Update editor state and maintain undo history

### Why Context-Aware AI is Important

The AI context menu uses multiple layers of context to provide better suggestions:

1. **Immediate Context**: The current block and surrounding text
2. **Page Context**: The page title, recent blocks, and overall structure
3. **Semantic Context**: Page tags that indicate the topic and domain
4. **Workspace Context**: Recent pages and common themes in the workspace

This multi-layered approach ensures AI suggestions are:

- **Relevant**: Matching the current topic and writing style
- **Consistent**: Maintaining tone across the document
- **Intelligent**: Understanding technical vs. casual content
- **Contextual**: Aware of the broader document purpose

### Detailed Sequence Steps

#### Frontend Menu Activation

1. **Trigger Detection**

   ```typescript
   // Slash command detection with debouncing
   const handleSlashCommand = debounce((text: string, position: Position) => {
     if (text.endsWith("/")) {
       // Gather context before showing menu
       const context = gatherEditorContext(position);
       showAIMenuPopup(position, context);
     }
   }, 100);

   // Context menu detection with selection
   const handleContextMenu = (event: MouseEvent) => {
     event.preventDefault();

     const selection = editor.getSelection();
     if (selection && selection.length > 0) {
       const context = {
         selectedText: selection,
         blockType: getCurrentBlockType(),
         surroundingBlocks: getSurroundingBlocks(2),
       };
       showContextMenu(event.clientX, event.clientY, context);
     }
   };
   ```

2. **Enhanced Context Gathering**

   ```typescript
   // Get comprehensive context for better AI suggestions
   const gatherEditorContext = async (position: Position) => {
     const currentBlock = editor.getBlock(position.block);
     const pageData = await getPageData(pageId);

     return {
       // Immediate context
       currentText: extractTextFromBlock(currentBlock),
       blockType: currentBlock.type,
       blockPosition: position,

       // Surrounding context
       previousBlocks: getPreviousBlocks(position.block, 3),
       nextBlocks: getNextBlocks(position.block, 2),

       // Page context
       pageTitle: pageData.title,
       pageTags: pageData.tags,
       pageLength: pageData.content.length,

       // Semantic context
       documentType: inferDocumentType(pageData),
       writingStyle: detectWritingStyle(pageData.content),
       technicalLevel: assessTechnicalLevel(pageData.content),
     };
   };
   ```

3. **Intelligent Menu Rendering**

   ```typescript
   // Display AI actions based on comprehensive context analysis
   const getContextualMenuOptions = (context: EditorContext) => {
     const baseOptions = [
       {
         label: "Continue writing",
         icon: "✍️",
         action: "continue",
         description: "AI continues in your style",
       },
       {
         label: "Improve writing",
         icon: "✨",
         action: "improve",
         description: "Enhance clarity and flow",
       },
       {
         label: "Summarize",
         icon: "📝",
         action: "summarize",
         description: "Create a concise summary",
       },
       {
         label: "Make shorter",
         icon: "✂️",
         action: "shorten",
         description: "Reduce length while keeping meaning",
       },
       {
         label: "Make longer",
         icon: "📏",
         action: "expand",
         description: "Add more detail and explanation",
       },
     ];

     // Add context-specific options
     if (context.blockType === "list") {
       baseOptions.push({
         label: "Add list items",
         icon: "📋",
         action: "extend-list",
         description: "Generate related list items",
       });
     }

     if (context.technicalLevel === "high") {
       baseOptions.push({
         label: "Add code example",
         icon: "💻",
         action: "code-example",
         description: "Generate relevant code snippet",
       });
     }

     if (context.documentType === "tutorial") {
       baseOptions.push({
         label: "Add explanation",
         icon: "💡",
         action: "explain",
         description: "Explain in simpler terms",
       });
     }

     return baseOptions;
   };
   ```

#### Backend AI Processing

1. **Enhanced Request Classification**

   ```typescript
   // Determine AI action type with context awareness
   const processAIRequest = async (request: AIRequest) => {
     const { actionType, context, workspaceId } = request;

     // Enhance context with workspace information
     const enhancedContext = await enhanceContext(context, workspaceId);

     // Build specialized prompt based on action and context
     const prompt = await buildContextAwarePrompt(actionType, enhancedContext);

     // Adjust AI parameters based on context
     const aiParams = getAIParameters(actionType, enhancedContext);

     return { prompt, aiParams };
   };
   ```

2. **Tag-Based Context Enhancement**

   ```typescript
   // Use page tags to improve AI understanding
   const enhanceContextWithTags = async (context: EditorContext) => {
     const tagContext = {
       primaryTopic: determinePrimaryTopic(context.pageTags),
       domain: inferDomain(context.pageTags),
       technicalTerms: extractTechnicalTerms(context.pageTags),
       relatedConcepts: await getRelatedConcepts(context.pageTags),
     };

     return {
       ...context,
       tagContext,
       semanticHints: generateSemanticHints(tagContext),
     };
   };
   ```

3. **Intelligent AI Generation**

   ```typescript
   // Call OpenAI with enhanced context-aware prompt
   const generateAIContent = async (
     prompt: string,
     params: AIParameters,
     context: EnhancedContext
   ) => {
     // Build system prompt based on context
     const systemPrompt = buildSystemPrompt(context);

     const response = await openai.chat.completions.create({
       model: "gpt-3.5-turbo",
       messages: [
         {
           role: "system",
           content: systemPrompt,
         },
         {
           role: "user",
           content: prompt,
         },
       ],
       max_tokens: params.maxTokens,
       temperature: params.temperature,
       presence_penalty: params.presencePenalty,
       frequency_penalty: params.frequencyPenalty,
     });

     // Post-process based on context
     return postProcessAIResponse(response.choices[0].message.content, context);
   };
   ```

4. **Context-Aware Response Processing**

   ```typescript
   // Clean and adapt AI response to match document style
   const postProcessAIResponse = (
     rawResponse: string,
     context: EnhancedContext
   ) => {
     let processed = rawResponse;

     // Match writing style
     if (context.writingStyle === "formal") {
       processed = formalizeTone(processed);
     } else if (context.writingStyle === "casual") {
       processed = casualizeTone(processed);
     }

     // Ensure technical accuracy
     if (context.technicalLevel === "high") {
       processed = validateTechnicalTerms(processed, context.technicalTerms);
     }

     // Format for block type
     if (context.blockType === "list") {
       processed = formatAsList(processed);
     } else if (context.blockType === "code") {
       processed = formatAsCode(processed, context.programmingLanguage);
     }

     return processed;
   };
   ```

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                 FRONTEND                        │
│  ┌─────────────────────────────────────────────┐│
│  │           BlockNote Editor                  ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │        Text Block Content               │││
│  │  │                                         │││
│  │  │  User types "/" → AIMenuPopup.tsx      │││
│  │  │           ┌─────────────────────────┐   │││
│  │  │           │ ✍️ Continue writing     │   │││
│  │  │           │ ✨ Improve writing      │   │││
│  │  │           │ 📝 Summarize           │   │││
│  │  │           │ ✂️ Make shorter         │   │││
│  │  │           │ 📏 Make longer          │   │││
│  │  │           └─────────────────────────┘   │││
│  │  └─────────────────────────────────────────┘││
│  └─────────────────────────────────────────────┘│
└─────────────────┬───────────────────────────────┘
                  │ API Request
                  ▼
┌─────────────────────────────────────────────────┐
│              BACKEND API                        │
│  ┌─────────────────────────────────────────────┐│
│  │    /api/ai/suggestion-generate              ││
│  │           ↓                                 ││
│  │  AIController.generateContentFromSuggestion ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│               AI SERVICE                        │
│  ┌─────────────────────────────────────────────┐│
│  │  AIService.generateContentFromSuggestion()  ││
│  │                                             ││
│  │  1. Analyze suggestion type                 ││
│  │  2. Build context-aware prompt              ││
│  │  3. Add workspace context                   ││
│  │  4. Call OpenAI API                         ││
│  │  5. Process and clean response              ││
│  └─────────────┬───────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│            OPENAI INTEGRATION                   │
│  ┌─────────────────────────────────────────────┐│
│  │          GPT-3.5-turbo                      ││
│  │                                             ││
│  │  Context-aware prompts for:                 ││
│  │  • Content continuation                     ││
│  │  • Writing improvement                      ││
│  │  • Text summarization                       ││
│  │  • Content expansion/compression            ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## 3. Technical Details

### Key Packages

**Frontend Editor Integration:**

- **@blocknote/core**: Core editor functionality and block management
- **@blocknote/react**: React components for BlockNote editor
- **react-dom**: Portal rendering for popup positioning
- **@mantine/core**: Modal and overlay components

**Backend AI Processing:**

- **openai**: Official OpenAI SDK for content generation
- **joi**: Request validation schemas
- **@supabase/supabase-js**: Database logging for AI interactions

### Database Schema

**ai_sessions table:**

- `id`: UUID primary key
- `workspace_id`: Reference to workspace
- `session_type`: Type of AI interaction ('content_generation', 'suggestion', etc.)
- `input_data`: JSON with original context and text
- `output_data`: JSON with generated content
- `metadata`: Additional context (pageId, action type, content length)
- `created_at`: Interaction timestamp

### AI Prompt Engineering

**1. Enhanced Content Continuation Prompt:**

```typescript
const buildContinuationPrompt = (context: EnhancedContext) => {
  const { currentText, pageTags, writingStyle, technicalLevel } = context;

  return `
You are a helpful writing assistant. Continue the following text naturally and coherently.

Document Context:
- Topic: ${pageTags.join(", ")}
- Writing Style: ${writingStyle}
- Technical Level: ${technicalLevel}
- Document Type: ${context.documentType}

Current paragraph: "${currentText}"

Previous context: ${context.previousBlocks.map((b) => b.text).join("\n")}

Instructions:
1. Continue writing in the same style and tone
2. Maintain the ${technicalLevel} technical level
3. Stay relevant to the topics: ${pageTags.join(", ")}
4. Write 1-3 sentences that logically follow
5. Ensure smooth transition from the current text
`;
};
```

**2. Context-Aware Writing Improvement:**

```typescript
const buildImprovementPrompt = (context: EnhancedContext) => {
  const { selectedText, pageTags, writingStyle, documentType } = context;

  return `
Improve the following text for clarity, flow, and engagement while maintaining the original meaning.

Document Context:
- Topics: ${pageTags.join(", ")}
- Style: ${writingStyle}
- Document Type: ${documentType}

Original text: "${selectedText}"

Surrounding context: ${context.surroundingBlocks.map((b) => b.text).join("\n")}

Requirements:
1. Maintain the ${writingStyle} writing style
2. Keep technical terms accurate for topics: ${pageTags.join(", ")}
3. Improve clarity without changing the core message
4. Ensure the improved text flows well with surrounding content
5. Make it more ${documentType === "tutorial" ? "instructive" : "informative"}
`;
};
```

**3. Intelligent Summarization:**

```typescript
const buildSummaryPrompt = (context: EnhancedContext) => {
  const { textToSummarize, pageTags, documentType } = context;

  return `
Create a concise summary of the following content.

Document Context:
- Main Topics: ${pageTags.join(", ")}
- Document Type: ${documentType}
- Target Audience: ${inferAudience(context)}

Content to summarize: "${textToSummarize}"

Guidelines:
1. Focus on key points related to ${pageTags.join(", ")}
2. Maintain appropriate technical depth
3. Create a ${documentType === "technical" ? "precise" : "clear"} summary
4. Length: ${calculateSummaryLength(textToSummarize)} sentences
5. Preserve important technical terms and concepts
`;
};
```

### How AI Context Analysis Works

1. **Multi-Level Context Gathering**:

   - **Block Level**: Current block type, content, and position
   - **Document Level**: Surrounding blocks, overall structure
   - **Semantic Level**: Page tags, inferred topics, technical level
   - **Workspace Level**: Common themes, writing patterns

2. **Intelligent Parameter Adjustment**:

   - **Temperature**: Lower for technical content (0.3), higher for creative (0.7)
   - **Max Tokens**: Varies by action (50 for short edits, 300 for expansions)
   - **Penalties**: Adjusted to match document style and avoid repetition

3. **Style Matching**:

   - Analyzes existing content for tone, formality, and technical depth
   - Adjusts AI output to maintain consistency
   - Preserves domain-specific terminology

4. **Tag-Based Enhancement**:
   - Uses page tags to understand domain and context
   - Provides semantic hints to AI for better relevance
   - Ensures technical accuracy for specialized topics

### Menu Positioning and UI

**Dynamic Positioning:**

```typescript
const calculateMenuPosition = (cursorPosition, editorRect) => {
  const menuHeight = 200;
  const menuWidth = 250;

  let top = cursorPosition.y + 20;
  let left = cursorPosition.x;

  // Prevent menu from going off-screen
  if (top + menuHeight > window.innerHeight) {
    top = cursorPosition.y - menuHeight - 10;
  }

  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }

  return { top, left };
};
```

**Menu Options Configuration:**

```typescript
const getMenuOptions = (context) => {
  const baseOptions = [
    {
      id: "continue",
      label: "Continue writing",
      icon: "✍️",
      description: "AI continues your text naturally",
      disabled: !context.hasText,
    },
    {
      id: "improve",
      label: "Improve writing",
      icon: "✨",
      description: "Enhance clarity and flow",
      disabled: !context.hasSelection,
    },
  ];

  return baseOptions.filter((option) => !option.disabled);
};
```

### Optimizations

- **Debounced Triggers**: Menu only appears after brief pause to prevent accidental activation
- **Context Caching**: Recent page context cached to avoid repeated database queries
- **Smart Token Management**: Dynamic token limits based on action type and context
- **Response Cleaning**: Automatic removal of unwanted formatting and artifacts
- **Keyboard Navigation**: Full keyboard support for menu selection
- **Smart Positioning**: Menu automatically repositions to stay within viewport
- **Predictive Loading**: Pre-fetch common AI responses for instant results
- **Style Consistency**: AI responses automatically match document formatting

## 4. Terminology Explained

### Slash Commands

A user interface pattern where typing "/" in an editor brings up a menu of available actions. The AI context menu uses this for quick access to AI features without interrupting the writing flow.

### Block-Based Editor

An editor architecture where content is organized into discrete blocks (paragraphs, headings, lists) rather than a single document. Each block can be manipulated independently, allowing for precise AI assistance.

### Context-Aware AI

AI that considers multiple layers of context:

- **Immediate**: Current text and cursor position
- **Local**: Surrounding blocks and structure
- **Document**: Page title, tags, and overall theme
- **Workspace**: Common patterns and topics

### Multi-Level Context Analysis

The process of gathering and analyzing context at different levels to provide more relevant AI suggestions. Like how humans consider the whole conversation, not just the last sentence.

### Writing Style Detection

Algorithmic analysis of text to determine:

- **Formality**: Academic, professional, casual, conversational
- **Technical Level**: Beginner, intermediate, expert
- **Tone**: Informative, instructive, persuasive, narrative

### Semantic Hints

Additional context provided to AI based on page tags and content analysis, helping it understand domain-specific requirements and terminology.

### Dynamic Prompt Engineering

Creating AI prompts that adapt based on context rather than using static templates. Different contexts generate different prompts for better results.

### Post-Processing Pipeline

The series of transformations applied to AI output to ensure it matches the document's style, format, and technical requirements.

---

## Important Implementation Notes

- **Real-time Performance**: Menu appears within 100ms of trigger for smooth user experience
- **Context Sensitivity**: AI suggestions adapt based on content type, tags, and document structure
- **Undo Support**: All AI-generated content integrates with editor's undo/redo system
- **Accessibility**: Full keyboard navigation and screen reader support
- **Error Handling**: Graceful fallbacks when AI services are unavailable
- **Privacy**: User content is only sent to OpenAI for processing, not stored permanently
- **Customization**: Menu options can be configured per workspace or user preferences
- **Learning**: System improves over time by analyzing successful AI interactions
- **Tag Integration**: Page tags significantly improve AI suggestion relevance
