import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { EmbeddingService } from "../services/embedding.service";
import Joi from "joi";

// Validation schemas
const searchSchema = Joi.object({
  query: Joi.string().required().min(1),
  workspace_id: Joi.string().uuid().required(),
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
});

const suggestionSchema = Joi.object({
  query: Joi.string().required().min(1),
  workspace_id: Joi.string().uuid().required(),
  limit: Joi.number().integer().min(1).max(20).default(10),
});

export class SearchController {
  // Full-text search across pages
  static async fullTextSearch(req: Request, res: Response) {
    const { error: validationError, value } = searchSchema.validate(req.body);
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { query, workspace_id, limit, offset } = value;

    // Use PostgreSQL full-text search
    const { data: pages, error } = await supabase
      .from("pages")
      .select(
        `
        id, 
        title, 
        content,
        created_at,
        updated_at,
        icon_url,
        cover_url,
        ts_rank(to_tsvector('english', title || ' ' || coalesce(content::text, '')), plainto_tsquery('english', $1)) as rank
      `
      )
      .eq("workspace_id", workspace_id)
      .textSearch("title,content", query, { type: "websearch" })
      .order("rank", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Search error:", error);
      throw new AppError(500, "Search failed");
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .textSearch("title,content", query, { type: "websearch" });

    if (countError) {
      console.error("Count error:", countError);
      throw new AppError(500, "Failed to count search results");
    }

    res.json({
      results: pages || [],
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: offset + limit < (count || 0),
      },
      query,
    });
  }

  // Semantic search using embeddings
  static async semanticSearch(req: Request, res: Response) {
    const { error: validationError, value } = searchSchema.validate(req.body);
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { query, workspace_id, limit, offset } = value;
    const similarity_threshold =
      parseFloat(req.body.similarity_threshold) || 0.7;

    try {
      // Use EmbeddingService for semantic search
      const results = await EmbeddingService.semanticSearch(
        query,
        workspace_id,
        limit,
        similarity_threshold
      );

      // Apply offset for pagination
      const paginatedResults = results.slice(offset, offset + limit);

      res.json({
        results: paginatedResults,
        pagination: {
          limit,
          offset,
          total: results.length,
          hasMore: offset + limit < results.length,
        },
        query,
        similarity_threshold,
      });
    } catch (embeddingError) {
      console.warn(
        "Semantic search failed, falling back to text search:",
        embeddingError
      );

      // Fallback to regular text search if embeddings fail
      const { data: pages, error } = await supabase
        .from("pages")
        .select(
          "id, title, content, created_at, updated_at, icon_url, cover_url"
        )
        .eq("workspace_id", workspace_id)
        .textSearch("title,content", query, { type: "websearch" })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new AppError(500, "Both semantic and text search failed");
      }

      res.json({
        results: pages || [],
        pagination: {
          limit,
          offset,
          total: pages?.length || 0,
          hasMore: false,
        },
        query,
        fallback: "text_search",
        note: "Semantic search unavailable, used text search as fallback",
      });
    }
  }

  // Auto-complete suggestions
  static async getSuggestions(req: Request, res: Response) {
    const { error: validationError, value } = suggestionSchema.validate(
      req.query
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { query, workspace_id, limit } = value;

    // Search for pages with titles that start with or contain the query
    const { data: suggestions, error } = await supabase
      .from("pages")
      .select("id, title, icon_url")
      .eq("workspace_id", workspace_id)
      .or(`title.ilike.%${query}%,title.ilike.${query}%`)
      .order("title", { ascending: true })
      .limit(limit);

    if (error) {
      throw new AppError(500, "Failed to fetch suggestions");
    }

    res.json({
      suggestions: suggestions || [],
      query,
    });
  }

  // Find similar pages using embeddings
  static async findSimilarPages(req: Request, res: Response) {
    const { id } = req.params;
    const { workspace_id } = req.body;
    const limit = parseInt(req.body.limit) || 10;
    const similarity_threshold =
      parseFloat(req.body.similarity_threshold) || 0.7;

    // Validate that the page exists
    const { data: targetPage, error: pageError } = await supabase
      .from("pages")
      .select("id, title, workspace_id")
      .eq("id", id)
      .single();

    if (pageError || !targetPage) {
      throw new AppError(404, "Page not found");
    }

    // Validate workspace access
    if (workspace_id && targetPage.workspace_id !== workspace_id) {
      throw new AppError(403, "Access denied to this workspace");
    }

    try {
      // Use EmbeddingService to find similar pages
      const similarPages = await EmbeddingService.findSimilarPages(
        id,
        limit,
        similarity_threshold
      );

      res.json({
        similar_pages: similarPages,
        target_page: {
          id: targetPage.id,
          title: targetPage.title,
        },
        similarity_threshold,
      });
    } catch (embeddingError) {
      console.warn("Embedding-based similarity search failed:", embeddingError);

      // Fallback: find pages with similar tags or in same workspace
      const { data: fallbackPages, error } = await supabase
        .from("pages")
        .select(
          `
          id, 
          title, 
          created_at, 
          updated_at, 
          icon_url,
          page_tags(tag_id)
        `
        )
        .eq("workspace_id", targetPage.workspace_id)
        .neq("id", id)
        .limit(limit);

      if (error) {
        throw new AppError(500, "Failed to find similar pages");
      }

      res.json({
        similar_pages: fallbackPages || [],
        target_page: {
          id: targetPage.id,
          title: targetPage.title,
        },
        fallback: "tag_based",
        note: "Embedding-based similarity unavailable, using tag-based similarity",
      });
    }
  }

  // Generate embeddings for a workspace (admin endpoint)
  static async generateEmbeddings(req: Request, res: Response) {
    const { workspace_id } = req.body;

    if (!workspace_id) {
      throw new AppError(400, "workspace_id is required");
    }

    // Validate workspace access
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspace_id)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // Generate embeddings in background
    EmbeddingService.generateWorkspaceEmbeddings(workspace_id).catch(
      (error) => {
        console.error("Background embedding generation failed:", error);
      }
    );

    res.json({
      message: "Embedding generation started",
      workspace_id,
      note: "Process is running in background",
    });
  }
}
