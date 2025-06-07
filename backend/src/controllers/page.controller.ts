import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { SummaryService } from "../services/summary.service";
import { AIService } from "../services/ai.service";
import Joi from "joi";

// Validation schemas
const createPageSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.array().default([]),
  workspace_id: Joi.string().uuid().required(),
  parent_id: Joi.string().uuid().optional().allow(null),
  icon: Joi.string().optional().allow(""),
  icon_url: Joi.string().uri().optional().allow("", null),
  cover_image: Joi.string().optional().allow(""),
  cover_url: Joi.string().uri().optional().allow("", null),
  tags: Joi.array().items(Joi.string().uuid()).optional(),
  is_deleted: Joi.boolean().default(false),
});

const updatePageSchema = Joi.object({
  title: Joi.string().optional(),
  content: Joi.array().optional(),
  icon: Joi.string().optional().allow(""),
  icon_url: Joi.string().uri().optional().allow("", null),
  cover_image: Joi.string().optional().allow(""),
  cover_url: Joi.string().uri().optional().allow("", null),
  tags: Joi.array().items(Joi.string().uuid()).optional(),
  is_deleted: Joi.boolean().optional(),
});

export class PageController {
  // Get all pages in a workspace
  static async getWorkspacePages(req: Request, res: Response) {
    const { workspaceId } = req.params;
    const { includeDeleted } = req.query;

    let query = supabase
      .from("pages")
      .select("*, tags(*)")
      .eq("workspace_id", workspaceId);

    // Filter out deleted pages unless explicitly requested
    if (includeDeleted !== "true") {
      query = query.eq("is_deleted", false);
    }

    const { data: pages, error } = await query;

    if (error) throw new AppError(500, "Failed to fetch pages");
    res.json(pages);
  }

  // Get a single page
  static async getPage(req: Request, res: Response) {
    const { id } = req.params;
    const { includeDeleted } = req.query;

    let query = supabase.from("pages").select("*, tags(*)").eq("id", id);

    // Filter out deleted pages unless explicitly requested
    if (includeDeleted !== "true") {
      query = query.eq("is_deleted", false);
    }

    const { data: page, error } = await query.single();

    if (error) throw new AppError(500, "Failed to fetch page");
    if (!page) throw new AppError(404, "Page not found");
    res.json(page);
  }

