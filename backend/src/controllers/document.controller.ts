import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { FileEmbeddingService } from "../services/file-embedding.service";

export class DocumentController {
  /**
   * Upload a document file for a page
   */
  static async uploadDocument(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    const { page_id, workspace_id } = req.body;
    const userId = req.user?.id;

    if (!page_id || !workspace_id || !userId) {
      throw new AppError(400, "Missing required fields: page_id, workspace_id");
    }

    // Validate file type
    const fileExtension = req.file.originalname.split(".").pop()?.toLowerCase();
    if (!fileExtension || !["pdf", "docx"].includes(fileExtension)) {
      throw new AppError(
        400,
        "Invalid file type. Only PDF and DOCX files are allowed"
      );
    }

    // Validate file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      throw new AppError(400, "File size exceeds 10MB limit");
    }

    try {
      // Generate unique filename
      const fileName = `documents/${page_id}/${uuidv4()}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("page-documents")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (uploadError) {
        throw new AppError(
          500,
          `Failed to upload document: ${uploadError.message}`
        );
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("page-documents").getPublicUrl(fileName);

      // Create file record in database
      const { data: fileRecord, error: dbError } = await supabase
        .from("page_files")
        .insert({
          page_id,
          workspace_id,
          user_id: userId,
          file_name: req.file.originalname,
          file_type: fileExtension as "pdf" | "docx",
          file_size: req.file.size,
          file_url: publicUrl,
          storage_path: fileName,
          metadata: {
            mime_type: req.file.mimetype,
            uploaded_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await supabase.storage.from("page-documents").remove([fileName]);
        throw new AppError(
          500,
          `Failed to save file record: ${dbError.message}`
        );
      }

      // Process file for embeddings asynchronously
      FileEmbeddingService.processFileForEmbeddings(
        fileRecord.id,
        req.file.buffer,
        fileExtension as "pdf" | "docx"
      ).catch((error) => {
        console.error("Error processing file embeddings:", error);
        // Don't fail the upload if embedding generation fails
      });

      res.json({
        id: fileRecord.id,
        file_name: fileRecord.file_name,
        file_type: fileRecord.file_type,
        file_size: fileRecord.file_size,
        file_url: fileRecord.file_url,
        created_at: fileRecord.created_at,
        message: "Document uploaded successfully",
      });
    } catch (error) {
      console.error("Document upload error:", error);
      throw error;
    }
  }

  /**
   * Get all documents for a page
   */
  static async getPageDocuments(req: Request, res: Response) {
    const { pageId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    try {
      const { data: documents, error } = await supabase
        .from("page_files")
        .select("*")
        .eq("page_id", pageId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new AppError(500, `Failed to fetch documents: ${error.message}`);
      }

      res.json({
        documents: documents || [],
        count: documents?.length || 0,
      });
    } catch (error) {
      console.error("Error fetching page documents:", error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  static async deleteDocument(req: Request, res: Response) {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    try {
      // Get file record
      const { data: fileRecord, error: fetchError } = await supabase
        .from("page_files")
        .select("*")
        .eq("id", fileId)
        .single();

      if (fetchError || !fileRecord) {
        throw new AppError(404, "Document not found");
      }

      // Check ownership
      if (fileRecord.user_id !== userId) {
        // Check if user owns the workspace
        const { data: workspace, error: workspaceError } = await supabase
          .from("workspaces")
          .select("user_id")
          .eq("id", fileRecord.workspace_id)
          .single();

        if (workspaceError || !workspace || workspace.user_id !== userId) {
          throw new AppError(403, "Forbidden");
        }
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("page-documents")
        .remove([fileRecord.storage_path]);

      if (storageError) {
        console.error("Storage deletion error:", storageError);
      }

      // Delete embeddings
      await FileEmbeddingService.deleteFileEmbeddings(fileId);

      // Delete from database (this will cascade delete embeddings too)
      const { error: deleteError } = await supabase
        .from("page_files")
        .delete()
        .eq("id", fileId);

      if (deleteError) {
        throw new AppError(
          500,
          `Failed to delete document: ${deleteError.message}`
        );
      }

      res.json({
        message: "Document deleted successfully",
        fileId,
      });
    } catch (error) {
      console.error("Error deleting document:", error);
      throw error;
    }
  }

  /**
   * Download a document
   */
  static async downloadDocument(req: Request, res: Response) {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    try {
      // Get file record
      const { data: fileRecord, error: fetchError } = await supabase
        .from("page_files")
        .select("*")
        .eq("id", fileId)
        .single();

      if (fetchError || !fileRecord) {
        throw new AppError(404, "Document not found");
      }

      // Generate signed URL for download
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from("page-documents")
        .createSignedUrl(fileRecord.storage_path, 3600); // 1 hour expiry

      if (urlError || !signedUrlData) {
        throw new AppError(500, "Failed to generate download URL");
      }

      res.json({
        download_url: signedUrlData.signedUrl,
        file_name: fileRecord.file_name,
        expires_in: 3600,
      });
    } catch (error) {
      console.error("Error generating download URL:", error);
      throw error;
    }
  }
}
