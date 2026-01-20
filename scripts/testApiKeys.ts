/**
 * Test script to verify DeepSeek and Gemini API keys are working
 * Run with: npx tsx scripts/testApiKeys.ts
 * 
 * Two-Model Architecture:
 *   - DeepSeek-V3.2 ("The Writer") - For chapter generation and creative writing
 *   - Gemini Flash ("The Clerk") - For state extraction and metadata processing
 */

import { env } from '../utils/env';
import { deepseekText } from '../services/deepseekService';
import { geminiText } from '../services/geminiService';

interface TestResult {
  service: string;
  role: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
}

async function testDeepSeek(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!env.deepseek?.apiKey) {
      return { 
        service: 'DeepSeek', 
        role: 'The Writer',
        status: 'skipped', 
        message: 'DEEPSEEK_API_KEY not set' 
      };
    }
    
    const response = await deepseekText({
      user: 'Say "Hello" and nothing else.',
      maxTokens: 10,
    });
    
    const duration = Date.now() - start;
    return {
      service: 'DeepSeek',
      role: 'The Writer',
      status: 'success',
      message: `Connected successfully. Response: "${response.trim()}"`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      service: 'DeepSeek',
      role: 'The Writer',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

async function testGemini(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!env.gemini?.apiKey) {
      return { 
        service: 'Gemini', 
        role: 'The Clerk',
        status: 'skipped', 
        message: 'GEMINI_API_KEY not set' 
      };
    }
    
    const response = await geminiText({
      user: 'Say "Hello" and nothing else.',
      maxTokens: 10,
    });
    
    const duration = Date.now() - start;
    return {
      service: 'Gemini',
      role: 'The Clerk',
      status: 'success',
      message: `Connected successfully. Response: "${response.trim()}"`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      service: 'Gemini',
      role: 'The Clerk',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

async function main() {
  console.log('🔑 Testing API Keys (Two-Model Architecture)\n');
  console.log('='.repeat(60));
  
  // Check which keys are set
  console.log('\n📋 API Key Status:');
  console.log(`  ✓ Supabase URL: ${env.supabase.url ? 'Set' : 'Missing'}`);
  console.log(`  ✓ Supabase Key: ${env.supabase.anonKey ? 'Set' : 'Missing'}`);
  console.log(`  ${env.deepseek?.apiKey ? '✓' : '✗'} DeepSeek (The Writer): ${env.deepseek?.apiKey ? 'Set' : 'Missing'}`);
  console.log(`  ${env.gemini?.apiKey ? '✓' : '✗'} Gemini (The Clerk): ${env.gemini?.apiKey ? 'Set' : 'Missing'}`);
  
  console.log('\n🧪 Testing API Connections...\n');
  
  const results: TestResult[] = [];
  
  // Test DeepSeek (The Writer)
  console.log('Testing DeepSeek-V3.2 (The Writer - for chapter generation)...');
  results.push(await testDeepSeek());
  
  // Test Gemini (The Clerk)
  console.log('Testing Gemini Flash (The Clerk - for state extraction)...');
  results.push(await testGemini());
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:\n');
  
  let hasErrors = false;
  let hasSkipped = false;
  
  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.service} (${result.role}): ${result.message}${duration}`);
    
    if (result.status === 'error') hasErrors = true;
    if (result.status === 'skipped') hasSkipped = true;
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Summary
  const deepseekResult = results.find(r => r.service === 'DeepSeek');
  const geminiResult = results.find(r => r.service === 'Gemini');
  const allPassed = deepseekResult?.status === 'success' && geminiResult?.status === 'success';
  
  if (allPassed) {
    console.log('\n✅ Both API keys are working!');
    console.log('   Your app is ready to use the two-model architecture:');
    console.log('   - DeepSeek-V3.2 (The Writer) for chapter generation');
    console.log('   - Gemini Flash (The Clerk) for state extraction');
  } else {
    console.log('\n❌ Some API keys are not working!');
    console.log('   Please check your .env.local file and ensure:');
    if (deepseekResult?.status !== 'success') {
      console.log('   - DEEPSEEK_API_KEY is set and valid');
    }
    if (geminiResult?.status !== 'success') {
      console.log('   - GEMINI_API_KEY is set and valid');
    }
  }
  
  if (hasSkipped) {
    console.log('\n⏭️  Some API keys are not set. Both are required for the two-model architecture.');
    console.log('   Add the following to your .env.local file:');
    if (deepseekResult?.status === 'skipped') {
      console.log('   DEEPSEEK_API_KEY=your_deepseek_api_key');
    }
    if (geminiResult?.status === 'skipped') {
      console.log('   GEMINI_API_KEY=your_gemini_api_key');
    }
  }
  
  if (hasErrors) {
    console.log('\n⚠️  Some API connections failed. Check the error messages above.');
    process.exit(1);
  } else if (!allPassed) {
    console.log('\n⚠️  Some API keys are missing. Both are required.');
    process.exit(1);
  } else {
    console.log('\n🎉 All API tests passed!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
