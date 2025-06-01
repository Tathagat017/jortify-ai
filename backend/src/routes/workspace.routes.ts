import { Router } from "express";
import { auth } from "../middleware/auth";
import { asyncHandler } from "../utils/async-handler";
import { WorkspaceController } from "../controllers/workspace.controller";

const router = Router();

// Apply auth middleware to all routes
router.use(auth);

// Get all workspaces for a user
router.get("/", asyncHandler(WorkspaceController.getAllWorkspaces));

// Create a new workspace
router.post("/", asyncHandler(WorkspaceController.createWorkspace));

// Update a workspace
router.put("/:id", asyncHandler(WorkspaceController.updateWorkspace));

// Delete a workspace
router.delete("/:id", asyncHandler(WorkspaceController.deleteWorkspace));

export const workspaceRoutes = router;
