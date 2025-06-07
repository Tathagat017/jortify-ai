# Server Express Architecture Technical Documentation

## 1. Tech Stack

### Backend Core

- **Express.js** - Web framework for Node.js
- **TypeScript** - Type-safe JavaScript development
- **Supabase** - PostgreSQL database with real-time capabilities
- **Node.js** - JavaScript runtime environment

### Middleware & Security

- **Helmet** - Security headers middleware
- **CORS** - Cross-origin resource sharing
- **Morgan** - HTTP request logger
- **Express Rate Limit** - API rate limiting
- **Joi** - Data validation middleware

### Database & Storage

- **PostgreSQL** - Primary database with pgvector extension
- **Supabase Client** - Database ORM and real-time subscriptions
- **UUID Extension** - Unique identifier generation

## 2. Feature Flow

### Server Initialization Flow

#### Backend Components

1. **[Server Entry]** `backend/src/index.ts` - Application bootstrap
2. **[Middleware Stack]** Security, logging, CORS, rate limiting setup
3. **[Route Mounting]** API endpoints organization
4. **[Database Connection]** Supabase client initialization
5. **[Error Handling]** Global error handling middleware

### Detailed Sequence Steps

1. **Environment Configuration**

   - Load environment variables from `.env`
   - Validate required API keys (OpenAI, Supabase, Tavily)
   - Set up configuration object for different environments

2. **Express App Initialization**

   - Create Express application instance
   - Configure JSON parsing middleware
   - Set up security headers via Helmet

3. **CORS Configuration**

   - Allow cross-origin requests from frontend
   - Configure allowed methods and headers
   - Set credentials and exposed headers

4. **Rate Limiting Setup**

   - Apply rate limiting (disabled in test environment)
   - Configure window size and maximum requests
   - Log rate limiting status

5. **Route Registration**

   - Mount all API routes under `/api` prefix
   - Organize routes by feature domains
   - Apply authentication middleware where needed

6. **Error Handling**

   - Register global error handler
   - Handle uncaught exceptions
   - Provide structured error responses

7. **Server Startup**
   - Listen on configured port
   - Initialize help content service
   - Log startup information

### Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│                   CLIENT                        │
│              (React Frontend)                   │
└─────────────────┬───────────────────────────────┘
                  │ HTTP/HTTPS Requests
                  ▼
┌─────────────────────────────────────────────────┐
│                MIDDLEWARE STACK                 │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │   Helmet    │    CORS     │   Rate Limit    ││
│  │ (Security)  │ (Cross-Ori) │ (API Limits)    ││
│  └─────────────┼─────────────┼─────────────────┘│
│                │             │                  │
│  ┌─────────────┴─────────────┴─────────────────┐│
│  │          Morgan (Logging)                   ││
│  └─────────────┬─────────────────────────────────┘│
└────────────────┼─────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────┐
│                ROUTE LAYER                      │
│  /api/auth      /api/ai       /api/pages        │
│  /api/search    /api/upload   /api/workspaces   │
│  /api/tags      /api/documents                  │
└─────────────────┬───────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────┐
│              CONTROLLER LAYER                   │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │     AI      │   Page      │    Search       ││
│  │ Controller  │ Controller  │  Controller     ││
│  └─────────────┼─────────────┼─────────────────┘│
└────────────────┼─────────────┼─────────────────┘
                 ▼             ▼
┌─────────────────────────────────────────────────┐
│               SERVICE LAYER                     │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │ AI Service  │ RAG Chat    │  Embedding      ││
│  │ Summary     │ Service     │  Service        ││
│  │ Service     │             │                 ││
│  └─────────────┼─────────────┼─────────────────┘│
└────────────────┼─────────────┼─────────────────┘
                 ▼             ▼
