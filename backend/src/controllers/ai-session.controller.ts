import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

export class AISessionController {
  // Get all AI sessions for a user
  static async getAllAISessions(req: Request, res: Response) {
    const { data: sessions, error } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("user_id", req.user!.id)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(500, "Failed to fetch AI sessions");
    res.json(sessions);
  }

  // Get a specific AI session
  static async getAISession(req: Request, res: Response) {
    const { id } = req.params;
    const { data: session, error } = await supabase
      .from("ai_sessions")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .single();

    if (error) throw new AppError(500, "Failed to fetch AI session");
    if (!session) throw new AppError(404, "AI session not found");
    res.json(session);
  }

  // Create a new AI session
  static async createAISession(req: Request, res: Response) {
    const { title, context } = req.body;
    const { data: session, error } = await supabase
      .from("ai_sessions")
      .insert([
        {
          title,
          context,
          user_id: req.user!.id,
        },
      ])
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to create AI session");
    res.status(201).json(session);
  }

  // Update an AI session
  static async updateAISession(req: Request, res: Response) {
    const { id } = req.params;
    const { title, context } = req.body;

    const { data: session, error } = await supabase
      .from("ai_sessions")
      .update({ title, context })
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update AI session");
    if (!session) throw new AppError(404, "AI session not found");
    res.json(session);
  }

  // Delete an AI session
  static async deleteAISession(req: Request, res: Response) {
    const { id } = req.params;
    const { error } = await supabase
      .from("ai_sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(500, "Failed to delete AI session");
    res.status(204).send();
  }
}
