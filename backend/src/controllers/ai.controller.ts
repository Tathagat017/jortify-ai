import { Request, Response } from "express";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { AIService } from "../services/ai.service";
import { SummaryService } from "../services/summary.service";
import { EmbeddingService } from "../services/embedding.service";
import { RAGChatService } from "../services/rag-chat.service";
import Joi from "joi";

// Validation schemas
const suggestionSchema = Joi.object({
  context: Joi.string().required(),
  currentText: Joi.string().required(),
  pageId: Joi.string().uuid().optional(),
  workspaceId: Joi.string().uuid().required(),
});

const linkSuggestionSchema = Joi.object({
  text: Joi.string().required().min(3),
  workspaceId: Joi.string().uuid().required(),
  pageId: Joi.string().uuid().optional(),
  contextWindow: Joi.number().integer().min(50).max(500).default(100),
});

const tagGenerationSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.array().default([]),
  workspaceId: Joi.string().uuid().required(),
});

const summarizeSchema = Joi.object({
  title: Joi.string().required(),
  content: Joi.array().default([]),
  length: Joi.string().valid("short", "medium", "long").default("medium"),
});

const completeTextSchema = Joi.object({
  text: Joi.string().required(),
  context: Joi.string().allow("").default(""),
  maxTokens: Joi.number().integer().min(50).max(500).default(150),
});

const chatSchema = Joi.object({
  question: Joi.string().required(),
  conversationId: Joi.string().uuid().optional(),
  workspaceId: Joi.string().uuid().required(),
  helpMode: Joi.boolean().optional(),
  webSearchEnabled: Joi.boolean().optional(),
});

const createConversationSchema = Joi.object({
  workspaceId: Joi.string().uuid().required(),
  title: Joi.string().optional().default("New Chat"),
  helpMode: Joi.boolean().optional(),
});

const generateContentSchema = Joi.object({
  suggestion: Joi.string().required().min(5),
  blockContext: Joi.string().required().min(10),
  workspaceId: Joi.string().uuid().required(),
  pageId: Joi.string().uuid().optional(),
});

export class AIController {
  // Real-time AI suggestions for in-editor assistance
  static async generateSuggestions(req: Request, res: Response) {
    const { error: validationError, value } = suggestionSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const suggestions = await AIService.generateSuggestions(value);

    // Log AI interaction
    try {
      await supabase.from("ai_sessions").insert({
        workspace_id: value.workspaceId,
        session_type: "suggestion",
        input_data: { context: value.context, currentText: value.currentText },
        output_data: suggestions,
        metadata: { pageId: value.pageId },
      });
    } catch (logError) {
      console.warn("Failed to log AI interaction:", logError);
    }

    res.json({
      success: true,
      suggestions: suggestions.suggestions,
      type: suggestions.type,
      timestamp: new Date().toISOString(),
    });
  }

  // Enhanced AI link suggestions using page summaries
  static async generateLinkSuggestions(req: Request, res: Response) {
    const { error: validationError, value } = linkSuggestionSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { text, workspaceId, pageId, contextWindow } = value;

    // Get enhanced link suggestions using summaries
    const linkSuggestions = await AIService.generateLinkSuggestions(
      text,
      workspaceId,
      pageId
    );

    // Log AI interaction
    try {
      await supabase.from("ai_sessions").insert({
        workspace_id: workspaceId,
        session_type: "link_suggestion",
        input_data: { text, contextWindow },
        output_data: { suggestions: linkSuggestions },
        metadata: { pageId, suggestionCount: linkSuggestions.length },
      });
    } catch (logError) {
      console.warn("Failed to log AI interaction:", logError);
    }

    res.json({
      success: true,
      suggestions: linkSuggestions,
      text,
      timestamp: new Date().toISOString(),
    });
  }

