# Notion AI Clone - Complete API Documentation

## Overview

This document provides comprehensive details for all API endpoints in the Notion AI Clone backend. The API is built with Express.js, TypeScript, and Supabase, featuring advanced AI capabilities powered by OpenAI.

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

All API endpoints require authentication via Supabase Auth. Include the authorization token in the request headers:

```http
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow a consistent format:

```json
{
  "success": boolean,
  "data": object | array,
  "error": string,
  "timestamp": string
}
```

---

## 1. WORKSPACE ENDPOINTS

### 1.1 Get All Workspaces

**GET** `/workspaces`

Get all workspaces for the authenticated user.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "My Workspace",
      "description": "Workspace description",
      "icon_url": "https://...",
      "user_id": "uuid",
      "created_at": "2024-03-20T10:00:00.000Z",
      "updated_at": "2024-03-20T10:00:00.000Z"
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 1.2 Create Workspace

**POST** `/workspaces`

Create a new workspace.

**Request Body:**

```json
{
  "name": "New Workspace",
  "description": "Optional description",
  "icon_url": "https://example.com/icon.png"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "New Workspace",
    "description": "Optional description",
    "icon_url": "https://example.com/icon.png",
    "user_id": "uuid",
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 1.3 Get Workspace by ID

**GET** `/workspaces/:id`

Get a specific workspace by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "My Workspace",
    "description": "Workspace description",
    "icon_url": "https://...",
    "user_id": "uuid",
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 1.4 Update Workspace

**PUT** `/workspaces/:id`

Update workspace details.

**Request Body:**

```json
{
  "name": "Updated Workspace Name",
  "description": "Updated description",
  "icon_url": "https://example.com/new-icon.png"
}
```

### 1.5 Delete Workspace

**DELETE** `/workspaces/:id`

Delete a workspace and all its contents.

**Response:**

```json
{
  "success": true,
  "message": "Workspace deleted successfully",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 2. PAGE ENDPOINTS

### 2.1 Get All Pages

**GET** `/pages`

Get all pages for a workspace with optional pagination.

**Query Parameters:**

- `workspace_id` (required): UUID of the workspace
- `limit` (optional): Number of pages to return (default: 50)
- `offset` (optional): Number of pages to skip (default: 0)
- `parent_id` (optional): Filter by parent page ID

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Page Title",
      "content": {
        /* BlockNote JSON content */
      },
      "workspace_id": "uuid",
      "parent_id": "uuid",
      "icon_url": "https://...",
      "cover_url": "https://...",
      "summary": "AI-generated summary",
      "summary_updated_at": "2024-03-20T10:00:00.000Z",
      "created_at": "2024-03-20T10:00:00.000Z",
      "updated_at": "2024-03-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 150,
    "hasMore": true
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.2 Create Page

**POST** `/pages`

Create a new page with automatic AI summary generation.

**Request Body:**

```json
{
  "title": "New Page Title",
  "content": {
    /* BlockNote JSON content */
  },
  "workspace_id": "uuid",
  "parent_id": "uuid", // Optional
  "icon_url": "https://...", // Optional
  "cover_url": "https://..." // Optional
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "New Page Title",
    "content": {
      /* BlockNote JSON content */
    },
    "workspace_id": "uuid",
    "parent_id": "uuid",
    "icon_url": "https://...",
    "cover_url": "https://...",
    "summary": "AI-generated summary",
    "summary_updated_at": "2024-03-20T10:00:00.000Z",
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.3 Get Page by ID

**GET** `/pages/:id`

Get a specific page by ID.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Page Title",
    "content": {
      /* BlockNote JSON content */
    },
    "workspace_id": "uuid",
    "parent_id": "uuid",
    "icon_url": "https://...",
    "cover_url": "https://...",
    "summary": "AI-generated summary",
    "summary_updated_at": "2024-03-20T10:00:00.000Z",
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.4 Update Page

**PUT** `/pages/:id`

Update a page with automatic summary regeneration if content changes.

**Request Body:**

```json
{
  "title": "Updated Page Title",
  "content": {
    /* Updated BlockNote JSON content */
  },
  "parent_id": "uuid",
  "icon_url": "https://...",
  "cover_url": "https://..."
}
```

### 2.5 Delete Page

**DELETE** `/pages/:id`

Delete a page and all its subpages.

**Response:**

```json
{
  "success": true,
  "message": "Page deleted successfully",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.6 Get Page Children

**GET** `/pages/:id/children`

Get all child pages of a specific page.

**Query Parameters:**

- `limit` (optional): Number of children to return (default: 50)
- `offset` (optional): Number of children to skip (default: 0)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Child Page",
      "parent_id": "uuid",
      "icon_url": "https://...",
      "created_at": "2024-03-20T10:00:00.000Z",
      "updated_at": "2024-03-20T10:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 10,
    "hasMore": false
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.7 Duplicate Page

**POST** `/pages/:id/duplicate`

Create a copy of a page including its content.

**Request Body:**

```json
{
  "title": "Copy of Original Page", // Optional
  "parent_id": "uuid", // Optional
  "includeChildren": false // Optional
}
```

### 2.8 Move Page

**POST** `/pages/:id/move`

Move a page to a different parent.

**Request Body:**

```json
{
  "parent_id": "uuid", // null for root level
  "workspace_id": "uuid" // Required if moving to different workspace
}
```

### 2.9 Get Page Backlinks

**GET** `/pages/:id/backlinks`

Get pages that link to this page.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Linking Page",
      "linkCount": 3,
      "lastLinked": "2024-03-20T10:00:00.000Z"
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 2.10 Generate Page Summary

**POST** `/pages/:id/generate-summary`

Manually trigger AI summary generation for a page.

**Request Body:**

```json
{
  "force": false // Optional: Force regeneration even if summary exists
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "summary": "AI-generated summary of the page content...",
    "generatedAt": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 3. SEARCH ENDPOINTS

### 3.1 Full-Text Search

**POST** `/search`

Perform full-text search across all pages in a workspace.

**Request Body:**

```json
{
  "query": "search term",
  "workspace_id": "uuid",
  "limit": 20, // Optional
  "offset": 0, // Optional
  "filters": {
    "parent_id": "uuid", // Optional
    "created_after": "2024-01-01", // Optional
    "created_before": "2024-12-31" // Optional
  }
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid",
        "title": "Matching Page",
        "snippet": "...highlighted search term...",
        "relevance": 0.95,
        "created_at": "2024-03-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "limit": 20,
      "offset": 0,
      "total": 45,
      "hasMore": true
    }
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 3.2 Semantic Search

**POST** `/search/semantic`

Perform AI-powered semantic search using vector embeddings.

**Request Body:**

```json
{
  "query": "conceptual search query",
  "workspace_id": "uuid",
  "limit": 10, // Optional
  "threshold": 0.7 // Optional: Minimum similarity score
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "page_id": "uuid",
      "title": "Semantically Related Page",
      "content": {
        /* BlockNote JSON */
      },
      "similarity": 0.92,
      "snippet": "Relevant content excerpt..."
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 3.3 Search Suggestions

**GET** `/search/suggestions`

Get auto-complete suggestions for search queries.

**Query Parameters:**

- `q`: Partial search term
- `workspace_id`: UUID of the workspace
- `limit`: Number of suggestions (default: 5)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "suggestion": "project management",
      "type": "page_title",
      "count": 3
    },
    {
      "suggestion": "project planning",
      "type": "content",
      "count": 7
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 3.4 Find Similar Pages

**POST** `/search/pages/:id/similar`

Find pages similar to a specific page using AI.

**Request Body:**

```json
{
  "limit": 5, // Optional
  "threshold": 0.6 // Optional: Minimum similarity score
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "page_id": "uuid",
      "title": "Similar Page",
      "similarity": 0.85,
      "snippet": "Content that makes it similar..."
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 3.5 Generate Embeddings

**POST** `/search/embeddings/generate`

Generate or update vector embeddings for workspace pages.

**Request Body:**

```json
{
  "workspace_id": "uuid",
  "force_regenerate": false // Optional: Regenerate existing embeddings
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "processed": 25,
    "updated": 5,
    "errors": 0,
    "message": "Embeddings generated successfully"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 4. FILE UPLOAD ENDPOINTS

### 4.1 Upload Icon

**POST** `/upload/icon`

Upload an icon image (automatically resized to 280x280).

**Request:**

- Content-Type: multipart/form-data
- File field: `icon`
- Supported formats: PNG, JPG, JPEG, GIF, WEBP
- Max size: 5MB

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "url": "https://storage.supabase.co/...",
    "filename": "icon-uuid.png",
    "size": 12345,
    "dimensions": {
      "width": 280,
      "height": 280
    }
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 4.2 Upload Cover Image

**POST** `/upload/cover`

Upload a cover image (automatically resized to 1200x400).

**Request:**

- Content-Type: multipart/form-data
- File field: `cover`
- Supported formats: PNG, JPG, JPEG, GIF, WEBP
- Max size: 10MB

**Response:**

```json
{
  "success": true,
  "data": {
    "fileId": "uuid",
    "url": "https://storage.supabase.co/...",
    "filename": "cover-uuid.jpg",
    "size": 45678,
    "dimensions": {
      "width": 1200,
      "height": 400
    }
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 4.3 Delete File

**DELETE** `/upload/:fileId`

Delete an uploaded file from storage.

**Response:**

```json
{
  "success": true,
  "message": "File deleted successfully",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 4.4 Get Presigned URL

**GET** `/upload/:fileId/presigned`

Get a presigned URL for direct file access.

**Query Parameters:**

- `expires_in`: Expiration time in seconds (default: 3600)

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://storage.supabase.co/...",
    "expires_at": "2024-03-20T11:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 4.5 Get File Info

**GET** `/upload/info/:fileId`

Get metadata about an uploaded file.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "filename": "image.png",
    "size": 12345,
    "mime_type": "image/png",
    "dimensions": {
      "width": 280,
      "height": 280
    },
    "uploaded_at": "2024-03-20T10:00:00.000Z"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 5. TAG ENDPOINTS

### 5.1 Get All Tags

**GET** `/tags`

Get all tags for a workspace.

**Query Parameters:**

- `workspace_id` (required): UUID of the workspace

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "project",
      "color": "#FF5733",
      "workspace_id": "uuid",
      "created_at": "2024-03-20T10:00:00.000Z"
    }
  ],
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 5.2 Create Tag

**POST** `/tags`

Create a new tag.

**Request Body:**

```json
{
  "name": "new-tag",
  "color": "#FF5733",
  "workspace_id": "uuid"
}
```

### 5.3 Update Tag

**PUT** `/tags/:id`

Update an existing tag.

**Request Body:**

```json
{
  "name": "updated-tag",
  "color": "#33FF57"
}
```

### 5.4 Delete Tag

**DELETE** `/tags/:id`

Delete a tag and remove it from all pages.

### 5.5 Add Tag to Page

**POST** `/tags/:tagId/pages/:pageId`

Associate a tag with a page.

### 5.6 Remove Tag from Page

**DELETE** `/tags/:tagId/pages/:pageId`

Remove a tag association from a page.

### 5.7 Get Page Tags

**GET** `/pages/:pageId/tags`

Get all tags associated with a specific page.

---

## 6. AI ENDPOINTS

### 6.1 AI Suggestions

**POST** `/ai/suggest`

Get real-time AI content suggestions for writing assistance.

**Request Body:**

```json
{
  "context": "This is the surrounding text context...",
  "currentText": "The user is currently typing this",
  "pageId": "uuid", // Optional
  "workspaceId": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "suggestions": [
    "Continue writing about...",
    "You might want to add...",
    "Consider including..."
  ],
  "type": "continuation",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 6.2 AI Link Suggestions

**POST** `/ai/link`

Get intelligent link suggestions based on content analysis.

**Request Body:**

```json
{
  "text": "The text to analyze for link opportunities",
  "workspaceId": "uuid",
  "pageId": "uuid", // Optional: exclude current page
  "contextWindow": 100 // Optional: characters around the text
}
```

**Response:**

```json
{
  "success": true,
  "suggestions": [
    {
      "pageId": "uuid",
      "pageTitle": "Related Page",
      "relevanceScore": 0.92,
      "snippet": "The relevant text that matches",
      "position": {
        "start": 45,
        "end": 67
      },
      "summary": "AI-generated summary explaining the relevance"
    }
  ],
  "text": "Original analyzed text",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 6.3 Generate Tags

**POST** `/ai/tags`

Generate semantic tags for page content using AI.

**Request Body:**

```json
{
  "title": "Page Title",
  "content": {
    /* BlockNote JSON content */
  },
  "workspaceId": "uuid"
}
```

**Response:**

```json
{
  "success": true,
  "tags": [
    {
      "name": "project-management",
      "color": "#FF5733",
      "confidence": 0.89
    },
    {
      "name": "productivity",
      "color": "#33FF57",
      "confidence": 0.76
    }
  ],
  "reasoning": "Tags generated based on content analysis of project planning and productivity concepts.",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 6.4 Summarize Content

**POST** `/ai/summarize`

Generate AI summary of page content.

**Request Body:**

```json
{
  "title": "Page Title",
  "content": {
    /* BlockNote JSON content */
  },
  "length": "medium" // "short", "medium", "long"
}
```

**Response:**

```json
{
  "success": true,
  "summary": "AI-generated summary of the content...",
  "length": "medium",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 6.5 Complete Text

**POST** `/ai/complete`

AI-powered text completion for writing assistance.

**Request Body:**

```json
{
  "text": "The incomplete sentence or paragraph...",
  "context": "Additional context for better completion",
  "maxTokens": 150 // Optional: maximum completion length
}
```

**Response:**

```json
{
  "success": true,
  "completion": "...completed text that follows naturally",
  "originalText": "The incomplete sentence or paragraph...",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 6.6 Analyze Writing

**POST** `/ai/analyze`

Analyze writing quality and provide suggestions.

**Request Body:**

```json
{
  "text": "The text content to analyze for writing quality..."
}
```

**Response:**

```json
{
  "success": true,
  "analysis": {
    "readabilityScore": 8.5,
    "sentimentScore": 0.2,
    "suggestions": [
      "Consider varying sentence length for better flow",
      "The tone is professional and clear"
    ],
    "statistics": {
      "wordCount": 245,
      "sentenceCount": 12,
      "avgWordsPerSentence": 20.4
    }
  },
  "textLength": 1456,
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 7. RAG CHATBOT ENDPOINTS

### 7.1 Create Chat Conversation

**POST** `/ai/chat/conversation`

Create a new AI chat conversation in a workspace.

**Request Body:**

```json
{
  "workspaceId": "uuid",
  "title": "New Chat", // Optional
  "userId": "uuid" // Optional
}
```

**Response:**

```json
{
  "success": true,
  "conversationId": "uuid",
  "workspaceId": "uuid",
  "title": "New Chat",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 7.2 Send Chat Message

**POST** `/ai/chat`

Send a question to the AI chatbot and get an answer based on workspace knowledge.

**Request Body:**

```json
{
  "question": "What is our product roadmap for 2024?",
  "conversationId": "uuid", // Optional: creates new if not provided
  "workspaceId": "uuid",
  "userId": "uuid" // Optional
}
```

**Response:**

```json
{
  "success": true,
  "answer": "Based on your workspace documents, your 2024 product roadmap includes...",
  "citations": [
    {
      "pageId": "uuid",
      "pageTitle": "Product Roadmap 2024",
      "relevance": 0.95,
      "excerpt": "Q1 focuses on user experience improvements..."
    }
  ],
  "conversationId": "uuid",
  "messageId": "uuid",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 7.3 Get Conversation History

**GET** `/ai/chat/history/:conversationId`

Retrieve the complete conversation history with messages and citations.

**Response:**

```json
{
  "success": true,
  "conversation": {
    "id": "uuid",
    "title": "Product Roadmap Discussion",
    "workspaceId": "uuid",
    "createdAt": "2024-03-20T09:00:00.000Z",
    "updatedAt": "2024-03-20T10:00:00.000Z"
  },
  "messages": [
    {
      "role": "user",
      "content": "What is our product roadmap for 2024?",
      "citations": []
    },
    {
      "role": "assistant",
      "content": "Based on your workspace documents...",
      "citations": [
        {
          "pageId": "uuid",
          "pageTitle": "Product Roadmap 2024",
          "relevance": 0.95,
          "excerpt": "Q1 focuses on user experience improvements..."
        }
      ]
    }
  ],
  "messageCount": 2,
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 7.4 List Workspace Conversations

**GET** `/ai/chat/workspace/:workspaceId/conversations`

Get all chat conversations in a workspace with pagination.

**Query Parameters:**

- `limit` (optional): Number of conversations (default: 20)
- `offset` (optional): Number to skip (default: 0)

**Response:**

```json
{
  "success": true,
  "conversations": [
    {
      "id": "uuid",
      "title": "Product Roadmap Discussion",
      "updatedAt": "2024-03-20T10:00:00.000Z",
      "createdAt": "2024-03-20T09:00:00.000Z",
      "messageCount": 8
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 15,
    "hasMore": false
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 7.5 Delete Conversation

**DELETE** `/ai/chat/:conversationId`

Delete a conversation and all its messages permanently.

**Response:**

```json
{
  "success": true,
  "message": "Conversation deleted successfully",
  "conversationId": "uuid",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 7.6 Update Conversation Title

**PUT** `/ai/chat/:conversationId/title`

Update the title of an existing conversation.

**Request Body:**

```json
{
  "title": "Updated Conversation Title"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Conversation title updated successfully",
  "conversationId": "uuid",
  "title": "Updated Conversation Title",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## 8. AI MANAGEMENT ENDPOINTS

### 8.1 Generate Workspace Summaries

**POST** `/ai/workspace/:workspaceId/generate-summaries`

Trigger batch summary generation for all pages in a workspace.

**Response:**

```json
{
  "success": true,
  "message": "Summary generation started for workspace",
  "workspaceId": "uuid",
  "note": "Process is running in background",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 8.2 Get Summary Status

**GET** `/ai/workspace/:workspaceId/summary-status`

Get the status of summary generation for a workspace.

**Response:**

```json
{
  "success": true,
  "workspaceId": "uuid",
  "totalPages": 100,
  "pagesWithSummaries": 85,
  "pagesNeedingUpdate": 15,
  "completionPercentage": 85,
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### 8.3 Get Knowledge Graph Data

**GET** `/ai/graph/:pageId`

Get knowledge graph data for visualization around a specific page.

**Response:**

```json
{
  "success": true,
  "graph": {
    "nodes": [
      {
        "id": "uuid",
        "label": "Central Page",
        "type": "current",
        "x": 0,
        "y": 0
      },
      {
        "id": "uuid",
        "label": "Related Page",
        "type": "similar",
        "similarity": 0.85,
        "x": 200,
        "y": 100
      }
    ],
    "edges": [
      {
        "id": "uuid-uuid",
        "source": "uuid",
        "target": "uuid",
        "type": "similar",
        "weight": 0.85
      }
    ],
    "centerNode": "uuid"
  },
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## Error Handling

### Standard Error Response Format

```json
{
  "success": false,
  "error": "Error message describing what went wrong",
  "code": "ERROR_CODE", // Optional error code
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created successfully
- **400**: Bad Request (validation error)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (access denied)
- **404**: Not Found
- **422**: Unprocessable Entity (validation failed)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

### Common Error Examples

**Validation Error (400):**

```json
{
  "success": false,
  "error": "Validation error: title is required",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

**Authentication Required (401):**

```json
{
  "success": false,
  "error": "Authentication required",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

**Access Denied (403):**

```json
{
  "success": false,
  "error": "Access denied to this workspace",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

**Not Found (404):**

```json
{
  "success": false,
  "error": "Page not found",
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

**Rate Limit (429):**

```json
{
  "success": false,
  "error": "Too many requests. Please try again later.",
  "retryAfter": 60,
  "timestamp": "2024-03-20T10:00:00.000Z"
}
```

---

## Rate Limiting

API endpoints have the following rate limits:

- **Standard endpoints**: 100 requests per minute per user
- **AI endpoints**: 20 requests per minute per user
- **File upload endpoints**: 10 requests per minute per user
- **Search endpoints**: 50 requests per minute per user

Rate limit headers are included in responses:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1679395200
```

---

## Pagination

Endpoints that return lists support pagination:

**Query Parameters:**

- `limit`: Number of items to return (max: 100)
- `offset`: Number of items to skip

**Response Format:**

```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

---

## Environment Variables

Required environment variables for the API:

```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key

# Server
PORT=3001
NODE_ENV=development

# Security
JWT_SECRET=your_jwt_secret

# File Storage
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/png,image/jpeg,image/gif,image/webp
```

---

## WebSocket Events (Future)

The API is designed to support real-time features via WebSocket:

```javascript
// Page updates
socket.on("page:updated", { pageId, changes });
socket.on("page:created", { page });
socket.on("page:deleted", { pageId });

// Collaboration
socket.on("user:joined", { userId, pageId });
socket.on("user:left", { userId, pageId });
socket.on("cursor:moved", { userId, position });

// AI events
socket.on("ai:suggestion", { pageId, suggestions });
socket.on("ai:summary:generated", { pageId, summary });
```

---

## SDK Examples

### JavaScript/TypeScript SDK Usage

```typescript
import { NotionAIClient } from "@notion-ai/client";

const client = new NotionAIClient({
  baseURL: "http://localhost:3001/api",
  token: "your-jwt-token",
});

// Create a page
const page = await client.pages.create({
  title: "New Page",
  content: { blocks: [] },
  workspace_id: "workspace-uuid",
});

// Get AI suggestions
const suggestions = await client.ai.suggest({
  context: "Writing about project management...",
  currentText: "The key benefits are",
  workspaceId: "workspace-uuid",
});

// Chat with AI
const response = await client.ai.chat({
  question: "What are our quarterly goals?",
  workspaceId: "workspace-uuid",
});
```

### Python SDK Usage

```python
from notion_ai_client import NotionAIClient

client = NotionAIClient(
    base_url='http://localhost:3001/api',
    token='your-jwt-token'
)

# Create a page
page = client.pages.create({
    'title': 'New Page',
    'content': {'blocks': []},
    'workspace_id': 'workspace-uuid'
})

# Get AI suggestions
suggestions = client.ai.suggest({
    'context': 'Writing about project management...',
    'currentText': 'The key benefits are',
    'workspaceId': 'workspace-uuid'
})

# Chat with AI
response = client.ai.chat({
    'question': 'What are our quarterly goals?',
    'workspaceId': 'workspace-uuid'
})
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:ai

# Run with coverage
npm run test:coverage
```

### Test Environment

Tests require these environment variables:

```env
NODE_ENV=test
TEST_SUPABASE_URL=your_test_db_url
TEST_OPENAI_API_KEY=your_test_api_key
```

---

## Performance Considerations

### Optimization Tips

1. **Use pagination** for large datasets
2. **Cache AI responses** when possible
3. **Generate embeddings in batches** for better performance
4. **Use semantic search** instead of full-text when relevant
5. **Leverage page summaries** for faster AI operations

### Response Times

Typical response times:

- Standard CRUD operations: < 100ms
- Search operations: < 300ms
- AI suggestions: < 2s
- AI chat responses: < 5s
- File uploads: < 2s

---

## Security Best Practices

### Authentication

- Always include valid JWT tokens
- Tokens expire after 24 hours
- Refresh tokens before expiration

### Data Access

- All endpoints enforce workspace ownership
- Row-level security prevents data leaks
- File uploads are virus-scanned

### API Security

- Input validation on all endpoints
- SQL injection prevention
- XSS protection
- Rate limiting enforcement

---

This comprehensive API documentation covers all endpoints, request/response formats, and usage examples for the Notion AI Clone backend. For additional support or questions, refer to the specific service documentation or contact the development team.
