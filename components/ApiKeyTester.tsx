import { useState } from 'react';
import { deepseekText } from '../services/deepseekService';
import { geminiText } from '../services/geminiService';
import { env } from '../utils/env';

/**
 * API Key Tester Component
 * 
 * Tests the unified model architecture:
 *   - DeepSeek-V3 ("The Writer & Clerk") - For all creative writing and state extraction tasks
 */

interface TestResult {
  service: string;
  role: string;
  status: 'testing' | 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
}

function ApiKeyTester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testDeepSeek = async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      if (!env.deepseek?.apiKey) {
        return {
          service: 'DeepSeek',
          role: 'The Writer',
          status: 'skipped',
          message: 'DEEPSEEK_API_KEY not set in .env.local'
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
      const hasApiKey = !!env.deepseek?.apiKey;
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (!hasApiKey) {
        errorMessage = 'API key not found. Please:\n1. Add DEEPSEEK_API_KEY=your_key_here to .env.local\n2. Restart the dev server (npm run dev)';
      }

      return {
        service: 'DeepSeek',
        role: 'The Writer',
        status: 'error',
        message: errorMessage,
        duration,
      };
    }
  };

  const testGemini = async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      if (!env.gemini?.apiKey) {
        return {
          service: 'Gemini',
          role: 'The Clerk',
          status: 'skipped',
          message: 'GEMINI_API_KEY not set in .env.local'
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
      const hasApiKey = !!env.gemini?.apiKey;
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (!hasApiKey) {
        errorMessage = 'API key not found. Please:\n1. Add GEMINI_API_KEY=your_key_here to .env.local\n2. Restart the dev server (npm run dev)';
      }

      return {
        service: 'Gemini',
        role: 'The Clerk',
        status: 'error',
        message: errorMessage,
        duration,
      };
    }
  };

  const runTests = async () => {
    setIsTesting(true);
    setResults([]);

    const testResults: TestResult[] = [];

    // Test DeepSeek (The Writer)
    setResults([{ service: 'DeepSeek', role: 'The Writer', status: 'testing', message: 'Testing...' }]);
    testResults.push(await testDeepSeek());
    setResults([...testResults]);

    // Test Gemini (The Clerk)
    setResults([...testResults, { service: 'Gemini', role: 'The Clerk', status: 'testing', message: 'Testing...' }]);
    testResults.push(await testGemini());
    setResults([...testResults]);

    setIsTesting(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'testing':
        return '⏳';
      case 'skipped':
        return '⏭️';
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'testing':
        return 'text-yellow-400';
      case 'skipped':
        return 'text-zinc-500';
    }
  };

  const deepseekResult = results.find(r => r.service === 'DeepSeek');
  const geminiResult = results.find(r => r.service === 'Gemini');
  const allPassed = deepseekResult?.status === 'success' && geminiResult?.status === 'success';

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-100">API Key Tester</h2>
          <p className="text-sm text-zinc-400">Unified DeepSeek Architecture</p>
        </div>
        <button
          onClick={runTests}
          disabled={isTesting}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
        >
          {isTesting ? 'Testing...' : 'Test All APIs'}
        </button>
      </div>

      <div className="mb-4 p-3 bg-zinc-800 rounded-lg">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">API Key Status:</h3>
        <div className="space-y-1 text-xs text-zinc-400">
          <div>✓ Supabase URL: {env.supabase.url ? 'Set' : 'Missing'}</div>
          <div>✓ Supabase Key: {env.supabase.anonKey ? 'Set' : 'Missing'}</div>
          <div>
            {env.deepseek?.apiKey ? '✓' : '✗'} DeepSeek-V3 (Primary):{' '}
            {env.deepseek?.apiKey ? 'Set' : 'Missing'}
          </div>
          <div>
            {env.deepseek?.apiKey ? '✓' : '✗'} DeepSeek-V3 (Extraction):{' '}
            {env.deepseek?.apiKey ? 'Set' : 'Missing'}
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Model Roles:</h3>
        <div className="space-y-2 text-xs text-zinc-400">
          <div>
            <span className="text-amber-400 font-medium">DeepSeek-V3 "Universal Model"</span>
            <p className="ml-2">Trained on Chinese web fiction. Understands cultivation tropes natively. Now used for all tasks including chapter generation, extraction, and lore updates.</p>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Test Results:</h3>
          {results.map((result, index) => (
            <div
              key={index}
              className="p-3 bg-zinc-800 rounded-lg border border-zinc-700"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getStatusIcon(result.status)}</span>
                    <span className={`font-medium ${getStatusColor(result.status)}`}>
                      {result.service}
                    </span>
                    <span className="text-xs text-zinc-500">({result.role})</span>
                    {result.duration && (
                      <span className="text-xs text-zinc-500">({result.duration}ms)</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap">{result.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && !isTesting && (
        <div className="mt-4 p-3 rounded-lg border-2 bg-zinc-800/50">
          {allPassed ? (
            <div className="text-green-400 font-medium">
              ✅ API configuration is working! Your app is ready to use the unified DeepSeek architecture.
            </div>
          ) : (
            <div className="text-red-400 font-medium">
              ❌ Some API keys are not working. Both are required:
              <ul className="mt-2 text-sm font-normal">
                {deepseekResult?.status !== 'success' && (
                  <li>• DEEPSEEK_API_KEY - Required for all AI features</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ApiKeyTester;
export { ApiKeyTester };
