import { createContext, ReactNode } from "react";
import { QueryClient } from "@tanstack/react-query";
import { AuthStore } from "./auth-store";
import { PageStore } from "./page-store";
import { UIStore } from "./ui-store";
import { ChatStore } from "./chat-store";
import { AILinkStore } from "./ai-link-store";
import { GraphViewStore } from "./graph-view-store";
import { WorkspaceStore } from "./workspace-store";
import TagStore from "./tag-store";
import { SearchStore } from "./search-store";

const queryClient = new QueryClient();

export const store = {
  authStore: new AuthStore(queryClient),
  pageStore: new PageStore(queryClient),
  uiStore: new UIStore(queryClient),
  chatStore: new ChatStore(queryClient),
  aiLinkStore: new AILinkStore(queryClient),
  graphViewStore: new GraphViewStore(queryClient),
  workspaceStore: new WorkspaceStore(queryClient),
  tagStore: new TagStore(queryClient),
  searchStore: new SearchStore(queryClient),
  queryClient,
};

export const StoreContext = createContext(store);

export const StoreProvider = ({ children }: { children: ReactNode }) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);