  // Get children of a page (with pagination)
  static async getPageChildren(req: Request, res: Response) {
    const { id } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const { data: children, error } = await supabase
      .from("pages")
      .select("id, title, created_at, updated_at, icon_url, cover_url")
      .eq("parent_id", id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new AppError(500, "Failed to fetch page children");

    // Get total count for pagination (excluding deleted)
    const { count, error: countError } = await supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", id)
      .eq("is_deleted", false);

    if (countError) throw new AppError(500, "Failed to count page children");

    res.json({
      children,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  }

  // Get backlinks for a page
  static async getPageBacklinks(req: Request, res: Response) {
    const { id } = req.params;

    // Find pages that link to this page in their content (excluding deleted pages)
    const { data: pages, error } = await supabase
      .from("pages")
      .select("id, title, content, created_at, updated_at")
      .neq("id", id)
      .eq("is_deleted", false); // Filter out deleted pages

    if (error)
      throw new AppError(500, "Failed to fetch pages for backlink analysis");

    // Filter pages that contain references to the target page
    const backlinks =
      pages?.filter((page) => {
        const contentStr = JSON.stringify(page.content);
        return contentStr.includes(id);
      }) || [];

    res.json(backlinks);
  }

  // Create a new page
  static async createPage(req: Request, res: Response) {
    const { error: validationError, value } = createPageSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const {
      title,
      content,
      workspace_id,
      parent_id,
      icon,
      icon_url,
      cover_image,
      cover_url,
      tags,
      is_deleted,
    } = value;

    // Get user_id from authenticated user
    const user_id = req.user?.id;
    if (!user_id) {
      throw new AppError(401, "User not authenticated");
    }

    const insertData: any = {
      title,
      content,
      workspace_id,
      parent_id,
      icon_url,
      cover_url,
      is_deleted,
      user_id,
    };

    // Add icon and cover_image if provided
    if (icon !== undefined) insertData.icon = icon;
    if (cover_image !== undefined) insertData.cover_image = cover_image;

    try {
      const { data: pageData, error } = await supabase
        .from("pages")
        .insert([insertData])
        .select()
        .single();

      let page = pageData;

      if (error) {
        // If error is related to missing column, try without icon/cover_image fields
        if (
          error.code === "PGRST204" &&
          (icon !== undefined || cover_image !== undefined)
        ) {
          console.warn(
            `Schema cache issue detected during create. Retrying without icon/cover_image fields.`
          );

          // Retry without the problematic fields
          const retryInsertData: any = {
            title,
            content,
            workspace_id,
            parent_id,
            icon_url,
            cover_url,
          };

          const { data: retryPage, error: retryError } = await supabase
            .from("pages")
            .insert([retryInsertData])
            .select()
            .single();

          if (retryError) throw new AppError(500, "Failed to create page");

          // Set the icon/cover_image fields manually in response (since they couldn't be saved)
          const resultPage = { ...retryPage };
          if (icon !== undefined) resultPage.icon = icon;
          if (cover_image !== undefined) resultPage.cover_image = cover_image;

          // Continue with tags and summary generation
          page = resultPage;
        } else {
          throw new AppError(500, "Failed to create page");
        }
      }

      // Add tags to page if provided
      if (tags && tags.length > 0) {
        const { error: tagError } = await supabase.from("page_tags").insert(
          tags.map((tagId: string) => ({
            page_id: page.id,
            tag_id: tagId,
          }))
        );

        if (tagError) {
          console.warn("Failed to add some tags to page:", tagError);
          // Don't throw error, continue without tags
        }
      }

      // Note: Tag generation is now handled by the frontend to avoid conflicts

      // Generate summary in background (don't wait for it)
      SummaryService.generatePageSummary(page.id).catch((error) => {
        console.error(
          `Failed to generate summary for new page ${page.id}:`,
          error
        );
      });

      res.status(201).json(page);
    } catch (error: any) {
      // Handle any other schema cache related errors
      if (error.code === "PGRST204") {
        throw new AppError(
          400,
          `Schema cache error: ${error.message}. Please try again in a moment.`
        );
      }
      throw error;
    }
  }

  // Duplicate a page
  static async duplicatePage(req: Request, res: Response) {
    const { id } = req.params;
    const { title: newTitle } = req.body;

    // Fetch original page
    const { data: originalPage, error: fetchError } = await supabase
      .from("pages")
      .select("*, page_tags(tag_id)")
      .eq("id", id)
      .single();

    if (fetchError) throw new AppError(500, "Failed to fetch original page");
    if (!originalPage) throw new AppError(404, "Page not found");

    // Create duplicate
    const duplicateTitle = newTitle || `${originalPage.title} (Copy)`;
    const { data: duplicatePage, error: createError } = await supabase
      .from("pages")
      .insert([
        {
          title: duplicateTitle,
          content: originalPage.content,
          workspace_id: originalPage.workspace_id,
          parent_id: originalPage.parent_id,
          icon_url: originalPage.icon_url,
          cover_url: originalPage.cover_url,
        },
      ])
      .select()
      .single();

    if (createError) throw new AppError(500, "Failed to create duplicate page");

    // Copy tags
    if (originalPage.page_tags?.length > 0) {
      const { error: tagError } = await supabase.from("page_tags").insert(
        originalPage.page_tags.map((pt: any) => ({
          page_id: duplicatePage.id,
          tag_id: pt.tag_id,
        }))
      );

      if (tagError)
        throw new AppError(500, "Failed to copy tags to duplicate page");
    }

    // Generate summary in background
    SummaryService.generatePageSummary(duplicatePage.id).catch((error) => {
      console.error(
        `Failed to generate summary for duplicated page ${duplicatePage.id}:`,
        error
      );
    });

    res.status(201).json(duplicatePage);
  }

  // Move a page to different parent
  static async movePage(req: Request, res: Response) {
    const { id } = req.params;
    const { parent_id } = req.body;

    // Validate that the new parent exists (if provided)
    if (parent_id) {
      const { data: parentPage, error: parentError } = await supabase
        .from("pages")
        .select("id")
        .eq("id", parent_id)
        .single();

      if (parentError || !parentPage) {
        throw new AppError(404, "Parent page not found");
      }

      // Prevent circular references
      if (parent_id === id) {
        throw new AppError(400, "Cannot move page to itself");
      }
    }

    const { data: page, error } = await supabase
      .from("pages")
      .update({ parent_id })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to move page");
    if (!page) throw new AppError(404, "Page not found");

    res.json(page);
  }

  // Update a page
  static async updatePage(req: Request, res: Response) {
    const { id } = req.params;
    const { error: validationError, value } = updatePageSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { title, content, icon, icon_url, cover_image, cover_url, tags } =
      value;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (icon_url !== undefined) updateData.icon_url = icon_url;
    if (cover_url !== undefined) updateData.cover_url = cover_url;

    // Handle icon and cover_image fields with fallback for schema cache issues
    if (icon !== undefined) updateData.icon = icon;
    if (cover_image !== undefined) updateData.cover_image = cover_image;

    try {
      // First, get the current page data to check existing tags
      const { data: currentPage, error: fetchError } = await supabase
        .from("pages")
        .select(
          `
          id,
          title,
          content,
          workspace_id,
          page_tags (
            tag_id,
            tags (
              id,
              name
            )
          )
        `
        )
        .eq("id", id)
        .single();

      if (fetchError || !currentPage) {
        throw new AppError(404, "Page not found");
      }

      // Note: Auto-tag regeneration is now handled by the frontend to avoid conflicts

      // Update the page
      const { data: page, error } = await supabase
        .from("pages")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        // If error is related to missing column, try without icon/cover_image fields
        if (
          error.code === "PGRST204" &&
          (icon !== undefined || cover_image !== undefined)
        ) {
          console.warn(
            `Schema cache issue detected. Retrying without icon/cover_image fields.`
          );

          // Retry without the problematic fields
          const retryUpdateData: any = {};
          if (title !== undefined) retryUpdateData.title = title;
          if (content !== undefined) retryUpdateData.content = content;
          if (icon_url !== undefined) retryUpdateData.icon_url = icon_url;
          if (cover_url !== undefined) retryUpdateData.cover_url = cover_url;

          const { data: retryPage, error: retryError } = await supabase
            .from("pages")
            .update(retryUpdateData)
            .eq("id", id)
            .select()
            .single();

          if (retryError) throw new AppError(500, "Failed to update page");
          if (!retryPage) throw new AppError(404, "Page not found");

          // Set the icon/cover_image fields manually in response (since they couldn't be saved)
          const resultPage = { ...retryPage };
          if (icon !== undefined) resultPage.icon = icon;
          if (cover_image !== undefined) resultPage.cover_image = cover_image;

          res.json(resultPage);
          return;
        }
        throw new AppError(500, "Failed to update page");
      }
      if (!page) throw new AppError(404, "Page not found");

      // Handle tag updates
      if (tags !== undefined) {
        // Manual tag update - remove existing and add new
        await supabase.from("page_tags").delete().eq("page_id", id);

        if (tags.length > 0) {
          const { error: tagError } = await supabase.from("page_tags").insert(
            tags.map((tagId: string) => ({
              page_id: id,
              tag_id: tagId,
            }))
          );

          if (tagError) throw new AppError(500, "Failed to update page tags");
        }
      }

      // Regenerate summary if title or content changed
      if (title !== undefined || content !== undefined) {
        SummaryService.generatePageSummary(id, true) // Force regeneration
          .catch((error) => {
            console.error(
              `Failed to regenerate summary for updated page ${id}:`,
              error
            );
          });
      }

      res.json(page);
    } catch (error: any) {
      // Handle any other schema cache related errors
      if (error.code === "PGRST204") {
        throw new AppError(
          400,
          `Schema cache error: ${error.message}. Please try again in a moment.`
        );
      }
      throw error;
    }
  }

  /**
   * Helper method to extract text from BlockNote content
   */
  private static extractTextFromContent(content: any): string {
    if (!content || typeof content !== "object") return "";

    let text = "";

    // If content is an array of blocks
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.content && Array.isArray(block.content)) {
          for (const inline of block.content) {
            if (inline.text) {
              text += inline.text + " ";
            }
          }
        }
      }
    } else if (content.blocks && Array.isArray(content.blocks)) {
      // If content has a blocks property
      return PageController.extractTextFromContent(content.blocks);
    }

