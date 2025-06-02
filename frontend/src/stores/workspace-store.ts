import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  cover_url?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export class WorkspaceStore {
  queryClient: QueryClient;
  workspaces: Workspace[] = [];
  selectedWorkspace: Workspace | null = null;
  loading: boolean = false;
  error: string | null = null;
  private baseUrl: string =
    import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  get workspaceName(): string {
    return this.selectedWorkspace?.name || "Your workspace";
  }

  async fetchWorkspaces(): Promise<Workspace[]> {
    const token = localStorage.getItem("jortify_token");
    if (!token) {
      return [];
    }

    try {
      this.loading = true;
      const res: AxiosResponse<Workspace[]> = await axios.get(
        `${this.baseUrl}/api/workspaces`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      runInAction(() => {
        this.workspaces = res.data;
        // Auto-select first workspace if none selected
        if (this.workspaces.length > 0 && !this.selectedWorkspace) {
          this.selectedWorkspace = this.workspaces[0];
        }
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to fetch workspaces";
        console.error("Error fetching workspaces:", error);
      });
      return [];
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async createWorkspace(
    name: string,
    description?: string
  ): Promise<Workspace | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Workspace> = await axios.post(
        `${this.baseUrl}/api/workspaces`,
        { name, description },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        this.workspaces.push(res.data);
        this.selectedWorkspace = res.data;
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to create workspace";
        console.error("Error creating workspace:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async updateWorkspace(
    id: string,
    name: string,
    description?: string
  ): Promise<Workspace | null> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return null;

    try {
      this.loading = true;
      const res: AxiosResponse<Workspace> = await axios.put(
        `${this.baseUrl}/api/workspaces/${id}`,
        { name, description },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      runInAction(() => {
        const index = this.workspaces.findIndex((w) => w.id === id);
        if (index !== -1) {
          this.workspaces[index] = res.data;
          if (this.selectedWorkspace?.id === id) {
            this.selectedWorkspace = res.data;
          }
        }
        this.error = null;
      });

      return res.data;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to update workspace";
        console.error("Error updating workspace:", error);
      });
      return null;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async deleteWorkspace(id: string): Promise<boolean> {
    const token = localStorage.getItem("jortify_token");
    if (!token) return false;

    try {
      this.loading = true;
      await axios.delete(`${this.baseUrl}/api/workspaces/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      runInAction(() => {
        this.workspaces = this.workspaces.filter((w) => w.id !== id);

        // Select another workspace if the deleted one was selected
        if (this.selectedWorkspace?.id === id) {
          this.selectedWorkspace =
            this.workspaces.length > 0 ? this.workspaces[0] : null;
        }
        this.error = null;
      });

      return true;
    } catch (error) {
      runInAction(() => {
        this.error = "Failed to delete workspace";
        console.error("Error deleting workspace:", error);
      });
      return false;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  selectWorkspace(workspace: Workspace) {
    this.selectedWorkspace = workspace;
    // Clear any cached pages since we're switching workspaces
    this.queryClient.invalidateQueries({ queryKey: ["pages"] });
  }

  clearError() {
    this.error = null;
  }

  clearStore() {
    this.workspaces = [];
    this.selectedWorkspace = null;
    this.loading = false;
    this.error = null;
  }
}
