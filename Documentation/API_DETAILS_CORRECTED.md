# Notion AI Clone - Complete API Documentation (CORRECTED)

## Overview

This document provides **ACCURATE** comprehensive details for all API endpoints in the Notion AI Clone backend. The API is built with Express.js, TypeScript, and Supabase, featuring advanced AI capabilities powered by OpenAI.

## Base URL

```
Development: http://localhost:3001/api
Production: https://your-domain.com/api
```

## Authentication

All API endpoints (except auth endpoints) require authentication via Supabase Auth. Include the authorization token in the request headers:

```http
Authorization: Bearer <your-jwt-token>
```

## Response Format

**Note:** The backend uses different response formats depending on the endpoint:

- Auth endpoints return Supabase's standard format with `status: "success"`
- Other endpoints typically return data directly or with simple structure

---

## 1. AUTHENTICATION ENDPOINTS (`/api/auth`)

### 1.1 Sign Up

**POST** `/auth/signup`

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
      "aud": "authenticated",
      "role": "authenticated",
      "email": "user@example.com",
      "email_confirmed_at": "2025-05-31T16:44:54.37818Z",
      "phone": "",
      "confirmation_sent_at": "2025-05-31T16:44:20.322436Z",
      "confirmed_at": "2025-05-31T16:44:54.37818Z",
      "last_sign_in_at": null,
      "app_metadata": {
        "provider": "email",
        "providers": ["email"]
      },
      "user_metadata": {
        "email": "user@example.com",
        "email_verified": true,
        "phone_verified": false,
        "sub": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073"
      },
      "identities": [
        {
          "identity_id": "870366b8-89a1-4519-b88e-7da66e520a08",
          "id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
          "user_id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
          "identity_data": {
            "email": "user@example.com",
            "email_verified": true,
            "phone_verified": false,
            "sub": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073"
          },
          "provider": "email",
          "last_sign_in_at": "2025-05-31T16:37:37.604186Z",
          "created_at": "2025-05-31T16:37:37.604234Z",
          "updated_at": "2025-05-31T16:37:37.604234Z",
          "email": "user@example.com"
        }
      ],
      "created_at": "2025-05-31T16:37:37.599565Z",
      "updated_at": "2025-05-31T16:37:37.599565Z",
      "is_anonymous": false
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsImtpZCI6IkM0Ukh4d3RKZUEvbmNQTFoiLCJ0eXAiOiJKV1QifQ...",
      "token_type": "bearer",
      "expires_in": 3600,
      "expires_at": 1748746120,
      "refresh_token": "54mp6sxlylhj"
    }
  }
}
```

### 1.2 Sign In

**POST** `/auth/signin`

Authenticate existing user.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "user": {
      "id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
      "aud": "authenticated",
      "role": "authenticated",
      "email": "tathagatraj4@gmail.com",
      "email_confirmed_at": "2025-05-31T16:44:54.37818Z",
      "phone": "",
      "confirmation_sent_at": "2025-05-31T16:44:20.322436Z",
      "confirmed_at": "2025-05-31T16:44:54.37818Z",
      "last_sign_in_at": "2025-06-01T01:48:40.614141922Z",
      "app_metadata": {
        "provider": "email",
        "providers": ["email"]
      },
      "user_metadata": {
        "email": "tathagatraj4@gmail.com",
        "email_verified": true,
        "phone_verified": false,
        "sub": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073"
      },
      "identities": [
        {
          "identity_id": "870366b8-89a1-4519-b88e-7da66e520a08",
          "id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
          "user_id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
          "identity_data": {
            "email": "tathagatraj4@gmail.com",
            "email_verified": true,
            "phone_verified": false,
            "sub": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073"
          },
          "provider": "email",
          "last_sign_in_at": "2025-05-31T16:37:37.604186Z",
          "created_at": "2025-05-31T16:37:37.604234Z",
          "updated_at": "2025-05-31T16:37:37.604234Z",
          "email": "tathagatraj4@gmail.com"
        }
      ],
      "created_at": "2025-05-31T16:37:37.599565Z",
      "updated_at": "2025-06-01T01:48:40.618531Z",
      "is_anonymous": false
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsImtpZCI6IkM0Ukh4d3RKZUEvbmNQTFoiLCJ0eXAiOiJKV1QifQ...",
      "token_type": "bearer",
      "expires_in": 3600,
      "expires_at": 1748746120,
      "refresh_token": "54mp6sxlylhj"
    }
  }
}
```