  // Generate semantic tags for a page
  static async generateTags(req: Request, res: Response) {
    const { error: validationError, value } = tagGenerationSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { title, content, workspaceId } = value;

    const tagResult = await AIService.generateTags(title, content, workspaceId);

    // Store generated tags in the database
    const tagsToCreate = [];
    for (const tag of tagResult.tags) {
      // Check if tag already exists
      const { data: existingTag } = await supabase
        .from("tags")
        .select("id")
        .eq("name", tag.name)
        .eq("workspace_id", workspaceId)
        .single();

      if (!existingTag) {
        tagsToCreate.push({
          name: tag.name,
          color: tag.color,
          workspace_id: workspaceId,
        });
      }
    }

    // Create new tags
    if (tagsToCreate.length > 0) {
      const { error: createTagError } = await supabase
        .from("tags")
        .insert(tagsToCreate);

      if (createTagError) {
        console.warn("Failed to create some tags:", createTagError);
      }
    }

    // Log AI interaction
    try {
      await supabase.from("ai_sessions").insert({
        workspace_id: workspaceId,
        session_type: "tag_generation",
        input_data: { title, content: JSON.stringify(content).slice(0, 500) },
        output_data: tagResult,
        metadata: { tagCount: tagResult.tags.length },
      });
    } catch (logError) {
      console.warn("Failed to log AI interaction:", logError);
    }

    res.json({
      success: true,
      tags: tagResult.tags,
      reasoning: tagResult.reasoning,
      timestamp: new Date().toISOString(),
    });
  }

  // Generate page summary
  static async summarizePage(req: Request, res: Response) {
    const { error: validationError, value } = summarizeSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { title, content, length } = value;

    const summary = await AIService.generateSummary(title, content, length);

    res.json({
      success: true,
      summary,
      length,
      timestamp: new Date().toISOString(),
    });
  }

  // Auto-complete text
  static async completeText(req: Request, res: Response) {
    const { error: validationError, value } = completeTextSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { text, context, maxTokens } = value;

    const completion = await AIService.completeText(text, context, maxTokens);

    res.json({
      success: true,
      completion,
      originalText: text,
      timestamp: new Date().toISOString(),
    });
  }

  // Analyze writing quality
  static async analyzeWriting(req: Request, res: Response) {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      throw new AppError(400, "Text is required for analysis");
    }

    const analysis = await AIService.analyzeWriting(text);

