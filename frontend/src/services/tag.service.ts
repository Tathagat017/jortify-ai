import axios, { AxiosResponse } from "axios";
import { Tag } from "../stores/tag-store";

class TagService {
  private baseUrl: string =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  private async getAuthHeaders() {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  // =================== TAG CRUD OPERATIONS ===================

  async getAllTags(workspaceId: string): Promise<Tag[]> {
    const headers = await this.getAuthHeaders();
    const response: AxiosResponse<Tag[]> = await axios.get(
      `${this.baseUrl}/api/tags`,
      {
        headers,
        params: { workspace_id: workspaceId },
      }
    );
    return response.data;
  }

  async createTag(
    name: string,
    color: string,
    workspaceId: string
  ): Promise<Tag> {
    const headers = await this.getAuthHeaders();
    const response: AxiosResponse<Tag> = await axios.post(
      `${this.baseUrl}/api/tags`,
      {
        name,
        color,
        workspace_id: workspaceId,
      },
      { headers }
    );
    return response.data;
  }

  async updateTag(tagId: string, name: string, color: string): Promise<Tag> {
    const headers = await this.getAuthHeaders();
    const response: AxiosResponse<Tag> = await axios.put(
      `${this.baseUrl}/api/tags/${tagId}`,
      { name, color },
      { headers }
    );
    return response.data;
  }

  async deleteTag(tagId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    await axios.delete(`${this.baseUrl}/api/tags/${tagId}`, { headers });
  }

  // =================== PAGE TAG OPERATIONS ===================

  async addTagToPage(pageId: string, tagId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    await axios.post(
      `${this.baseUrl}/api/pages/${pageId}/tags`,
      { tagId },
      { headers }
    );
  }

  async removeTagFromPage(pageId: string, tagId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    await axios.delete(`${this.baseUrl}/api/pages/${pageId}/tags/${tagId}`, {
      headers,
    });
  }

  async getPageTags(pageId: string): Promise<Tag[]> {
    const headers = await this.getAuthHeaders();
    const response: AxiosResponse<Tag[]> = await axios.get(
      `${this.baseUrl}/api/pages/${pageId}/tags`,
      { headers }
    );
    return response.data;
  }

  // =================== BULK OPERATIONS ===================

  async addMultipleTagsToPage(pageId: string, tagIds: string[]): Promise<void> {
    const headers = await this.getAuthHeaders();
    await Promise.all(
      tagIds.map((tagId) =>
        axios.post(
          `${this.baseUrl}/api/pages/${pageId}/tags`,
          { tagId },
          { headers }
        )
      )
    );
  }

  async removeMultipleTagsFromPage(
    pageId: string,
    tagIds: string[]
  ): Promise<void> {
    const headers = await this.getAuthHeaders();
    await Promise.all(
      tagIds.map((tagId) =>
        axios.delete(`${this.baseUrl}/api/pages/${pageId}/tags/${tagId}`, {
          headers,
        })
      )
    );
  }

  // =================== SEARCH AND FILTER ===================

  async searchTags(workspaceId: string, query: string): Promise<Tag[]> {
    const tags = await this.getAllTags(workspaceId);
    return tags.filter((tag) =>
      tag.name.toLowerCase().includes(query.toLowerCase())
    );
  }

  async getTagsByColor(workspaceId: string, color: string): Promise<Tag[]> {
    const tags = await this.getAllTags(workspaceId);
    return tags.filter((tag) => tag.color === color);
  }
}

export const tagService = new TagService();
