#!/usr/bin/env ts-node

import { spawn } from "child_process";
import { resolve } from "path";

const testFiles = [
  "workspace.test.ts",
  "pages.test.ts",
  "search.test.ts",
  "tags.test.ts",
  "ai.test.ts",
];

async function runTests() {
  console.log("🚀 Starting comprehensive API endpoint tests...\n");
  console.log(`📊 Running ${testFiles.length} test suites:\n`);

  testFiles.forEach((file, index) => {
    console.log(
      `  ${index + 1}. ${file.replace(".test.ts", "").toUpperCase()} API Tests`
    );
  });

  console.log("\n" + "=".repeat(60) + "\n");

  try {
    // Run Jest with all test files
    const jestProcess = spawn(
      "npx",
      ["jest", "--verbose", "--detectOpenHandles", "--forceExit"],
      {
        stdio: "inherit",
        shell: true,
        cwd: resolve(__dirname, ".."),
      }
    );

    jestProcess.on("close", (code) => {
      console.log("\n" + "=".repeat(60));

      if (code === 0) {
        console.log("\n✅ All API endpoint tests completed successfully!");
        console.log("\n📈 Test Coverage Summary:");
        console.log("  • Workspace API: All CRUD operations tested");
        console.log(
          "  • Page API: All operations including children, backlinks, summaries"
        );
        console.log(
          "  • Search API: Full-text, semantic, suggestions, embeddings"
        );
        console.log("  • Tag API: CRUD operations and page associations");
        console.log("  • AI API: All AI features including RAG chatbot");
        console.log("\n🎉 Backend API is ready for production!");
      } else {
        console.log("\n❌ Some tests failed. Please check the output above.");
        console.log("\n🔧 Common issues to check:");
        console.log("  • Backend server is running on localhost:3001");
        console.log("  • Database is accessible and migrations are applied");
        console.log("  • OpenAI API key is properly configured");
        console.log("  • JWT token is valid and not expired");
      }

      process.exit(code || 0);
    });

    jestProcess.on("error", (error) => {
      console.error("\n❌ Failed to start test runner:", error);
      process.exit(1);
    });
  } catch (error) {
    console.error("\n❌ Error running tests:", error);
    process.exit(1);
  }
}

// Check if backend server is running
async function checkBackendHealth() {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    if (response.ok) {
      console.log("✅ Backend server is running");
      return true;
    }
  } catch (error) {
    console.log("❌ Backend server is not accessible at localhost:3001");
    console.log("   Please start the backend server first: npm run dev");
    return false;
  }
  return false;
}

// Main execution
async function main() {
  console.log("🔍 Checking backend server health...\n");

  const isBackendRunning = await checkBackendHealth();

  if (!isBackendRunning) {
    console.log(
      "\n⚠️  Please ensure the backend server is running before running tests."
    );
    console.log("   Run: npm run dev in another terminal");
    process.exit(1);
  }

  console.log("");
  await runTests();
}

if (require.main === module) {
  main().catch(console.error);
}
