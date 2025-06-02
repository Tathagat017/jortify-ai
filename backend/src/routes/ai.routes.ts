import { Router } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { auth } from "../middleware/auth";
import { AIService } from "../services/ai.service";
import { SummaryService } from "../services/summary.service";
import { EmbeddingService } from "../services/embedding.service";
import { RAGChatService } from "../services/rag-chat.service";
import Joi from "joi";
import { asyncHandler } from "../utils/async-handler";
import { AIController } from "../controllers/ai.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Validation schemas
const suggestionSchema = Joi.object({
  context: Joi.string().required(),
  currentText: Joi.string().required(),
  pageId: Joi.string().uuid().optional(),
  workspaceId: Joi.string().uuid().required(),
});

const linkSuggestionSchema = Joi.object({
  text: Joi.string().required().min(3),
  workspaceId: Joi.string().uuid().required(),
  pageId: Joi.string().uuid().optional(),
  contextWindow: Joi.number().integer().min(50).max(500).default(100),
});

const tagGenerationSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.array().default([]),
  workspaceId: Joi.string().uuid().required(),
});

const summarizeSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.array().default([]),
  length: Joi.string().valid("short", "medium", "long").default("medium"),
});

const completeTextSchema = Joi.object({
  text: Joi.string().required(),
  context: Joi.string().allow("").default(""),
  maxTokens: Joi.number().integer().min(50).max(500).default(150),
});

const chatSchema = Joi.object({
  question: Joi.string().required().min(1),
  conversationId: Joi.string().uuid().optional(),
  workspaceId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().optional(),
});

const createConversationSchema = Joi.object({
  workspaceId: Joi.string().uuid().required(),
  title: Joi.string().optional().default("New Chat"),
  userId: Joi.string().uuid().optional(),
});

// =================== BASIC AI FEATURES ===================

// Real-time AI suggestions for in-editor assistance
router.post("/suggestions", asyncHandler(AIController.generateSuggestions));

// Enhanced AI link suggestions using page summaries
router.post(
  "/link-suggestions",
  asyncHandler(AIController.generateLinkSuggestions)
);

// Generate semantic tags for a page
router.post("/generate-tags", asyncHandler(AIController.generateTags));

// Generate page summary
router.post("/summarize", asyncHandler(AIController.summarizePage));

// Auto-complete text
router.post("/complete", asyncHandler(AIController.completeText));

// Analyze writing quality
router.post("/analyze", asyncHandler(AIController.analyzeWriting));

// =================== RAG CHATBOT ENDPOINTS ===================

// Create a new chat conversation
router.post("/conversations", asyncHandler(AIController.createConversation));

// RAG-based Q&A chatbot
router.post("/chat", asyncHandler(AIController.chatWithRAG));

// Get conversation history
router.get(
  "/conversations/:conversationId",
  asyncHandler(AIController.getConversationHistory)
);

// Get all conversations for a workspace
router.get(
  "/conversations/workspace/:workspaceId",
  asyncHandler(AIController.getWorkspaceConversations)
);

// Delete a conversation and all its messages
router.delete(
  "/conversations/:conversationId",
  asyncHandler(AIController.deleteConversation)
);

// Update conversation title
router.patch(
  "/conversations/:conversationId/title",
  asyncHandler(AIController.updateConversationTitle)
);

// =================== BATCH OPERATIONS ===================

// Generate workspace summaries (batch operation)
router.post(
  "/workspace/:workspaceId/summaries",
  asyncHandler(AIController.generateWorkspaceSummaries)
);

// Generate embeddings for workspace pages
router.post(
  "/workspace/:workspaceId/embeddings",
  asyncHandler(AIController.generateWorkspaceEmbeddings)
);

export const aiRoutes = router;
