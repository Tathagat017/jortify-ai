import { QueryClient } from "@tanstack/react-query";
import { makeAutoObservable } from "mobx";

export class UIStore {
  authModalOpen: boolean = false;
  authView: "login" | "signup" | null = null;
  sidebarOpen: boolean = true;
  sidebarWidth: number = 300; // Default width in pixels
  searchQuery: string = "";
  sidebarView: "pages" | "trash" = "pages"; // Current sidebar view
  searchFocusTrigger: number = 0; // Counter to trigger search focus
  queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  openAuthModal(view: "login" | "signup") {
    this.authModalOpen = true;
    this.authView = view;
  }

  closeAuthModal() {
    this.authModalOpen = false;
    this.authView = null;
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  setSidebarWidth(width: number) {
    this.sidebarWidth = Math.min(Math.max(width, 250), window.innerWidth * 0.4); // Min 250px, max 40% of screen
  }

  setSearchQuery(query: string) {
    this.searchQuery = query;
  }

  setSidebarView(view: "pages" | "trash") {
    this.sidebarView = view;
  }

  clearSearch() {
    this.searchQuery = "";
  }

  triggerSearchFocus() {
    this.searchFocusTrigger += 1;
  }
}
