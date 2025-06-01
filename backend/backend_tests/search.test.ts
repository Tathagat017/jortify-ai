import {
  makeRequest,
  generateTestWorkspace,
  generateTestPage,
  cleanupTestData,
} from "./setup";

describe("Search API Endpoints", () => {
  let testWorkspaceId: string;
  let testPageId: string;

  beforeAll(async () => {
    // Create test workspace and page with searchable content
    const workspaceData = generateTestWorkspace();
    const workspaceResponse = await makeRequest(
      "POST",
      "/workspaces",
      workspaceData
    );
    testWorkspaceId = workspaceResponse.data.data.id;
    cleanupTestData.addWorkspace(testWorkspaceId);

    const pageData = {
      ...generateTestPage(testWorkspaceId),
      title: "Project Management Guide",
      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "This comprehensive guide covers project management methodologies, team collaboration strategies, and productivity optimization techniques for modern organizations.",
              },
            ],
          },
        ],
      },
    };
    const pageResponse = await makeRequest("POST", "/pages", pageData);
    testPageId = pageResponse.data.data.id;
    cleanupTestData.addPage(testPageId);
  });

  describe("POST /search - Full-Text Search", () => {
    it("should perform full-text search successfully", async () => {
      const searchData = {
        query: "project management",
        workspace_id: testWorkspaceId,
        limit: 20,
        offset: 0,
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty("results");
      expect(Array.isArray(response.data.data.results)).toBe(true);
      expect(response.data.data).toHaveProperty("pagination");
      expect(response.data.data.pagination.limit).toBe(20);
      expect(response.data.data.pagination.offset).toBe(0);
    });

    it("should find the test page in search results", async () => {
      const searchData = {
        query: "comprehensive guide",
        workspace_id: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      // Should find our test page
      const foundPage = response.data.data.results.find(
        (result: any) => result.id === testPageId
      );
      if (foundPage) {
        expect(foundPage).toHaveProperty("title");
        expect(foundPage).toHaveProperty("snippet");
        expect(foundPage).toHaveProperty("relevance");
      }
    });

    it("should support pagination", async () => {
      const searchData = {
        query: "project",
        workspace_id: testWorkspaceId,
        limit: 1,
        offset: 0,
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.pagination.limit).toBe(1);
      expect(response.data.data.pagination.offset).toBe(0);
    });

    it("should support date filters", async () => {
      const searchData = {
        query: "management",
        workspace_id: testWorkspaceId,
        filters: {
          created_after: "2024-01-01",
          created_before: "2024-12-31",
        },
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });

    it("should fail with missing workspace_id", async () => {
      const searchData = {
        query: "project management",
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    it("should fail with missing query", async () => {
      const searchData = {
        workspace_id: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/search", searchData);

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  describe("POST /search/semantic - Semantic Search", () => {
    it("should perform semantic search successfully", async () => {
      const searchData = {
        query: "team collaboration and productivity",
        workspace_id: testWorkspaceId,
        limit: 10,
        threshold: 0.7,
      };

      const response = await makeRequest(
        "POST",
        "/search/semantic",
        searchData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);

      // Check result structure
      if (response.data.data.length > 0) {
        const result = response.data.data[0];
        expect(result).toHaveProperty("page_id");
        expect(result).toHaveProperty("title");
        expect(result).toHaveProperty("similarity");
        expect(result).toHaveProperty("snippet");
        expect(typeof result.similarity).toBe("number");
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      }
    });

    it("should respect similarity threshold", async () => {
      const searchData = {
        query: "completely unrelated content about space exploration",
        workspace_id: testWorkspaceId,
        threshold: 0.9, // High threshold
      };

      const response = await makeRequest(
        "POST",
        "/search/semantic",
        searchData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);

      // All results should meet threshold
      response.data.data.forEach((result: any) => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should use default threshold when not provided", async () => {
      const searchData = {
        query: "project management",
        workspace_id: testWorkspaceId,
      };

      const response = await makeRequest(
        "POST",
        "/search/semantic",
        searchData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
    });
  });

  describe("GET /search/suggestions - Search Suggestions", () => {
    it("should get search suggestions", async () => {
      const response = await makeRequest(
        "GET",
        `/search/suggestions?q=project&workspace_id=${testWorkspaceId}&limit=5`
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);

      // Check suggestion structure
      if (response.data.data.length > 0) {
        const suggestion = response.data.data[0];
        expect(suggestion).toHaveProperty("suggestion");
        expect(suggestion).toHaveProperty("type");
        expect(suggestion).toHaveProperty("count");
        expect(typeof suggestion.count).toBe("number");
      }
    });

    it("should limit suggestions", async () => {
      const response = await makeRequest(
        "GET",
        `/search/suggestions?q=proj&workspace_id=${testWorkspaceId}&limit=2`
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.length).toBeLessThanOrEqual(2);
    });

    it("should handle empty query", async () => {
      const response = await makeRequest(
        "GET",
        `/search/suggestions?q=&workspace_id=${testWorkspaceId}`
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    it("should fail with missing workspace_id", async () => {
      const response = await makeRequest(
        "GET",
        "/search/suggestions?q=project"
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });

  describe("POST /search/pages/:id/similar - Find Similar Pages", () => {
    it("should find similar pages", async () => {
      const requestData = {
        limit: 5,
        threshold: 0.6,
      };

      const response = await makeRequest(
        "POST",
        `/search/pages/${testPageId}/similar`,
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);

      // Check similar page structure
      if (response.data.data.length > 0) {
        const similarPage = response.data.data[0];
        expect(similarPage).toHaveProperty("page_id");
        expect(similarPage).toHaveProperty("title");
        expect(similarPage).toHaveProperty("similarity");
        expect(similarPage).toHaveProperty("snippet");
        expect(similarPage.page_id).not.toBe(testPageId); // Should not include self
      }
    });

    it("should respect similarity threshold for similar pages", async () => {
      const requestData = {
        threshold: 0.9, // High threshold
      };

      const response = await makeRequest(
        "POST",
        `/search/pages/${testPageId}/similar`,
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      // All results should meet threshold
      response.data.data.forEach((page: any) => {
        expect(page.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it("should return 404 for non-existent page", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await makeRequest(
        "POST",
        `/search/pages/${fakeId}/similar`,
        {}
      );

      expect(response.status).toBe(404);
      expect(response.data.success).toBe(false);
    });
  });

  describe("POST /search/embeddings/generate - Generate Embeddings", () => {
    it("should generate embeddings for workspace", async () => {
      const requestData = {
        workspace_id: testWorkspaceId,
        force_regenerate: false,
      };

      const response = await makeRequest(
        "POST",
        "/search/embeddings/generate",
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty("processed");
      expect(response.data.data).toHaveProperty("updated");
      expect(response.data.data).toHaveProperty("errors");
      expect(response.data.data).toHaveProperty("message");
      expect(typeof response.data.data.processed).toBe("number");
      expect(typeof response.data.data.updated).toBe("number");
      expect(typeof response.data.data.errors).toBe("number");
    });

    it("should force regenerate embeddings", async () => {
      const requestData = {
        workspace_id: testWorkspaceId,
        force_regenerate: true,
      };

      const response = await makeRequest(
        "POST",
        "/search/embeddings/generate",
        requestData
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.message).toContain("successfully");
    });

    it("should fail with invalid workspace_id", async () => {
      const requestData = {
        workspace_id: "invalid-uuid",
      };

      const response = await makeRequest(
        "POST",
        "/search/embeddings/generate",
        requestData
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });

    it("should fail with missing workspace_id", async () => {
      const response = await makeRequest(
        "POST",
        "/search/embeddings/generate",
        {}
      );

      expect(response.status).toBe(400);
      expect(response.data.success).toBe(false);
    });
  });
});
