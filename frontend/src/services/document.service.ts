import axios from "axios";

export interface PageDocument {
  id: string;
  page_id: string;
  workspace_id: string;
  user_id: string;
  file_name: string;
  file_type: "pdf" | "docx";
  file_size: number;
  file_url: string;
  storage_path: string;
  metadata: {
    mime_type?: string;
    uploaded_at?: string;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface DocumentUploadResponse {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  created_at: string;
  message: string;
}

export interface DocumentDownloadResponse {
  download_url: string;
  file_name: string;
  expires_in: number;
}

export class DocumentService {
  private static baseUrl =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  /**
   * Get auth headers
   */
  private static getAuthHeaders() {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("Authentication required");
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Upload a document file for a page
   */
  static async uploadDocument(
    file: File,
    pageId: string,
    workspaceId: string
  ): Promise<DocumentUploadResponse> {
    const formData = new FormData();
    formData.append("document", file);
    formData.append("page_id", pageId);
    formData.append("workspace_id", workspaceId);

    const response = await axios.post<DocumentUploadResponse>(
      `${this.baseUrl}/api/documents/upload`,
      formData,
      {
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  }

  /**
   * Get all documents for a page
   */
  static async getPageDocuments(pageId: string): Promise<{
    documents: PageDocument[];
    count: number;
  }> {
    const response = await axios.get(
      `${this.baseUrl}/api/documents/page/${pageId}`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  /**
   * Delete a document
   */
  static async deleteDocument(fileId: string): Promise<void> {
    await axios.delete(`${this.baseUrl}/api/documents/${fileId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  /**
   * Get download URL for a document
   */
  static async getDocumentDownloadUrl(
    fileId: string
  ): Promise<DocumentDownloadResponse> {
    const response = await axios.get<DocumentDownloadResponse>(
      `${this.baseUrl}/api/documents/${fileId}/download`,
      {
        headers: this.getAuthHeaders(),
      }
    );
    return response.data;
  }

  /**
   * Download a document
   */
  static async downloadDocument(
    fileId: string,
    fileName: string
  ): Promise<void> {
    try {
      const { download_url } = await this.getDocumentDownloadUrl(fileId);

      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = download_url;
      link.download = fileName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading document:", error);
      throw error;
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["pdf", "docx"].includes(extension)) {
      return {
        valid: false,
        error: "Only PDF and DOCX files are allowed",
      };
    }

    // Check file size (10MB max)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: "File size must be less than 10MB",
      };
    }

    return { valid: true };
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}
