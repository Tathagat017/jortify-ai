import axios from "axios";

export interface UploadResponse {
  url: string;
  fileName: string;
  message: string;
}

export class UploadService {
  private static baseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  /**
   * Upload an icon image for a page
   */
  static async uploadPageIcon(file: File, pageId: string): Promise<string> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();
    formData.append("icon", file);
    formData.append("page_id", pageId);

    try {
      const response = await axios.post<UploadResponse>(
        `${this.baseUrl}/api/upload/icon`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.url;
    } catch (error) {
      console.error("Error uploading page icon:", error);
      throw new Error("Failed to upload icon");
    }
  }

  /**
   * Upload a cover image for a page
   */
  static async uploadPageCover(file: File, pageId: string): Promise<string> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();
    formData.append("cover", file);
    formData.append("page_id", pageId);

    try {
      const response = await axios.post<UploadResponse>(
        `${this.baseUrl}/api/upload/cover`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.url;
    } catch (error) {
      console.error("Error uploading page cover:", error);
      throw new Error("Failed to upload cover image");
    }
  }

  /**
   * Upload a general image for page content
   */
  static async uploadContentImage(
    file: File,
    pageId?: string
  ): Promise<string> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("Authentication required");
    }

    const formData = new FormData();
    formData.append("image", file);
    if (pageId) {
      formData.append("page_id", pageId);
    }

    try {
      // Use the general upload endpoint for content images
      const response = await axios.post<UploadResponse>(
        `${this.baseUrl}/api/upload/image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      return response.data.url;
    } catch (error) {
      console.error("Error uploading content image:", error);
      throw new Error("Failed to upload image");
    }
  }

  /**
   * Convert blob URL to File object for upload
   */
  static async blobUrlToFile(
    blobUrl: string,
    fileName: string = "image.jpg"
  ): Promise<File> {
    try {
      const response = await fetch(blobUrl);
      const blob = await response.blob();
      return new File([blob], fileName, { type: blob.type });
    } catch (error) {
      console.error("Error converting blob URL to file:", error);
      throw new Error("Failed to process image");
    }
  }

  /**
   * Check if a URL is a blob URL
   */
  static isBlobUrl(url: string): boolean {
    return url.startsWith("blob:");
  }

  /**
   * Process and upload image from blob URL
   */
  static async processAndUploadBlobImage(
    blobUrl: string,
    pageId: string,
    type: "icon" | "cover" | "content" = "content"
  ): Promise<string> {
    if (!this.isBlobUrl(blobUrl)) {
      return blobUrl; // Already a permanent URL
    }

    try {
      const file = await this.blobUrlToFile(blobUrl);

      switch (type) {
        case "icon":
          return await this.uploadPageIcon(file, pageId);
        case "cover":
          return await this.uploadPageCover(file, pageId);
        case "content":
        default:
          return await this.uploadContentImage(file, pageId);
      }
    } catch (error) {
      console.error("Error processing blob image:", error);
      throw error;
    }
  }
}
