import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import { logger } from "../src/utils/logger";
import { errorHandler } from "../src/middleware/error-handler";
import { routes } from "../src/routes";
import { config } from "../src/config";

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Initialize Supabase client
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
  })
);

// Simple and effective CORS setup for Vercel
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // Allow specific origins and all for development
  const allowedOrigins = [
    "https://jortify-ai.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://localhost:5174",
  ];

  if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || "*");
  } else {
    res.header("Access-Control-Allow-Origin", origin); // Allow all for now
  }

  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin,X-Requested-With,Content-Type,Accept,Authorization,X-API-Key,Cache-Control"
  );
  res.header("Access-Control-Max-Age", "86400");
  res.header("Vary", "Origin");

  // Handle preflight requests immediately
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin}`);
  next();
});

app.use(morgan("dev"));

// Rate limiting - skip for test environment
if (config.nodeEnv !== "test") {
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
  });
  app.use(limiter);
  logger.info(
    `Rate limiting enabled: ${config.rateLimit.max} requests per ${
      config.rateLimit.windowMs / 1000 / 60
    } minutes`
  );
} else {
  logger.info("Rate limiting disabled for test environment");
}

app.get("/", (req, res) => {
  res.status(200).send("Welcome to the API");
});

// Handle preflight for all routes
app.options("*", (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// CORS test endpoint
app.get("/cors-test", (req, res) => {
  res.status(200).json({
    message: "CORS test successful",
    origin: req.headers.origin,
    method: req.method,
    path: req.path,
    corsHeaders: {
      "access-control-allow-origin": res.getHeader(
        "Access-Control-Allow-Origin"
      ),
      "access-control-allow-credentials": res.getHeader(
        "Access-Control-Allow-Credentials"
      ),
      "access-control-allow-methods": res.getHeader(
        "Access-Control-Allow-Methods"
      ),
      "access-control-allow-headers": res.getHeader(
        "Access-Control-Allow-Headers"
      ),
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount all routes under /api
app.use("/api", routes);

// Error handling
app.use(errorHandler);

// Export the Express app for Vercel
export default app;
