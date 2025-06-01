import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";
import type { PartialBlock } from "@blocknote/core";
import editorStore from "./editor-store";

// Simplified BlockNote content interface for better compatibility
export interface BlockNoteContent {
  type:
    | "paragraph"
    | "heading"
    | "bulletListItem"
    | "numberedListItem"
    | "codeBlock"
    | "image"
    | "table"
    | "callout";
  content?: Array<{
    type: string;
    text?: string;
    href?: string;
    [key: string]: unknown;
  }>;
  props?: {
    backgroundColor?: string;
    textColor?: string;
    textAlignment?: "left" | "center" | "right";
    level?: number;
    [key: string]: unknown;
  };
  children?: BlockNoteContent[];
  id?: string;
}

export interface Page {
  id: string;
  title: string;
  user_id: string;
  workspace_id: string;
  content?: PartialBlock[]; // BlockNote content
  icon?: string;
  icon_url?: string;
  cover_image?: string;
  cover_url?: string;
  created_at?: string;
  updated_at?: string;
  is_deleted?: boolean;
  parent_id?: string | null; // For nested pages
  summary?: string | null;
  summary_updated_at?: string | null;
  tags?: Array<{
    id: string;
    name: string;
    color: string;
  }>;
}

export class PageStore {
  queryClient: QueryClient;
  pages: Page[] = [];
  trashedPages: Page[] = [];
  selectedPage: Page | null = null;
  loading: boolean = false;
  error: string | null = null;
  private baseUrl: string =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  async fetchPagesForWorkspace(workspaceId?: string): Promise<Page[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token || !workspaceId) {
      return [];
    }

