import { Router } from "express";
import { authRouter } from "./auth";
import { workspaceRoutes } from "./workspace.routes";
import { pageRoutes } from "./page.routes";
import { tagRoutes } from "./tag.routes";
import { aiSessionRoutes } from "./ai-session.routes";
import { searchRoutes } from "./search.routes";
import { uploadRoutes } from "./upload.routes";
import { aiRoutes } from "./ai.routes";
import documentRoutes from "./document.routes";

const router = Router();

// Mount all routes
router.use("/auth", authRouter);
router.use("/workspaces", workspaceRoutes);
router.use("/pages", pageRoutes);
router.use("/tags", tagRoutes);
router.use("/ai-sessions", aiSessionRoutes);
router.use("/search", searchRoutes);
router.use("/upload", uploadRoutes);
router.use("/ai", aiRoutes);
router.use("/documents", documentRoutes);

export const routes = router;
