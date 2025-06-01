import { makeAutoObservable } from "mobx";
import { QueryClient } from "@tanstack/react-query";

export class AILinkStore {
  queryClient: QueryClient;
  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }
  // Add AI link-related state and actions here
}
