# AI Menu in BlockNote Editor

This directory contains the implementation of the AI Menu feature for the BlockNote editor, which allows users to access AI-powered writing assistance directly within the editor.

## Features

### `/ai` Slash Command

- Users can type `/ai` in the editor to trigger the AI menu
- The command appears in the slash menu with the title "AI Assistant"
- Includes aliases: "ai", "assistant", "help", "complete", "analyze", "suggest"

### AI Operations

The AI menu provides four main operations:

1. **Complete Text** - AI completes the current text content
2. **Content Suggestions** - AI provides suggestions for improving content
3. **Writing Analysis** - AI analyzes writing quality and provides feedback
4. **Summarize Content** - AI generates a summary of the page content

### User Experience

- Modal popup with clear operation buttons
- Loading states with spinner during AI processing
- Error handling with user-friendly messages
- Accept/Reject buttons for AI suggestions
- Results displayed in formatted alerts

### Empty Content Handling

The AI menu intelligently handles cases where there's no content in the current page:

- **For Summarize**: Works with the page structure even if no text content exists
- **For Other Operations**: Falls back to using the page summary if available
- **No Content Available**: Shows helpful error message asking user to add content

## Components

### `AISlashCommand.tsx`

- Defines the custom slash command for triggering the AI menu
- Returns a suggestion item that integrates with BlockNote's slash menu system

### `AIMenuPopup.tsx`

- Main modal component that displays AI operation options
- Handles API calls to the backend AI services
- Manages loading states, errors, and results
- Provides accept/reject functionality for AI suggestions
- **Fixed**: Properly sends BlockNote content object for summarize operation
- **Enhanced**: Handles empty content scenarios gracefully

## Integration

The AI menu is integrated into the main `BlockNoteEditor.tsx` component:

1. Custom slash menu with AI command
2. State management for menu visibility
3. Suggestion acceptance handler that inserts AI results into the editor

## API Integration

The component uses the existing `aiService` to call these endpoints:

- `POST /ai/complete` - Text completion
- `POST /ai/suggestions` - Content suggestions
- `POST /ai/analyze` - Writing analysis
- `POST /ai/summarize` - Content summarization (sends proper BlockNote content object)

## Usage

1. User types `/ai` in the editor
2. Selects "AI Assistant" from the slash menu
3. Chooses one of the four AI operations
4. Waits for AI processing (loading state shown)
5. Reviews the AI result
6. Accepts (inserts into editor) or rejects the suggestion

## Technical Details

- Uses Mantine UI components for consistent styling
- FontAwesome icons for visual elements
- Proper TypeScript typing throughout
- Error boundaries and fallback handling
- Integrates with existing MobX stores (pageStore, workspaceStore)
- **Fixed**: Proper API payload format for backend validation
- **Enhanced**: Smart content detection and fallback strategies

## Recent Fixes

### Summarize API Fix

- **Issue**: Backend expected `content` as object but frontend was sending extracted text string
- **Fix**: Now sends the raw BlockNote content object for summarize operations
- **Result**: Summarize operation now works correctly with backend validation

### Empty Content Handling

- **Issue**: AI menu failed when triggered on empty pages/blocks
- **Fix**: Intelligent fallback system:
  - Summarize: Works with page structure even if empty
  - Other operations: Use page summary as content if available
  - No content: Show helpful error message
- **Result**: AI menu works in all scenarios, including empty pages

## Future Enhancements

- Streaming AI responses for real-time feedback
- More granular insertion options (replace vs append)
- Custom prompts and AI model selection
- Undo/redo support for AI operations
