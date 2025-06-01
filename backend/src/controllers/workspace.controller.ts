import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

export class WorkspaceController {
  // Get all workspaces for a user
  static async getAllWorkspaces(req: Request, res: Response) {
    const { data: workspaces, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(500, "Failed to fetch workspaces");
    res.json(workspaces);
  }

  // Create a new workspace
  static async createWorkspace(req: Request, res: Response) {
    const { name, description } = req.body;
    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert([
        {
          name,
          description,
          user_id: req.user!.id,
        },
      ])
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to create workspace");
    res.status(201).json(workspace);
  }

  // Update a workspace
  static async updateWorkspace(req: Request, res: Response) {
    const { id } = req.params;
    const { name, description } = req.body;

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .update({ name, description })
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update workspace");
    if (!workspace) throw new AppError(404, "Workspace not found");
    res.json(workspace);
  }

  // Delete a workspace
  static async deleteWorkspace(req: Request, res: Response) {
    const { id } = req.params;
    const { error } = await supabase
      .from("workspaces")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(500, "Failed to delete workspace");
    res.status(204).send();
  }
}
