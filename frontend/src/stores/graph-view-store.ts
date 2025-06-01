import { makeAutoObservable } from "mobx";
import { QueryClient } from "@tanstack/react-query";

export class GraphViewStore {
  queryClient: QueryClient;
  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }
  // Add graph view-related state and actions here
}
