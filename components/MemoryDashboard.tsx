import React, { useState, useEffect, useCallback } from 'react';
import { NovelState } from '../types';
import { LoreBible } from '../types/loreBible';
import { buildLoreBible, formatLoreBibleCompact, validateLoreBibleConsistency } from '../services/loreBible/loreBibleService';
import { gatherMemoryContext, MemoryContext } from '../services/memory/memoryTierManager';
import { getRelevantArcMemories, ArcMemorySummary } from '../services/memory/arcMemoryService';
import { analyzeChapterContext, QueryAnalysisResult } from '../services/memory/queryAnalyzer';
import { getIndexingStats, fullReindex, isPineconeReady, getNovelStats, isEmbeddingServiceAvailable, generateEmbedding, ensureIndexExists } from '../services/vectorDb';
import { logger } from '../services/loggingService';

interface MemoryDashboardProps {
  novelState: NovelState | null;
}

type TabType = 'overview' | 'loreBible' | 'arcMemory' | 'vectorDb' | 'queryAnalysis';

export const MemoryDashboard: React.FC<MemoryDashboardProps> = ({ novelState }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loreBible, setLoreBible] = useState<LoreBible | null>(null);
  const [arcMemories, setArcMemories] = useState<ArcMemorySummary[]>([]);
  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysisResult | null>(null);
  const [vectorDbStats, setVectorDbStats] = useState<{
    ready: boolean;
    vectorCount: number;
    lastIndexed: number | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load memory context when novel state changes
  useEffect(() => {
    if (novelState) {
      loadMemoryData();
    }
  }, [novelState?.id, novelState?.chapters.length]);

  const loadMemoryData = useCallback(async () => {
    if (!novelState) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Build Lore Bible
      const bible = buildLoreBible(novelState, novelState.chapters.length);
      setLoreBible(bible);

      // Get arc memories
      const memories = getRelevantArcMemories(novelState, novelState.chapters.length, 5);
      setArcMemories(memories);

      // Analyze queries
      const analysis = analyzeChapterContext(novelState);
      setQueryAnalysis(analysis);

      // Check vector DB status
      const ready = await isPineconeReady();
      if (ready) {
        const stats = await getNovelStats(novelState.id);
        setVectorDbStats({
          ready: true,
          vectorCount: stats?.vectorCount || 0,
          lastIndexed: null, // Would come from sync status table
        });
      } else {
        setVectorDbStats({ ready: false, vectorCount: 0, lastIndexed: null });
      }

    } catch (err) {
      logger.error('Failed to load memory data', 'MemoryDashboard', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load memory data');
    } finally {
      setIsLoading(false);
    }
  }, [novelState]);

  const handleFullReindex = async () => {
    if (!novelState) return;
    
    setIsIndexing(true);
    setError(null);

    try {
      const result = await fullReindex(novelState);
      
      if (result.success) {
        setVectorDbStats(prev => prev ? {
          ...prev,
          vectorCount: result.indexedCount,
          lastIndexed: Date.now(),
        } : null);
      } else {
        setError(`Indexing completed with errors: ${result.errors.join(', ')}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleGatherContext = async () => {
    if (!novelState) return;
    
    setIsLoading(true);
    try {
      const context = await gatherMemoryContext(novelState, {
        searchQueries: queryAnalysis?.queries.map(q => q.query),
      });
      setMemoryContext(context);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to gather context');
    } finally {
      setIsLoading(false);
    }
  };

  if (!novelState) {
    return (
      <div className="p-6 text-center text-slate-400">
        <p>Select a novel to view memory dashboard</p>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'loreBible', label: 'Lore Bible' },
    { id: 'arcMemory', label: 'Arc Memory' },
    { id: 'vectorDb', label: 'Vector DB' },
    { id: 'queryAnalysis', label: 'Query Analysis' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h2 className="text-xl font-semibold text-amber-400">Hierarchical Memory System</h2>
        <p className="text-sm text-slate-400 mt-1">
          {novelState.title} - Chapter {novelState.chapters.length}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-amber-400 border-b-2 border-amber-400 bg-slate-800/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewTab
                loreBible={loreBible}
                arcMemories={arcMemories}
                vectorDbStats={vectorDbStats}
                memoryContext={memoryContext}
                onGatherContext={handleGatherContext}
              />
            )}
            {activeTab === 'loreBible' && (
              <LoreBibleTab loreBible={loreBible} novelState={novelState} />
            )}
            {activeTab === 'arcMemory' && (
              <ArcMemoryTab arcMemories={arcMemories} />
            )}
            {activeTab === 'vectorDb' && (
              <VectorDbTab
                stats={vectorDbStats}
                isIndexing={isIndexing}
                onReindex={handleFullReindex}
                onIndexCreated={loadMemoryData}
              />
            )}
            {activeTab === 'queryAnalysis' && (
              <QueryAnalysisTab analysis={queryAnalysis} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab: React.FC<{
  loreBible: LoreBible | null;
  arcMemories: ArcMemorySummary[];
  vectorDbStats: { ready: boolean; vectorCount: number; lastIndexed: number | null } | null;
  memoryContext: MemoryContext | null;
  onGatherContext: () => void;
}> = ({ loreBible, arcMemories, vectorDbStats, memoryContext, onGatherContext }) => {
  return (
    <div className="space-y-6">
      {/* Memory Tiers Overview */}
      <div className="grid grid-cols-3 gap-4">
        {/* Short-Term */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-2">Current Breath</h3>
          <p className="text-2xl font-bold text-white">
            {memoryContext?.shortTerm.chapterNumbers.length || 0}
          </p>
          <p className="text-sm text-slate-400">Recent Chapters</p>
          <p className="text-xs text-slate-500 mt-2">
            {memoryContext?.shortTerm.tokenCount || 0} tokens
          </p>
        </div>

        {/* Mid-Term */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-2">Episodic Arc</h3>
          <p className="text-2xl font-bold text-white">{arcMemories.length}</p>
          <p className="text-sm text-slate-400">Arc Memories</p>
          <p className="text-xs text-slate-500 mt-2">
            {memoryContext?.midTerm.tokenCount || 0} tokens
          </p>
        </div>

        {/* Long-Term */}
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-2">Sect Library</h3>
          <p className="text-2xl font-bold text-white">
            {vectorDbStats?.vectorCount || 0}
          </p>
          <p className="text-sm text-slate-400">Indexed Vectors</p>
          <p className={`text-xs mt-2 ${vectorDbStats?.ready ? 'text-green-400' : 'text-red-400'}`}>
            {vectorDbStats?.ready ? 'Connected' : 'Not Connected'}
          </p>
        </div>
      </div>

      {/* Lore Bible Status */}
      {loreBible && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-3">Lore Bible Status</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Protagonist:</span>
              <span className="text-white ml-2">{loreBible.protagonist.identity.name}</span>
            </div>
            <div>
              <span className="text-slate-400">Cultivation:</span>
              <span className="text-white ml-2">
                {loreBible.protagonist.cultivation.realm} - {loreBible.protagonist.cultivation.stage}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Major Characters:</span>
              <span className="text-white ml-2">{loreBible.majorCharacters.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Active Conflicts:</span>
              <span className="text-white ml-2">{loreBible.activeConflicts.length}</span>
            </div>
            <div>
              <span className="text-slate-400">Karma Debts:</span>
              <span className="text-white ml-2">{loreBible.karmaDebts.length}</span>
            </div>
            <div>
              <span className="text-slate-400">As of Chapter:</span>
              <span className="text-white ml-2">{loreBible.asOfChapter}</span>
            </div>
          </div>
        </div>
      )}

      {/* Gather Context Button */}
      <div className="flex justify-center">
        <button
          onClick={onGatherContext}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors"
        >
          Gather Full Memory Context
        </button>
      </div>

      {/* Context Summary */}
      {memoryContext && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-3">Context Summary</h3>
          <div className="text-sm space-y-2">
            <p className="text-slate-400">
              Total Tokens: <span className="text-white">{memoryContext.totalTokenCount.toLocaleString()}</span>
            </p>
            <p className="text-slate-400">
              Retrieval Time: <span className="text-white">{memoryContext.retrievalDuration}ms</span>
            </p>
            <p className="text-slate-400">
              Vector DB Available: <span className={memoryContext.longTerm.vectorDbAvailable ? 'text-green-400' : 'text-red-400'}>
                {memoryContext.longTerm.vectorDbAvailable ? 'Yes' : 'No'}
              </span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Lore Bible Tab Component
const LoreBibleTab: React.FC<{
  loreBible: LoreBible | null;
  novelState: NovelState;
}> = ({ loreBible, novelState }) => {
  if (!loreBible) {
    return <p className="text-slate-400">No Lore Bible available</p>;
  }

  const validation = validateLoreBibleConsistency(loreBible);

  return (
    <div className="space-y-6">
      {/* Validation Status */}
      <div className={`p-3 rounded-lg border ${
        validation.isValid 
          ? 'bg-green-900/20 border-green-700 text-green-300'
          : 'bg-red-900/20 border-red-700 text-red-300'
      }`}>
        <p className="font-medium">
          {validation.isValid ? 'Lore Bible Valid' : 'Validation Issues Found'}
        </p>
        {validation.errors.length > 0 && (
          <ul className="mt-2 text-sm list-disc list-inside">
            {validation.errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        )}
        {validation.warnings.length > 0 && (
          <ul className="mt-2 text-sm text-amber-300 list-disc list-inside">
            {validation.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Protagonist Section */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">Protagonist State</h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-slate-400">Name:</span>
            <span className="text-white ml-2">{loreBible.protagonist.identity.name}</span>
            {loreBible.protagonist.identity.aliases.length > 0 && (
              <span className="text-slate-500 ml-2">
                ({loreBible.protagonist.identity.aliases.join(', ')})
              </span>
            )}
          </div>
          <div>
            <span className="text-slate-400">Sect:</span>
            <span className="text-white ml-2">{loreBible.protagonist.identity.sect}</span>
          </div>
          <div>
            <span className="text-slate-400">Cultivation:</span>
            <span className="text-white ml-2">
              {loreBible.protagonist.cultivation.realm} - {loreBible.protagonist.cultivation.stage}
            </span>
          </div>
          {loreBible.protagonist.cultivation.physique && (
            <div>
              <span className="text-slate-400">Physique:</span>
              <span className="text-white ml-2">{loreBible.protagonist.cultivation.physique}</span>
            </div>
          )}
        </div>

        {/* Techniques */}
        {loreBible.protagonist.techniques.length > 0 && (
          <div className="mt-4">
            <h4 className="text-slate-300 font-medium mb-2">Techniques</h4>
            <div className="space-y-1">
              {loreBible.protagonist.techniques.map((tech, i) => (
                <div key={i} className="text-sm">
                  <span className="text-amber-300">{tech.name}</span>
                  <span className="text-slate-500 ml-2">({tech.masteryLevel})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inventory */}
        {(loreBible.protagonist.inventory.equipped.length > 0 || 
          loreBible.protagonist.inventory.storageRing.length > 0) && (
          <div className="mt-4">
            <h4 className="text-slate-300 font-medium mb-2">Inventory</h4>
            {loreBible.protagonist.inventory.equipped.length > 0 && (
              <p className="text-sm text-slate-400">
                Equipped: {loreBible.protagonist.inventory.equipped.map(i => i.name).join(', ')}
              </p>
            )}
            {loreBible.protagonist.inventory.storageRing.length > 0 && (
              <p className="text-sm text-slate-400">
                Storage: {loreBible.protagonist.inventory.storageRing.map(i => i.name).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Narrative Anchors */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">Narrative Anchors</h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-slate-400">Last Major Event:</span>
            <p className="text-white mt-1">{loreBible.narrativeAnchors.lastMajorEvent}</p>
            <span className="text-slate-500 text-xs">Chapter {loreBible.narrativeAnchors.lastMajorEventChapter}</span>
          </div>
          <div>
            <span className="text-slate-400">Current Objective:</span>
            <p className="text-white mt-1">{loreBible.narrativeAnchors.currentObjective}</p>
          </div>
          {loreBible.narrativeAnchors.activeQuests.length > 0 && (
            <div>
              <span className="text-slate-400">Active Quests:</span>
              <ul className="mt-1 list-disc list-inside text-white">
                {loreBible.narrativeAnchors.activeQuests.map((quest, i) => (
                  <li key={i}>{quest}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Active Conflicts */}
      {loreBible.activeConflicts.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-3">Active Conflicts</h3>
          <div className="space-y-3">
            {loreBible.activeConflicts.map((conflict, i) => (
              <div key={i} className="text-sm border-l-2 border-red-500 pl-3">
                <p className="text-white">{conflict.description}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  <span>Type: {conflict.type}</span>
                  <span>Urgency: {conflict.urgency}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Karma Debts */}
      {loreBible.karmaDebts.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-3">Karma Debts</h3>
          <div className="space-y-3">
            {loreBible.karmaDebts.map((karma, i) => (
              <div key={i} className="text-sm border-l-2 border-purple-500 pl-3">
                <p className="text-white">
                  <span className="text-amber-300">{karma.target}</span>
                  <span className="text-slate-500 ml-2">({karma.targetStatus})</span>
                </p>
                <p className="text-slate-400 mt-1">{karma.consequence}</p>
                <p className="text-xs text-slate-500 mt-1">Threat: {karma.threatLevel}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compact Format Preview */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">Compact Format (for prompts)</h3>
        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono bg-slate-900 p-3 rounded overflow-auto max-h-48">
          {formatLoreBibleCompact(loreBible)}
        </pre>
      </div>
    </div>
  );
};

// Arc Memory Tab Component
const ArcMemoryTab: React.FC<{
  arcMemories: ArcMemorySummary[];
}> = ({ arcMemories }) => {
  if (arcMemories.length === 0) {
    return <p className="text-slate-400">No arc memories available</p>;
  }

  return (
    <div className="space-y-4">
      {arcMemories.map((memory, i) => (
        <div key={i} className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-amber-400 font-medium">{memory.arcTitle}</h3>
            <span className={`px-2 py-1 rounded text-xs ${
              memory.status === 'active' 
                ? 'bg-green-900/50 text-green-300 border border-green-700'
                : 'bg-slate-700 text-slate-300'
            }`}>
              {memory.status === 'active' ? 'ACTIVE' : 'Completed'}
            </span>
          </div>
          
          <p className="text-sm text-slate-400 mb-2">
            Chapters {memory.startChapter}{memory.endChapter ? `-${memory.endChapter}` : '+'}
          </p>
          
          <p className="text-sm text-slate-300 mb-4">{memory.summary.substring(0, 300)}...</p>
          
          {memory.keyEvents.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs text-slate-500 uppercase mb-1">Key Events</h4>
              <ul className="text-sm text-slate-300 list-disc list-inside">
                {memory.keyEvents.slice(0, 3).map((event, j) => (
                  <li key={j}>{event}</li>
                ))}
              </ul>
            </div>
          )}
          
          {memory.unresolvedElements.length > 0 && (
            <div>
              <h4 className="text-xs text-slate-500 uppercase mb-1">Unresolved</h4>
              <div className="flex flex-wrap gap-2">
                {memory.unresolvedElements.slice(0, 5).map((elem, j) => (
                  <span key={j} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                    {elem}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Vector DB Tab Component
const VectorDbTab: React.FC<{
  stats: { ready: boolean; vectorCount: number; lastIndexed: number | null } | null;
  isIndexing: boolean;
  onReindex: () => void;
  onIndexCreated?: () => void;
}> = ({ stats, isIndexing, onReindex, onIndexCreated }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [isCreatingIndex, setIsCreatingIndex] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);

  const handleCreateIndex = async () => {
    setIsCreatingIndex(true);
    setTestResult(null);

    try {
      const success = await ensureIndexExists();
      if (success) {
        setTestResult({
          success: true,
          message: 'Index created successfully!',
          details: 'The Pinecone index "hall-of-jade-manuscripts" has been created. It may take a few moments to become fully ready.',
        });
        // Refresh the stats after index creation
        if (onIndexCreated) {
          setTimeout(() => onIndexCreated(), 2000);
        }
      } else {
        setTestResult({
          success: false,
          message: 'Failed to create index',
          details: 'Check that your PINECONE_API_KEY is correct and you have permission to create indexes.',
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Index creation failed',
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsCreatingIndex(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      // Test 1: Check if embedding service is available
      const embeddingAvailable = isEmbeddingServiceAvailable();
      if (!embeddingAvailable) {
        setTestResult({
          success: false,
          message: 'OpenAI API key not configured',
          details: 'Embeddings require OPENAI_API_KEY to be set in environment variables.',
        });
        return;
      }

      // Test 2: Check Pinecone connection
      const pineconeReady = await isPineconeReady();
      if (!pineconeReady) {
        setTestResult({
          success: false,
          message: 'Pinecone index not found',
          details: 'The index "hall-of-jade-manuscripts" does not exist. Click "Create Index" below to create it.',
        });
        return;
      }

      // Test 3: Generate a test embedding
      const testText = 'Han Xiao achieved a breakthrough to Nascent Soul realm.';
      const embedding = await generateEmbedding(testText);
      
      if (!embedding) {
        setTestResult({
          success: false,
          message: 'Embedding generation failed',
          details: 'Could not generate embedding for test text.',
        });
        return;
      }

      setTestResult({
        success: true,
        message: 'All systems operational!',
        details: `✓ OpenAI embeddings working (${embedding.length} dimensions)\n✓ Pinecone connected\n✓ Ready for indexing`,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Test failed',
        details: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`p-4 rounded-lg border ${
        stats?.ready 
          ? 'bg-green-900/20 border-green-700'
          : 'bg-amber-900/20 border-amber-700'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${stats?.ready ? 'bg-green-400' : 'bg-amber-400'}`}></div>
          <span className={stats?.ready ? 'text-green-300' : 'text-amber-300'}>
            {stats?.ready ? 'Pinecone Connected' : 'Pinecone Index Not Found'}
          </span>
        </div>
        {!stats?.ready && (
          <div className="mt-3">
            <p className="text-sm text-slate-400 mb-3">
              The Pinecone index "hall-of-jade-manuscripts" doesn't exist yet. Click below to create it.
            </p>
            <button
              onClick={handleCreateIndex}
              disabled={isCreatingIndex}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isCreatingIndex
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              {isCreatingIndex ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Creating Index...
                </span>
              ) : (
                'Create Index'
              )}
            </button>
          </div>
        )}
      </div>

      {/* Test Connection */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">Connection Test</h3>
        <button
          onClick={handleTestConnection}
          disabled={isTesting}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isTesting
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          {isTesting ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Testing...
            </span>
          ) : (
            'Test Pinecone + Embeddings'
          )}
        </button>

        {testResult && (
          <div className={`mt-4 p-3 rounded-lg ${
            testResult.success 
              ? 'bg-green-900/30 border border-green-700 text-green-300'
              : 'bg-red-900/30 border border-red-700 text-red-300'
          }`}>
            <p className="font-medium">{testResult.message}</p>
            {testResult.details && (
              <pre className="mt-2 text-xs whitespace-pre-wrap">{testResult.details}</pre>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      {stats?.ready && (
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <h3 className="text-amber-400 font-medium mb-3">Index Statistics</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Total Vectors:</span>
              <span className="text-white ml-2">{stats.vectorCount.toLocaleString()}</span>
            </div>
            {stats.lastIndexed && (
              <div>
                <span className="text-slate-400">Last Indexed:</span>
                <span className="text-white ml-2">
                  {new Date(stats.lastIndexed).toLocaleString()}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reindex Button */}
      <div className="flex justify-center">
        <button
          onClick={onReindex}
          disabled={!stats?.ready || isIndexing}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            stats?.ready && !isIndexing
              ? 'bg-amber-600 hover:bg-amber-700 text-white'
              : 'bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
        >
          {isIndexing ? (
            <span className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Indexing...
            </span>
          ) : (
            'Full Reindex'
          )}
        </button>
      </div>

      {/* Info */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 text-sm text-slate-400">
        <h4 className="text-slate-300 font-medium mb-2">What gets indexed:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Characters (name, personality, cultivation, background)</li>
          <li>Chapter summaries</li>
          <li>World Bible entries</li>
          <li>Items and Techniques</li>
          <li>Antagonists</li>
          <li>Story Threads</li>
          <li>Arcs</li>
          <li>Territories</li>
        </ul>
      </div>
    </div>
  );
};

// Query Analysis Tab Component
const QueryAnalysisTab: React.FC<{
  analysis: QueryAnalysisResult | null;
}> = ({ analysis }) => {
  if (!analysis) {
    return <p className="text-slate-400">No query analysis available</p>;
  }

  return (
    <div className="space-y-6">
      {/* Source */}
      <div className="text-sm text-slate-400">
        Analysis source: {analysis.sourceDescription}
      </div>

      {/* Extracted Entities */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">
          Extracted Entities ({analysis.entities.length})
        </h3>
        {analysis.entities.length === 0 ? (
          <p className="text-slate-400 text-sm">No entities extracted</p>
        ) : (
          <div className="space-y-2">
            {analysis.entities.slice(0, 10).map((entity, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b border-slate-700 pb-2">
                <div>
                  <span className="text-white">{entity.name}</span>
                  <span className="text-slate-500 ml-2">({entity.type})</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  entity.confidence >= 0.8 ? 'bg-green-900/50 text-green-300' :
                  entity.confidence >= 0.5 ? 'bg-amber-900/50 text-amber-300' :
                  'bg-slate-700 text-slate-400'
                }`}>
                  {(entity.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generated Queries */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">
          Generated Queries ({analysis.queries.length})
        </h3>
        {analysis.queries.length === 0 ? (
          <p className="text-slate-400 text-sm">No queries generated</p>
        ) : (
          <div className="space-y-3">
            {analysis.queries.map((query, i) => (
              <div key={i} className={`border-l-2 pl-3 text-sm ${
                query.priority === 'high' ? 'border-red-500' : 
                query.priority === 'medium' ? 'border-amber-500' : 'border-slate-500'
              }`}>
                <p className="text-white">{query.query}</p>
                <div className="flex gap-4 mt-1 text-xs text-slate-500">
                  <span>Type: {query.type}</span>
                  <span>Priority: {query.priority}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{query.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Keywords */}
      <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
        <h3 className="text-amber-400 font-medium mb-3">
          Detected Keywords ({analysis.keywords.length})
        </h3>
        {analysis.keywords.length === 0 ? (
          <p className="text-slate-400 text-sm">No keywords detected</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {analysis.keywords.map((keyword, i) => (
              <span key={i} className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                {keyword}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryDashboard;
