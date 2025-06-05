import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { TagController } from "../controllers/tag.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Get all tags for a user
router.get("/", asyncHandler(TagController.getAllTags));

// Create a new tag
router.post("/", asyncHandler(TagController.createTag));

// Update a tag
router.put("/:id", asyncHandler(TagController.updateTag));

// Delete a tag
router.delete("/:id", asyncHandler(TagController.deleteTag));

export const tagRoutes = router;
