import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

export class AuthController {
  // Sign up
  static async signUp(req: Request, res: Response) {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw new AppError(400, error.message);

    res.status(201).json({
      status: "success",
      data,
    });
  }

  // Sign in
  static async signIn(req: Request, res: Response) {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw new AppError(401, error.message);

    res.status(200).json({
      status: "success",
      data,
    });
  }

  // Sign out
  static async signOut(req: Request, res: Response) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new AppError(400, error.message);

    res.status(200).json({
      status: "success",
      message: "Signed out successfully",
    });
  }

  // Get current user
  static async getCurrentUser(req: Request, res: Response) {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw new AppError(401, error.message);

    res.status(200).json({
      status: "success",
      data: user,
    });
  }
}
