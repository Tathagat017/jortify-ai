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
      .from("page-icons")
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
    } = supabase.storage.from("page-icons").getPublicUrl(fileName);

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
      .from("page-covers")
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
    } = supabase.storage.from("page-covers").getPublicUrl(fileName);

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

  // Upload general image for content
  static async uploadImage(req: Request, res: Response) {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
    }

    // Process image with reasonable size limits
    const processedImage = await sharp(req.file.buffer)
      .resize(1920, 1080, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Generate unique filename
    const fileName = `images/${uuidv4()}.jpg`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("user-uploads")
      .upload(fileName, processedImage, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      throw new AppError(500, `Failed to upload image: ${error.message}`);
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("user-uploads").getPublicUrl(fileName);

    res.json({
      url: publicUrl,
      fileName: data.path,
      message: "Image uploaded successfully",
    });
  }

  // Delete uploaded file
  static async deleteFile(req: Request, res: Response) {
    const { fileId } = req.params;

    // Extract file path from fileId (assuming format: "icons/uuid.jpg" or "covers/uuid.jpg")
    if (!fileId.includes("/")) {
      throw new AppError(400, "Invalid file ID format");
    }

    // Determine bucket based on file path
    let bucketName: string;
    if (fileId.startsWith("icons/")) {
      bucketName = "page-icons";
    } else if (fileId.startsWith("covers/")) {
      bucketName = "page-covers";
    } else if (fileId.startsWith("images/")) {
      bucketName = "user-uploads";
    } else {
      throw new AppError(
        400,
        "Invalid file path - must start with icons/, covers/, or images/"
      );
    }

    const { error } = await supabase.storage.from(bucketName).remove([fileId]);

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

    // Determine bucket based on file path
    let bucketName: string;
    if (fileId.startsWith("icons/")) {
      bucketName = "page-icons";
    } else if (fileId.startsWith("covers/")) {
      bucketName = "page-covers";
    } else if (fileId.startsWith("images/")) {
      bucketName = "user-uploads";
    } else {
      throw new AppError(
        400,
        "Invalid file path - must start with icons/, covers/, or images/"
      );
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
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

    // Determine bucket based on file path
    let bucketName: string;
    if (fileId.startsWith("icons/")) {
      bucketName = "page-icons";
    } else if (fileId.startsWith("covers/")) {
      bucketName = "page-covers";
    } else if (fileId.startsWith("images/")) {
      bucketName = "user-uploads";
    } else {
      throw new AppError(
        400,
        "Invalid file path - must start with icons/, covers/, or images/"
      );
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
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
    } = supabase.storage.from(bucketName).getPublicUrl(fileId);

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
