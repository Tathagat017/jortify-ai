import { Request, Response } from "express";
import sharp from "sharp";
import { supabase } from "../lib/supabase";
import { AppError } from "../middleware/error-handler";
import { v4 as uuidv4 } from "uuid";

export class UploadController {
  // Upload page icon
  static async uploadIcon(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    const { page_id, workspace_id } = req.body;
    if (!page_id && !workspace_id) {
      throw new AppError(400, "Either page_id or workspace_id is required");
    }

    // Process image to standard icon size (280x280)
    const processedImage = await sharp(req.file.buffer)
      .resize(280, 280, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Generate unique filename
    const fileName = `icons/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(fileName, processedImage, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      throw new AppError(500, `Failed to upload icon: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(fileName);

    // Update page or workspace with new icon URL
    if (page_id) {
      const { error: updateError } = await supabase
        .from("pages")
        .update({ icon_url: publicUrl })
        .eq("id", page_id);

      if (updateError) {
        throw new AppError(500, "Failed to update page icon");
      }
    } else if (workspace_id) {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ icon_url: publicUrl })
        .eq("id", workspace_id);

      if (updateError) {
        throw new AppError(500, "Failed to update workspace icon");
      }
    }

    res.json({
      url: publicUrl,
      fileName: data.path,
      message: "Icon uploaded successfully",
    });
  }

  // Upload cover image
  static async uploadCover(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    const { page_id, workspace_id } = req.body;
    if (!page_id && !workspace_id) {
      throw new AppError(400, "Either page_id or workspace_id is required");
    }

    // Process image for cover (1200x400 aspect ratio)
    const processedImage = await sharp(req.file.buffer)
      .resize(1200, 400, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const fileName = `covers/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("uploads")
      .upload(fileName, processedImage, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      throw new AppError(500, `Failed to upload cover: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(fileName);

    // Update page or workspace with new cover URL
    if (page_id) {
      const { error: updateError } = await supabase
        .from("pages")
        .update({ cover_url: publicUrl })
        .eq("id", page_id);

      if (updateError) {
        throw new AppError(500, "Failed to update page cover");
      }
    } else if (workspace_id) {
      const { error: updateError } = await supabase
        .from("workspaces")
        .update({ cover_url: publicUrl })
        .eq("id", workspace_id);

      if (updateError) {
        throw new AppError(500, "Failed to update workspace cover");
      }
    }

    res.json({
      url: publicUrl,
      fileName: data.path,
      message: "Cover uploaded successfully",
    });
  }

  // Delete uploaded file
  static async deleteFile(req: Request, res: Response) {
    const { fileId } = req.params;

    // Extract file path from fileId (assuming format: "icons/uuid.jpg" or "covers/uuid.jpg")
    if (!fileId.includes("/")) {
      throw new AppError(400, "Invalid file ID format");
    }

    const { error } = await supabase.storage.from("uploads").remove([fileId]);

    if (error) {
      throw new AppError(500, `Failed to delete file: ${error.message}`);
    }

    res.json({
      message: "File deleted successfully",
      fileId,
    });
  }

  // Generate presigned URL for upload (alternative upload method)
  static async generatePresignedUrl(req: Request, res: Response) {
    const { fileId } = req.params;
    const { expiresIn = 3600 } = req.query; // Default 1 hour

    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUrl(fileId, parseInt(expiresIn as string));

    if (error) {
      throw new AppError(
        500,
        `Failed to generate presigned URL: ${error.message}`
      );
    }

    res.json({
      signedUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + parseInt(expiresIn as string) * 1000),
      fileId,
    });
  }

  // Get file info
  static async getFileInfo(req: Request, res: Response) {
    const { fileId } = req.params;

    const { data, error } = await supabase.storage
      .from("uploads")
      .list(fileId.split("/")[0], {
        search: fileId.split("/")[1],
      });

    if (error) {
      throw new AppError(500, `Failed to get file info: ${error.message}`);
    }

    const fileInfo = data?.[0];
    if (!fileInfo) {
      throw new AppError(404, "File not found");
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("uploads").getPublicUrl(fileId);

    res.json({
      name: fileInfo.name,
      size: fileInfo.metadata?.size,
      contentType: fileInfo.metadata?.mimetype,
      lastModified: fileInfo.updated_at,
      publicUrl,
      fileId,
    });
  }
}
