import { makeAutoObservable, runInAction } from "mobx";
import { QueryClient } from "@tanstack/react-query";
import { aiService } from "../services/ai.service";

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  connectionCount?: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerNode: string | null;
  workspaceId?: string;
  workspaceName?: string;
}

export class GraphViewStore {
  queryClient: QueryClient;

  // State
  isModalOpen = false;
  isLoading = false;
  error: string | null = null;
  currentGraph: KnowledgeGraph | null = null;
  currentWorkspaceId: string | null = null;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  // Actions
  openModal = () => {
    this.isModalOpen = true;
  };

  closeModal = () => {
    this.isModalOpen = false;
    this.error = null;
  };

  // Fetch knowledge graph for a workspace
  fetchKnowledgeGraph = async (workspaceId: string) => {
    if (!workspaceId) {
      this.error = "Workspace ID is required";
      return;
    }

    this.isLoading = true;
    this.error = null;
    this.currentWorkspaceId = workspaceId;

    try {
      const response = await aiService.getKnowledgeGraph(workspaceId);

      runInAction(() => {
        this.currentGraph = response.graph;
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error
            ? error.message
            : "Failed to fetch knowledge graph";
        this.isLoading = false;
        this.currentGraph = null;
      });
    }
  };

  // Clear current graph data
  clearGraph = () => {
    this.currentGraph = null;
    this.currentWorkspaceId = null;
    this.error = null;
  };

  // Reset store state
  reset = () => {
    this.isModalOpen = false;
    this.isLoading = false;
    this.error = null;
    this.currentGraph = null;
    this.currentWorkspaceId = null;
  };
}