### 1.3 Sign Out

**POST** `/auth/signout`

**Headers Required:**

```http
Authorization: Bearer <your-jwt-token>
```

**Response:**

```json
{
  "status": "success",
  "message": "Signed out successfully"
}
```

### 1.4 Get Current User

**GET** `/auth/me`

Get current authenticated user information.

**Headers Required:**

```http
Authorization: Bearer <your-jwt-token>
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
    "aud": "authenticated",
    "role": "authenticated",
    "email": "tathagatraj4@gmail.com",
    "email_confirmed_at": "2025-05-31T16:44:54.37818Z",
    "phone": "",
    "last_sign_in_at": "2025-06-01T01:48:40.614141922Z",
    "app_metadata": {
      "provider": "email",
      "providers": ["email"]
    },
    "user_metadata": {
      "email": "tathagatraj4@gmail.com",
      "email_verified": true,
      "phone_verified": false,
      "sub": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073"
    },
    "created_at": "2025-05-31T16:37:37.599565Z",
    "updated_at": "2025-06-01T01:48:40.618531Z",
    "is_anonymous": false
  }
}
```

---

## 2. WORKSPACE ENDPOINTS (`/api/workspaces`)

**All endpoints require authentication.**

### 2.1 Get All Workspaces

**GET** `/workspaces`

Get all workspaces for the authenticated user.

**Response:**

```json
[
  {
    "id": "uuid",
    "name": "My Workspace",
    "description": "Workspace description",
    "icon_url": null,
    "user_id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  }
]
```

### 2.2 Create Workspace

**POST** `/workspaces`

Create a new workspace.

**Request Body:**

