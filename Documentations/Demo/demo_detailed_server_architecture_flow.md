# Server Architecture Detailed Flow Documentation

## Database Schema Usage

### Core Infrastructure Tables

**users**

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    full_name TEXT,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);
```

- `password_hash`: Bcrypt hashed password for authentication
- `email_verified`: Email verification status for security
- `last_login`: Session tracking and analytics

**workspaces**

```sql
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

- `owner_id`: Workspace ownership for access control
- `settings`: Workspace-specific configuration (theme, permissions, etc.)

**workspace_members**

```sql
CREATE TABLE workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    permissions JSONB DEFAULT '{}',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(workspace_id, user_id)
);
```

- `role`: Hierarchical permission system
- `permissions`: Granular permission overrides

## Detailed Step-by-Step Flow

### Step 1: Server Initialization and Middleware Stack

**Express Server Setup:**

```typescript
// src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://api.openai.com", "wss://"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
const corsOptions = {
  origin:
    process.env.NODE_ENV === "production"
      ? ["https://yourdomain.com"]
      : ["http://localhost:3000", "http://localhost:5173"],
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Body parsing and compression
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
app.use(morgan("combined"));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});
```

### Step 2: Authentication Middleware

**JWT Authentication:**

```typescript
// src/middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: "Access token required" });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;

    // Get user from database
    const { data: user, error } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("id", decoded.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Update last login
    await supabase
      .from("users")
      .update({ last_login: new Date().toISOString() })
      .eq("id", user.id);

    req.user = user;
    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

// Workspace access middleware
export const checkWorkspaceAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("role, permissions")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (!membership) {
      return res.status(403).json({ error: "Access denied to workspace" });
    }

    req.user!.role = membership.role;
    next();
  } catch (error) {
    console.error("Workspace access error:", error);
    return res.status(500).json({ error: "Failed to verify workspace access" });
  }
};
```

### Step 3: Route Organization and Controller Pattern

**Route Registration:**

```typescript
// src/routes/index.ts
import { Router } from "express";
import authRoutes from "./auth.routes";
import pageRoutes from "./page.routes";
import aiRoutes from "./ai.routes";
import workspaceRoutes from "./workspace.routes";
import searchRoutes from "./search.routes";
import { authenticateToken } from "../middleware/auth.middleware";

const router = Router();

// Public routes
router.use("/auth", authRoutes);

// Protected routes
router.use("/pages", authenticateToken, pageRoutes);
router.use("/ai", authenticateToken, aiRoutes);
router.use("/workspaces", authenticateToken, workspaceRoutes);
router.use("/search", authenticateToken, searchRoutes);

export default router;
```

**Page Routes Example:**

```typescript
// src/routes/page.routes.ts
import { Router } from "express";
import { PageController } from "../controllers/page.controller";
import { checkWorkspaceAccess } from "../middleware/auth.middleware";
import { validatePageData } from "../middleware/validation.middleware";

const router = Router();

// Get all pages in workspace
router.get(
  "/workspace/:workspaceId",
  checkWorkspaceAccess,
  PageController.getWorkspacePages
);

// Get single page
router.get("/:pageId", PageController.getPage);

// Create new page
router.post(
  "/workspace/:workspaceId",
  checkWorkspaceAccess,
  validatePageData,
  PageController.createPage
);

// Update page
router.put("/:pageId", validatePageData, PageController.updatePage);

// Delete page
router.delete("/:pageId", PageController.deletePage);

export default router;
```

### Step 4: Controller Implementation

**Page Controller:**

```typescript
// src/controllers/page.controller.ts
import { Request, Response } from "express";
import { PageService } from "../services/page.service";
import { EmbeddingService } from "../services/embedding.service";

export class PageController {
  static async getWorkspacePages(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const userId = req.user!.id;

      const pages = await PageService.getWorkspacePages(workspaceId, userId);

      res.json({
        success: true,
        pages,
        count: pages.length,
      });
    } catch (error) {
      console.error("Get workspace pages error:", error);
      res.status(500).json({ error: "Failed to fetch pages" });
    }
  }

  static async createPage(req: Request, res: Response) {
    try {
      const { workspaceId } = req.params;
      const { title, content, parentId } = req.body;
      const userId = req.user!.id;

      // Create page
      const page = await PageService.createPage({
        workspaceId,
        title,
        content,
        parentId,
        createdBy: userId,
      });

      // Generate embedding asynchronously
      EmbeddingService.generatePageEmbedding(page.id, content).catch((error) =>
        console.error("Embedding generation failed:", error)
      );

      res.status(201).json({
        success: true,
        page,
      });
    } catch (error) {
      console.error("Create page error:", error);
      res.status(500).json({ error: "Failed to create page" });
    }
  }

  static async updatePage(req: Request, res: Response) {
    try {
      const { pageId } = req.params;
      const { title, content } = req.body;
      const userId = req.user!.id;

      // Check page ownership/permissions
      const hasPermission = await PageService.checkPagePermission(
        pageId,
        userId
      );
      if (!hasPermission) {
        return res.status(403).json({ error: "Permission denied" });
      }

      // Update page
      const updatedPage = await PageService.updatePage(pageId, {
        title,
        content,
        lastEditedBy: userId,
      });

      // Update embedding if content changed
      if (content) {
        EmbeddingService.updatePageEmbedding(pageId, content).catch((error) =>
          console.error("Embedding update failed:", error)
        );
      }

      res.json({
        success: true,
        page: updatedPage,
      });
    } catch (error) {
      console.error("Update page error:", error);
      res.status(500).json({ error: "Failed to update page" });
    }
  }
}
```

