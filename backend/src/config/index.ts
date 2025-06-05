import dotenv from "dotenv";

dotenv.config();

const isDev =
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

export const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || "development",
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
  },
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: isDev ? 3000 : 4000, // Much higher limit for dev/test, normal for production
  },
  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};