```json
{
  "name": "New Workspace",
  "description": "Optional description"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "New Workspace",
  "description": "Optional description",
  "icon_url": null,
  "user_id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 2.3 Update Workspace

**PUT** `/workspaces/:id`

Update workspace details.

**Request Body:**

```json
{
  "name": "Updated Workspace Name",
  "description": "Updated description"
}
```

**Response:**

```json
{
  "id": "uuid",
  "name": "Updated Workspace Name",
  "description": "Updated description",
  "icon_url": null,
  "user_id": "2d453dee-15b5-4ef0-98a6-b34c7d1cf073",
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 2.4 Delete Workspace

**DELETE** `/workspaces/:id`

Delete a workspace and all its contents.

**Response:**

```
Status: 204 No Content
(Empty response body)
```

---

## 3. PAGE ENDPOINTS (`/api/pages`)

**All endpoints require authentication.**

### 3.1 Get User Pages

**GET** `/pages`

Get all pages for the authenticated user.

**Response:**

```json
[
  {
    "id": "uuid",
    "title": "Page Title",
    "content": {},
    "workspace_id": "uuid",
    "parent_id": null,
    "icon_url": null,
    "cover_url": null,
    "summary": null,
    "summary_updated_at": null,
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z",
    "tags": []
  }
]
```

### 3.2 Get Workspace Pages

**GET** `/pages/workspace/:workspaceId`

Get all pages in a specific workspace.

**Response:**

```json
[
  {
    "id": "uuid",
    "title": "Page Title",
    "content": {},
    "workspace_id": "uuid",
    "parent_id": null,
    "icon_url": null,
    "cover_url": null,
    "summary": null,
    "summary_updated_at": null,
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z",
    "tags": [
      {
        "id": "tag-uuid",
        "name": "project",
        "color": "#FF5733"
      }
    ]
  }
]
```

### 3.3 Get Single Page

**GET** `/pages/:id`

Get a specific page by ID.

**Response:**

```json
{
  "id": "uuid",
  "title": "Page Title",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": null,
  "icon_url": null,
  "cover_url": null,
  "summary": null,
  "summary_updated_at": null,
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z",
  "tags": []
}
```

### 3.4 Get Page Children

**GET** `/pages/:id/children`

Get all child pages of a specific page with pagination.

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of children to return (default: 10)

**Response:**

```json
{
  "children": [
    {
      "id": "uuid",
      "title": "Child Page",
      "created_at": "2024-03-20T10:00:00.000Z",
      "updated_at": "2024-03-20T10:00:00.000Z",
      "icon_url": null,
      "cover_url": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

### 3.5 Get Page Backlinks

**GET** `/pages/:id/backlinks`

Get pages that link to this page.

**Response:**

```json
[
  {
    "id": "uuid",
    "title": "Linking Page",
    "content": {},
    "created_at": "2024-03-20T10:00:00.000Z",
    "updated_at": "2024-03-20T10:00:00.000Z"
  }
]
```

### 3.6 Create Page

**POST** `/pages`

Create a new page with automatic AI summary generation.

**Request Body:**

```json
{
  "title": "New Page Title",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": "uuid",
  "icon_url": "https://example.com/icon.png",
  "cover_url": "https://example.com/cover.jpg",
  "tags": ["tag-uuid-1", "tag-uuid-2"]
}
```

**Response:**

```json
{
  "id": "uuid",
  "title": "New Page Title",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": "uuid",
  "icon_url": "https://example.com/icon.png",
  "cover_url": "https://example.com/cover.jpg",
  "summary": null,
  "summary_updated_at": null,
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 3.7 Duplicate Page

**POST** `/pages/:id/duplicate`

Create a copy of a page including its content.

**Request Body:**

```json
{
  "title": "Copy of Original Page"
}
```

**Response:**

```json
{
  "id": "new-uuid",
  "title": "Copy of Original Page",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": "uuid",
  "icon_url": null,
  "cover_url": null,
  "summary": null,
  "summary_updated_at": null,
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 3.8 Move Page

**PATCH** `/pages/:id/move`

Move a page to a different parent.

**Request Body:**

```json
{
  "parent_id": "new-parent-uuid"
}
```

**Response:**

```json
{
  "id": "uuid",
  "title": "Moved Page",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": "new-parent-uuid",
  "icon_url": null,
  "cover_url": null,
  "summary": null,
  "summary_updated_at": null,
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 3.9 Update Page

**PUT** `/pages/:id`

Update a page with automatic summary regeneration if content changes.

**Request Body:**

```json
{
  "title": "Updated Page Title",
  "content": {},
  "icon_url": "https://example.com/new-icon.png",
  "cover_url": "https://example.com/new-cover.jpg"
}
```

**Response:**

```json
{
  "id": "uuid",
  "title": "Updated Page Title",
  "content": {},
  "workspace_id": "uuid",
  "parent_id": "uuid",
  "icon_url": "https://example.com/new-icon.png",
  "cover_url": "https://example.com/new-cover.jpg",
  "summary": null,
  "summary_updated_at": null,
  "created_at": "2024-03-20T10:00:00.000Z",
  "updated_at": "2024-03-20T10:00:00.000Z"
}
```

### 3.10 Delete Page

**DELETE** `/pages/:id`

Delete a page and all its subpages.

**Response:**

```
Status: 204 No Content
(Empty response body)
```

### 3.11 Generate Page Summary

**POST** `/pages/:id/summary`

Manually trigger AI summary generation for a page.

**Request Body:**

```json
{
  "force": false
}
```

**Response:**

```json
{
  "summary": "AI-generated summary of the page content...",
  "pageId": "uuid"
}
```

---

## 4. AI ENDPOINTS (`/api/ai`)

**All endpoints require authentication.**

**Note:** AI endpoint responses vary based on the specific functionality. These endpoints use validation middleware and may have different response structures.

### 4.1 AI Suggestions

**POST** `/ai/suggestions`

Get real-time AI content suggestions for writing assistance.

**Request Body:**

```json
{
  "context": "This is the surrounding text context...",
  "currentText": "The user is currently typing this",
  "pageId": "uuid",
  "workspaceId": "uuid"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.2 AI Link Suggestions

**POST** `/ai/link-suggestions`

Get intelligent link suggestions based on content analysis.

**Request Body:**

```json
{
  "text": "The text to analyze for link opportunities",
  "workspaceId": "uuid",
  "pageId": "uuid",
  "contextWindow": 100
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.3 Generate Tags

**POST** `/ai/generate-tags`

Generate semantic tags for page content using AI.

**Request Body:**

```json
{
  "title": "Page Title",
  "content": {},
  "workspaceId": "uuid"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.4 Summarize Content

**POST** `/ai/summarize`

Generate AI summary of page content.

**Request Body:**

```json
{
  "title": "Page Title",
  "content": {},
  "length": "medium"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.5 Complete Text

**POST** `/ai/complete`

AI-powered text completion for writing assistance.

**Request Body:**

```json
{
  "text": "The incomplete sentence or paragraph...",
  "context": "Additional context for better completion",
  "maxTokens": 150
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.6 Analyze Writing

**POST** `/ai/analyze`

Analyze writing quality and provide suggestions.

**Request Body:**

```json
{
  "text": "The text content to analyze for writing quality..."
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.7 Create Chat Conversation

**POST** `/ai/conversations`

Create a new AI chat conversation in a workspace.

**Request Body:**

```json
{
  "workspaceId": "uuid",
  "title": "New Chat",
  "userId": "uuid"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.8 Chat with RAG

**POST** `/ai/chat`

Send a question to the AI chatbot and get an answer based on workspace knowledge.

**Request Body:**

```json
{
  "question": "What is our product roadmap for 2024?",
  "conversationId": "uuid",
  "workspaceId": "uuid",
  "userId": "uuid"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.9 Get Conversation History

**GET** `/ai/conversations/:conversationId`

Retrieve the complete conversation history with messages and citations.

**Response:** _(Format determined by AI service implementation)_

### 4.10 Get Workspace Conversations

**GET** `/ai/conversations/workspace/:workspaceId`

Get all chat conversations in a workspace with pagination.

**Query Parameters:**

- `limit` (optional): Number of conversations (default: 20)
- `offset` (optional): Number to skip (default: 0)

**Response:** _(Format determined by AI service implementation)_

### 4.11 Delete Conversation

**DELETE** `/ai/conversations/:conversationId`

Delete a conversation and all its messages permanently.

**Response:** _(Format determined by AI service implementation)_

### 4.12 Update Conversation Title

**PATCH** `/ai/conversations/:conversationId/title`

Update the title of an existing conversation.

**Request Body:**

```json
{
  "title": "Updated Conversation Title"
}
```

**Response:** _(Format determined by AI service implementation)_

### 4.13 Generate Workspace Summaries

**POST** `/ai/workspace/:workspaceId/summaries`

Trigger batch summary generation for all pages in a workspace.

**Response:** _(Format determined by AI service implementation)_

### 4.14 Generate Workspace Embeddings

**POST** `/ai/workspace/:workspaceId/embeddings`

Generate embeddings for workspace pages.

**Response:** _(Format determined by AI service implementation)_

---

## 5. SEARCH ENDPOINTS (`/api/search`)

**All endpoints require authentication.**

### 5.1 Full-Text Search

**POST** `/search/text`

Perform full-text search across all pages in a workspace.

**Request Body:**

```json
{
  "query": "search term",
  "workspace_id": "uuid",
  "limit": 20,
  "offset": 0,
  "filters": {
    "parent_id": "uuid",
    "created_after": "2024-01-01",
    "created_before": "2024-12-31"
  }
}
```

**Response:** _(Format determined by search service implementation)_

### 5.2 Semantic Search

**POST** `/search/semantic`

Perform AI-powered semantic search using vector embeddings.

**Request Body:**

```json
{
  "query": "conceptual search query",
  "workspace_id": "uuid",
  "limit": 10,
  "threshold": 0.7
}
```

**Response:** _(Format determined by search service implementation)_

### 5.3 Search Suggestions

**GET** `/search/suggestions`

Get auto-complete suggestions for search queries.

**Query Parameters:**

- `q`: Partial search term
- `workspace_id`: UUID of the workspace
- `limit`: Number of suggestions (default: 5)

**Response:** _(Format determined by search service implementation)_

### 5.4 Find Similar Pages

**POST** `/search/similar/:id`

Find pages similar to a specific page using AI.

**Request Body:**

```json
{
  "limit": 5,
  "threshold": 0.6
}
```

**Response:** _(Format determined by search service implementation)_

### 5.5 Generate Embeddings

**POST** `/search/embeddings`

Generate or update vector embeddings for workspace pages.

**Request Body:**

```json
{
  "workspace_id": "uuid",
  "force_regenerate": false
}
```

**Response:** _(Format determined by search service implementation)_

---

## 6. UPLOAD ENDPOINTS (`/api/upload`)

**All endpoints require authentication.**

### 6.1 Upload Icon

**POST** `/upload/icon`

Upload an icon image (automatically resized to 280x280).

**Request:**

- Content-Type: multipart/form-data
- File field: `icon`
- Supported formats: PNG, JPG, JPEG, GIF, WEBP
- Max size: 5MB

**Response:** _(Format determined by upload service implementation)_

### 6.2 Upload Cover Image

**POST** `/upload/cover`

Upload a cover image (automatically resized to 1200x400).

**Request:**

- Content-Type: multipart/form-data
- File field: `cover`
- Supported formats: PNG, JPG, JPEG, GIF, WEBP
- Max size: 10MB

**Response:** _(Format determined by upload service implementation)_

### 6.3 Delete File

**DELETE** `/upload/:fileId`

Delete an uploaded file from storage.

**Response:** _(Format determined by upload service implementation)_

### 6.4 Generate Presigned URL

**POST** `/upload/presigned/:fileId`

Generate a presigned URL for direct file access.

**Request Body:**

```json
{
  "expires_in": 3600
}
```

**Response:** _(Format determined by upload service implementation)_

### 6.5 Get File Info

**GET** `/upload/:fileId`

Get metadata about an uploaded file.

**Response:** _(Format determined by upload service implementation)_

---

## 7. TAG ENDPOINTS (`/api/tags`)

**All endpoints require authentication.**

### 7.1 Get All Tags

**GET** `/tags`

Get all tags for the authenticated user.

**Response:** _(Format determined by tag service implementation)_

### 7.2 Create Tag

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

**Response:** _(Format determined by tag service implementation)_

### 7.3 Update Tag

**PUT** `/tags/:id`

Update an existing tag.

**Request Body:**

```json
{
  "name": "updated-tag",
  "color": "#33FF57"
}
```

**Response:** _(Format determined by tag service implementation)_

### 7.4 Delete Tag

**DELETE** `/tags/:id`

Delete a tag and remove it from all pages.

**Response:** _(Format determined by tag service implementation)_

---

## 8. AI SESSION ENDPOINTS (`/api/ai-sessions`)

**All endpoints require authentication.**

### 8.1 Get All AI Sessions

**GET** `/ai-sessions`

Get all AI sessions for the authenticated user.

**Response:** _(Format determined by AI session service implementation)_

### 8.2 Get AI Session

**GET** `/ai-sessions/:id`

Get a specific AI session by ID.

**Response:** _(Format determined by AI session service implementation)_

### 8.3 Create AI Session

**POST** `/ai-sessions`

Create a new AI session.

**Request Body:**

```json
{
  "title": "New AI Session",
  "type": "chat",
  "workspace_id": "uuid",
  "metadata": {}
}
```

**Response:** _(Format determined by AI session service implementation)_

### 8.4 Update AI Session

**PUT** `/ai-sessions/:id`

Update an existing AI session.

**Request Body:**

```json
{
  "title": "Updated AI Session Title",
  "metadata": {
    "updated_field": "value"
  }
}
```

**Response:** _(Format determined by AI session service implementation)_

### 8.5 Delete AI Session

**DELETE** `/ai-sessions/:id`

Delete an AI session permanently.

**Response:** _(Format determined by AI session service implementation)_

---

## Error Handling

### Standard Error Response Format

Errors are handled by the `AppError` middleware and typically return:

```json
{
  "message": "Error message describing what went wrong",
  "statusCode": 400
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created successfully
- **204**: No Content (for DELETE operations)
- **400**: Bad Request (validation error)
- **401**: Unauthorized (authentication required)
- **403**: Forbidden (access denied)
- **404**: Not Found
- **422**: Unprocessable Entity (validation failed)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

---

## Important Notes

1. **Authentication responses** use Supabase's standard format with `status: "success"`
2. **Most other endpoints** return data directly without wrapper objects
3. **DELETE operations** typically return `204 No Content` with empty body
4. **AI and service endpoints** may have custom response formats determined by their respective service implementations
5. **Error responses** use the `AppError` middleware format

---

This corrected API documentation now reflects the **ACTUAL** response formats used in the backend implementation.
