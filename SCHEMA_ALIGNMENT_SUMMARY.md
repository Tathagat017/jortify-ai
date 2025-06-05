# Frontend-Backend Schema Alignment Summary

## Overview

This document summarizes the alignment between frontend TypeScript interfaces and the Supabase database schema.

## ✅ Schema Alignment Status: ALIGNED

### **Pages Table vs Frontend Page Interface**

| Field                | Frontend Type               | Database Type                    | Status     | Notes                                 |
| -------------------- | --------------------------- | -------------------------------- | ---------- | ------------------------------------- |
| `id`                 | `string`                    | `UUID`                           | ✅ Aligned | Primary key                           |
| `title`              | `string`                    | `TEXT NOT NULL`                  | ✅ Aligned |                                       |
| `user_id`            | `string`                    | `UUID NOT NULL`                  | ✅ Aligned | **ADDED to database**                 |
| `workspace_id`       | `string`                    | `UUID NOT NULL`                  | ✅ Aligned | Foreign key to workspaces             |
| `content`            | `PartialBlock[]?`           | `JSONB DEFAULT '[]'`             | ✅ Aligned | BlockNote content                     |
| `icon`               | `string?`                   | `TEXT`                           | ✅ Aligned | Emoji or text icon                    |
| `icon_url`           | `string?`                   | `TEXT`                           | ✅ Aligned | URL to icon image                     |
| `cover_image`        | `string?`                   | `TEXT`                           | ✅ Aligned | Cover image identifier                |
| `cover_url`          | `string?`                   | `TEXT`                           | ✅ Aligned | URL to cover image                    |
| `created_at`         | `string?`                   | `TIMESTAMP WITH TIME ZONE`       | ✅ Aligned |                                       |
| `updated_at`         | `string?`                   | `TIMESTAMP WITH TIME ZONE`       | ✅ Aligned | Auto-updated via trigger              |
| `is_deleted`         | `boolean?`                  | `BOOLEAN DEFAULT FALSE NOT NULL` | ✅ Aligned | **ADDED to database** for soft delete |
| `parent_id`          | `string \| null?`           | `UUID REFERENCES pages(id)`      | ✅ Aligned | For nested pages                      |
| `summary`            | `string \| null?`           | `TEXT`                           | ✅ Aligned | AI-generated summary                  |
| `summary_updated_at` | `string \| null?`           | `TIMESTAMP WITH TIME ZONE`       | ✅ Aligned | Auto-updated via trigger              |
| `tags`               | `Array<{id, name, color}>?` | Via `page_tags` junction         | ✅ Aligned | Many-to-many relationship             |

### **Workspaces Table vs Frontend Workspace Interface**

| Field         | Frontend Type | Database Type              | Status     | Notes                    |
| ------------- | ------------- | -------------------------- | ---------- | ------------------------ |
| `id`          | `string`      | `UUID`                     | ✅ Aligned | Primary key              |
| `name`        | `string`      | `TEXT NOT NULL`            | ✅ Aligned |                          |
| `description` | `string?`     | `TEXT`                     | ✅ Aligned |                          |
| `icon_url`    | `string?`     | `TEXT`                     | ✅ Aligned |                          |
| `cover_url`   | `string?`     | `TEXT`                     | ✅ Aligned | **ADDED to frontend**    |
| `user_id`     | `string`      | `UUID NOT NULL`            | ✅ Aligned | Owner of workspace       |
| `created_at`  | `string`      | `TIMESTAMP WITH TIME ZONE` | ✅ Aligned |                          |
| `updated_at`  | `string`      | `TIMESTAMP WITH TIME ZONE` | ✅ Aligned | Auto-updated via trigger |

### **Tags Table**

| Field          | Database Type              | Notes                     |
| -------------- | -------------------------- | ------------------------- |
| `id`           | `UUID`                     | Primary key               |
| `name`         | `TEXT NOT NULL`            | Tag name                  |
| `color`        | `TEXT`                     | Tag color                 |
| `workspace_id` | `UUID NOT NULL`            | Foreign key to workspaces |
| `created_at`   | `TIMESTAMP WITH TIME ZONE` |                           |

### **Page Tags Junction Table**

| Field     | Database Type | Notes                |
| --------- | ------------- | -------------------- |
| `page_id` | `UUID`        | Foreign key to pages |
| `tag_id`  | `UUID`        | Foreign key to tags  |

## Key Changes Made

### Database Schema Updates:

1. **Added `user_id` column to `pages` table** - Required by frontend interface
2. **Added `is_deleted` column to `pages` table** - For soft delete functionality
3. **Added indexes** for `user_id` and `is_deleted` columns for better query performance
4. **Updated RLS policies** to include user_id checks for better security

### Frontend Interface Updates:

1. **Added `cover_url` to Workspace interface** - To match database schema

## Row Level Security (RLS) Policies

### Pages Table Policies:

- Users can view pages they own OR pages in workspaces they own
- Users can create pages in their own workspaces (and must be the page owner)
- Users can update/delete pages they own OR pages in workspaces they own

### Workspaces Table Policies:

- Users can only access workspaces they own
- Full CRUD operations restricted to workspace owners

### Tags & Page Tags Policies:

- Users can manage tags in workspaces they own
- Page tag associations follow workspace ownership rules

## Soft Delete Implementation

The `is_deleted` column enables soft delete functionality:

- Default value: `FALSE`
- When a page is "deleted", `is_deleted` is set to `TRUE`
- Frontend filters out deleted pages in normal views
- Deleted pages can be restored by setting `is_deleted` back to `FALSE`
- Permanent deletion removes the record entirely

## Storage Buckets

Three storage buckets are configured:

1. `page-icons` - Public bucket for page icons
2. `page-covers` - Public bucket for page cover images
3. `user-uploads` - Private bucket for user file uploads

## Migration Status

✅ **Ready to run migration**: `0001_initial_core_schema_notion_ai_clone.sql`

The migration file is now fully aligned with the frontend interfaces and includes all necessary columns, indexes, and security policies.
