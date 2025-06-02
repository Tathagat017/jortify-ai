import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import Joi from "joi";

// Validation schemas
const createTagSchema = Joi.object({
  name: Joi.string().required().min(1).max(50),
  color: Joi.string()
    .required()
    .valid(
      "blue",
      "green",
      "yellow",
      "red",
      "purple",
      "gray",
      "orange",
      "pink"
    ),
  workspace_id: Joi.string().uuid().required(),
});

const updateTagSchema = Joi.object({
  name: Joi.string().optional().min(1).max(50),
  color: Joi.string()
    .optional()
    .valid(
      "blue",
      "green",
      "yellow",
      "red",
      "purple",
      "gray",
      "orange",
      "pink"
    ),
});

export class TagController {
  // Get all tags for a workspace
  static async getAllTags(req: Request, res: Response) {
    const { workspace_id } = req.query;

    if (!workspace_id) {
      throw new AppError(400, "workspace_id query parameter is required");
    }

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspace_id)
      .eq("user_id", req.user!.id)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found or access denied");
    }

    const { data: tags, error } = await supabase
      .from("tags")
      .select("*")
      .eq("workspace_id", workspace_id)
      .order("created_at", { ascending: true });

    if (error) throw new AppError(500, "Failed to fetch tags");
    res.json(tags);
  }

  // Create a new tag
  static async createTag(req: Request, res: Response) {
    const { error: validationError, value } = createTagSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { name, color, workspace_id } = value;

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspace_id)
      .eq("user_id", req.user!.id)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found or access denied");
    }

    // Check if tag with same name already exists in workspace
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("name", name)
      .eq("workspace_id", workspace_id)
      .single();

    if (existingTag) {
      throw new AppError(409, "Tag with this name already exists in workspace");
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .insert([
        {
          name,
          color,
          workspace_id,
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
    const { error: validationError, value } = updateTagSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { name, color } = value;

    // First, get the tag to verify workspace access
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      throw new AppError(404, "Tag not found");
    }

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", existingTag.workspace_id)
      .eq("user_id", req.user!.id)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(403, "Access denied to this workspace");
    }

    // Check if new name conflicts with existing tag in workspace
    if (name) {
      const { data: conflictingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("name", name)
        .eq("workspace_id", existingTag.workspace_id)
        .neq("id", id)
        .single();

      if (conflictingTag) {
        throw new AppError(
          409,
          "Tag with this name already exists in workspace"
        );
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    const { data: tag, error } = await supabase
      .from("tags")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to update tag");
    if (!tag) throw new AppError(404, "Tag not found");
    res.json(tag);
  }

  // Delete a tag
  static async deleteTag(req: Request, res: Response) {
    const { id } = req.params;

    // First, get the tag to verify workspace access
    const { data: existingTag, error: fetchError } = await supabase
      .from("tags")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (fetchError || !existingTag) {
      throw new AppError(404, "Tag not found");
    }

    // Verify user has access to this workspace
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", existingTag.workspace_id)
      .eq("user_id", req.user!.id)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(403, "Access denied to this workspace");
    }

    // Delete the tag (this will also delete page_tags relationships due to CASCADE)
    const { error } = await supabase.from("tags").delete().eq("id", id);

    if (error) throw new AppError(500, "Failed to delete tag");
    res.status(204).send();
  }
}
