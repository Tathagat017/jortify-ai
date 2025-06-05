import dotenv from "dotenv";
import { RAGChatService } from "./services/rag-chat.service";
import { SummaryService } from "./services/summary.service";

// Load environment variables
dotenv.config();

async function testRAGChatbot() {
  console.log("🤖 Testing RAG Chatbot System...\n");

  try {
    // Test data - you should replace these with actual workspace/page IDs from your database
    const testWorkspaceId = "test-workspace-id"; // Replace with actual workspace ID
    const testUserId = "test-user-id"; // Replace with actual user ID

    console.log("1. Testing conversation creation...");
    const conversationId = await RAGChatService.createConversation(
      testWorkspaceId,
      testUserId,
      "Test Conversation"
    );
    console.log(`✅ Created conversation: ${conversationId}\n`);

    console.log("2. Testing RAG response generation...");
    const response = await RAGChatService.generateRAGResponse(
      "What is this workspace about?",
      conversationId,
      testWorkspaceId
    );

    console.log("📝 RAG Response:");
    console.log(`Answer: ${response.answer}`);
    console.log(`Citations: ${response.citations.length} found`);
    response.citations.forEach((citation, index) => {
      console.log(
        `  ${index + 1}. ${
          citation.pageTitle
        } (relevance: ${citation.relevance.toFixed(2)})`
      );
    });
    console.log("");

    console.log("3. Testing conversation history retrieval...");
    const history = await RAGChatService.getConversationHistory(conversationId);
    console.log(`✅ Retrieved ${history.length} messages from conversation\n`);

    console.log("4. Testing workspace conversations list...");
    const conversations = await RAGChatService.getWorkspaceConversations(
      testWorkspaceId
    );
    console.log(
      `✅ Found ${conversations.length} conversations in workspace\n`
    );

    console.log("5. Testing conversation deletion...");
    await RAGChatService.deleteConversation(conversationId);
    console.log(`✅ Deleted conversation: ${conversationId}\n`);

    console.log("🎉 All RAG chatbot tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);

    if (error instanceof Error) {
      if (error.message.includes("workspace-id")) {
        console.log(
          "\n💡 Note: You need to replace testWorkspaceId with an actual workspace ID from your database"
        );
      }
      if (error.message.includes("OpenAI API key")) {
        console.log(
          "\n💡 Note: Make sure OPENAI_API_KEY is set in your .env file"
        );
      }
    }
  }
}

async function testSummaryGeneration() {
  console.log("\n📝 Testing Summary Service...\n");

  try {
    const testWorkspaceId = "test-workspace-id"; // Replace with actual workspace ID

    console.log("1. Testing workspace summary status...");
    const pagesNeedingUpdate =
      await SummaryService.getPagesNeedingSummaryUpdate(testWorkspaceId);
    console.log(
      `✅ Found ${pagesNeedingUpdate.length} pages needing summary updates\n`
    );

    console.log("🎉 Summary service tests passed!");
  } catch (error) {
    console.error("❌ Summary test failed:", error);
  }
}

// Run tests
if (require.main === module) {
  (async () => {
    await testRAGChatbot();
    await testSummaryGeneration();
  })();
}

export { testRAGChatbot, testSummaryGeneration };
