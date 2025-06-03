# 🧠 Notion AI Clone - Intelligent Workspace Builder
![image](https://github.com/user-attachments/assets/f9913097-e679-4ade-9738-fb9308a98d7a)

![image](https://github.com/user-attachments/assets/092ad574-dcc8-4126-ac66-3469454671ab)

![image](https://github.com/user-attachments/assets/e5d720da-a65c-48b0-a601-e8c471ce1cf2)

![image](https://github.com/user-attachments/assets/4b7aa8c6-e12f-404a-8cff-c7eaa4b0654e)

![image](https://github.com/user-attachments/assets/1d53f8f4-f80f-475f-bd32-f81e6c6b2e8d)

![image](https://github.com/user-attachments/assets/dba575ab-b78e-49f1-a4e2-fbff59008054)

![image](https://github.com/user-attachments/assets/ea08869a-b894-4eb7-8cfd-4dfb59288a68)

![image](https://github.com/user-attachments/assets/d40254cb-1fcc-44ea-afbb-ba666b969b88)

![image](https://github.com/user-attachments/assets/60c79a7f-a839-4284-ac16-ad9407d3323b)

![image](https://github.com/user-attachments/assets/623fbc2e-b4fd-4bd1-af9d-09d096e5e0b6)

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)

**A modern, AI-powered workspace builder that combines the familiarity of Notion with cutting-edge AI capabilities for intelligent content creation, organization, and discovery.**

[Features](#-features) • [Quick Start](#-quick-start) • [Architecture](#-architecture) • [API Documentation](#-api-documentation)

</div>

---

## 🚀 Unique Selling Propositions

### 🧠 **Context-Aware AI Ecosystem**

Unlike traditional Notion clones, this application creates a **self-improving knowledge base** where AI understands your workspace context, writing patterns, and content relationships to provide hyper-relevant assistance.

### 🔗 **Intelligent Content Interconnection**

Advanced RAG (Retrieval-Augmented Generation) system that automatically discovers and suggests relevant connections between your content, creating a living knowledge graph that evolves with your workspace.

### 🤖 **Multi-Modal AI Integration**

- **Real-time Writing Assistant**: Context-aware content suggestions while typing
- **Auto-Linking System**: Intelligent page connections with confidence scoring
- **Semantic Auto-Tagging**: AI-powered content categorization
- **RAG Chatbot**: Natural language queries against your entire workspace
- **Knowledge Graph Visualization**: Interactive network of content relationships

### 📚 **Vector-Powered Search & Discovery**

Semantic search using OpenAI embeddings and PostgreSQL's pgvector, enabling discovery of related content even when exact keywords don't match.

---

## ✨ Features

### 📝 **Core Workspace Features**

- **Rich Block Editor**: Powered by BlockNote.js with drag-and-drop functionality
- **Hierarchical Pages**: Nested page structure with parent-child relationships
- **Cross-Linking**: @mention system with automatic backlink generation
- **Rich Media Support**: Icons, cover images, callouts, code blocks, tables
- **Dark/Light Themes**: Multiple typography options (Serif, Sans, Mono)
- **File Attachments**: PDF/DOCX upload with content extraction

### 🤖 **AI-Powered Features**

- **Smart Content Suggestions**: Real-time AI writing assistance with accept/reject UI
- **Auto-Link Discovery**: Context-aware page linking with relevance scoring
- **Semantic Tagging**: Automatic tag generation based on content analysis
- **Knowledge Graph**: Visual representation of content relationships
- **RAG Chatbot**: Conversational AI that answers questions using workspace content
- **Document Intelligence**: Extract and embed content from uploaded files

### 🔍 **Search & Discovery**

- **Vector Search**: Semantic search across all content
- **Tag-based Filtering**: Organize and find content by auto-generated tags
- **Graph Navigation**: Explore content relationships visually
- **Chat History**: Persistent conversation threads with AI assistant

### 🔐 **Security & Authentication**

- **Supabase Auth**: Email/password and OAuth integration
- **Row-Level Security**: Workspace-based access control
- **JWT Token Management**: Secure session handling
- **CORS Protection**: Cross-origin request security

---

## 🏗 Architecture Overview

### **System Architecture Pattern: Layered + Domain-Driven Design**

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                                │
│  React 18 + TypeScript + MobX + Mantine UI + BlockNote.js     │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/REST APIs
┌─────────────────────────▼───────────────────────────────────────┐
│                   API GATEWAY LAYER                             │
│     Express.js + Middleware Stack + CORS + Rate Limiting       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                 BUSINESS LOGIC LAYER                            │
│         Controllers → Services → Domain Logic                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    DATA ACCESS LAYER                            │
│              Supabase Client + pgvector + Redis                │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│    PostgreSQL + Supabase Storage + OpenAI + LangChain         │
└─────────────────────────────────────────────────────────────────┘
```

### **Design Patterns Implemented**

| Pattern                  | Purpose                            | Implementation                         |
| ------------------------ | ---------------------------------- | -------------------------------------- |
| **Layered Architecture** | Separation of concerns             | Routes → Controllers → Services → Data |
| **Service Layer**        | Business logic encapsulation       | Domain-specific service classes        |
| **Repository Pattern**   | Data access abstraction            | Supabase client as unified data layer  |
| **Observer Pattern**     | Reactive state management          | MobX stores + database triggers        |
| **Factory Pattern**      | AI service instantiation           | Dynamic model selection                |
| **Strategy Pattern**     | Different AI processing approaches | Multiple embedding strategies          |

---

## 🗄️ Database Design

### **Technology Stack**

- **Database**: PostgreSQL with Supabase
- **Vector Storage**: pgvector extension for embeddings
- **Real-time**: Supabase real-time subscriptions
- **File Storage**: Supabase Storage for file attachments

### **Core Tables & Relationships**

#### **Content Hierarchy**

```sql
WORKSPACES (Container for all user content)
├── PAGES (Hierarchical content structure)
│   ├── PAGE_EMBEDDINGS (Vector representations)
│   ├── PAGE_TAGS (Many-to-many with TAGS)
│   ├── PAGE_FILES (File attachments)
│   └── AI_SESSIONS (AI interaction logs)
└── TAGS (Semantic categorization)
```

#### **AI & Chat System**

```sql
CHAT_CONVERSATIONS (User chat sessions)
├── CHAT_MESSAGES (Individual messages)
└── Related to PAGE_EMBEDDINGS (RAG context)

FILE_EMBEDDINGS (Chunked file content vectors)
└── Associated with PAGE_FILES
```

#### **Key Schema Features**

- **Vector Similarity**: pgvector enables semantic search
- **Hierarchical Structure**: Self-referencing pages for nested content
- **Audit Trail**: Created/updated timestamps on all entities
- **Soft Deletes**: Archived field for content recovery
- **RLS Security**: Row-level security for multi-tenant isolation

---

## 🔧 Backend Architecture

### **Service Layer Pattern: "Domain-Driven Service Architecture"**

#### **Core Services**

| Service                  | Responsibility                    | Key Features                                 |
| ------------------------ | --------------------------------- | -------------------------------------------- |
| **AIService**            | Content suggestions & completions | OpenAI integration, context building         |
| **EmbeddingService**     | Vector generation & management    | Text-to-vector conversion, similarity search |
| **RAGChatService**       | Conversational AI with context    | Vector retrieval + LLM generation            |
| **SummaryService**       | Content summarization             | Page summaries, title generation             |
| **TagService**           | Semantic tagging                  | AI-powered tag generation                    |
| **FileEmbeddingService** | Document processing               | PDF/DOCX parsing, chunking, embedding        |
| **PageService**          | Content CRUD operations           | Page management, hierarchy handling          |
| **AuthService**          | Authentication & authorization    | Supabase auth integration                    |

#### **Service Communication Pattern**

```
Controller Layer (HTTP handling)
    ↓ Dependency Injection
Service Layer (Business logic)
    ↓ Repository Pattern
Data Layer (Supabase client)
    ↓ Database Operations
PostgreSQL + pgvector
```

### **AI Integration Architecture**

#### **Vector Processing Pipeline**

1. **Content Extraction**: Parse BlockNote JSON → Plain text
2. **Chunking**: Split large content into manageable pieces
3. **Embedding**: OpenAI text-embedding-ada-002 (1536 dimensions)
4. **Storage**: pgvector for similarity operations
5. **Retrieval**: Vector similarity search for RAG

#### **RAG (Retrieval-Augmented Generation) Flow**

1. **Query Processing**: User question → vector embedding
2. **Similarity Search**: Find relevant content chunks
3. **Context Building**: Compile relevant documents
4. **Generation**: OpenAI with enhanced context
5. **Response**: Streaming answer with source citations

---

## 🎨 Frontend Architecture

### **State Management: MobX + React Query Hybrid**

#### **Store Architecture**

```typescript
StoreContext (Provider)
├── AuthStore (User authentication state)
├── PageStore (Content & hierarchy management)
├── UIStore (Interface state & themes)
├── ChatStore (AI conversations)
├── TagStore (Tag management & suggestions)
├── SearchStore (Search functionality)
└── GraphStore (Knowledge graph data)
```

#### **Component Architecture**

```
Pages (Route components)
├── Components
│   ├── Editor (BlockNote integration)
│   ├── Sidebar (Navigation & hierarchy)
│   ├── AI (Suggestions, chat, auto-linking)
│   ├── Graph (React Flow visualization)
│   └── Shared (Reusable UI components)
├── Hooks (Custom logic abstraction)
├── Services (API communication)
└── Utils (Helper functions)
```

### **Key Frontend Patterns**

| Pattern                      | Purpose                | Implementation                     |
| ---------------------------- | ---------------------- | ---------------------------------- |
| **Container/Presentational** | UI logic separation    | Smart containers + dumb components |
| **Custom Hooks**             | Logic reuse            | useEditor, useAuth, useStore       |
| **Provider Pattern**         | Global state access    | Store context providers            |
| **Render Props**             | Component flexibility  | Editor plugins, AI suggestions     |
| **Higher-Order Components**  | Cross-cutting concerns | Auth protection, error boundaries  |

---

## 🚀 Quick Start

### **Prerequisites**

- Node.js >= 18.0.0
- npm >= 8.0.0
- Git
- Supabase account
- OpenAI API key

### **1. Clone & Install**

```bash
git clone <repository-url>
cd notion-ai-clone

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### **2. Environment Setup**

#### **Backend Environment (.env)**

```env
# Database
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# AI Services
OPENAI_API_KEY=your_openai_api_key
LANGCHAIN_API_KEY=your_langchain_api_key

# Server Configuration
PORT=3001
NODE_ENV=development
JWT_SECRET=your_jwt_secret

# CORS
FRONTEND_URL=http://localhost:5173
```

#### **Frontend Environment (.env)**

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_BASE_URL=http://localhost:3001
```

### **3. Database Setup**

```bash
cd backend
npm run db:migrate  # Run Supabase migrations
npm run db:seed     # Optional: Add sample data
```

### **4. Start Development Servers**

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### **5. Access the Application**

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- API Documentation: http://localhost:3001/api-docs

---

## 📦 Dependencies

### **Backend Dependencies**

#### **Core Framework**

- `express`: Web application framework
- `cors`: Cross-origin resource sharing
- `helmet`: Security middleware
- `morgan`: HTTP request logging
- `compression`: Response compression

#### **Database & Auth**

- `@supabase/supabase-js`: Supabase client
- `jsonwebtoken`: JWT token handling
- `bcryptjs`: Password hashing

#### **AI & ML**

- `openai`: OpenAI API integration
- `langchain`: LLM orchestration framework
- `tiktoken`: Token counting for AI models
- `pdf-parse`: PDF content extraction
- `mammoth`: DOCX content extraction

#### **Utilities**

- `joi`: Schema validation
- `uuid`: UUID generation
- `lodash`: Utility functions
- `axios`: HTTP client

### **Frontend Dependencies**

#### **Core Framework**

- `react`: UI library (v18.2.0)
- `react-dom`: React DOM rendering
- `react-router-dom`: Client-side routing
- `typescript`: Type safety

#### **State Management**

- `mobx`: Reactive state management
- `mobx-react-lite`: MobX React integration
- `@tanstack/react-query`: Server state management

#### **UI Framework**

- `@mantine/core`: Component library (v6.0.21)
- `@mantine/hooks`: Utility hooks
- `@mantine/notifications`: Toast notifications
- `@mantine/modals`: Modal dialogs

#### **Editor & Visualization**

- `@blocknote/core`: Block-based editor
- `@blocknote/react`: React integration
- `reactflow`: Knowledge graph visualization
- `react-split`: Resizable layouts

#### **AI & Communication**

- `@supabase/supabase-js`: Supabase client
- `axios`: API communication
- `react-markdown`: Markdown rendering

---

## 🛠 Development

### **Available Scripts**

#### **Backend**

```bash
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server
npm run test         # Run test suite
npm run db:migrate   # Run database migrations
npm run db:reset     # Reset database
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

#### **Frontend**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run test         # Run test suite
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

### **Code Quality Tools**

- **ESLint**: Code linting with custom rules
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Husky**: Git hooks for quality gates
- **Jest**: Unit testing framework

---

## 📚 API Documentation

### **Core Endpoints**

#### **Authentication**

```
POST   /auth/login              # User login
POST   /auth/register           # User registration
POST   /auth/logout             # User logout
GET    /auth/me                 # Get current user
```

#### **Pages**

```
GET    /pages                   # List user pages
POST   /pages                   # Create new page
GET    /pages/:id               # Get page by ID
PUT    /pages/:id               # Update page
DELETE /pages/:id               # Delete page
GET    /pages/:id/children      # Get child pages
```

#### **AI Features**

```
POST   /ai/suggest              # Get content suggestions
POST   /ai/auto-link            # Get link suggestions
POST   /ai/generate-tags        # Generate tags for page
GET    /ai/graph/:pageId        # Get knowledge graph data
POST   /ai/chat                 # RAG chatbot interaction
```

#### **Search & Discovery**

```
POST   /search                  # Vector-powered search
GET    /tags                    # List all tags
GET    /tags/:id/pages          # Pages with specific tag
```

### **WebSocket Events**

```
page:updated         # Real-time page updates
ai:suggestion        # Live AI suggestions
chat:message         # Chat message updates
```

---

## 🔒 Security

### **Authentication & Authorization**

- **JWT Tokens**: Secure session management
- **Row-Level Security**: Supabase RLS for data isolation
- **CORS Protection**: Configured for specific origins
- **Rate Limiting**: API endpoint protection
- **Input Validation**: Joi schema validation

### **Data Protection**

- **Encrypted Storage**: Supabase handles encryption at rest
- **HTTPS Only**: All production traffic encrypted
- **API Key Security**: Environment variable management
- **SQL Injection Protection**: Parameterized queries

---

## 🚀 Deployment

### **Production Setup**

#### **Backend Deployment**

```bash
# Build the application
npm run build

# Set production environment variables
export NODE_ENV=production
export PORT=3001

# Start the server
npm start
```

#### **Frontend Deployment**

```bash
# Build for production
npm run build

# The dist/ folder contains the built application
# Deploy to your preferred hosting service
```

### **Environment Configuration**

- **Database**: Supabase production instance
- **AI Services**: OpenAI production API keys
- **Storage**: Supabase Storage for file uploads
- **Monitoring**: Application logging and error tracking

---

## 🤝 Contributing

### **Development Workflow**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding standards
4. Write tests for new functionality
5. Run the test suite (`npm test`)
6. Commit changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### **Coding Standards**

- Follow TypeScript strict mode
- Use ESLint and Prettier configurations
- Write comprehensive JSDoc comments
- Maintain test coverage above 80%
- Follow conventional commit messages

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **BlockNote.js** - Powerful block-based editor
- **Supabase** - Backend-as-a-Service platform
- **OpenAI** - AI language models
- **LangChain** - LLM application framework
- **Mantine** - React components library
- **React Flow** - Node-based graph visualization

---

---

<div align="center">

**Built with ❤️ by Tathagat for the future of intelligent workspaces**

[⬆ Back to Top](#-notion-ai-clone---intelligent-workspace-builder)

</div>
