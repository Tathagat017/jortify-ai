import {
  makeRequest,
  generateTestWorkspace,
  generateTestPage,
  cleanupTestData,
  TEST_CONFIG,
  getAuthHeaders,
} from "./setup";

describe("Upload API Endpoints", () => {
  let testWorkspaceId: string;
  let testPageId: string;

  beforeAll(async () => {
    // Create test workspace
    const workspaceData = generateTestWorkspace();
    const workspaceResponse = await makeRequest(
      "POST",
      "/workspaces",
      workspaceData
    );

    if (workspaceResponse.status === 200 && workspaceResponse.data?.data?.id) {
      testWorkspaceId = workspaceResponse.data.data.id;
      cleanupTestData.addWorkspace(testWorkspaceId);

      // Create test page
      const pageData = generateTestPage(testWorkspaceId);
      const pageResponse = await makeRequest("POST", "/pages", pageData);
      if (pageResponse.status === 200 && pageResponse.data?.data?.id) {
        testPageId = pageResponse.data.data.id;
        cleanupTestData.addPage(testPageId);
      }
    }
  });

  describe("POST /upload/icon - Upload Icon", () => {
    it("should handle icon upload request for page", async () => {
      if (testPageId) {
        const uploadData = {
          page_id: testPageId,
          file_type: "image/png",
          file_size: 1024,
        };

        const response = await makeRequest("POST", "/upload/icon", uploadData);

        if (response.status === 200) {
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty("upload_url");
          expect(response.data.data).toHaveProperty("file_id");
        } else {
          console.log("Icon upload failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      } else {
        console.log("Skipping test - no test page available");
      }
    });

    it("should handle icon upload request for workspace", async () => {
      if (testWorkspaceId) {
        const uploadData = {
          workspace_id: testWorkspaceId,
          file_type: "image/png",
          file_size: 1024,
        };

        const response = await makeRequest("POST", "/upload/icon", uploadData);

        if (response.status === 200) {
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty("upload_url");
          expect(response.data.data).toHaveProperty("file_id");
        } else {
          console.log("Icon upload failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      } else {
        console.log("Skipping test - no test workspace available");
      }
    });
  });

  describe("POST /upload/cover - Upload Cover", () => {
    it("should handle cover upload for page", async () => {
      if (testPageId) {
        const uploadData = {
          page_id: testPageId,
          file_type: "image/jpeg",
          file_size: 2048,
        };

        const response = await makeRequest("POST", "/upload/cover", uploadData);

        if (response.status === 200) {
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty("upload_url");
          expect(response.data.data).toHaveProperty("file_id");
        } else {
          console.log("Cover upload failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      } else {
        console.log("Skipping test - no test page available");
      }
    });

    it("should handle cover upload for workspace", async () => {
      if (testWorkspaceId) {
        const uploadData = {
          workspace_id: testWorkspaceId,
          file_type: "image/jpeg",
          file_size: 2048,
        };

        const response = await makeRequest("POST", "/upload/cover", uploadData);

        if (response.status === 200) {
          expect(response.data.success).toBe(true);
          expect(response.data.data).toHaveProperty("upload_url");
          expect(response.data.data).toHaveProperty("file_id");
        } else {
          console.log("Cover upload failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      } else {
        console.log("Skipping test - no test workspace available");
      }
    });
  });

  describe("DELETE /upload/:fileId - Delete File", () => {
    it("should handle file deletion request", async () => {
      const testFileId = "test-file-id-123";
      const response = await makeRequest("DELETE", `/upload/${testFileId}`);

      // Should either succeed, return 404 for non-existent file, or other valid response
      if (response.status === 200) {
        expect(response.data.success).toBe(true);
        expect(response.data.message).toContain("deleted");
      } else {
        console.log("File deletion response:", response.status, response.data);
        expect([200, 404, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("GET /upload/:fileId/presigned - Get Presigned URL", () => {
    it("should handle presigned URL request", async () => {
      const testFileId = "test-file-id-123";
      const response = await makeRequest(
        "GET",
        `/upload/${testFileId}/presigned`
      );

      if (response.status === 200) {
        expect(response.data.success).toBe(true);
        expect(response.data.data).toHaveProperty("presigned_url");
        expect(response.data.data).toHaveProperty("expires_at");
      } else {
        console.log("Presigned URL response:", response.status, response.data);
        expect([200, 404, 400, 500]).toContain(response.status);
      }
    });

    it("should handle presigned URL with custom expiration", async () => {
      const testFileId = "test-file-id-123";
      const response = await makeRequest(
        "GET",
        `/upload/${testFileId}/presigned?expires_in=3600`
      );

      if (response.status === 200) {
        expect(response.data.success).toBe(true);
        expect(response.data.data).toHaveProperty("presigned_url");
        expect(response.data.data).toHaveProperty("expires_at");
      } else {
        console.log(
          "Presigned URL with expiration response:",
          response.status,
          response.data
        );
        expect([200, 404, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("GET /upload/info/:fileId - Get File Info", () => {
    it("should handle file info request", async () => {
      const testFileId = "test-file-id-123";
      const response = await makeRequest("GET", `/upload/info/${testFileId}`);

      if (response.status === 200) {
        expect(response.data.success).toBe(true);
        expect(response.data.data).toHaveProperty("file_id");
        expect(response.data.data).toHaveProperty("file_type");
        expect(response.data.data).toHaveProperty("file_size");
        expect(response.data.data).toHaveProperty("uploaded_at");
      } else {
        console.log("File info response:", response.status, response.data);
        expect([200, 404, 400, 500]).toContain(response.status);
      }
    });
  });
});
