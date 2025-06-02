import axiosInstance from "../lib/axios";
import { AxiosResponse } from "axios";
import { Tag } from "../stores/tag-store";

class TagService {
  // =================== TAG CRUD OPERATIONS ===================

  async getAllTags(): Promise<Tag[]> {
    try {
      const response: AxiosResponse<Tag[]> = await axiosInstance.get(
        `/api/tags`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tags:", error);
      throw error;
    }
  }

  async createTag(name: string, color?: string): Promise<Tag> {
    try {
      const response: AxiosResponse<Tag> = await axiosInstance.post(
        `/api/tags`,
        { name, color }
      );
      return response.data;
    } catch (error) {
      console.error("Error creating tag:", error);
      throw error;
    }
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag> {
    try {
      const response: AxiosResponse<Tag> = await axiosInstance.put(
        `/api/tags/${id}`,
        updates
      );
      return response.data;
    } catch (error) {
      console.error("Error updating tag:", error);
      throw error;
    }
  }

  async deleteTag(id: string): Promise<void> {
    try {
      await axiosInstance.delete(`/api/tags/${id}`);
    } catch (error) {
      console.error("Error deleting tag:", error);
      throw error;
    }
  }

  // =================== PAGE TAG OPERATIONS ===================

  async getTagsByPageId(pageId: string): Promise<Tag[]> {
    try {
      const response: AxiosResponse<Tag[]> = await axiosInstance.get(
        `/api/tags/page/${pageId}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching tags for page:", error);
      throw error;
    }
  }

  async addTagToPage(pageId: string, tagId: string): Promise<void> {
    try {
      await axiosInstance.post(`/api/tags/page/${pageId}/tag/${tagId}`);
    } catch (error) {
      console.error("Error adding tag to page:", error);
      throw error;
    }
  }

  async removeTagFromPage(pageId: string, tagId: string): Promise<void> {
    try {
      await axiosInstance.delete(`/api/tags/page/${pageId}/tag/${tagId}`);
    } catch (error) {
      console.error("Error removing tag from page:", error);
      throw error;
    }
  }

  async getPagesByTagId(
    tagId: string
  ): Promise<{ id: string; title: string }[]> {
    try {
      const response: AxiosResponse<{ id: string; title: string }[]> =
        await axiosInstance.get(`/api/tags/${tagId}/pages`);
      return response.data;
    } catch (error) {
      console.error("Error fetching pages for tag:", error);
      throw error;
    }
  }

  // =================== BULK OPERATIONS ===================

  async bulkCreateTags(
    tags: { name: string; color?: string }[]
  ): Promise<Tag[]> {
    try {
      const response: AxiosResponse<Tag[]> = await axiosInstance.post(
        `/api/tags/bulk`,
        { tags }
      );
      return response.data;
    } catch (error) {
      console.error("Error bulk creating tags:", error);
      throw error;
    }
  }

  // =================== SEARCH AND FILTER ===================

  async searchTags(query: string): Promise<Tag[]> {
    try {
      const response: AxiosResponse<Tag[]> = await axiosInstance.get(
        `/api/tags/search`,
        {
          params: { q: query },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error searching tags:", error);
      throw error;
    }
  }

  async getTagUsageStats(): Promise<
    { tagId: string; tagName: string; usageCount: number }[]
  > {
    try {
      const response: AxiosResponse<
        { tagId: string; tagName: string; usageCount: number }[]
      > = await axiosInstance.get(`/api/tags/stats`);
      return response.data;
    } catch (error) {
      console.error("Error fetching tag usage stats:", error);
      throw error;
    }
  }

  async getAutocompleteTags(query: string): Promise<Tag[]> {
    try {
      const response: AxiosResponse<Tag[]> = await axiosInstance.get(
        `/api/tags/autocomplete`,
        {
          params: { q: query },
        }
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching autocomplete tags:", error);
      throw error;
    }
  }
}

export const tagService = new TagService();
