import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { AISessionController } from "../controllers/ai-session.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Get all AI sessions for a user
router.get("/", asyncHandler(AISessionController.getAllAISessions));

// Get a specific AI session
router.get("/:id", asyncHandler(AISessionController.getAISession));

// Create a new AI session
router.post("/", asyncHandler(AISessionController.createAISession));

// Update an AI session
router.put("/:id", asyncHandler(AISessionController.updateAISession));

// Delete an AI session
router.delete("/:id", asyncHandler(AISessionController.deleteAISession));

export const aiSessionRoutes = router;
