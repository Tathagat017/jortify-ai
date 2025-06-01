import dotenv from "dotenv";
import { ApiResponse, TestResponse } from "./types";

// Load environment variables
dotenv.config();

// Test user credentials
const TEST_USER = {
  email: "tathagatraj4@gmail.com",
  password: "Redranger@1234",
};

// Test configuration
export const TEST_CONFIG = {
  BASE_URL: "http://localhost:8080/api",
  JWT_TOKEN: "", // Will be set dynamically
  TIMEOUT: 30000,
};

// Function to get fresh JWT token
async function getAuthToken(): Promise<string> {
  try {
    const response = await fetch(`${TEST_CONFIG.BASE_URL}/auth/signin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(TEST_USER),
    });

    if (!response.ok) {
      throw new Error(`Login failed with status: ${response.status}`);
    }

    const data = (await response.json()) as any;

    // Handle the actual response structure: { access_token: "...", user: {...} }
    if (data.access_token) {
      console.log("✅ Successfully obtained fresh JWT token");
      console.log(`User ID: ${data.user?.id}, Email: ${data.user?.email}`);
      return data.access_token;
    } else {
      throw new Error("No access token in response");
    }
  } catch (error) {
    console.warn("⚠️ Failed to get fresh token, using fallback:", error);
    // Fallback to the provided token if login fails
    return "eyJhbGciOiJIUzI1NiIsImtpZCI6IkM0Ukh4d3RKZUEvbmNQTFoiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2ZnbGZ6cGR2bWVib2libmpldG9rLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiIyZDQ1M2RlZS0xNWI1LTRlZjAtOThhNi1iMzRjN2QxY2YwNzMiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzQ4NzQ2MTIwLCJpYXQiOjE3NDg3NDI1MjAsImVtYWlsIjoidGF0aGFnYXRyYWo0QGdtYWlsLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWwiOiJ0YXRoYWdhdHJhajRAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwic3ViIjoiMmQ0NTNkZWUtMTViNS00ZWYwLTk4YTYtYjM0YzdkMWNmMDczIn0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoicGFzc3dvcmQiLCJ0aW1lc3RhbXAiOjE3NDg3NDI1MjB9XSwic2Vzc2lvbl9pZCI6ImU3OGJmYzk1LTNiYTAtNGIxOC05ZDQ2LTY3NzZkMjgwOTRkZSIsImlzX2Fub255bW91cyI6ZmFsc2V9.1ivqC1Q9zbcHv10jCplkDPJV4cLAb4uMY8Xv9d_4mXk";
  }
}

// Common headers for API requests
export const getAuthHeaders = () => ({
  Authorization: `Bearer ${TEST_CONFIG.JWT_TOKEN}`,
  "Content-Type": "application/json",
});

// Utility function to make HTTP requests
export const makeRequest = async <T = any>(
  method: string,
  endpoint: string,
  data?: any,
  headers?: any
): Promise<TestResponse> => {
  const url = `${TEST_CONFIG.BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...headers,
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  let responseData: ApiResponse<T>;
  try {
    responseData = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    responseData = {
      success: false,
      error: "Failed to parse response JSON",
    };
  }

  return {
    status: response.status,
    data: responseData,
    headers: response.headers,
  };
};

// Test data generators
export const generateTestWorkspace = () => ({
  name: `Test Workspace ${Date.now()}`,
  description: "Test workspace for API testing",
  icon_url: "https://example.com/icon.png",
});

export const generateTestPage = (workspaceId: string, parentId?: string) => ({
  title: `Test Page ${Date.now()}`,
  content: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "This is a test page content with some text for testing purposes.",
          },
        ],
      },
    ],
  },
  workspace_id: workspaceId,
  parent_id: parentId,
  icon_url: "https://example.com/icon.png",
  cover_url: "https://example.com/cover.jpg",
});

export const generateTestTag = (workspaceId: string) => ({
  name: `test-tag-${Date.now()}`,
  color: "#FF5733",
  workspace_id: workspaceId,
});

// Cleanup utilities
export const cleanupTestData = {
  workspaces: [] as string[],
  pages: [] as string[],
  tags: [] as string[],
  conversations: [] as string[],

  addWorkspace: (id: string) => {
    cleanupTestData.workspaces.push(id);
  },

  addPage: (id: string) => {
    cleanupTestData.pages.push(id);
  },

  addTag: (id: string) => {
    cleanupTestData.tags.push(id);
  },

  addConversation: (id: string) => {
    cleanupTestData.conversations.push(id);
  },

  async cleanup() {
    console.log("Cleaning up test data...");

    // Clean up conversations
    for (const id of this.conversations) {
      try {
        await makeRequest("DELETE", `/ai/chat/${id}`);
      } catch (error) {
        console.warn(`Failed to cleanup conversation ${id}:`, error);
      }
    }

    // Clean up pages
    for (const id of this.pages) {
      try {
        await makeRequest("DELETE", `/pages/${id}`);
      } catch (error) {
        console.warn(`Failed to cleanup page ${id}:`, error);
      }
    }

    // Clean up tags
    for (const id of this.tags) {
      try {
        await makeRequest("DELETE", `/tags/${id}`);
      } catch (error) {
        console.warn(`Failed to cleanup tag ${id}:`, error);
      }
    }

    // Clean up workspaces
    for (const id of this.workspaces) {
      try {
        await makeRequest("DELETE", `/workspaces/${id}`);
      } catch (error) {
        console.warn(`Failed to cleanup workspace ${id}:`, error);
      }
    }

    // Reset arrays
    this.workspaces = [];
    this.pages = [];
    this.tags = [];
    this.conversations = [];
  },
};

// Global setup and teardown
beforeAll(async () => {
  console.log("Starting API tests...");
  console.log(`Base URL: ${TEST_CONFIG.BASE_URL}`);

  // Add fetch polyfill for Node.js if needed
  if (!global.fetch) {
    try {
      const { default: fetch } = await import("node-fetch");
      global.fetch = fetch as any;
    } catch (error) {
      console.warn("Could not import node-fetch:", error);
    }
  }

  // Get fresh JWT token
  try {
    TEST_CONFIG.JWT_TOKEN = await getAuthToken();
    console.log("🔑 JWT token obtained and set for tests");
  } catch (error) {
    console.error("❌ Failed to get JWT token:", error);
  }
});

afterAll(async () => {
  await cleanupTestData.cleanup();
  console.log("API tests completed and cleaned up.");
});
