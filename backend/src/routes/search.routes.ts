import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { SearchController } from "../controllers/search.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Full-text search across pages
router.post("/text", asyncHandler(SearchController.fullTextSearch));

// Semantic search using embeddings
router.post("/semantic", asyncHandler(SearchController.semanticSearch));

// Search pages by tags only
router.post("/tags", asyncHandler(SearchController.searchByTags));

// Auto-complete suggestions
router.get("/suggestions", asyncHandler(SearchController.getSuggestions));

// Find similar pages using embeddings
router.post("/similar/:id", asyncHandler(SearchController.findSimilarPages));

// Generate embeddings for a workspace (admin endpoint)
router.post("/embeddings", asyncHandler(SearchController.generateEmbeddings));

export const searchRoutes = router;