### Step 5: Service Layer Implementation

**Page Service:**

```typescript
// src/services/page.service.ts
import { supabase } from "../config/supabase";

export class PageService {
  static async getWorkspacePages(workspaceId: string, userId: string) {
    const { data: pages, error } = await supabase
      .from("pages")
      .select(
        `
        id, title, content, parent_id, created_at, updated_at,
        created_by, last_edited_by,
        page_tags(
          tags(id, name, color)
        )
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("is_deleted", false)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch pages: ${error.message}`);
    }

    return pages || [];
  }

  static async createPage(pageData: CreatePageData) {
    const { data: page, error } = await supabase
      .from("pages")
      .insert({
        workspace_id: pageData.workspaceId,
        title: pageData.title,
        content: pageData.content || {},
        parent_id: pageData.parentId,
        created_by: pageData.createdBy,
        last_edited_by: pageData.createdBy,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create page: ${error.message}`);
    }

    return page;
  }

  static async updatePage(pageId: string, updates: UpdatePageData) {
    const { data: page, error } = await supabase
      .from("pages")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pageId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update page: ${error.message}`);
    }

    return page;
  }

  static async checkPagePermission(
    pageId: string,
    userId: string
  ): Promise<boolean> {
    const { data: page } = await supabase
      .from("pages")
      .select(
        `
        workspace_id,
        workspaces!inner(
          workspace_members!inner(user_id, role)
        )
      `
      )
      .eq("id", pageId)
      .eq("workspaces.workspace_members.user_id", userId)
      .single();

    return !!page;
  }
}
```

### Step 6: Database Connection and Configuration

**Supabase Configuration:**

```typescript
// src/config/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase configuration");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
  db: {
    schema: "public",
  },
});

// Database health check
export const checkDatabaseConnection = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.from("users").select("id").limit(1);

    return !error;
  } catch (error) {
    console.error("Database connection failed:", error);
    return false;
  }
};
```

### Step 7: Error Handling and Logging

**Global Error Handler:**

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  // Log error details
  console.error("Error occurred:", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // Don't leak error details in production
  const response = {
    error:
      process.env.NODE_ENV === "production" ? "Something went wrong" : message,
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  };

  res.status(statusCode).json(response);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### Step 8: Validation Middleware

**Request Validation:**

```typescript
// src/middleware/validation.middleware.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";

const pageSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  content: Joi.object().optional(),
  parentId: Joi.string().uuid().optional().allow(null),
});

export const validatePageData = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { error } = pageSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.details.map((detail) => detail.message),
    });
  }

  next();
};

// Generic validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.details.map((detail) => detail.message),
      });
    }

    next();
  };
};
```

### Step 9: Environment Configuration

**Environment Variables:**

```typescript
// src/config/environment.ts
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || "development",

  // Database
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,

  // Authentication
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",

  // AI Services
  openaiApiKey: process.env.OPENAI_API_KEY!,

  // External Services
  tavilyApiKey: process.env.TAVILY_API_KEY,

  // Security
  corsOrigins: process.env.CORS_ORIGINS?.split(",") || [
    "http://localhost:3000",
  ],
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || "100"),
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || "900000"), // 15 minutes
};

// Validate required environment variables
const requiredEnvVars = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "JWT_SECRET",
  "OPENAI_API_KEY",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
```

### Step 10: Server Startup and Graceful Shutdown

**Application Bootstrap:**

```typescript
// src/index.ts (continued)
import { checkDatabaseConnection } from "./config/supabase";
import { errorHandler } from "./middleware/error.middleware";
import routes from "./routes";

// Register routes
app.use("/api", routes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
const gracefulShutdown = (signal: string) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
const startServer = async () => {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      throw new Error("Database connection failed");
    }
    console.log("✅ Database connected successfully");

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    });

    return server;
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
```

## Key Packages Used

**Core Framework:**

- `express`: Web application framework
- `cors`: Cross-origin resource sharing
- `helmet`: Security headers middleware
- `compression`: Response compression

**Authentication & Security:**

- `jsonwebtoken`: JWT token handling
- `bcryptjs`: Password hashing
- `express-rate-limit`: Rate limiting
- `joi`: Request validation

**Database & External Services:**

- `@supabase/supabase-js`: Database client
- `openai`: AI service integration
- `dotenv`: Environment variable management

**Utilities:**

- `morgan`: HTTP request logging
- `uuid`: Unique identifier generation

## Performance Optimizations

**Middleware Optimization:**

- Compression for response size reduction
- Rate limiting to prevent abuse
- Request size limits to prevent DoS attacks

**Database Optimization:**

- Connection pooling through Supabase
- Prepared statements for security and performance
- Async operations to prevent blocking

**Error Handling:**

- Centralized error handling
- Graceful shutdown procedures
- Health check endpoints for monitoring

**Security Measures:**

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Security headers with Helmet
