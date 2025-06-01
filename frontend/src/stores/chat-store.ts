import { makeAutoObservable } from "mobx";
import { QueryClient } from "@tanstack/react-query";

export class ChatStore {
  queryClient: QueryClient;
  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }
  // Add chat-related state and actions here
}
