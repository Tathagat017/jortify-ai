import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/error-handler";
import { routes } from "./routes";
import { config } from "./config";

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
app.use(helmet());
const corsOptions = {
  origin: "*",
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Access-Control-Request-Method",
    "Access-Control-Request-Headers",
    "X-CSRF-Token",
    "X-API-Key",
  ],
  exposedHeaders: ["Content-Length", "X-Request-ID", "X-Response-Time"],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("/", cors(corsOptions));
app.use(express.json());
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
// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// Mount all routes under /api
app.use("/api", routes);

// Error handling
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`CORS Origin: ${config.cors.origin}`);
});
