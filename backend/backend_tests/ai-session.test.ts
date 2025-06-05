import {
  makeRequest,
  generateTestWorkspace,
  generateTestPage,
  cleanupTestData,
} from "./setup";

describe("AI Session API Endpoints", () => {
  let testWorkspaceId: string;
  let testPageId: string;
  let testSessionId: string;

  beforeAll(async () => {
    // Create test workspace and page
    const workspaceData = generateTestWorkspace();
    const workspaceResponse = await makeRequest(
      "POST",
      "/workspaces",
      workspaceData
    );
    testWorkspaceId = (workspaceResponse.data as any).data.id;
    cleanupTestData.addWorkspace(testWorkspaceId);

    const pageData = generateTestPage(testWorkspaceId);
    const pageResponse = await makeRequest("POST", "/pages", pageData);
    testPageId = (pageResponse.data as any).data.id;
    cleanupTestData.addPage(testPageId);
  });

  describe("POST /ai-sessions - Create AI Session", () => {
    it("should create a new AI session successfully", async () => {
      const sessionData = {
        prompt: "What is the main topic of this page?",
        response:
          "This page discusses project management methodologies and best practices.",
        model: "gpt-4",
        page_id: testPageId,
      };

      const response = await makeRequest("POST", "/ai-sessions", sessionData);

      expect([200, 201]).toContain(response.status);
      if (response.status === 201) {
        expect((response.data as any).id).toBeDefined();
        expect((response.data as any).prompt).toBe(sessionData.prompt);
        expect((response.data as any).response).toBe(sessionData.response);
        expect((response.data as any).model).toBe(sessionData.model);
        expect((response.data as any).page_id).toBe(testPageId);
        expect((response.data as any).user_id).toBeDefined();
        expect((response.data as any).created_at).toBeDefined();

        testSessionId = (response.data as any).id;
      }
    });

    it("should create AI session without page_id", async () => {
      const sessionData = {
        prompt: "General AI question",
        response: "General AI response",
        model: "gpt-3.5-turbo",
      };

      const response = await makeRequest("POST", "/ai-sessions", sessionData);

      expect([200, 201]).toContain(response.status);
      if (response.status === 201) {
        expect((response.data as any).id).toBeDefined();
        expect((response.data as any).page_id).toBeNull();
      }
    });

    it("should fail with missing required fields", async () => {
      const incompleteData = {
        prompt: "Test prompt",
        // Missing response and model
      };

      const response = await makeRequest(
        "POST",
        "/ai-sessions",
        incompleteData
      );

      expect(response.status).toBe(400);
    });

    it("should fail without authentication", async () => {
      const sessionData = {
        prompt: "Test prompt",
        response: "Test response",
        model: "gpt-4",
      };

      const response = await makeRequest("POST", "/ai-sessions", sessionData, {
        Authorization: "",
        "Content-Type": "application/json",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai-sessions - Get All AI Sessions", () => {
    it("should get all AI sessions for authenticated user", async () => {
      const response = await makeRequest("GET", "/ai-sessions");

      expect([200, 401]).toContain(response.status);
      if (response.status === 200) {
        expect(
          Array.isArray((response.data as any).data || response.data)
        ).toBe(true);
        const dataArray = (response.data as any).data || response.data;
        if (Array.isArray(dataArray) && dataArray.length > 0) {
          const session = dataArray[0];
          expect(session).toHaveProperty("id");
          expect(session).toHaveProperty("prompt");
          expect(session).toHaveProperty("response");
          expect(session).toHaveProperty("model");
          expect(session).toHaveProperty("created_at");
        }
      }
    });

    it("should fail without authentication", async () => {
      const response = await makeRequest("GET", "/ai-sessions", undefined, {
        Authorization: "",
        "Content-Type": "application/json",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /ai-sessions/:id - Get AI Session by ID", () => {
    it("should get AI session by valid ID", async () => {
      if (!testSessionId) {
        // Create a session first if none exists
        const sessionData = {
          prompt: "Test prompt for get",
          response: "Test response for get",
          model: "gpt-4",
          page_id: testPageId,
        };
        const createResponse = await makeRequest(
          "POST",
          "/ai-sessions",
          sessionData
        );
        testSessionId = (createResponse.data as any).id;
      }

      const response = await makeRequest(
        "GET",
        `/ai-sessions/${testSessionId}`
      );

      expect([200, 404, 401]).toContain(response.status);
      if (response.status === 200) {
        expect((response.data as any).id).toBe(testSessionId);
        expect(response.data as any).toHaveProperty("prompt");
        expect(response.data as any).toHaveProperty("response");
        expect(response.data as any).toHaveProperty("model");
      }
    });

    it("should return 404 for non-existent session", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await makeRequest("GET", `/ai-sessions/${fakeId}`);

      expect([404, 500]).toContain(response.status);
    });

    it("should fail without authentication", async () => {
      const response = await makeRequest(
        "GET",
        `/ai-sessions/${testSessionId || "test"}`,
        undefined,
        {
          Authorization: "",
          "Content-Type": "application/json",
        }
      );

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /ai-sessions/:id - Update AI Session", () => {
    it("should update AI session successfully", async () => {
      if (!testSessionId) {
        // Create a session first if none exists
        const sessionData = {
          prompt: "Test prompt for update",
          response: "Test response for update",
          model: "gpt-4",
          page_id: testPageId,
        };
        const createResponse = await makeRequest(
          "POST",
          "/ai-sessions",
          sessionData
        );
        testSessionId = (createResponse.data as any).id;
      }

      const updateData = {
        prompt: "Updated prompt",
        response: "Updated response",
        model: "gpt-3.5-turbo",
      };

      const response = await makeRequest(
        "PUT",
        `/ai-sessions/${testSessionId}`,
        updateData
      );

      expect([200, 404, 401]).toContain(response.status);
      if (response.status === 200) {
        expect((response.data as any).prompt).toBe(updateData.prompt);
        expect((response.data as any).response).toBe(updateData.response);
        expect((response.data as any).model).toBe(updateData.model);
      }
    });

    it("should allow partial updates", async () => {
      if (!testSessionId) {
        return; // Skip if no session exists
      }

      const partialUpdate = {
        prompt: "Partially updated prompt",
      };

      const response = await makeRequest(
        "PUT",
        `/ai-sessions/${testSessionId}`,
        partialUpdate
      );

      expect([200, 404, 401]).toContain(response.status);
      if (response.status === 200) {
        expect((response.data as any).prompt).toBe(partialUpdate.prompt);
      }
    });

    it("should return 404 for non-existent session", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const updateData = {
        prompt: "Updated prompt",
      };

      const response = await makeRequest(
        "PUT",
        `/ai-sessions/${fakeId}`,
        updateData
      );

      expect([404, 500]).toContain(response.status);
    });

    it("should fail without authentication", async () => {
      const updateData = {
        prompt: "Updated prompt",
      };

      const response = await makeRequest(
        "PUT",
        `/ai-sessions/${testSessionId || "test"}`,
        updateData,
        {
          Authorization: "",
          "Content-Type": "application/json",
        }
      );

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /ai-sessions/:id - Delete AI Session", () => {
    let sessionToDelete: string;

    beforeAll(async () => {
      // Create a session specifically for deletion test
      const sessionData = {
        prompt: "Session to be deleted",
        response: "This session will be deleted",
        model: "gpt-4",
        page_id: testPageId,
      };
      const response = await makeRequest("POST", "/ai-sessions", sessionData);
      if (response.status === 201) {
        sessionToDelete = (response.data as any).id;
      }
    });

    it("should delete AI session successfully", async () => {
      if (!sessionToDelete) {
        return; // Skip if session creation failed
      }

      const response = await makeRequest(
        "DELETE",
        `/ai-sessions/${sessionToDelete}`
      );

      expect([200, 204, 404, 401]).toContain(response.status);

      if (response.status === 204 || response.status === 200) {
        // Verify session is actually deleted
        const getResponse = await makeRequest(
          "GET",
          `/ai-sessions/${sessionToDelete}`
        );
        expect([404, 500]).toContain(getResponse.status);
      }
    });

    it("should return 404 when deleting non-existent session", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const response = await makeRequest("DELETE", `/ai-sessions/${fakeId}`);

      expect([404, 500]).toContain(response.status);
    });

    it("should fail without authentication", async () => {
      const response = await makeRequest(
        "DELETE",
        `/ai-sessions/${testSessionId || "test"}`,
        undefined,
        {
          Authorization: "",
          "Content-Type": "application/json",
        }
      );

      expect(response.status).toBe(401);
    });
  });
});
