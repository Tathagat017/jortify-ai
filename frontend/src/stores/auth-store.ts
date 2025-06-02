import { makeAutoObservable } from "mobx";
import { User, Session } from "@supabase/supabase-js";
import axiosInstance from "../lib/axios";
import { QueryClient } from "@tanstack/react-query";

const USER_KEY = "jortify_user";
const TOKEN_KEY = "jortify_token";

export class AuthStore {
  user: User | null = null;
  token: string | null = null;
  loading: boolean = false;
  error: string | null = null;
  queryClient: QueryClient;

  constructor(queryClient: QueryClient) {
    makeAutoObservable(this);
    this.loadSession();
    this.queryClient = queryClient;
  }

  loadSession() {
    const userStr = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (userStr && token) {
      try {
        this.user = JSON.parse(userStr);
        this.token = token;
      } catch {
        this.user = null;
        this.token = null;
      }
    }
  }

  saveSession(user: User, token: string) {
    this.user = user;
    this.token = token;
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearSession() {
    this.user = null;
    this.token = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    this.queryClient.invalidateQueries();
  }

  isAuthenticated(): boolean {
    const userStr = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    return !!(userStr && token);
  }

  async signUp(email: string, password: string) {
    try {
      this.loading = true;
      this.error = null;

      const response = await axiosInstance.post<{
        data: { user: User | null; session: Session | null };
        error: Error | null;
      }>(`/api/auth/signup`, {
        email,
        password,
      });

      const { data, error } = response.data;

      if (error) {
        throw error;
      }

      if (data && data.user && data.session) {
        this.saveSession(data.user, data.session.access_token);
        this.user = data.user;
      } else {
        console.warn(
          "Signup response did not contain expected user or session:",
          data
        );
        throw new Error(
          "Signup successful, but no user or session data received."
        );
      }
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
    }
  }

  async signIn(email: string, password: string): Promise<boolean> {
    try {
      this.loading = true;
      this.error = null;

      const response = await axiosInstance.post<{
        data: { user: User | null; session: Session | null };
        error: Error | null;
      }>(`/api/auth/signin`, {
        email,
        password,
      });

      const { data, error } = response.data;

      if (error) {
        throw error;
      }

      if (data && data.user && data.session) {
        this.saveSession(data.user, data.session.access_token);
        this.user = data.user;
        return true;
      }
      console.warn(
        "Signin response did not contain expected user or session:",
        data
      );
      throw new Error(
        "Signin successful, but no user or session data received."
      );
    } catch (error) {
      this.error = (error as Error).message;
      return false;
    } finally {
      this.loading = false;
    }
  }

  async signOut() {
    try {
      this.loading = true;
      this.error = null;

      const response = await axiosInstance.post<{ error: Error | null }>(
        `/api/auth/signout`,
        null,
        {
          headers: {
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
          },
        }
      );

      const { error } = response.data;

      if (error) {
        throw error;
      }

      this.clearSession();
    } catch (error) {
      this.error = (error as Error).message;
    } finally {
      this.loading = false;
    }
  }

  resetError() {
    this.error = null;
  }
}
