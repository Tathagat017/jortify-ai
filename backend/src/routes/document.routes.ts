import { Router } from "express";
import { auth } from "../middleware/auth";
import { documentUpload } from "../middleware/upload";
import { asyncHandler } from "../utils/async-handler";
import { DocumentController } from "../controllers/document.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Upload document for a page
router.post(
  "/upload",
  documentUpload.single("document"),
  asyncHandler(DocumentController.uploadDocument)
);

// Get all documents for a page
router.get("/page/:pageId", asyncHandler(DocumentController.getPageDocuments));

// Delete a document
router.delete("/:fileId", asyncHandler(DocumentController.deleteDocument));

// Download a document
router.get(
  "/:fileId/download",
  asyncHandler(DocumentController.downloadDocument)
);

export default router;
