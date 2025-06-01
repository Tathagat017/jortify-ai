---
description: 
globs: 
alwaysApply: false
---
# Frontend Rules & Architecture

## 🔧 General Rules

- ✅ **Use only FontAwesome Icons** throughout the application.
- ✅ **NEVER make direct API calls from React components**.
  - All Axios calls must be made from **MobX stores**.
  - Components must use `useQuery` or `useMutation` from **TanStack Query** to invoke store methods.

### ✅ Example (Correct Usage in Component)

```tsx
const { data: users } = useQuery({
  queryKey: ["users"],
  queryFn: async () => {
    return await authStore.getUsers();
  },
});
```

src/
├── components/
│   ├── editor/       # BlockNote editor wrapper
│   ├── sidebar/      # Navigation tree
│   ├── navbar/       # Header & actions
│   ├── graph/        # React Flow graph visualization
│   ├── ai/           # AI interaction components (Suggestions, Q&A)
│   └── shared/       # Reusable UI elements
├── stores/           # MobX stores (all API logic lives here)
│   ├── store-context-provider.tsx
│   ├── auth-store.ts
│   ├── page-store.ts
│   ├── ui-store.ts
│   ├── chat-store.ts
│   ├── ai-link-store.ts
│   ├── graph-view-store.ts
├── hooks/            # Custom hooks (useStore, useEditor, etc.)
├── pages/            # Route entry points (landing, protected)
└── styles/           # Global styles, theme configs

store-context-provider
```
import { createContext, ReactNode } from "react";
import { TaskStore } from "./task-store";
import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient();

export const store = {
  taskStore: new TaskStore(queryClient),
  queryClient,
};

export const StoreContext = createContext(store);

export const StoreProvider = ({ children }: { children: ReactNode }) => (
  <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
);
```
Example MobX store : 

export class TaskStore {
  queryClient: QueryClient;
  tasks: Task[] = [];
  private baseUrl: string = import.meta.env.VITE_API_BASE_URL;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  async getTasks(): Promise<Task[]> {
    try {
      const res: AxiosResponse<Task[]> = await axios.get(
        `${this.baseUrl}/api/tasks`
      );
      return res.data;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return [];
    }
  }

  async updateTask(updateRequest: UpdateTaskRequest): Promise<Task | null> {
    try {
      const res: AxiosResponse<Task> = await axios.post(
        `${this.baseUrl}/api/task`,
        updateRequest
      );
      runInAction(() => {
        const index = this.tasks.findIndex((t) => t.id === updateRequest.id);
        if (index !== -1) {
          this.tasks[index] = res.data;
        }
      });
      return res.data;
    } catch (error) {
      console.error("Error updating task:", error);
      return null;
    }
  }

  clearStore() {}
}

