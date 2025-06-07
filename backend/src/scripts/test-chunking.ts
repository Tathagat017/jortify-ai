#!/usr/bin/env ts-node

import { DocumentParserService } from "../services/document-parser.service";

async function testChunking() {
  console.log("🚀 Testing Enhanced Chunking System\n");

  const sampleText = `
# Q4 Sales Strategy Document

## Executive Summary
Our Q4 sales strategy focuses on digital transformation and customer retention. This comprehensive approach will drive revenue growth through innovative channels and enhanced customer experiences.

## Key Objectives
1. **Increase Digital Sales**: Target 40% increase in online revenue
2. **Customer Retention**: Improve retention rate to 85%
3. **Market Expansion**: Enter 3 new geographic markets
4. **Product Innovation**: Launch 2 new product lines

## Market Analysis
The current market shows strong demand for digital solutions. Our competitors are investing heavily in AI and automation. We must respond with innovative approaches.

\`\`\`python
# Sales Analytics Code
def calculate_revenue_growth(current, target):
    return ((target - current) / current) * 100

def customer_segmentation(customers):
    segments = {
        'high_value': [],
        'medium_value': [],
        'low_value': []
    }
    for customer in customers:
        if customer.value > 10000:
            segments['high_value'].append(customer)
        elif customer.value > 5000:
            segments['medium_value'].append(customer)
        else:
            segments['low_value'].append(customer)
    return segments
\`\`\`

## Implementation Timeline
- **Week 1-2**: Team preparation and resource allocation
- **Week 3-4**: Digital platform enhancement
- **Week 5-6**: Marketing campaign launch
- **Week 7-8**: Performance monitoring and optimization

## Budget Allocation
The total budget for Q4 initiatives is $500,000, distributed across:
- Digital marketing: 40%
- Product development: 30%
- Customer retention programs: 20%
- Market research: 10%

## Risk Assessment
Key risks include market volatility, competitive pressure, and resource constraints. Mitigation strategies involve diversification, agile responses, and strategic partnerships.

## Success Metrics
We will measure success through KPIs including revenue growth, customer satisfaction scores, market share expansion, and digital engagement rates.
  `.trim();

  console.log(`📄 Sample text length: ${sampleText.length} characters\n`);

  // Test 1: Advanced Chunking
  console.log("🔬 TEST 1: Advanced Chunking (LangChain + tiktoken)");
  const advancedResult = await DocumentParserService.chunkDocumentWithMetadata(
    sampleText,
    {
      maxTokens: 300,
      overlapTokens: 50,
      useAdvancedChunking: true,
      preserveCodeBlocks: true,
      preserveMarkdown: true,
    }
  );

  console.log("✅ Advanced Results:");
  console.log(`   📊 Chunks: ${advancedResult.metadata.totalChunks}`);
  console.log(`   ⚡ Method: ${advancedResult.metadata.method}`);
  console.log(
    `   🔢 Avg tokens/chunk: ${advancedResult.metadata.avgTokensPerChunk}`
  );
  console.log(
    `   📝 Avg chars/chunk: ${advancedResult.metadata.avgCharsPerChunk}`
  );
  console.log(`   🎯 Total tokens: ${advancedResult.metadata.totalTokens}`);
  console.log(
    `   ⏱️  Processing time: ${advancedResult.metadata.processingTime}ms\n`
  );

  // Test 2: Basic Chunking
  console.log("🔬 TEST 2: Basic Chunking (Fallback)");
  const basicResult = await DocumentParserService.chunkDocumentWithMetadata(
    sampleText,
    {
      maxTokens: 300,
      overlapTokens: 50,
      useAdvancedChunking: false,
    }
  );

  console.log("✅ Basic Results:");
  console.log(`   📊 Chunks: ${basicResult.metadata.totalChunks}`);
  console.log(`   ⚡ Method: ${basicResult.metadata.method}`);
  console.log(
    `   🔢 Avg tokens/chunk: ${basicResult.metadata.avgTokensPerChunk}`
  );
  console.log(
    `   📝 Avg chars/chunk: ${basicResult.metadata.avgCharsPerChunk}`
  );
  console.log(`   🎯 Total tokens: ${basicResult.metadata.totalTokens}`);
  console.log(
    `   ⏱️  Processing time: ${basicResult.metadata.processingTime}ms\n`
  );

  // Test 3: Compare first chunks
  console.log("🔍 COMPARISON: First Chunk from Each Method\n");

  console.log("🚀 Advanced Chunking - First Chunk:");
  console.log("─".repeat(60));
  console.log(advancedResult.chunks[0]);
  console.log("─".repeat(60));
  console.log(
    `Tokens: ${DocumentParserService.getTokenCount(advancedResult.chunks[0])}\n`
  );

  console.log("🔄 Basic Chunking - First Chunk:");
  console.log("─".repeat(60));
  console.log(basicResult.chunks[0]);
  console.log("─".repeat(60));
  console.log(
    `Tokens: ${DocumentParserService.getTokenCount(basicResult.chunks[0])}\n`
  );

  // Test 4: Token Count Accuracy
  console.log("🎯 TOKEN COUNT ACCURACY TEST");
  const testStrings = [
    "Hello world",
    "This is a longer sentence with more complex tokenization.",
    'Code example: function test() { return "hello"; }',
    sampleText.substring(0, 500),
  ];

  for (const testStr of testStrings) {
    const tokenCount = DocumentParserService.getTokenCount(testStr);
    const approxTokens = Math.ceil(testStr.split(/\s+/).length / 0.75);
    console.log(
      `📝 "${testStr.substring(0, 50)}${testStr.length > 50 ? "..." : ""}"`
    );
    console.log(`   🎯 Accurate: ${tokenCount} tokens`);
    console.log(`   📊 Approx: ${approxTokens} tokens`);
    console.log(
      `   📈 Difference: ${Math.abs(tokenCount - approxTokens)} tokens\n`
    );
  }
}

// Run the test
if (require.main === module) {
  testChunking().catch(console.error);
}

export { testChunking };
