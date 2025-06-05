import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import { AxiosResponse } from "axios";
import type { PartialBlock } from "@blocknote/core";
import { UploadService } from "../services/upload.service";

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
  private autoTagTimeout: NodeJS.Timeout | null = null;
  private typingTimeout: NodeJS.Timeout | null = null;
  private isUserTyping: boolean = false;
  private hasContentBeenEdited: boolean = false; // Track if content has been edited

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
      const res: AxiosResponse<Page[]> = await axiosInstance.get(
        `/api/pages/workspace/${workspaceId}?includeDeleted=true`,
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

  setSelectedPageAsNull() {
    this.selectedPage = null;
  }

  // Legacy method for backward compatibility
  async fetchPagesForUser(): Promise<Page[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      return [];
    }

    try {
      this.loading = true;
      const res: AxiosResponse<Page[]> = await axiosInstance.get(
        `/api/pages?includeDeleted=true`
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
      const res: AxiosResponse<Page> = await axiosInstance.post(
        `/api/pages`,
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
      // Process content images if content is being updated
      const processedUpdates = { ...updates };
      if (updates.content) {
        processedUpdates.content = await this.processContentImages(
          updates.content,
          pageId
        );
      }

      // First update the local state optimistically
      runInAction(() => {
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          this.pages[pageIndex] = {
            ...this.pages[pageIndex],
            ...processedUpdates,
          };
          if (this.selectedPage?.id === pageId) {
            this.selectedPage = { ...this.selectedPage, ...processedUpdates };
          }
        }
      });

      // Then make the API call (don't include user_id in updates)
      const res: AxiosResponse<Page> = await axiosInstance.put(
        `/api/pages/${pageId}`,
        processedUpdates,
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
      const res: AxiosResponse<Page> = await axiosInstance.post(
        `/api/pages/${pageId}/duplicate`,
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
      const res: AxiosResponse<Page> = await axiosInstance.patch(
        `/api/pages/${pageId}/move`,
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
      const res: AxiosResponse<{ message: string; page: Page }> =
        await axiosInstance.delete(`/api/pages/${pageId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

      runInAction(() => {
        // Move page from pages to trash
        const pageIndex = this.pages.findIndex((p) => p.id === pageId);
        if (pageIndex !== -1) {
          const deletedPage = res.data.page; // Use the updated page from the response
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
      const res: AxiosResponse<{ message: string; page: Page }> =
        await axiosInstance.patch(
          `/api/pages/${pageId}/restore`,
          {},
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
          const restoredPage = res.data.page;
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
      await axiosInstance.delete(`/api/pages/${pageId}/permanent`, {
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
      // Reset the edited flag for the new page
      this.hasContentBeenEdited = false;
    });

    // Invalidate related queries
    this.queryClient.invalidateQueries({
      queryKey: ["page", page.id],
    });
  }

  async fetchPageById(id: string): Promise<Page | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      return null;
    }

    try {
      const res: AxiosResponse<Page> = await axiosInstance.get(
        `/api/pages/${id}`
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
  ): Promise<void> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return;

    try {
      this.loading = true;
      const res: AxiosResponse<Page> = await axiosInstance.put(
        `/api/pages/${pageId}`,
        { content },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        const index = this.pages.findIndex((page) => page.id === pageId);
        if (index !== -1) {
          this.pages[index] = res.data;
        }
        if (this.selectedPage?.id === pageId) {
          this.selectedPage = res.data;
        }
        this.error = null;

        // Mark that content has been edited
        this.hasContentBeenEdited = true;
      });

      // Mark that user is typing and reset typing timeout
      this.handleUserTyping();
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to update page content";
        console.error("Error updating page content:", error);
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  // Handle user typing - reset timers
  handleUserTyping(): void {
    this.isUserTyping = true;

    // Clear existing typing timeout
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }

    // Clear existing auto-tag timeout
    if (this.autoTagTimeout) {
      clearTimeout(this.autoTagTimeout);
    }

    // Set new typing timeout (user stops typing after 2 seconds)
    this.typingTimeout = setTimeout(() => {
      this.isUserTyping = false;
    }, 2000);
  }

  // Handle editor blur - start auto-tag generation process
  handleEditorBlur(pageId: string, workspaceId: string): void {
    // Only proceed if content has been edited
    if (!this.hasContentBeenEdited) {
      console.log("🏷️ Auto-tag generation skipped: No content has been edited");
      return;
    }

    console.log(
      "✅ Content has been edited, proceeding with auto-tag generation"
    );

    // Reset the edited flag since we're processing the changes
    this.hasContentBeenEdited = false;

    // Clear any existing auto-tag timeout
    if (this.autoTagTimeout) {
      clearTimeout(this.autoTagTimeout);
    }

    // Only proceed if user is not currently typing
    if (!this.isUserTyping) {
      this.startAutoTagGeneration(pageId, workspaceId);
    } else {
      // Wait for typing to finish, then start auto-tag generation
      const checkTypingInterval = setInterval(() => {
        if (!this.isUserTyping) {
          clearInterval(checkTypingInterval);
          this.startAutoTagGeneration(pageId, workspaceId);
        }
      }, 500);

      // Safety timeout - don't wait forever
      setTimeout(() => {
        clearInterval(checkTypingInterval);
        if (!this.isUserTyping) {
          this.startAutoTagGeneration(pageId, workspaceId);
        }
      }, 10000); // Max 10 seconds wait
    }
  }

  // Start the 30-second countdown for auto-tag generation
  private startAutoTagGeneration(pageId: string, workspaceId: string): void {
    // Import tagStore dynamically and start loading state
    import("./store-context-provider").then(({ store }) => {
      const { tagStore } = store;
      if (tagStore) {
        tagStore.startAutoGeneration();
      }
    });

    this.autoTagTimeout = setTimeout(async () => {
      await this.generateAutoTags(pageId, workspaceId);
    }, 15000); // Changed to 15 seconds
  }

  // Generate auto tags for a page
  private async generateAutoTags(
    pageId: string,
    workspaceId: string
  ): Promise<void> {
    try {
      const page = this.pages.find((p) => p.id === pageId);
      if (!page) return;

      // Check if page has meaningful content
      const contentText = this.extractTextFromContent(page.content);
      if (!contentText || contentText.trim().length < 50) {
        return; // Don't generate tags for pages with minimal content
      }

      // Import tagStore dynamically to avoid circular dependency
      const { store } = await import("./store-context-provider");
      const { tagStore } = store;

      if (tagStore) {
        await tagStore.generateTagsForPage(
          page.title,
          page.content || {},
          workspaceId,
          pageId, // Pass pageId for duplicate checking
          true // Mark as auto-generation
        );
      }
    } catch (error) {
      console.error("Error generating auto tags:", error);
    }
  }

  // Cancel auto-tag generation (e.g., when user starts typing again)
  cancelAutoTagGeneration(): void {
    if (this.autoTagTimeout) {
      clearTimeout(this.autoTagTimeout);
      this.autoTagTimeout = null;
    }

    // Stop the loading state in tag store
    import("./store-context-provider").then(({ store }) => {
      const { tagStore } = store;
      if (tagStore) {
        tagStore.stopAutoGeneration();
      }
    });
  }

  // Extract text content from BlockNote content for analysis
  private extractTextFromContent(content: PartialBlock[] | undefined): string {
    if (!content || !Array.isArray(content)) return "";

    try {
      // Simple JSON stringify approach to extract text
      const contentStr = JSON.stringify(content);
      // Extract text values from the JSON string
      const textMatches = contentStr.match(/"text":"([^"]+)"/g);
      if (textMatches) {
        return textMatches
          .map((match) => match.replace(/"text":"([^"]+)"/, "$1"))
          .join(" ")
          .trim();
      }
      return "";
    } catch (error) {
      console.error("Error extracting text from content:", error);
      return "";
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
      // Check if it's a blob URL that needs uploading
      if (UploadService.isBlobUrl(icon)) {
        const finalIconUrl = await UploadService.processAndUploadBlobImage(
          icon,
          pageId,
          "icon"
        );
        await this.updatePage(pageId, {
          icon_url: finalIconUrl,
          icon: undefined,
        });
      }
      // Check if it's already a permanent URL (http/https)
      else if (icon.startsWith("http://") || icon.startsWith("https://")) {
        await this.updatePage(pageId, { icon_url: icon, icon: undefined });
      }
      // Otherwise, it's an emoji or text icon
      else {
        await this.updatePage(pageId, { icon: icon, icon_url: undefined });
      }

      return true;
    } catch (error) {
      console.error("Error updating page icon:", error);
      return false;
    }
  }

  // Add method to handle cover image update
  async updatePageCover(pageId: string, coverImage: string): Promise<boolean> {
    try {
      let finalCoverUrl = coverImage;

      // If it's a blob URL, upload it first
      if (UploadService.isBlobUrl(coverImage)) {
        finalCoverUrl = await UploadService.processAndUploadBlobImage(
          coverImage,
          pageId,
          "cover"
        );
      }

      // Update the page with the permanent URL
      await this.updatePage(pageId, { cover_url: finalCoverUrl });
      return true;
    } catch (error) {
      console.error("Error updating page cover:", error);
      return false;
    }
  }

  // Get workspace name for a page
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

  // Process content to convert blob URLs to permanent URLs
  private async processContentImages(
    content: PartialBlock[],
    pageId: string
  ): Promise<PartialBlock[]> {
    if (!content || !Array.isArray(content)) return content;

    const processedContent = await Promise.all(
      content.map(async (block) => {
        if (
          block.type === "image" &&
          block.props?.url &&
          UploadService.isBlobUrl(block.props.url)
        ) {
          try {
            const permanentUrl = await UploadService.processAndUploadBlobImage(
              block.props.url,
              pageId,
              "content"
            );
            return {
              ...block,
              props: {
                ...block.props,
                url: permanentUrl,
              },
            };
          } catch (error) {
            console.error("Error uploading image in content:", error);
            return block; // Keep original if upload fails
          }
        }
        return block;
      })
    );

    return processedContent;
  }
}
