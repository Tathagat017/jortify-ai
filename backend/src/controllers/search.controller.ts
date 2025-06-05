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
  similarity_threshold: Joi.number().min(0).max(1).default(0.7),
  filters: Joi.object({
    searchBehavior: Joi.string().valid("simple", "semantic").default("simple"),
    searchIn: Joi.object({
      pageName: Joi.boolean().default(true),
      subPageName: Joi.boolean().default(true),
      pageContent: Joi.boolean().default(true),
    }).default({}),
    metadata: Joi.object({
      tags: Joi.array().items(Joi.string().uuid()).default([]),
      workspaceType: Joi.string()
        .valid("public", "private", "all")
        .default("all"),
    }).default({}),
  }).default({}),
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

    const { query, workspace_id, limit, offset, filters } = value;

    // Build search query based on filters
    let searchQuery = supabase
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
        summary,
        parent_id
      `
      )
      .eq("workspace_id", workspace_id)
      .eq("is_deleted", false);

    // Apply search filters
    if (filters.searchIn) {
      const searchFields = [];
      if (filters.searchIn.pageName) searchFields.push("title");
      if (filters.searchIn.pageContent) searchFields.push("content");

      if (searchFields.length > 0) {
        if (filters.searchBehavior === "simple") {
          // Simple search: use plain text search for partial matching
          searchQuery = searchQuery.textSearch(searchFields.join(","), query, {
            type: "plain",
          });
        } else {
          // Semantic search: use websearch for whole word matching
          searchQuery = searchQuery.textSearch(searchFields.join(","), query, {
            type: "websearch",
          });
        }
      }
    } else {
      if (filters.searchBehavior === "simple") {
        // Simple search: use plain text search for partial matching
        searchQuery = searchQuery.textSearch("title,content", query, {
          type: "plain",
        });
      } else {
        // Semantic search: use websearch for whole word matching
        searchQuery = searchQuery.textSearch("title,content", query, {
          type: "websearch",
        });
      }
    }

    // Apply parent_id filter for sub-pages
    if (filters.searchIn?.subPageName === false) {
      searchQuery = searchQuery.is("parent_id", null);
    }

    const { data: pages, error } = await searchQuery.range(
      offset,
      offset + limit - 1
    );

    if (error) {
      console.error("Search error:", error);
      throw new AppError(500, "Search failed");
    }

    // Get total count for pagination using same search logic
    let countQuery = supabase
      .from("pages")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .eq("is_deleted", false);

    if (filters.searchIn) {
      const searchFields = [];
      if (filters.searchIn.pageName) searchFields.push("title");
      if (filters.searchIn.pageContent) searchFields.push("content");

      if (searchFields.length > 0) {
        if (filters.searchBehavior === "simple") {
          // Simple search: use plain text search for partial matching
          countQuery = countQuery.textSearch(searchFields.join(","), query, {
            type: "plain",
          });
        } else {
          // Semantic search: use websearch for whole word matching
          countQuery = countQuery.textSearch(searchFields.join(","), query, {
            type: "websearch",
          });
        }
      }
    } else {
      if (filters.searchBehavior === "simple") {
        // Simple search: use plain text search for partial matching
        countQuery = countQuery.textSearch("title,content", query, {
          type: "plain",
        });
      } else {
        // Semantic search: use websearch for whole word matching
        countQuery = countQuery.textSearch("title,content", query, {
          type: "websearch",
        });
      }
    }

    if (filters.searchIn?.subPageName === false) {
      countQuery = countQuery.is("parent_id", null);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Count error:", countError);
      throw new AppError(500, "Failed to count search results");
    }

    // Transform results to include tags properly
    const transformedResults = await Promise.all(
      (pages || []).map(async (page: any) => {
        // Fetch tags for this page
        const { data: pageTags } = await supabase
          .from("page_tags")
          .select(
            `
            tag:tags(id, name, color)
          `
          )
          .eq("page_id", page.id);

        return {
          id: page.id,
          title: page.title,
          content: page.content,
          created_at: page.created_at,
          updated_at: page.updated_at,
          icon_url: page.icon_url,
          cover_url: page.cover_url,
          summary: page.summary,
          parent_id: page.parent_id,
          tags: pageTags?.map((pt: any) => pt.tag) || [],
        };
      })
    );

    res.json({
      results: transformedResults,
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

    const {
      query,
      workspace_id,
      limit,
      offset,
      filters,
      similarity_threshold,
    } = value;

    try {
      // Generate embedding for the query
      const queryEmbedding = await EmbeddingService.generateEmbedding(query);
      console.log(`🔍 Sidebar Search - Query: "${query}"`);
      console.log(`📊 Generated embedding length: ${queryEmbedding.length}`);

      // Use enhanced semantic search that includes files
      const { data: searchResults, error: searchError } = await supabase.rpc(
        "semantic_search_with_files",
        {
          query_embedding: JSON.stringify(queryEmbedding),
          workspace_filter: workspace_id,
          similarity_threshold: similarity_threshold,
          max_results: limit * 2, // Get more results to handle filtering
        }
      );

      console.log(`🔧 Enhanced search error:`, searchError);
      console.log(
        `📋 Enhanced search results count:`,
        searchResults?.length || 0
      );

      if (searchResults && searchResults.length > 0) {
        console.log(
          `🎯 Enhanced search results:`,
          searchResults.map((r: any) => ({
            source_type: r.source_type,
            title: r.title,
            similarity: r.similarity,
          }))
        );
      }

      if (searchError) {
        console.warn(
          "Enhanced search failed, falling back to page-only search:",
          searchError
        );
        // Fallback to original EmbeddingService
        const results = await EmbeddingService.semanticSearch(
          query,
          workspace_id,
          limit,
          similarity_threshold
        );

        // Transform to match expected format
        const transformedResults = results.map((result: any) => ({
          id: result.page_id || result.id,
          title: result.title,
          content: result.content,
          created_at: result.created_at,
          updated_at: result.updated_at || result.created_at,
          icon_url: result.icon_url || null,
          cover_url: result.cover_url || null,
          summary: result.summary || null,
          parent_id: result.parent_id || null,
          similarity: result.similarity,
          source_type: "page",
          tags: [],
        }));

        res.json({
          results: transformedResults,
          pagination: {
            limit,
            offset,
            total: transformedResults.length,
            hasMore: false,
          },
          query,
          similarity_threshold,
        });
        return;
      }

      // Process enhanced search results
      const processedResults = await Promise.all(
        (searchResults || []).map(async (result: any) => {
          if (result.source_type === "page") {
            // For page results, get full page data with tags
            const { data: pageData } = await supabase
              .from("pages")
              .select(
                `
                id, title, content, created_at, updated_at, 
                icon_url, cover_url, summary, parent_id
              `
              )
              .eq("id", result.page_id)
              .single();

            const { data: pageTags } = await supabase
              .from("page_tags")
              .select(`tag:tags(id, name, color)`)
              .eq("page_id", result.page_id);

            return {
              ...(pageData || {}),
              id: result.page_id,
              similarity: result.similarity,
              source_type: result.source_type,
              tags: pageTags?.map((pt: any) => pt.tag) || [],
            };
          } else {
            // For file results, get page data and indicate it's from a file
            const { data: pageData } = await supabase
              .from("pages")
              .select(
                `
                id, title, created_at, updated_at, 
                icon_url, cover_url, summary, parent_id
              `
              )
              .eq("id", result.page_id)
              .single();

            const { data: pageTags } = await supabase
              .from("page_tags")
              .select(`tag:tags(id, name, color)`)
              .eq("page_id", result.page_id);

            return {
              ...(pageData || {}),
              id: result.page_id,
              title: `📄 ${result.title} (in ${
                pageData?.title || "Unknown Page"
              })`,
              content: result.content, // File content
              similarity: result.similarity,
              source_type: result.source_type,
              tags: pageTags?.map((pt: any) => pt.tag) || [],
            };
          }
        })
      );

      // Apply tag filtering if specified
      let filteredResults = processedResults;
      if (filters.metadata?.tags && filters.metadata.tags.length > 0) {
        filteredResults = processedResults.filter((result: any) =>
          result.tags?.some((tag: any) =>
            filters.metadata.tags.includes(tag.id)
          )
        );
      }

      // Apply pagination
      const paginatedResults = filteredResults.slice(offset, offset + limit);

      res.json({
        results: paginatedResults,
        pagination: {
          limit,
          offset,
          total: filteredResults.length,
          hasMore: offset + limit < filteredResults.length,
        },
        query,
        similarity_threshold,
      });
    } catch (embeddingError) {
      console.warn(
        "Semantic search failed, falling back to text search:",
        embeddingError
      );

      // Fallback to regular text search with filters
      const hasTagFilter =
        filters.metadata?.tags && filters.metadata.tags.length > 0;

      let searchQuery;
      if (hasTagFilter) {
        // If filtering by tags, we need to join with page_tags table
        searchQuery = supabase
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
            summary,
            parent_id,
            page_tags!inner(tag_id)
          `
          )
          .eq("workspace_id", workspace_id)
          .eq("is_deleted", false)
          .in("page_tags.tag_id", filters.metadata.tags);
      } else {
        searchQuery = supabase
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
            summary,
            parent_id
          `
          )
          .eq("workspace_id", workspace_id)
          .eq("is_deleted", false);
      }

      // Apply search filters based on search behavior
      if (filters.searchIn) {
        const searchFields = [];
        if (filters.searchIn.pageName) searchFields.push("title");
        if (filters.searchIn.pageContent) searchFields.push("content");

        if (searchFields.length > 0) {
          if (filters.searchBehavior === "simple") {
            // Simple search: use plain text search for partial matching
            searchQuery = searchQuery.textSearch(
              searchFields.join(","),
              query,
              {
                type: "plain",
              }
            );
          } else {
            // Semantic search: use websearch for whole word matching
            searchQuery = searchQuery.textSearch(
              searchFields.join(","),
              query,
              {
                type: "websearch",
              }
            );
          }
        }
      } else {
        if (filters.searchBehavior === "simple") {
          // Simple search: use plain text search for partial matching
          searchQuery = searchQuery.textSearch("title,content", query, {
            type: "plain",
          });
        } else {
          // Semantic search: use websearch for whole word matching
          searchQuery = searchQuery.textSearch("title,content", query, {
            type: "websearch",
          });
        }
      }

      // Apply parent_id filter for sub-pages
      if (filters.searchIn?.subPageName === false) {
        searchQuery = searchQuery.is("parent_id", null);
      }

      const { data: pages, error } = await searchQuery.range(
        offset,
        offset + limit - 1
      );

      if (error) {
        console.error("Fallback search error:", error);
        throw new AppError(500, "Search failed");
      }

      // Transform results to include tags
      const transformedResults = await Promise.all(
        (pages || []).map(async (page: any) => {
          const { data: pageTags } = await supabase
            .from("page_tags")
            .select(
              `
              tag:tags(id, name, color)
            `
            )
            .eq("page_id", page.id);

          return {
            id: page.id,
            title: page.title,
            content: page.content,
            created_at: page.created_at,
            updated_at: page.updated_at,
            icon_url: page.icon_url,
            cover_url: page.cover_url,
            summary: page.summary,
            parent_id: page.parent_id,
            tags: pageTags?.map((pt: any) => pt.tag) || [],
          };
        })
      );

      res.json({
        results: transformedResults,
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

  // Search pages by tags only
  static async searchByTags(req: Request, res: Response) {
    const { error: validationError, value } = Joi.object({
      workspace_id: Joi.string().uuid().required(),
      tag_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0),
    }).validate(req.body);

    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { workspace_id, tag_ids, limit, offset } = value;

    // Get pages that have any of the specified tags
    const { data: pageIds, error: pageIdsError } = await supabase
      .from("page_tags")
      .select("page_id")
      .in("tag_id", tag_ids);

    if (pageIdsError) {
      console.error("Error fetching page IDs by tags:", pageIdsError);
      throw new AppError(500, "Failed to search by tags");
    }

    if (!pageIds || pageIds.length === 0) {
      res.json({
        results: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false,
        },
        tag_ids,
      });
      return;
    }

    const uniquePageIds = [...new Set(pageIds.map((p) => p.page_id))];

    // Get the actual pages
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
        summary,
        parent_id
      `
      )
      .eq("workspace_id", workspace_id)
      .eq("is_deleted", false)
      .in("id", uniquePageIds)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Error fetching pages:", error);
      throw new AppError(500, "Failed to fetch pages by tags");
    }

    // Transform results to include tags
    const transformedResults = await Promise.all(
      (pages || []).map(async (page: any) => {
        // Fetch tags for this page
        const { data: pageTags } = await supabase
          .from("page_tags")
          .select(
            `
            tag:tags(id, name, color)
          `
          )
          .eq("page_id", page.id);

        return {
          id: page.id,
          title: page.title,
          content: page.content,
          created_at: page.created_at,
          updated_at: page.updated_at,
          icon_url: page.icon_url,
          cover_url: page.cover_url,
          summary: page.summary,
          parent_id: page.parent_id,
          tags: pageTags?.map((pt: any) => pt.tag) || [],
        };
      })
    );

    res.json({
      results: transformedResults,
      pagination: {
        limit,
        offset,
        total: uniquePageIds.length,
        hasMore: offset + limit < uniquePageIds.length,
      },
      tag_ids,
    });
  }
}
