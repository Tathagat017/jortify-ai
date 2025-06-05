import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";
import { aiService, TagSuggestion } from "../services/ai.service";

export interface Tag {
  id: string;
  name: string;
  color: string;
  workspace_id: string;
  created_at: string;
}

export interface PageTag {
  page_id: string;
  tag_id: string;
  tag: Tag;
}

export class TagStore {
  queryClient: QueryClient;
  tags: Tag[] = [];
  selectedTags: string[] = []; // For filtering
  tagSuggestions: TagSuggestion[] = [];
  loading: boolean = false;
  autoGenerating: boolean = false; // New central loading state for auto-generation
  error: string | null = null;
  showTagSuggestions: boolean = false;
  private baseUrl: string =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  // =================== TAG CRUD OPERATIONS ===================

  async fetchTagsForWorkspace(workspaceId: string): Promise<Tag[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token || !workspaceId) {
      return [];
    }

    try {
      this.loading = true;
      const res: AxiosResponse<Tag[]> = await axios.get(
        `${this.baseUrl}/api/tags`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { workspace_id: workspaceId },
        }
      );

      runInAction(() => {
        this.tags = res.data;
        this.error = null;
      });

      return this.tags;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to fetch tags";
        console.error("Error fetching tags:", error);
      });
      return [];
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async createTag(
    name: string,
    color: string,
    workspaceId: string
  ): Promise<Tag | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Tag> = await axios.post(
        `${this.baseUrl}/api/tags`,
        {
          name,
          color,
          workspace_id: workspaceId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        this.tags.push(res.data);
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to create tag";
        console.error("Error creating tag:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async updateTag(
    tagId: string,
    name: string,
    color: string
  ): Promise<Tag | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Tag> = await axios.put(
        `${this.baseUrl}/api/tags/${tagId}`,
        { name, color },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        const index = this.tags.findIndex((tag) => tag.id === tagId);
        if (index !== -1) {
          this.tags[index] = res.data;
        }
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to update tag";
        console.error("Error updating tag:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async deleteTag(tagId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      this.loading = true;
      await axios.delete(`${this.baseUrl}/api/tags/${tagId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      runInAction(() => {
        this.tags = this.tags.filter((tag) => tag.id !== tagId);
        this.selectedTags = this.selectedTags.filter((id) => id !== tagId);
        this.error = null;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to delete tag";
        console.error("Error deleting tag:", error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  // =================== PAGE TAG OPERATIONS ===================

  async addTagToPage(pageId: string, tagId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      await axios.post(
        `${this.baseUrl}/api/pages/${pageId}/tags`,
        { tagId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to add tag to page";
        console.error("Error adding tag to page:", error);
      });
      return false;
    }
  }

  async removeTagFromPage(pageId: string, tagId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      await axios.delete(`${this.baseUrl}/api/pages/${pageId}/tags/${tagId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to remove tag from page";
        console.error("Error removing tag from page:", error);
      });
      return false;
    }
  }

  async getPageTags(pageId: string): Promise<Tag[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return [];

    try {
      const res: AxiosResponse<Tag[]> = await axios.get(
        `${this.baseUrl}/api/pages/${pageId}/tags`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return res.data;
    } catch (error) {
      console.error("Error fetching page tags:", error);
      return [];
    }
  }

  // =================== AI TAG GENERATION ===================

  async generateTagsForPage(
    title: string,
    content: object,
    workspaceId: string,
    pageId?: string,
    isAutoGeneration: boolean = false
  ): Promise<TagSuggestion[]> {
    try {
      if (isAutoGeneration) {
        this.autoGenerating = true;
      } else {
        this.loading = true;
      }

      const result = await aiService.generateTags(title, content, workspaceId);

      // Get existing page tags to filter out duplicates
      let existingPageTags: Tag[] = [];
      if (pageId) {
        existingPageTags = await this.getPageTags(pageId);
      }

      // Filter out duplicate tags (tags already on the page)
      const existingTagNames = existingPageTags.map((tag) =>
        tag.name.toLowerCase()
      );
      const uniqueSuggestions = result.tags.filter(
        (suggestion) =>
          !existingTagNames.includes(suggestion.name.toLowerCase())
      );

      runInAction(() => {
        if (uniqueSuggestions.length > 0) {
          this.tagSuggestions = uniqueSuggestions;
          this.showTagSuggestions = true;
        } else {
          // No unique suggestions
          this.tagSuggestions = [];
          if (isAutoGeneration) {
            // For auto-generation, don't show popover if all tags are duplicates
            this.showTagSuggestions = false;
          } else {
            // For manual generation, show message that all tags are already added
            this.showTagSuggestions = true;
            this.error = "All suggested tags are already added to this page";
          }
        }

        if (!isAutoGeneration) {
          this.error = null;
        }
      });

      return uniqueSuggestions;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to generate tags";
        this.tagSuggestions = [];
        this.showTagSuggestions = false;
        console.error("Error generating tags:", error);
      });
      return [];
    } finally {
      runInAction(() => {
        if (isAutoGeneration) {
          this.autoGenerating = false;
        } else {
          this.loading = false;
        }
      });
    }
  }

  // Start auto-generation (called from page store)
  startAutoGeneration(): void {
    runInAction(() => {
      this.autoGenerating = true;
    });
  }

  // Stop auto-generation (called when cancelled)
  stopAutoGeneration(): void {
    runInAction(() => {
      this.autoGenerating = false;
    });
  }

  async acceptTagSuggestion(
    suggestion: TagSuggestion,
    workspaceId: string,
    pageId?: string
  ): Promise<Tag | null> {
    // First, check if tag already exists
    const existingTag = this.tags.find((tag) => tag.name === suggestion.name);

    let tag: Tag;
    if (existingTag) {
      tag = existingTag;
    } else {
      // Create new tag
      const newTag = await this.createTag(
        suggestion.name,
        suggestion.color,
        workspaceId
      );
      if (!newTag) return null;
      tag = newTag;
    }

    // Add tag to page if pageId provided
    if (pageId) {
      await this.addTagToPage(pageId, tag.id);
    }

    // Remove from suggestions
    runInAction(() => {
      this.tagSuggestions = this.tagSuggestions.filter(
        (s) => s.name !== suggestion.name
      );
    });

    return tag;
  }

  dismissTagSuggestion(suggestion: TagSuggestion): void {
    runInAction(() => {
      this.tagSuggestions = this.tagSuggestions.filter(
        (s) => s.name !== suggestion.name
      );
    });
  }

  dismissAllTagSuggestions(): void {
    runInAction(() => {
      this.tagSuggestions = [];
      this.showTagSuggestions = false;
      this.error = null; // Clear any duplicate tag error message
    });
  }

  // =================== TAG FILTERING ===================

  toggleTagFilter(tagId: string): void {
    runInAction(() => {
      if (this.selectedTags.includes(tagId)) {
        this.selectedTags = this.selectedTags.filter((id) => id !== tagId);
      } else {
        this.selectedTags.push(tagId);
      }
    });
  }

  clearTagFilters(): void {
    runInAction(() => {
      this.selectedTags = [];
    });
  }

  isTagSelected(tagId: string): boolean {
    return this.selectedTags.includes(tagId);
  }

  // =================== UTILITY METHODS ===================

  getTagById(tagId: string): Tag | undefined {
    return this.tags.find((tag) => tag.id === tagId);
  }

  getTagByName(name: string): Tag | undefined {
    return this.tags.find((tag) => tag.name === name);
  }

  getTagsByColor(color: string): Tag[] {
    return this.tags.filter((tag) => tag.color === color);
  }

  clearError(): void {
    runInAction(() => {
      this.error = null;
    });
  }

  clearTags(): void {
    runInAction(() => {
      this.tags = [];
      this.selectedTags = [];
      this.tagSuggestions = [];
      this.showTagSuggestions = false;
      this.autoGenerating = false;
      this.error = null;
    });
  }
}

export default TagStore;
