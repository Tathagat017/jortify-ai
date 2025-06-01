import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";

export class TagController {
  // Get all tags for a user
  static async getAllTags(req: Request, res: Response) {
    const { data: tags, error } = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(500, "Failed to fetch tags");
    res.json(tags);
  }

  // Create a new tag
  static async createTag(req: Request, res: Response) {
    const { name, color } = req.body;
    const { data: tag, error } = await supabase
      .from("tags")
      .insert([
        {
          name,
          color,
          user_id: req.user!.id,
        },
      ])
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to create tag");
    res.status(201).json(tag);
  }

  // Update a tag
  static async updateTag(req: Request, res: Response) {
    const { id } = req.params;
    const { name, color } = req.body;

    const { data: tag, error } = await supabase
      .from("tags")
      .update({ name, color })
      .eq("id", id)
      .eq("user_id", req.user!.id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update tag");
    if (!tag) throw new AppError(404, "Tag not found");
    res.json(tag);
  }

  // Delete a tag
  static async deleteTag(req: Request, res: Response) {
    const { id } = req.params;
    const { error } = await supabase
      .from("tags")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user!.id);

    if (error) throw new AppError(500, "Failed to delete tag");
    res.status(204).send();
  }
}
