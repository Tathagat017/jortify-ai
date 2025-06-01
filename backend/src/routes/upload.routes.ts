import { Router } from "express";
import { auth } from "../middleware/auth";
import { upload } from "../middleware/upload";
import { asyncHandler } from "../utils/async-handler";
import { UploadController } from "../controllers/upload.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Upload page/workspace icon
router.post(
  "/icon",
  upload.single("icon"),
  asyncHandler(UploadController.uploadIcon)
);

// Upload page/workspace cover image
router.post(
  "/cover",
  upload.single("cover"),
  asyncHandler(UploadController.uploadCover)
);

// Delete uploaded file
router.delete("/:fileId", asyncHandler(UploadController.deleteFile));

// Generate presigned URL for upload (alternative upload method)
router.post(
  "/presigned/:fileId",
  asyncHandler(UploadController.generatePresignedUrl)
);

// Get file info
router.get("/:fileId", asyncHandler(UploadController.getFileInfo));

export const uploadRoutes = router;
