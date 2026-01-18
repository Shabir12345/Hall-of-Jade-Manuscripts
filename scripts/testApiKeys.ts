/**
 * Test script to verify Grok API key is working
 * Run with: npx tsx scripts/testApiKeys.ts
 */

import { env } from '../utils/env';
import { grokText } from '../services/grokService';

interface TestResult {
  service: string;
  status: 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
}

async function testGrok(): Promise<TestResult> {
  const start = Date.now();
  try {
    if (!env.grok?.apiKey) {
      return { service: 'Grok', status: 'skipped', message: 'XAI_API_KEY not set' };
    }
    
    const response = await grokText({
      user: 'Say "Hello" and nothing else.',
      maxTokens: 10,
    });
    
    const duration = Date.now() - start;
    return {
      service: 'Grok',
      status: 'success',
      message: `Connected successfully. Response: "${response.trim()}"`,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - start;
    return {
      service: 'Grok',
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

async function main() {
  console.log('🔑 Testing API Keys...\n');
  console.log('='.repeat(60));
  
  // Check which keys are set
  console.log('\n📋 API Key Status:');
  console.log(`  ✓ Supabase URL: ${env.supabase.url ? 'Set' : 'Missing'}`);
  console.log(`  ✓ Supabase Key: ${env.supabase.anonKey ? 'Set' : 'Missing'}`);
  console.log(`  ${env.grok?.apiKey ? '✓' : '✗'} Grok (XAI): ${env.grok?.apiKey ? 'Set' : 'Missing'}`);
  
  console.log('\n🧪 Testing API Connection...\n');
  
  const results: TestResult[] = [];
  
  // Test Grok
  console.log('Testing Grok (required for all AI features)...');
  results.push(await testGrok());
  
  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Results:\n');
  
  let hasErrors = false;
  let hasSkipped = false;
  
  for (const result of results) {
    const icon = result.status === 'success' ? '✅' : result.status === 'error' ? '❌' : '⏭️';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${icon} ${result.service}: ${result.message}${duration}`);
    
    if (result.status === 'error') hasErrors = true;
    if (result.status === 'skipped') hasSkipped = true;
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Summary
  const grokResult = results.find(r => r.service === 'Grok');
  const grokSuccess = grokResult?.status === 'success';
  
  if (grokSuccess) {
    console.log('\n✅ Grok API key is working!');
    console.log('   Your app is ready to use Grok for all AI features.');
  } else {
    console.log('\n❌ Grok API key test failed!');
    console.log('   Please check your .env.local file and ensure:');
    console.log('   - XAI_API_KEY is set and valid');
  }
  
  if (hasSkipped) {
    console.log('\n⏭️  Grok API key is not set. Please add XAI_API_KEY to your .env.local file.');
  }
  
  if (hasErrors) {
    console.log('\n⚠️  Some API connections failed. Check the error messages above.');
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