    return text.trim();
  }

  // Delete a page (soft delete)
  static async deletePage(req: Request, res: Response) {
    const { id } = req.params;

    // Soft delete - set is_deleted to true
    const { data: page, error } = await supabase
      .from("pages")
      .update({ is_deleted: true })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to delete page");
    if (!page) throw new AppError(404, "Page not found");

    res.json({ message: "Page moved to trash", page });
  }

  // Restore a page from trash
  static async restorePage(req: Request, res: Response) {
    const { id } = req.params;

    // Restore page - set is_deleted to false
    const { data: page, error } = await supabase
      .from("pages")
      .update({ is_deleted: false })
      .eq("id", id)
      .eq("is_deleted", true) // Only restore if it's actually deleted
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to restore page");
    if (!page) throw new AppError(404, "Page not found in trash");

    res.json({ message: "Page restored successfully", page });
  }

  // Permanently delete a page
  static async permanentlyDeletePage(req: Request, res: Response) {
    const { id } = req.params;

    // Clean up summary and embeddings before deleting
    try {
      await SummaryService.deletePageSummary(id);
    } catch (summaryError) {
      console.warn(`Failed to clean up summary for page ${id}:`, summaryError);
    }

    // Hard delete from database
    const { error } = await supabase
      .from("pages")
      .delete()
      .eq("id", id)
      .eq("is_deleted", true); // Only allow permanent deletion of trashed pages

    if (error) throw new AppError(500, "Failed to permanently delete page");
    res.status(204).send();
  }

  // Get all pages for the authenticated user
  static async getUserPages(req: Request, res: Response) {
    const { includeDeleted } = req.query;

    let query = supabase
      .from("pages")
      .select("id, title, created_at, updated_at, workspace_id")
      .order("created_at", { ascending: false });

    // Filter out deleted pages unless explicitly requested
    if (includeDeleted !== "true") {
      query = query.eq("is_deleted", false);
    }

    const { data: pages, error } = await query;

    if (error) throw new AppError(500, "Failed to fetch pages");
    res.json(pages);
  }

  // Generate summary for a specific page (manual trigger)
  static async generatePageSummary(req: Request, res: Response) {
    const { id } = req.params;
    const { force = false } = req.body;

    // Validate that the page exists
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id, title")
      .eq("id", id)
      .single();

    if (pageError || !page) {
      throw new AppError(404, "Page not found");
    }

    // Generate summary
    const summary = await SummaryService.generatePageSummary(id, force);

    res.json({
      message: "Summary generated successfully",
      pageId: id,
      summary,
      timestamp: new Date().toISOString(),
    });
  }

  // Get tags for a page
  static async getPageTags(req: Request, res: Response) {
    const { id } = req.params;

    const { data: pageTags, error } = await supabase
      .from("page_tags")
      .select(
        `
        tag_id,
        tags (
          id,
          name,
          color,
          workspace_id,
          created_at
        )
      `
      )
      .eq("page_id", id);

    if (error) throw new AppError(500, "Failed to fetch page tags");

    // Extract the tag objects from the join result
    const tags = pageTags?.map((pt: any) => pt.tags) || [];
    res.json(tags);
  }

  // Add tag to page
  static async addTagToPage(req: Request, res: Response) {
    const { id: pageId } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      throw new AppError(400, "Tag ID is required");
    }

    // Validate that the page exists
    const { data: page, error: pageError } = await supabase
      .from("pages")
      .select("id")
      .eq("id", pageId)
      .single();

    if (pageError || !page) {
      throw new AppError(404, "Page not found");
    }

    // Validate that the tag exists
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagId)
      .single();

    if (tagError || !tag) {
      throw new AppError(404, "Tag not found");
    }

    // Check if the relationship already exists
    const { data: existing, error: existingError } = await supabase
      .from("page_tags")
      .select("*")
      .eq("page_id", pageId)
      .eq("tag_id", tagId)
      .single();

    if (existingError && existingError.code !== "PGRST116") {
      throw new AppError(500, "Failed to check existing tag relationship");
    }

    if (existing) {
      throw new AppError(409, "Tag is already associated with this page");
    }

    // Create the relationship
    const { data: pageTag, error } = await supabase
      .from("page_tags")
      .insert([{ page_id: pageId, tag_id: tagId }])
      .select()
      .single();

    if (error) throw new AppError(500, "Failed to add tag to page");

    res.status(201).json({
      message: "Tag added to page successfully",
      pageTag,
    });
  }

  // Remove tag from page
  static async removeTagFromPage(req: Request, res: Response) {
    const { id: pageId, tagId } = req.params;

    // Validate that the relationship exists
    const { data: existing, error: existingError } = await supabase
      .from("page_tags")
      .select("*")
      .eq("page_id", pageId)
      .eq("tag_id", tagId)
      .single();

    if (existingError || !existing) {
      throw new AppError(404, "Tag relationship not found");
    }

    // Remove the relationship
    const { error } = await supabase
      .from("page_tags")
      .delete()
      .eq("page_id", pageId)
      .eq("tag_id", tagId);

    if (error) throw new AppError(500, "Failed to remove tag from page");

    res.json({
      message: "Tag removed from page successfully",
    });
  }
}
