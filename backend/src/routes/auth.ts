import { Router } from "express";
import { asyncHandler } from "../utils/async-handler";
import { AuthController } from "../controllers/auth.controller";

const router = Router();

// Sign up
router.post("/signup", asyncHandler(AuthController.signUp));

// Sign in
router.post("/signin", asyncHandler(AuthController.signIn));

// Sign out
router.post("/signout", asyncHandler(AuthController.signOut));

// Get current user
router.get("/me", asyncHandler(AuthController.getCurrentUser));

export const authRouter = router;