    try {
      this.loading = true;
      const res: AxiosResponse<Page[]> = await axios.get(
        `${this.baseUrl}/api/pages/workspace/${workspaceId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      runInAction(() => {
        this.pages = res.data.filter((p: Page) => !p.is_deleted);
        this.trashedPages = res.data.filter((p: Page) => p.is_deleted);

        // Auto-select first page if none selected
        if (this.pages.length > 0 && !this.selectedPage) {
          this.selectedPage = this.pages[0];
        }
        this.error = null;
      });

      return this.pages;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to fetch pages";
        console.error("Error fetching pages:", error);
      });
      return [];
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  // Legacy method for backward compatibility
  async fetchPagesForUser(): Promise<Page[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      return [];
    }

    try {
      this.loading = true;
      const res: AxiosResponse<Page[]> = await axios.get(
        `${this.baseUrl}/api/pages`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      runInAction(() => {
        this.pages = res.data.filter((p: Page) => !p.is_deleted);
        this.trashedPages = res.data.filter((p: Page) => p.is_deleted);

        // Auto-select first page if none selected
        if (this.pages.length > 0 && !this.selectedPage) {
          this.selectedPage = this.pages[0];
        }
        this.error = null;
      });

      return this.pages;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to fetch pages";
        console.error("Error fetching pages:", error);
      });
      return [];
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async createNewPage(
    workspaceId: string,
    parentId?: string
  ): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token || !workspaceId) return null;

    const newPageData = {
      title: "Untitled",
      content: [{ type: "paragraph", content: "" }],
      workspace_id: workspaceId,
      parent_id: parentId || null,
    };

    try {
      this.loading = true;
      const res: AxiosResponse<Page> = await axios.post(
        `${this.baseUrl}/api/pages`,
        newPageData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        this.pages.push(res.data);
        this.selectedPage = res.data;
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to create page";
        console.error("Error creating page:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async updatePage(
    pageId: string,
    updates: Partial<Page>
  ): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      // First update the local state optimistically
      runInAction(() => {
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          this.pages[pageIndex] = { ...this.pages[pageIndex], ...updates };
          if (this.selectedPage?.id === pageId) {
            this.selectedPage = { ...this.selectedPage, ...updates };
          }
        }
      });

      // Then make the API call (don't include user_id in updates)
      const res: AxiosResponse<Page> = await axios.put(
        `${this.baseUrl}/api/pages/${pageId}`,
        updates,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Update with server response
      runInAction(() => {
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          this.pages[pageIndex] = res.data;
          if (this.selectedPage?.id === pageId) {
            this.selectedPage = res.data;
          }
        }
        this.error = null;
      });

      return res.data;
    } catch (error) {
      // Revert optimistic update on error
      runInAction(() => {
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          // Fetch the latest state from server
          this.fetchPageById(pageId).then((page) => {
            if (page) {
              this.pages[pageIndex] = page;
              if (this.selectedPage?.id === pageId) {
                this.selectedPage = page;
              }
            }
          });
        }
        this.error = "Failed to update page";
        console.error("Error updating page:", error);
      });
      return null;
    }
  }

  async duplicatePage(pageId: string, title?: string): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Page> = await axios.post(
        `${this.baseUrl}/api/pages/${pageId}/duplicate`,
        {
          title:
            title ||
            `Copy of ${
              this.pages.find((p) => p.id === pageId)?.title || "Page"
            }`,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        this.pages.push(res.data);
        this.selectedPage = res.data;
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to duplicate page";
        console.error("Error duplicating page:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async movePage(
    pageId: string,
    newParentId: string | null
  ): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Page> = await axios.patch(
        `${this.baseUrl}/api/pages/${pageId}/move`,
        {
          parent_id: newParentId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        const index = this.pages.findIndex((p) => p.id === pageId);
        if (index !== -1) {
          this.pages[index] = res.data;
          if (this.selectedPage?.id === pageId) {
            this.selectedPage = res.data;
          }
        }
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to move page";
        console.error("Error moving page:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async deletePage(pageId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      this.loading = true;
      await axios.delete(`${this.baseUrl}/api/pages/${pageId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      runInAction(() => {
        // Move page from pages to trash
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          const deletedPage = { ...this.pages[pageIndex], is_deleted: true };
          this.pages.splice(pageIndex, 1);
          this.trashedPages.push(deletedPage);

          // Select another page if the deleted one was selected
          if (this.selectedPage?.id === pageId) {
            this.selectedPage = this.pages.length > 0 ? this.pages[0] : null;
          }
        }
        this.error = null;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to delete page";
        console.error("Error deleting page:", error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async restorePage(pageId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      this.loading = true;
      const res: AxiosResponse<Page> = await axios.patch(
        `${this.baseUrl}/api/pages/${pageId}`,
        { is_deleted: false },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        // Move page from trash back to pages
        const pageIndex = this.trashedPages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          const restoredPage = res.data;
          this.trashedPages.splice(pageIndex, 1);
          this.pages.push(restoredPage);
        }
        this.error = null;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to restore page";
        console.error("Error restoring page:", error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async permanentlyDeletePage(pageId: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      this.loading = true;
      await axios.delete(`${this.baseUrl}/api/pages/${pageId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      runInAction(() => {
        // Remove from trash permanently
        const pageIndex = this.trashedPages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          this.trashedPages.splice(pageIndex, 1);
        }
        this.error = null;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to permanently delete page";
        console.error("Error permanently deleting page:", error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  selectPage(page: Page) {
    runInAction(() => {
      this.selectedPage = page;
      // Update URL without full page reload
      window.history.pushState({}, "", `/dashboard/${page.id}`);

      // Clear editor instance to force recreation
      if (editorStore.editor) {
        editorStore.editor = null;
      }
    });
  }

  async fetchPageById(id: string): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      return null;
    }

    try {
      const res: AxiosResponse<Page> = await axios.get(
        `${this.baseUrl}/api/pages/${id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching page:", error);
      return null;
    }
  }

  // Filter pages based on search query
  getFilteredPages(searchQuery: string): Page[] {
    if (!searchQuery.trim()) return this.pages;

    const query = searchQuery.toLowerCase();
    return this.pages.filter((page) =>
      page.title.toLowerCase().includes(query)
    );
  }

  // Get pages organized in tree structure (max 2 levels)
  getPageTree(): Page[] {
    const rootPages = this.pages.filter((page) => !page.parent_id);
    return this.buildPageTree(rootPages, 0, 1); // Max depth of 1 (0 = root, 1 = sub-page)
  }

  private buildPageTree(
    pages: Page[],
    currentLevel: number,
    maxLevel: number
  ): Page[] {
    if (currentLevel >= maxLevel) {
      return pages.map((page) => ({ ...page, children: [] }));
    }

    return pages.map((page) => ({
      ...page,
      children: this.buildPageTree(
        this.pages.filter((p) => p.parent_id === page.id),
        currentLevel + 1,
        maxLevel
      ),
    }));
  }

  // Clear pages when switching workspaces
  clearPages() {
    this.pages = [];
    this.trashedPages = [];
    this.selectedPage = null;
  }

  clearError() {
    this.error = null;
  }

  // Add method to handle page selection from URL
  async selectPageFromUrl(pageId: string) {
    if (!pageId) return;

    // First check if page is in memory
    const existingPage = this.pages.find((p) => p.id === pageId);
    if (existingPage) {
      this.selectPage(existingPage);
      return;
    }

    // If not in memory, fetch from server
    try {
      const page = await this.fetchPageById(pageId);
      if (page) {
        runInAction(() => {
          this.pages.push(page);
          this.selectPage(page);
        });
      }
    } catch (error) {
      console.error("Error fetching page from URL:", error);
    }
  }

  // Add method to handle content reordering
  async updatePageContent(
    pageId: string,
    content: PartialBlock[]
  ): Promise<boolean> {
    try {
      await this.updatePage(pageId, { content });
      return true;
    } catch (error) {
      console.error("Error updating page content:", error);
      return false;
    }
  }

  // Add method to handle manual page linking
  async linkPages(
    sourcePageId: string,
    targetPageId: string
  ): Promise<boolean> {
    try {
      const sourcePage = this.pages.find((p) => p.id === sourcePageId);
      if (!sourcePage) return false;

      // Add link to content
      const linkContent: PartialBlock = {
        type: "paragraph",
        content: [
          {
            type: "link",
            href: `/dashboard/${targetPageId}`,
            content: [
              {
                type: "text",
                text:
                  this.pages.find((p) => p.id === targetPageId)?.title ||
                  "Untitled",
                styles: {},
              },
            ],
          },
        ],
      };

      const updatedContent = [...(sourcePage.content || []), linkContent];
      await this.updatePageContent(sourcePageId, updatedContent);
      return true;
    } catch (error) {
      console.error("Error linking pages:", error);
      return false;
    }
  }

  // Add method to handle icon update
  async updatePageIcon(pageId: string, icon: string): Promise<boolean> {
    try {
      // If the icon is a URL, update icon_url, otherwise update icon
      const isUrl = icon.startsWith("http://") || icon.startsWith("https://");
      const updateData = isUrl ? { icon_url: icon } : { icon };
      await this.updatePage(pageId, updateData);
      return true;
    } catch (error) {
      console.error("Error updating page icon:", error);
      return false;
    }
  }

  // Add method to handle cover image update
  async updatePageCover(pageId: string, coverImage: string): Promise<boolean> {
    try {
      // If the cover is a URL, update cover_url, otherwise update cover_image
      const isUrl =
        coverImage.startsWith("http://") || coverImage.startsWith("https://");
      const updateData = isUrl
        ? { cover_url: coverImage }
        : { cover_image: coverImage };
      await this.updatePage(pageId, updateData);
      return true;
    } catch (error) {
      console.error("Error updating page cover:", error);
      return false;
    }
  }

  // Add method to get workspace name for a page
  getWorkspaceNameForPage(pageId: string): string {
    const page = this.pages.find((p) => p.id === pageId);
    if (!page) return "";

    // TODO: Get workspace name from workspace store
    // For now, return a placeholder
    return "My Workspace";
  }

  // Add a savePage method that saves all current selected page data
  async savePage(): Promise<boolean> {
    if (!this.selectedPage) return false;

    try {
      const updates: Partial<Page> = {
        title: this.selectedPage.title,
        content: this.selectedPage.content,
        icon: this.selectedPage.icon,
        icon_url: this.selectedPage.icon_url,
        cover_image: this.selectedPage.cover_image,
        cover_url: this.selectedPage.cover_url,
      };

      const result = await this.updatePage(this.selectedPage.id, updates);
      return !!result;
    } catch (error) {
      console.error("Error saving page:", error);
      return false;
    }
  }
}