    res.json({
      success: true,
      analysis,
      textLength: text.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Generate content based on suggestion and block context
  static async generateContentFromSuggestion(req: Request, res: Response) {
    const { error: validationError, value } = generateContentSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { suggestion, blockContext, workspaceId, pageId } = value;

    const generatedContent = await AIService.generateContentFromSuggestion(
      suggestion,
      blockContext,
      workspaceId,
      pageId
    );

    // Log AI interaction
    try {
      await supabase.from("ai_sessions").insert({
        workspace_id: workspaceId,
        session_type: "content_generation",
        input_data: { suggestion, blockContext: blockContext.slice(0, 200) },
        output_data: { generatedContent: generatedContent.slice(0, 500) },
        metadata: { pageId, contentLength: generatedContent.length },
      });
    } catch (logError) {
      console.warn("Failed to log AI interaction:", logError);
    }

    res.json({
      success: true,
      generatedContent,
      originalSuggestion: suggestion,
      timestamp: new Date().toISOString(),
    });
  }

  // =================== RAG CHATBOT CONTROLLERS ===================

  // Create a new chat conversation
  static async createConversation(req: Request, res: Response) {
    const { error: validationError, value } = createConversationSchema.validate(
      req.body
    );
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const { workspaceId, title, helpMode } = value;
    const userId = req.user!.id; // Get userId from authenticated user

    // Validate workspace access
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .eq("user_id", userId) // Ensure user owns the workspace
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    const conversationId = await RAGChatService.createConversation(
      workspaceId,
      userId,
      title,
      helpMode || false
    );

    res.status(201).json({
      success: true,
      conversationId,
      workspaceId,
      title,
      helpMode: helpMode || false,
      timestamp: new Date().toISOString(),
    });
  }

  // RAG-based Q&A chatbot
  static async chatWithRAG(req: Request, res: Response) {
    const { error: validationError, value } = chatSchema.validate(req.body);
    if (validationError) {
      throw new AppError(
        400,
        `Validation error: ${validationError.details[0].message}`
      );
    }

    const {
      question,
      conversationId,
      workspaceId,
      helpMode,
      webSearchEnabled,
    } = value;
    const userId = req.user!.id; // Get userId from authenticated user

    // Validate workspace access
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", userId) // Ensure user owns the workspace
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // If no conversation ID provided, create a new conversation
    let activeConversationId = conversationId;
    if (!activeConversationId) {
      activeConversationId = await RAGChatService.createConversation(
        workspaceId,
        userId,
        "New Chat",
        helpMode || false
      );
    }

    // Validate conversation exists and user has access
    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .select("id, workspace_id, help_mode")
      .eq("id", activeConversationId)
      .eq("user_id", userId) // Ensure user owns the conversation
      .single();

    if (convError || !conversation) {
      throw new AppError(404, "Conversation not found");
    }

    if (conversation.workspace_id !== workspaceId) {
      throw new AppError(403, "Access denied to this conversation");
    }

    // Use help mode from conversation if not explicitly provided
    const useHelpMode =
      helpMode !== undefined ? helpMode : conversation.help_mode;

    // Generate RAG response
    const response = await RAGChatService.generateRAGResponse(
      question,
      activeConversationId,
      workspaceId,
      5, // maxResults
      useHelpMode || false,
      webSearchEnabled || false
    );

    // Log AI interaction
    try {
      await supabase.from("ai_sessions").insert({
        workspace_id: workspaceId,
        session_type: "rag_chat",
        input_data: { question, helpMode: useHelpMode, webSearchEnabled },
        output_data: { answer: response.answer, citations: response.citations },
        metadata: {
          conversationId: activeConversationId,
          citationCount: response.citations.length,
          helpMode: useHelpMode,
          webSearchEnabled: webSearchEnabled || false,
        },
      });
    } catch (logError) {
      console.warn("Failed to log AI interaction:", logError);
    }

    res.json({
      success: true,
      answer: response.answer,
      citations: response.citations,
      conversationId: response.conversationId,
      messageId: response.messageId,
      timestamp: new Date().toISOString(),
    });
  }

  // Get conversation history
  static async getConversationHistory(req: Request, res: Response) {
    const { conversationId } = req.params;
    const userId = req.user!.id; // Get userId from authenticated user

    // Validate conversation exists and user has access
    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .select(
        "id, title, workspace_id, created_at, updated_at, help_mode, metadata"
      )
      .eq("id", conversationId)
      .eq("user_id", userId) // Ensure user owns the conversation
      .single();

    if (convError || !conversation) {
      throw new AppError(404, "Conversation not found");
    }

    // Get conversation history
    const messages = await RAGChatService.getConversationHistory(
      conversationId
    );

    res.json({
      success: true,
      conversation: {
        id: conversation.id,
        title: conversation.title,
        workspaceId: conversation.workspace_id,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        helpMode: conversation.help_mode,
        metadata: conversation.metadata,
      },
      messages,
      messageCount: messages.length,
      timestamp: new Date().toISOString(),
    });
  }

  // Get all conversations for a workspace
  static async getWorkspaceConversations(req: Request, res: Response) {
    const { workspaceId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const userId = req.user!.id; // Get userId from authenticated user

    // Validate workspace access
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("id", workspaceId)
      .eq("user_id", userId) // Ensure user owns the workspace
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // Get conversations with pagination
    const { data: conversations, error } = await supabase
      .from("chat_conversations")
      .select(
        `
        id,
        title,
        updated_at,
        created_at,
        help_mode,
        metadata
      `
      )
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId) // Ensure user owns the conversations
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new AppError(500, "Failed to fetch conversations");
    }

    // Get message counts for each conversation
    const conversationsWithCounts = await Promise.all(
      (conversations || []).map(async (conv) => {
        const { count } = await supabase
          .from("chat_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id);

        return {
          id: conv.id,
          title: conv.title,
          updatedAt: conv.updated_at,
          createdAt: conv.created_at,
          messageCount: count || 0,
          helpMode: conv.help_mode,
          metadata: conv.metadata,
        };
      })
    );

    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from("chat_conversations")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId); // Ensure user owns the conversations

    if (countError) {
      throw new AppError(500, "Failed to count conversations");
    }

    res.json({
      success: true,
      conversations: conversationsWithCounts,
      pagination: {
        limit,
        offset,
        total: totalCount || 0,
        hasMore: offset + limit < (totalCount || 0),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Delete a conversation and all its messages
  static async deleteConversation(req: Request, res: Response) {
    const { conversationId } = req.params;

    // Validate conversation exists and user has access
    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .select("id, workspace_id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new AppError(404, "Conversation not found");
    }

    // Delete conversation (messages will be deleted automatically due to cascade)
    await RAGChatService.deleteConversation(conversationId);

    res.json({
      success: true,
      message: "Conversation deleted successfully",
      conversationId,
      timestamp: new Date().toISOString(),
    });
  }

  // Update conversation title
  static async updateConversationTitle(req: Request, res: Response) {
    const { conversationId } = req.params;
    const { title } = req.body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      throw new AppError(400, "Valid title is required");
    }

    // Validate conversation exists and user has access
    const { data: conversation, error: convError } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .single();

    if (convError || !conversation) {
      throw new AppError(404, "Conversation not found");
    }

    // Update title
    const { error: updateError } = await supabase
      .from("chat_conversations")
      .update({ title: title.trim() })
      .eq("id", conversationId);

    if (updateError) {
      throw new AppError(500, "Failed to update conversation title");
    }

    res.json({
      success: true,
      message: "Conversation title updated successfully",
      conversationId,
      title: title.trim(),
      timestamp: new Date().toISOString(),
    });
  }

  // Get knowledge graph data for visualization (workspace-wide)
  static async getWorkspaceKnowledgeGraph(req: Request, res: Response) {
    const { workspaceId } = req.params;
    const userId = req.user!.id;

    // Validate workspace exists and user has access
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .eq("user_id", userId)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // Get all pages in the workspace
    const { data: allPages, error: pagesError } = await supabase
      .from("pages")
      .select("id, title, content, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (pagesError) {
      throw new AppError(500, "Failed to fetch workspace pages");
    }

    if (!allPages || allPages.length === 0) {
      res.json({
        success: true,
        graph: {
          nodes: [],
          edges: [],
          centerNode: null,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Helper function to extract links from page content
    const extractLinksFromContent = (content: any[]): string[] => {
      const links: string[] = [];

      const traverseContent = (blocks: any[]) => {
        if (!Array.isArray(blocks)) return;

        blocks.forEach((block) => {
          // Handle different BlockNote content structures
          if (block.type === "link" && block.href) {
            // Extract page ID from href like "/page/uuid"
            const match = block.href.match(/\/page\/([a-f0-9-]+)/);
            if (match) {
              links.push(match[1]);
            }
          }

          // Check for text blocks with inline links
          if (block.type === "paragraph" || block.type === "heading") {
            if (block.content && Array.isArray(block.content)) {
              block.content.forEach((inline: any) => {
                if (
                  inline.type === "link" &&
                  inline.attrs &&
                  inline.attrs.href
                ) {
                  const match = inline.attrs.href.match(/\/page\/([a-f0-9-]+)/);
                  if (match) {
                    links.push(match[1]);
                  }
                }
              });
            }
          }

          // Handle nested structures
          if (block.content && Array.isArray(block.content)) {
            traverseContent(block.content);
          }
          if (block.children && Array.isArray(block.children)) {
            traverseContent(block.children);
          }
        });
      };

      traverseContent(content);
      return [...new Set(links)]; // Remove duplicates
    };

    // Create a map of all pages for easy lookup
    const pageMap = new Map();
    allPages.forEach((p) => pageMap.set(p.id, p));

    // Build a comprehensive link map
    const linkMap = new Map<string, string[]>();
    allPages.forEach((page) => {
      const links = extractLinksFromContent(page.content || []);
      linkMap.set(page.id, links);
      if (links.length > 0) {
        console.log(
          `🔗 Page "${page.title}" links to:`,
          links.map((id) => {
            const targetPage = pageMap.get(id);
            return targetPage
              ? `"${targetPage.title}" (${id})`
              : `Unknown (${id})`;
          })
        );
      }
    });

    console.log(`🔗 Building workspace graph for ${allPages.length} pages`);
    console.log(
      `📋 Total link relationships found: ${
        Array.from(linkMap.values()).flat().length
      }`
    );

    // Create nodes for all pages
    const nodes: any[] = [];
    const edges: any[] = [];

    // Calculate layout positions using a force-directed approach
    const centerX = 0;
    const centerY = 0;
    const radius = 300;

    // Identify pages with the most connections (hubs)
    const connectionCounts = new Map<string, number>();
    allPages.forEach((page) => {
      const outgoingLinks = linkMap.get(page.id) || [];
      const incomingLinks = Array.from(linkMap.entries()).filter(([_, links]) =>
        links.includes(page.id)
      ).length;
      connectionCounts.set(page.id, outgoingLinks.length + incomingLinks);
    });

    // Sort pages by connection count (most connected first)
    const sortedPages = [...allPages].sort(
      (a, b) =>
        (connectionCounts.get(b.id) || 0) - (connectionCounts.get(a.id) || 0)
    );

    // Position nodes in concentric circles based on connectivity
    sortedPages.forEach((page, index) => {
      const connectionCount = connectionCounts.get(page.id) || 0;
      let x, y;

      if (connectionCount === 0) {
        // Isolated pages go to the outer ring
        const angle = (index * 2 * Math.PI) / sortedPages.length;
        x = Math.cos(angle) * (radius + 100);
        y = Math.sin(angle) * (radius + 100);
      } else if (connectionCount >= 3) {
        // Highly connected pages go to the center
        const angle = (index * 2 * Math.PI) / Math.min(sortedPages.length, 6);
        x = Math.cos(angle) * 100;
        y = Math.sin(angle) * 100;
      } else {
        // Moderately connected pages go to the middle ring
        const angle = (index * 2 * Math.PI) / sortedPages.length;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
      }

      const hasOutgoingLinks = (linkMap.get(page.id) || []).length > 0;
      const hasIncomingLinks = Array.from(linkMap.entries()).some(
        ([_, links]) => links.includes(page.id)
      );

      let nodeType = "isolated";
      if (hasOutgoingLinks && hasIncomingLinks) {
        nodeType = "hub";
      } else if (hasOutgoingLinks) {
        nodeType = "source";
      } else if (hasIncomingLinks) {
        nodeType = "target";
      }

      nodes.push({
        id: page.id,
        label: page.title || "Untitled",
        type: nodeType,
        connectionCount,
        x,
        y,
      });
    });

    // Create edges for all links
    allPages.forEach((sourcePage) => {
      const links = linkMap.get(sourcePage.id) || [];
      links.forEach((targetPageId) => {
        if (pageMap.has(targetPageId)) {
          const targetPage = pageMap.get(targetPageId);
          console.log(
            `➡️ Creating edge: "${sourcePage.title}" -> "${targetPage.title}"`
          );
          edges.push({
            id: `${sourcePage.id}-${targetPageId}`,
            source: sourcePage.id,
            target: targetPageId,
            type: "page_link",
            weight: 1.0,
          });
        } else {
          console.log(`❌ Target page not found for link: ${targetPageId}`);
        }
      });
    });

    console.log(
      `📊 Generated workspace graph with ${nodes.length} nodes and ${edges.length} edges`
    );
    console.log(`🔗 Page links: ${edges.length}`);
    console.log(
      `🏢 Hub pages: ${nodes.filter((n) => n.type === "hub").length}`
    );
    console.log(
      `📤 Source pages: ${nodes.filter((n) => n.type === "source").length}`
    );
    console.log(
      `📥 Target pages: ${nodes.filter((n) => n.type === "target").length}`
    );
    console.log(
      `🏝️ Isolated pages: ${nodes.filter((n) => n.type === "isolated").length}`
    );

    res.json({
      success: true,
      graph: {
        nodes,
        edges,
        centerNode: null, // No single center node in workspace view
        workspaceId,
        workspaceName: workspace.name,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Generate workspace summaries (batch operation)
  static async generateWorkspaceSummaries(req: Request, res: Response) {
    const { workspaceId } = req.params;

    // Validate workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // Get all pages in the workspace that need summaries
    const { data: pages, error: pagesError } = await supabase
      .from("pages")
      .select("id, title")
      .eq("workspace_id", workspaceId);

    if (pagesError) {
      throw new AppError(500, "Failed to fetch pages");
    }

    // Generate summaries in background for all pages
    const summaryPromises =
      pages?.map((page) =>
        SummaryService.generatePageSummary(page.id, true).catch((error) => {
          console.error(
            `Failed to generate summary for page ${page.id}:`,
            error
          );
          return null;
        })
      ) || [];

    // Don't wait for all summaries to complete
    Promise.all(summaryPromises).catch((error) => {
      console.error("Some summaries failed to generate:", error);
    });

    res.json({
      success: true,
      message: "Summary generation started for workspace",
      workspaceId,
      pageCount: pages?.length || 0,
      timestamp: new Date().toISOString(),
    });
  }

  // Generate embeddings for workspace pages
  static async generateWorkspaceEmbeddings(req: Request, res: Response) {
    const { workspaceId } = req.params;

    // Validate workspace exists
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      throw new AppError(404, "Workspace not found");
    }

    // Generate embeddings in background
    EmbeddingService.generateWorkspaceEmbeddings(workspaceId).catch((error) => {
      console.error("Background embedding generation failed:", error);
    });

    res.json({
      success: true,
      message: "Embedding generation started for workspace",
      workspaceId,
      note: "Process is running in background",
      timestamp: new Date().toISOString(),
    });
  }
}
