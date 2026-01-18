import React, { useState } from 'react';
import { grokText } from '../services/grokService';
import { env } from '../utils/env';

interface TestResult {
  service: string;
  status: 'testing' | 'success' | 'error' | 'skipped';
  message: string;
  duration?: number;
}

function ApiKeyTester() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const testGrok = async (): Promise<TestResult> => {
    const start = Date.now();
    try {
      if (!env.grok?.apiKey) {
        return { service: 'Grok', status: 'skipped', message: 'XAI_API_KEY not set in .env.local' };
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
      const hasApiKey = !!env.grok?.apiKey;
      let errorMessage = error instanceof Error ? error.message : String(error);
      
      if (!hasApiKey) {
        errorMessage = 'API key not found. Please:\n1. Add XAI_API_KEY=your_key_here to .env.local\n2. Restart the dev server (npm run dev)';
      }
      
      return {
        service: 'Grok',
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

    // Test Grok
    setResults([...testResults, { service: 'Grok', status: 'testing', message: 'Testing...' }]);
    testResults.push(await testGrok());
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

  const grokResult = results.find(r => r.service === 'Grok');
  const allRequiredPassed = grokResult?.status === 'success';

  return (
    <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-zinc-100">API Key Tester</h2>
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
            {env.grok?.apiKey ? '✓' : '✗'} Grok (XAI):{' '}
            {env.grok?.apiKey ? 'Set' : 'Missing'}
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
                    {result.duration && (
                      <span className="text-xs text-zinc-500">({result.duration}ms)</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-400">{result.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 p-3 rounded-lg border-2 bg-zinc-800/50">
          {allRequiredPassed ? (
            <div className="text-green-400 font-medium">
              ✅ Grok API key is working! Your app is ready to use Grok for all AI features.
            </div>
          ) : (
            <div className="text-red-400 font-medium">
              ❌ Grok API key test failed! Please check your .env.local file and ensure XAI_API_KEY is set.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ApiKeyTester;
export { ApiKeyTester };