┌─────────────────────────────────────────────────┐
│              DATABASE LAYER                     │
│  ┌─────────────┬─────────────┬─────────────────┐│
│  │  Supabase   │ PostgreSQL  │   pgvector      ││
│  │  Client     │ Database    │  (Embeddings)   ││
│  └─────────────┴─────────────┴─────────────────┘│
└─────────────────────────────────────────────────┘
```

## 3. Technical Details

### Key Packages

- **express**: Web framework for building REST APIs
- **@supabase/supabase-js**: Database client for PostgreSQL operations
- **helmet**: Security middleware for HTTP headers
- **cors**: Configurable CORS middleware
- **morgan**: HTTP request logging middleware
- **express-rate-limit**: Rate limiting middleware
- **joi**: Schema-based data validation
- **dotenv**: Environment variable management
- **winston**: Logging library (via custom logger utility)

### Database Schema

**Core Tables:**

- `workspaces`: User workspace containers
- `pages`: Content pages with JSONB content
- `tags`: Semantic tags for organization
- `page_tags`: Many-to-many relationship
- `page_embeddings`: Vector embeddings for semantic search
- `chat_conversations`: RAG chatbot conversations
- `chat_messages`: Individual chat messages with citations
- `ai_sessions`: AI interaction logging
- `help_content`: Documentation chunks for help mode

### Middleware Configuration

**Security Middleware (Helmet):**

```typescript
app.use(helmet()); // Sets security headers
```

**CORS Configuration:**

```typescript
const corsOptions = {
  origin: "*", // Allow all origins in development
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
};
```

**Rate Limiting:**

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
});
```

### Route Organization

**Route Structure:**

```
/api
├── /auth           → Authentication endpoints
├── /workspaces     → Workspace management
├── /pages          → Page CRUD operations
├── /tags           → Tag management
├── /search         → Semantic search
├── /upload         → File upload handling
├── /ai             → AI features (suggestions, tags, etc.)
├── /ai-sessions    → AI session management
└── /documents      → Document processing
```

### Error Handling

**Global Error Handler:**

```typescript
app.use(errorHandler); // Custom error handling middleware
```

**Error Response Format:**

```json
{
  "error": "Error message",
  "status": 400,
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/endpoint"
}
```

### Authentication Flow

1. **JWT Token Validation** via auth middleware
2. **User Context Injection** into request object
3. **Row Level Security** enforcement in database
4. **Permission Checking** based on workspace ownership

### Optimizations

- **Connection Pooling**: Supabase handles connection pooling automatically
- **Middleware Ordering**: Security first, then logging, then business logic
- **Rate Limiting**: Prevents API abuse and ensures fair usage
- **Error Logging**: Comprehensive error tracking for debugging
- **Environment-Based Configuration**: Different settings for dev/test/prod

## 4. Terminology Explained

### MVC Architecture

The Model-View-Controller pattern where:

- **Models** are represented by database tables and schemas
- **Views** are the JSON API responses
- **Controllers** handle HTTP requests and coordinate business logic

### Middleware Stack

Sequential processing layers that handle cross-cutting concerns like security, logging, and validation before reaching business logic.

### Route Mounting

The process of organizing API endpoints into logical groups and attaching them to specific URL paths with common middleware.

### Service Layer Pattern

Business logic is separated into service classes that can be reused across multiple controllers, promoting code reusability and testability.

### Row Level Security (RLS)

Database-level security that automatically filters data based on user permissions, ensuring users can only access their own data.

### Dependency Injection

Services and utilities are imported and used by controllers, allowing for better testing and modularity.

---

## Important Implementation Notes

- **Environment Variables**: All sensitive configuration (API keys, database URLs) is stored in environment variables
- **Type Safety**: Full TypeScript implementation with strict typing for better development experience
- **Error Boundaries**: Comprehensive error handling at all layers with proper HTTP status codes
- **Logging Strategy**: Structured logging with different levels (info, warn, error) for better monitoring
- **Security First**: Multiple layers of security including CORS, rate limiting, and authentication
- **Scalable Architecture**: Clear separation of concerns allows for easy feature additions and modifications
