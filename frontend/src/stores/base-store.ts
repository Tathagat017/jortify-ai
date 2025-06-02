import { QueryClient } from "@tanstack/react-query";
import { makeAutoObservable } from "mobx";
import axios, { AxiosResponse } from "axios";

export class BaseStore {
  queryClient: QueryClient;
  protected baseUrl: string = import.meta.env.VITE_API_BASE_URL;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.queryClient = queryClient;
  }

  protected async apiCall<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any
  ): Promise<T | null> {
    try {
      const response: AxiosResponse<T> = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        data,
      });
      return response.data;
    } catch (error) {
      console.error(`Error in ${method} ${endpoint}:`, error);
      return null;
    }
  }

  clearStore() {
    // To be implemented by child classes
  }
}
