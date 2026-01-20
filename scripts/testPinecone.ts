/**
 * Pinecone Connection Test Script
 * 
 * Run with: npx vite-node scripts/testPinecone.ts
 * Or import and call testPineconeConnection() from browser console
 */

import { isPineconeConfigured, PINECONE_CONFIG } from '../config/pinecone';
import { isPineconeReady, ensureIndexExists, getIndexStats } from '../services/vectorDb/pineconeService';
import { isEmbeddingServiceAvailable, generateEmbedding } from '../services/vectorDb/embeddingService';

export async function testPineconeConnection(): Promise<{
  success: boolean;
  details: {
    configured: boolean;
    embeddingsAvailable: boolean;
    indexReady: boolean;
    indexStats: any;
    testEmbedding: boolean;
  };
  errors: string[];
}> {
  const errors: string[] = [];
  const details = {
    configured: false,
    embeddingsAvailable: false,
    indexReady: false,
    indexStats: null as any,
    testEmbedding: false,
  };

  console.log('🧪 Testing Pinecone Connection...\n');

  // Step 1: Check if Pinecone is configured
  console.log('1️⃣ Checking Pinecone configuration...');
  details.configured = isPineconeConfigured();
  if (details.configured) {
    console.log('   ✅ Pinecone API key is configured');
    console.log(`   📍 Index name: ${PINECONE_CONFIG.indexName}`);
  } else {
    console.log('   ❌ Pinecone API key is NOT configured');
    errors.push('PINECONE_API_KEY is not set in environment variables');
  }

  // Step 2: Check if embedding service is available
  console.log('\n2️⃣ Checking embedding service (OpenAI)...');
  details.embeddingsAvailable = isEmbeddingServiceAvailable();
  if (details.embeddingsAvailable) {
    console.log('   ✅ OpenAI API key is configured for embeddings');
  } else {
    console.log('   ❌ OpenAI API key is NOT configured');
    errors.push('OPENAI_API_KEY is not set - required for generating embeddings');
  }

  // Step 3: Test Pinecone connection
  if (details.configured) {
    console.log('\n3️⃣ Testing Pinecone connection...');
    try {
      details.indexReady = await isPineconeReady();
      if (details.indexReady) {
        console.log('   ✅ Successfully connected to Pinecone index');
      } else {
        console.log('   ⚠️ Index may not exist yet, attempting to create...');
        const created = await ensureIndexExists();
        if (created) {
          console.log('   ✅ Index created/verified successfully');
          details.indexReady = true;
        } else {
          console.log('   ❌ Failed to create/verify index');
          errors.push('Could not create or connect to Pinecone index');
        }
      }
    } catch (error) {
      console.log('   ❌ Connection failed:', error);
      errors.push(`Pinecone connection error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Step 4: Get index stats
  if (details.indexReady) {
    console.log('\n4️⃣ Getting index statistics...');
    try {
      const stats = await getIndexStats();
      details.indexStats = stats;
      if (stats) {
        console.log(`   📊 Total vectors: ${stats.totalVectorCount}`);
        console.log(`   📁 Namespaces: ${Object.keys(stats.namespaces || {}).length}`);
      } else {
        console.log('   ⚠️ Could not retrieve stats');
      }
    } catch (error) {
      console.log('   ⚠️ Stats retrieval failed:', error);
    }
  }

  // Step 5: Test embedding generation
  if (details.embeddingsAvailable) {
    console.log('\n5️⃣ Testing embedding generation...');
    try {
      const testText = 'Han Xiao achieved a breakthrough to Nascent Soul realm.';
      const embedding = await generateEmbedding(testText);
      if (embedding && embedding.length === 1536) {
        console.log(`   ✅ Successfully generated embedding (${embedding.length} dimensions)`);
        details.testEmbedding = true;
      } else {
        console.log('   ❌ Embedding generation returned unexpected result');
        errors.push('Embedding generation returned invalid result');
      }
    } catch (error) {
      console.log('   ❌ Embedding generation failed:', error);
      errors.push(`Embedding generation error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Summary
  const success = details.configured && details.embeddingsAvailable && 
                  details.indexReady && details.testEmbedding;

  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED');
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach(err => console.log(`  - ${err}`));
  }

  return { success, details, errors };
}

// Export for use in browser
if (typeof window !== 'undefined') {
  (window as any).testPineconeConnection = testPineconeConnection;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPineconeConnection().then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
  });
}
