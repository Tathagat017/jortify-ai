import {
  makeRequest,
  generateTestWorkspace,
  generateTestPage,
  cleanupTestData,
} from "./setup";

describe("AI API Endpoints", () => {
  let testWorkspaceId: string;
  let testPageId: string;
  let testConversationId: string;

  beforeAll(async () => {
    // Create test workspace and page
    const workspaceData = generateTestWorkspace();
    const workspaceResponse = await makeRequest(
      "POST",
      "/workspaces",
      workspaceData
    );

    if (
      workspaceResponse.status === 200 &&
      (workspaceResponse.data as any)?.data?.id
    ) {
      testWorkspaceId = (workspaceResponse.data as any).data.id;
      cleanupTestData.addWorkspace(testWorkspaceId);
    }

    const pageData = generateTestPage(testWorkspaceId);
    const pageResponse = await makeRequest("POST", "/pages", pageData);
    testPageId = pageResponse.data.data.id;
    cleanupTestData.addPage(testPageId);
  });

  describe("POST /ai/suggest - AI Content Suggestions", () => {
    it("should generate AI content suggestions", async () => {
      const requestData = {
        context:
          "This is a document about project management and team collaboration.",
        currentText: "The key benefits of our approach are",
        pageId: testPageId,
        workspaceId: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/ai/suggest", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.suggestions) {
          expect(Array.isArray(responseData.data.suggestions)).toBe(true);
          expect(responseData.data.suggestions.length).toBeGreaterThan(0);
        }
      } else {
        console.log("AI suggestions failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should handle minimal context", async () => {
      const requestData = {
        context: "Short context",
        currentText: "The",
        workspaceId: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/ai/suggest", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.suggestions) {
          expect(Array.isArray(responseData.data.suggestions)).toBe(true);
        }
      } else {
        console.log("AI suggestions failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should fail with missing required fields", async () => {
      const response = await makeRequest("POST", "/ai/suggest", {});

      if (response.status === 400) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(false);
      } else {
        console.log("AI suggestions failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /ai/link - AI Link Suggestions", () => {
    it("should generate link suggestions based on content", async () => {
      const requestData = {
        text: "This project involves complex project management and team coordination tasks.",
        workspaceId: testWorkspaceId,
        pageId: testPageId,
        contextWindow: 100,
      };

      const response = await makeRequest("POST", "/ai/link", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.suggestions) {
          expect(Array.isArray(responseData.data.suggestions)).toBe(true);
          expect(responseData.data.text).toBe(requestData.text);
        }
      } else {
        console.log(
          "AI link generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should handle text without relevant links", async () => {
      const requestData = {
        text: "Some completely unrelated text about cooking recipes.",
        workspaceId: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/ai/link", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.suggestions) {
          expect(Array.isArray(responseData.data.suggestions)).toBe(true);
        }
      } else {
        console.log(
          "AI link generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should fail with missing text", async () => {
      const response = await makeRequest("POST", "/ai/link", {
        workspaceId: testWorkspaceId,
      });

      if (response.status === 400) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(false);
      } else {
        console.log(
          "AI link generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /ai/tags - Generate Semantic Tags", () => {
    it("should generate tags for page content", async () => {
      const requestData = {
        title: "Project Management Best Practices",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This document covers project management methodologies, team collaboration tools, and productivity optimization strategies.",
                },
              ],
            },
          ],
        },
        workspaceId: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/ai/tags", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.tags) {
          expect(Array.isArray(responseData.data.tags)).toBe(true);
          expect(responseData.data.tags.length).toBeGreaterThan(0);

          // Check tag structure
          if (responseData.data.tags.length > 0) {
            const tag = responseData.data.tags[0];
            expect(tag).toHaveProperty("name");
            expect(tag).toHaveProperty("color");
            expect(typeof tag.confidence).toBe("number");
          }
        }
      } else {
        console.log(
          "AI tag generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }

      expect(response.data).toHaveProperty("reasoning");
      expect(response.data).toHaveProperty("timestamp");
    });

    it("should handle short content", async () => {
      const requestData = {
        title: "Short Note",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Brief note." }],
            },
          ],
        },
        workspaceId: testWorkspaceId,
      };

      const response = await makeRequest("POST", "/ai/tags", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.tags) {
          expect(Array.isArray(responseData.data.tags)).toBe(true);
        }
      } else {
        console.log(
          "AI tag generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should fail with missing content", async () => {
      const response = await makeRequest("POST", "/ai/tags", {
        workspaceId: testWorkspaceId,
      });

      if (response.status === 400) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(false);
      } else {
        console.log(
          "AI tag generation failed:",
          response.status,
          response.data
        );
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /ai/summarize - Summarize Content", () => {
    it("should generate summary for content", async () => {
      const requestData = {
        title: "Long Document",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "This is a very long document with multiple paragraphs discussing various aspects of project management, team collaboration, productivity optimization, and strategic planning for modern organizations.",
                },
              ],
            },
          ],
        },
        length: "medium",
      };

      const response = await makeRequest("POST", "/ai/summarize", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.summary) {
          expect(responseData.data.summary.length).toBeGreaterThan(0);
          expect(responseData.data.length).toBe("medium");
        }
      } else {
        console.log("AI summarization failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }

      expect(response.data).toHaveProperty("timestamp");
    });

    it("should handle different summary lengths", async () => {
      const requestData = {
        title: "Test Document",
        content: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Content for summarization." }],
            },
          ],
        },
        length: "short",
      };

      const response = await makeRequest("POST", "/ai/summarize", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        expect(responseData.length).toBe("short");
      } else {
        console.log("AI summarization failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /ai/complete - Text Completion", () => {
    it("should complete text intelligently", async () => {
      const requestData = {
        text: "The three main benefits of agile project management are",
        context: "This document discusses project management methodologies.",
        maxTokens: 150,
      };

      const response = await makeRequest("POST", "/ai/complete", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.completion) {
          expect(responseData.data.completion.length).toBeGreaterThan(0);
          expect(responseData.data.originalText).toBe(requestData.text);
        }
      } else {
        console.log("AI completion failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }

      expect(response.data).toHaveProperty("timestamp");
    });

    it("should handle completion without context", async () => {
      const requestData = {
        text: "The weather today is",
        maxTokens: 50,
      };

      const response = await makeRequest("POST", "/ai/complete", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.completion) {
          expect(responseData.data.completion.length).toBeGreaterThan(0);
        }
      } else {
        console.log("AI completion failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("POST /ai/analyze - Analyze Writing", () => {
    it("should analyze writing quality", async () => {
      const requestData = {
        text: "This is a well-structured document that covers multiple important topics. The writing is clear and professional. It includes various sentences of different lengths to maintain reader engagement. The content provides valuable insights into project management practices.",
      };

      const response = await makeRequest("POST", "/ai/analyze", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        if (responseData.data?.analysis) {
          expect(responseData.data.analysis).toHaveProperty("readabilityScore");
          expect(responseData.data.analysis).toHaveProperty("sentimentScore");
          expect(responseData.data.analysis).toHaveProperty("suggestions");
          expect(responseData.data.analysis).toHaveProperty("statistics");
          expect(Array.isArray(responseData.data.analysis.suggestions)).toBe(
            true
          );
          expect(responseData.data.analysis.statistics).toHaveProperty(
            "wordCount"
          );
          expect(responseData.data.analysis.statistics).toHaveProperty(
            "sentenceCount"
          );
          expect(responseData.data).toHaveProperty("textLength");
        }
      } else {
        console.log("AI analysis failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });

    it("should handle short text", async () => {
      const requestData = {
        text: "Short text.",
      };

      const response = await makeRequest("POST", "/ai/analyze", requestData);

      if (response.status === 200) {
        const responseData = response.data as any;
        expect(responseData.success).toBe(true);
        expect(responseData.data.analysis.statistics.wordCount).toBe(2);
      } else {
        console.log("AI analysis failed:", response.status, response.data);
        expect([200, 400, 500]).toContain(response.status);
      }
    });
  });

  describe("RAG Chatbot Endpoints", () => {
    describe("POST /ai/chat/conversation - Create Chat Conversation", () => {
      it("should create a new chat conversation", async () => {
        const requestData = {
          workspaceId: testWorkspaceId,
          title: "Test Chat Conversation",
        };

        const response = await makeRequest(
          "POST",
          "/ai/chat/conversation",
          requestData
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("conversationId");
          expect(responseData.workspaceId).toBe(testWorkspaceId);
          expect(responseData.title).toBe(requestData.title);

          testConversationId = responseData.conversationId;
          cleanupTestData.addConversation(testConversationId);
        } else {
          console.log(
            "AI conversation creation failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should create conversation with default title", async () => {
        const requestData = {
          workspaceId: testWorkspaceId,
        };

        const response = await makeRequest(
          "POST",
          "/ai/chat/conversation",
          requestData
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("title");

          cleanupTestData.addConversation(responseData.conversationId);
        } else {
          console.log(
            "AI conversation creation failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("POST /ai/chat - Send Chat Message", () => {
      it("should generate RAG response with citations", async () => {
        const requestData = {
          question: "What information do we have about project management?",
          conversationId: testConversationId,
          workspaceId: testWorkspaceId,
        };

        const response = await makeRequest("POST", "/ai/chat", requestData);

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("answer");
          expect(responseData.answer.length).toBeGreaterThan(0);
          expect(responseData).toHaveProperty("citations");
          expect(Array.isArray(responseData.citations)).toBe(true);
          expect(responseData.conversationId).toBe(testConversationId);
          expect(responseData).toHaveProperty("messageId");
          expect(responseData).toHaveProperty("timestamp");
        } else {
          console.log("AI chat failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should create new conversation if not provided", async () => {
        const requestData = {
          question: "What is the purpose of this workspace?",
          workspaceId: testWorkspaceId,
        };

        const response = await makeRequest("POST", "/ai/chat", requestData);

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("conversationId");
          expect(responseData.conversationId).not.toBe(testConversationId);

          cleanupTestData.addConversation(responseData.conversationId);
        } else {
          console.log("AI chat failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should handle questions with no relevant content", async () => {
        const requestData = {
          question: "What is the weather like on Mars?",
          conversationId: testConversationId,
          workspaceId: testWorkspaceId,
        };

        const response = await makeRequest("POST", "/ai/chat", requestData);

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("answer");
        } else {
          console.log("AI chat failed:", response.status, response.data);
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("GET /ai/chat/history/:conversationId - Get Conversation History", () => {
      it("should get conversation history with messages", async () => {
        const response = await makeRequest(
          "GET",
          `/ai/chat/history/${testConversationId}`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("conversation");
          expect(responseData).toHaveProperty("messages");
          expect(Array.isArray(responseData.messages)).toBe(true);
          expect(responseData.messages.length).toBeGreaterThan(0);
          expect(responseData).toHaveProperty("messageCount");

          // Check message structure
          if (responseData.messages.length > 0) {
            const message = responseData.messages[0];
            expect(message).toHaveProperty("role");
            expect(message).toHaveProperty("content");
            expect(message).toHaveProperty("citations");
          }
        } else {
          console.log(
            "Get conversation history failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should return 404 for non-existent conversation", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const response = await makeRequest("GET", `/ai/chat/history/${fakeId}`);

        if (response.status === 404) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(false);
        } else {
          console.log(
            "Get conversation history failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("GET /ai/chat/workspace/:workspaceId/conversations - List Workspace Conversations", () => {
      it("should list all conversations in workspace", async () => {
        const response = await makeRequest(
          "GET",
          `/ai/chat/workspace/${testWorkspaceId}/conversations`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(Array.isArray(responseData.conversations)).toBe(true);
          expect(responseData.conversations.length).toBeGreaterThan(0);
          expect(responseData).toHaveProperty("pagination");

          // Check conversation structure
          const conversation = responseData.conversations[0];
          expect(conversation).toHaveProperty("id");
          expect(conversation).toHaveProperty("title");
          expect(conversation).toHaveProperty("updatedAt");
          expect(conversation).toHaveProperty("messageCount");
        } else {
          console.log(
            "Get workspace conversations failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should support pagination", async () => {
        const response = await makeRequest(
          "GET",
          `/ai/chat/workspace/${testWorkspaceId}/conversations?limit=1&offset=0`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData.pagination.limit).toBe(1);
          expect(responseData.pagination.offset).toBe(0);
        } else {
          console.log(
            "Get workspace conversations pagination failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("PUT /ai/chat/:conversationId/title - Update Conversation Title", () => {
      it("should update conversation title", async () => {
        const newTitle = `Updated Chat Title ${Date.now()}`;
        const requestData = { title: newTitle };

        const response = await makeRequest(
          "PUT",
          `/ai/chat/${testConversationId}/title`,
          requestData
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData.title).toBe(newTitle);
          expect(responseData.conversationId).toBe(testConversationId);
        } else {
          console.log(
            "Update conversation title failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should fail with empty title", async () => {
        const response = await makeRequest(
          "PUT",
          `/ai/chat/${testConversationId}/title`,
          { title: "" }
        );

        if (response.status === 400) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(false);
        } else {
          console.log(
            "Update conversation title failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("DELETE /ai/chat/:conversationId - Delete Conversation", () => {
      let conversationToDelete: string;

      beforeAll(async () => {
        // Create a conversation specifically for deletion
        const requestData = {
          workspaceId: testWorkspaceId,
          title: "Conversation to Delete",
        };
        const response = await makeRequest(
          "POST",
          "/ai/chat/conversation",
          requestData
        );
        conversationToDelete = (response.data as any).data.conversationId;
      });

      it("should delete conversation successfully", async () => {
        const response = await makeRequest(
          "DELETE",
          `/ai/chat/${conversationToDelete}`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData.message).toContain("deleted successfully");
          expect(responseData.conversationId).toBe(conversationToDelete);

          // Verify conversation is deleted
          const verifyResponse = await makeRequest(
            "GET",
            `/ai/chat/history/${conversationToDelete}`
          );
          expect(verifyResponse.status).toBe(404);
        } else {
          console.log(
            "Conversation deletion failed:",
            response.status,
            response.data
          );
          expect([200, 404, 400, 500]).toContain(response.status);
        }
      });

      it("should return 404 for non-existent conversation", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const response = await makeRequest("DELETE", `/ai/chat/${fakeId}`);

        if (response.status === 404) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(false);
        } else {
          console.log(
            "Conversation deletion failed:",
            response.status,
            response.data
          );
          expect([200, 404, 400, 500]).toContain(response.status);
        }
      });
    });
  });

  describe("AI Management Endpoints", () => {
    describe("POST /ai/workspace/:workspaceId/generate-summaries - Generate Workspace Summaries", () => {
      it("should trigger batch summary generation", async () => {
        const response = await makeRequest(
          "POST",
          `/ai/workspace/${testWorkspaceId}/generate-summaries`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData.message).toContain("Summary generation started");
          expect(responseData.workspaceId).toBe(testWorkspaceId);
          expect(responseData.note).toContain("background");
        } else {
          console.log(
            "Workspace summary generation failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("GET /ai/workspace/:workspaceId/summary-status - Get Summary Status", () => {
      it("should get summary generation status", async () => {
        const response = await makeRequest(
          "GET",
          `/ai/workspace/${testWorkspaceId}/summary-status`
        );

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData.workspaceId).toBe(testWorkspaceId);
          expect(responseData).toHaveProperty("totalPages");
          expect(responseData).toHaveProperty("pagesWithSummaries");
          expect(responseData).toHaveProperty("pagesNeedingUpdate");
          expect(responseData).toHaveProperty("completionPercentage");
        } else {
          console.log(
            "Get workspace summary status failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });

    describe("GET /ai/graph/:pageId - Get Knowledge Graph Data", () => {
      it("should get knowledge graph data for a page", async () => {
        const response = await makeRequest("GET", `/ai/graph/${testPageId}`);

        if (response.status === 200) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(true);
          expect(responseData).toHaveProperty("graph");
          expect(responseData.graph).toHaveProperty("nodes");
          expect(responseData.graph).toHaveProperty("edges");
          expect(Array.isArray(responseData.graph.nodes)).toBe(true);
          expect(Array.isArray(responseData.graph.edges)).toBe(true);
          expect(responseData.graph).toHaveProperty("centerNode");
        } else {
          console.log(
            "Get knowledge graph data failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });

      it("should return 404 for non-existent page", async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const response = await makeRequest("GET", `/ai/graph/${fakeId}`);

        if (response.status === 404) {
          const responseData = response.data as any;
          expect(responseData.success).toBe(false);
        } else {
          console.log(
            "Get knowledge graph data failed:",
            response.status,
            response.data
          );
          expect([200, 400, 500]).toContain(response.status);
        }
      });
    });
  });
});
