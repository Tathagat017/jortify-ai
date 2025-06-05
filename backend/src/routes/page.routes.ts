import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { PageController } from "../controllers/page.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Get all pages in a workspace
router.get(
  "/workspace/:workspaceId",
  asyncHandler(PageController.getWorkspacePages)
);

// Get all pages for the authenticated user
router.get("/", asyncHandler(PageController.getUserPages));

// Get a single page
router.get("/:id", asyncHandler(PageController.getPage));

// Get children of a page (with pagination)
router.get("/:id/children", asyncHandler(PageController.getPageChildren));

// Get backlinks for a page
router.get("/:id/backlinks", asyncHandler(PageController.getPageBacklinks));

// Get tags for a page
router.get("/:id/tags", asyncHandler(PageController.getPageTags));

// Add tag to page
router.post("/:id/tags", asyncHandler(PageController.addTagToPage));

// Remove tag from page
router.delete(
  "/:id/tags/:tagId",
  asyncHandler(PageController.removeTagFromPage)
);

// Create a new page
router.post("/", asyncHandler(PageController.createPage));

// Duplicate a page
router.post("/:id/duplicate", asyncHandler(PageController.duplicatePage));

// Move a page to different parent
router.patch("/:id/move", asyncHandler(PageController.movePage));

// Update a page
router.put("/:id", asyncHandler(PageController.updatePage));

// Delete a page
router.delete("/:id", asyncHandler(PageController.deletePage));

// Restore a page from trash
router.patch("/:id/restore", asyncHandler(PageController.restorePage));

// Permanently delete a page
router.delete(
  "/:id/permanent",
  asyncHandler(PageController.permanentlyDeletePage)
);

// Generate summary for a specific page (manual trigger)
router.post("/:id/summary", asyncHandler(PageController.generatePageSummary));

export const pageRoutes = router;
