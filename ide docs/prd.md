---
description:
globs:
alwaysApply: false
---

# 🧠 Notion-Style Workspace Builder with AI Add-ons – PRD

## 📌 Overview

This project is a Notion-style workspace builder enhanced with AI features. It replicates the experience of [Notion](mdc:https:/www.notion.com) with key collaborative and productivity tools, real-time editing, and generative AI.

The reference clone is [jotion](mdc:https:/github.com/abdallaamin/jotion.git), but this implementation expands core functionality with smart AI features like auto-linking, knowledge graph generation, and a RAG-based Q&A chatbot.

---

## 🚀 Core Functional Features

### 📝 1. Notion-Style Block Editor

Powered by [BlockNote.js](mdc:https:/blocknotejs.org/docs)

- [x] Text formatting: headings (H1-H3), lists (bulleted, numbered, todo)
- [x] Markdown support: `**bold**`, `*italic*`, `` `code` ``, etc.
- [x] Drag-and-drop blocks
- [x] Block nesting and reordering
- [x] Code blocks with syntax highlighting
- [x] Toggle lists (collapsible)
- [x] Basic tables

---

### 🎨 2. User Experience

- [x] Page icons (280x280px)
- [x] Cover images (banners)
- [x] Typography themes: Serif, Sans, Mono
- [x] Dark/Light mode toggle
- [x] Callout blocks
  - Types: Warning, Tip, Note, Danger
  - Custom emoji/icons
  - Collapsible option

---

### 🔗 3. Cross-Linking

- [x] `@mention` system for pages and users
- [x] Automatic backlink generation
- [x] Link preview tooltip on hover

---

## 🤖 AI-Powered Add-ons (XL Package)

### ⚡ 1. Real-Time AI Collaboration

- [x] AI suggests content in-editor (e.g., sentence completion, refinements)
- [x] Interactive accept/reject for AI suggestions
- [x] Visual indication for AI-generated content

### 🔗 2. AI Auto-Linker

- [x] Context-aware link suggestions while typing
- [x] Confidence scores for suggestions
- [x] One-click to accept

### 🧠 3. Knowledge Graph

- [x] Automatically build graph of interlinked pages
- [x] React Flow for visualization
- [x] Interactive node-edge exploration

### 🏷️ 4. Auto Tag Generator

- [x] Generate semantic tags for each page
- [x] Store and associate multiple tags
- [x] Enhance search relevance via tag filtering

### 💬 5. RAG Chatbot

- [x] Natural language Q&A on workspace content
- [x] Citation of source documents
- [x] Streaming answers with LangChain + OpenAI
- [x] Conversation history per user

---

## 🧱 Tech Stack

### 🔧 Frontend

- React 18 + TypeScript
- MobX (state management)
- Mantine UI v6.0.21
- TanStack Query
- FontAwesome Icons
- BlockNoteJS (editor)
- React Flow (graph)
- React Split (resizable layout)
- react-router

### 🔩 Backend

- Node.js + Express
- Supabase (auth, DB, realtime)
- PostgreSQL + `pgvector`
- LangChain + OpenAI
- CORS, JWT, Morgan

---

## 🗃️ Data Model (Supabase)

### Tables

- `users` – Auth + profile info
- `workspaces` – Workspace containers
- `pages` – Page metadata & hierarchy
- `blocks` – JSON blob of content blocks
- `tags` – Auto-generated tags
- `page_tags` – Many-to-many link
- `ai_sessions` – Logs for AI interactions

---

## 🔐 Authentication Flow

1. User chooses Email/Password or Google
2. Redirect to Supabase auth provider
3. On success, return session token
4. Store in secure HTTP-only cookie
5. Use token for all authenticated API calls

---

## 🌐 Backend Routes

### 📄 Page Routes

- `POST /pages` – Create a page
- `GET /pages/:id` – Fetch page by ID
- `PUT /pages/:id` – Update content
- `DELETE /pages/:id` – Delete a page
- `GET /pages/:id/children` – List subpages
- `POST /search` – Search across pages

### 🧠 AI Routes

- `POST /ai/suggest` – Get in-editor AI suggestions
- `POST /ai/link` – Generate link suggestions
- `GET /ai/graph/:pageId` – Return knowledge graph data
- `POST /ai/tags` – Auto-generate semantic tags
- `POST /ai/chat` – RAG-based chatbot Q&A

---

## 🛠️ Implementation Roadmap

### Phase 1: Core Editor & Navigation

- [ ] Setup project, Supabase auth
- [ ] Integrate BlockNote editor
- [ ] Implement sidebar + navbar UI
- [ ] Add basic page CRUD endpoints
- [ ] Create a `todo.md` file and keep track of all tasks done
- [ ] Implement server logs that are written to a log file

### Phase 2: Enhanced UX

- [ ] Implement callouts, styling, icons, cover images
- [ ] Add cross-linking and backlinks
- [ ] Add tag management system

### Phase 3: AI Features

- [ ] Real-time AI suggestions in editor
- [ ] AI auto-linker and smart insert
- [ ] Generate React Flow knowledge graph
- [ ] Semantic tag generator (AI + classifier)
- [ ] Implement RAG chatbot with vector search

---

## 🧭 Component Architecture

Front end  
src/
├── components/
│ ├── editor/ # BlockNote wrapper
│ ├── sidebar/ # Navigation & tree
│ ├── navbar/ # Header + actions
│ ├── graph/ # React Flow visualization
│ ├── ai/ # Suggestion bar, Q&A
│ └── shared/ # Reusable elements
├── stores/ # MobX stores - auth-store,page-store,ui-store,chat-store,ai-link-store,graph-view-store
├── hooks/ # Custom hooks (e.g. useEditor, useAuth, useStore)
├── pages/ # Route entry points - protected / public pages - landing page etc ( minimal number of pages)
└── styles/ # Global styles (theme, layout)
└── types/ # All types.ts files ( interfaces,types etc)
└── utils/ # openai , chatservice , any other frontend utility service etc
└── assets/ images assets etc
└── App.tsx
└── Main.tsx

NOTE : [frontend_rules.md](mdc:notion-ai-clone/docs/frontend-rules.md) must be followed strictly.

## 📚 AI Implementation Details

### 🧠 Real-Time AI Suggestion

- Client emits debounced content to `/ai/suggest`
- Server uses LangChain to:
  - Analyze block context
  - Return suggestions
- UI shows floating bubble with "accept" / "reject"

### 🔗 Auto-Link Suggestions

- Analyze current text buffer
- Identify keywords/phrases
- Match against known pages
- Return suggestions with relevance scores

### 🧬 Knowledge Graph Generation

- Analyze workspace relationships + links
- Generate JSON of nodes and edges
- Render with React Flow (zoom, pan, select)

### 🧠 Auto Tags

- LangChain + OpenAI classifier
- Predict 3–5 tags per page
- Store in `tags` + `page_tags`

### 🤖 RAG Chatbot

1. Embed query with OpenAI
2. Vector similarity search in Supabase
3. Retrieve top relevant pages
4. Generate streaming answer with citations

---

## ✅ Deliverables

- Notion-style editor UI with drag-drop blocks
- Sidebar navigation with nesting
- Full CRUD on pages with Supabase
- Real-time AI helper suggestions
- Auto-link and tag generation
- Graph view of workspace
- Q&A chatbot with LangChain & RAG

- empty frontend and backend folders are already created for your reference.
  NOTE : ALL THE DB MIGRATION HAVE BE DONE FOR REMOTE DB AND WILL HAVE NAMING will start from 0001\_, 0002 etc in sequence
