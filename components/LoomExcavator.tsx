/**
 * Loom Excavator Component
 * 
 * The "Archeology Dashboard" for narrative forensic scans.
 * Features:
 * - Scan Zone: Select excavation range
 * - Evidence Wall: Polaroid-style cards with original quotes
 * - Web of Fate View: Visual timeline showing the "Gap"
 */

import React, { useState, useCallback } from 'react';
import {
  Search,
  Pickaxe,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  BookOpen,
  TrendingUp,
  Loader2,
  Quote,
  MapPin,
  Eye,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { NovelState } from '../types';
import {
  NarrativeSeed,
  NarrativeSeedType,
  ExcavationResult,
  NarrativeDebtBreakdown,
  NEGLECT_THRESHOLDS,
} from '../types/narrativeForensics';
import {
  runExcavation,
  approveSeed,
  rejectSeed,
  getExcavationRecommendations,
  ExcavationProgress,
} from '../services/narrativeForensics';
import { checkSeedAgainstThreads } from '../services/narrativeIntegrationService';
import { useNavigation } from '../contexts/NavigationContext';

// ============================================================================
// TYPES
// ============================================================================

interface LoomExcavatorProps {
  novelState: NovelState;
  onSeedApproved?: (seed: NarrativeSeed, threadId: string) => void;
  onSeedRejected?: (seed: NarrativeSeed) => void;
  onScanComplete?: (result: ExcavationResult) => void;
}

type ViewMode = 'scan' | 'evidence' | 'timeline';

// ============================================================================
// SEED TYPE ICONS & COLORS
// ============================================================================

const SEED_TYPE_CONFIG: Record<NarrativeSeedType, { icon: React.ReactNode; color: string; label: string }> = {
  unanswered_question: { icon: <Search className="w-4 h-4" />, color: 'text-blue-400', label: 'Unanswered Question' },
  unused_item: { icon: <Sparkles className="w-4 h-4" />, color: 'text-amber-400', label: 'Unused Item' },
  missing_npc: { icon: <Eye className="w-4 h-4" />, color: 'text-purple-400', label: 'Missing NPC' },
  broken_promise: { icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-400', label: 'Broken Promise' },
  unresolved_conflict: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-orange-400', label: 'Unresolved Conflict' },
  forgotten_technique: { icon: <BookOpen className="w-4 h-4" />, color: 'text-cyan-400', label: 'Forgotten Technique' },
  abandoned_location: { icon: <MapPin className="w-4 h-4" />, color: 'text-green-400', label: 'Abandoned Location' },
  dangling_mystery: { icon: <Search className="w-4 h-4" />, color: 'text-indigo-400', label: 'Dangling Mystery' },
  chekhov_gun: { icon: <Sparkles className="w-4 h-4" />, color: 'text-yellow-400', label: "Chekhov's Gun" },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const LoomExcavator: React.FC<LoomExcavatorProps> = ({
  novelState,
  onSeedApproved,
  onSeedRejected,
  onScanComplete,
}) => {
  // State
  const [viewMode, setViewMode] = useState<ViewMode>('scan');
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(Math.min(10, novelState.chapters.length));
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ExcavationProgress | null>(null);
  const [result, setResult] = useState<ExcavationResult | null>(null);
  const [seeds, setSeeds] = useState<NarrativeSeed[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<NarrativeSeed | null>(null);
  const { navigateToView } = useNavigation();

  const currentChapter = novelState.chapters.length;

  // Persistence Key
  const STORAGE_KEY = `akasha_seeds_${novelState.id}`;

  // Load seeds on mount
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSeeds(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load seeds:', e);
    }
  }, [STORAGE_KEY]);

  // Save seeds on change
  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    } catch (e) {
      console.error('Failed to save seeds:', e);
    }
  }, [seeds, STORAGE_KEY]);

  // Auto-update end chapter logic
  React.useEffect(() => {
    if (endChapter > currentChapter) {
      setEndChapter(currentChapter);
    }
  }, [currentChapter]);

  // Handle scan
  const handleScan = useCallback(async () => {
    if (startChapter > endChapter || startChapter < 1) return;

    setIsScanning(true);
    setProgress({ phase: 'discovery', current: 0, total: endChapter - startChapter + 1, message: 'Initializing...' });
    setResult(null);
    setSeeds([]);

    try {
      const excavationResult = await runExcavation(
        novelState,
        {
          novelId: novelState.id,
          startChapter,
          endChapter,
        },
        {},
        (prog) => setProgress(prog)
      );

      setResult(excavationResult);
      setSeeds(excavationResult.seeds);
      setViewMode('evidence');
      onScanComplete?.(excavationResult);
    } catch (error) {
      console.error('Excavation failed:', error);
    } finally {
      setIsScanning(false);
      setProgress(null);
    }
  }, [novelState, startChapter, endChapter, onScanComplete]);

  // Handle seed approval
  const handleApproveSeed = useCallback(async (seed: NarrativeSeed) => {
    try {
      const { thread, updatedSeed } = await approveSeed(seed, novelState);
      setSeeds(prev => prev.map(s => s.id === seed.id ? updatedSeed : s));
      onSeedApproved?.(updatedSeed, thread.id);
    } catch (error) {
      console.error('Failed to approve seed:', error);
    }
  }, [novelState, onSeedApproved]);

  // Handle seed rejection (deletion)
  const handleRejectSeed = useCallback((seed: NarrativeSeed) => {
    if (confirm('Are you sure you want to permanently dismiss this seed?')) {
      // Remove from list entirely instead of just marking status
      setSeeds(prev => prev.filter(s => s.id !== seed.id));
      onSeedRejected?.(rejectSeed(seed));
    }
  }, [onSeedRejected]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Pickaxe className="w-6 h-6 text-amber-400" />
          <h2 className="text-xl font-bold">Narrative Forensics</h2>
          <span className="text-sm text-gray-400">Akasha Recall System</span>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
          {(['scan', 'evidence', 'timeline'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${viewMode === mode
                ? 'bg-amber-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
            >
              {mode === 'scan' ? 'Scan Zone' : mode === 'evidence' ? 'Evidence Wall' : 'Web of Fate'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'scan' && (
          <ScanZone
            startChapter={startChapter}
            endChapter={endChapter}
            maxChapter={currentChapter}
            isScanning={isScanning}
            progress={progress}
            onStartChapterChange={setStartChapter}
            onEndChapterChange={setEndChapter}
            onScan={handleScan}
          />
        )}

        {viewMode === 'evidence' && (
          <EvidenceWall
            seeds={seeds}
            currentChapter={currentChapter}
            selectedSeed={selectedSeed}
            onSelectSeed={setSelectedSeed}
            onApproveSeed={handleApproveSeed}
            onRejectSeed={handleRejectSeed}
            narrativeDebt={result?.narrativeDebt}
            novelState={novelState}
            navigateToView={navigateToView}
          />
        )}

        {viewMode === 'timeline' && selectedSeed && (
          <WebOfFateView
            seed={selectedSeed}
            currentChapter={currentChapter}
          />
        )}

        {viewMode === 'timeline' && !selectedSeed && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a seed from the Evidence Wall to view its timeline</p>
          </div>
        )}
      </div>

      {/* Footer with Narrative Debt */}
      {result && (
        <NarrativeDebtFooter
          debt={result.narrativeDebt}
          seeds={seeds}
        />
      )}
    </div>
  );
};

// ============================================================================
// SCAN ZONE COMPONENT
// ============================================================================

interface ScanZoneProps {
  startChapter: number;
  endChapter: number;
  maxChapter: number;
  isScanning: boolean;
  progress: ExcavationProgress | null;
  onStartChapterChange: (value: number) => void;
  onEndChapterChange: (value: number) => void;
  onScan: () => void;
}

const ScanZone: React.FC<ScanZoneProps> = ({
  startChapter,
  endChapter,
  maxChapter,
  isScanning,
  progress,
  onStartChapterChange,
  onEndChapterChange,
  onScan,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-20 -left-20 w-96 h-96 bg-amber-900/40 rounded-full blur-[100px]" />
        <div className="absolute top-40 right-10 w-64 h-64 bg-blue-900/30 rounded-full blur-[80px]" />
      </div>

      <div className="max-w-xl w-full space-y-8 relative z-10">
        {/* Title */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center p-3 bg-amber-500/10 rounded-full mb-4">
            <Pickaxe className="w-8 h-8 text-amber-400" />
          </div>
          <h3 className="text-3xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent mb-2">
            Akasha Recall
          </h3>
          <p className="text-gray-400">
            Excavate forgotten narrative threads from the River of Time
          </p>
        </div>

        {/* Scan Controls */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-8 shadow-2xl">
          {/* Progress Bar (Dual Range Slider Visual) */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-gray-400">Scan Range</span>
              <span className="text-amber-400 font-mono">
                Ch. {startChapter} — {endChapter}
              </span>
            </div>

            <div className="h-4 bg-gray-900 rounded-full overflow-hidden relative">
              {/* Active Region */}
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                style={{
                  left: `${((startChapter - 1) / (maxChapter || 1)) * 100}%`,
                  right: `${100 - (endChapter / (maxChapter || 1)) * 100}%`,
                }}
              />
              {/* Ticks */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 w-px bg-white/10"
                  style={{ left: `${(i + 1) * 10}%` }}
                />
              ))}
            </div>

            <div className="flex justify-between text-xs text-gray-500 font-mono">
              <span>Start</span>
              <span>Current (Ch. {maxChapter})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Start From</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={endChapter}
                  value={startChapter}
                  onChange={(e) => onStartChapterChange(Math.max(1, Math.min(endChapter, parseInt(e.target.value) || 1)))}
                  className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Ch</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Excavate Until</label>
              <div className="relative">
                <input
                  type="number"
                  min={startChapter}
                  max={maxChapter}
                  value={endChapter}
                  onChange={(e) => onEndChapterChange(Math.max(startChapter, Math.min(maxChapter, parseInt(e.target.value) || maxChapter)))}
                  className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all outline-none font-mono"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">Ch</span>
              </div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500">
            Scanning {endChapter - startChapter + 1} chapter(s) for narrative anomalies
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onScan}
          disabled={isScanning || startChapter > endChapter}
          className={`group w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all relative overflow-hidden ${isScanning
            ? 'bg-gray-800 text-gray-500 cursor-wait'
            : 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white shadow-lg hover:shadow-amber-500/25 transform hover:-translate-y-0.5'
            }`}
        >
          {isScanning ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{progress?.message || 'Accessing Akasha Records...'}</span>
            </div>
          ) : (
            <>
              <Pickaxe className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              Begin Excavation
            </>
          )}

          {/* Shimmer Effect */}
          {!isScanning && (
            <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent z-10" />
          )}
        </button>

        {/* Loading Bar */}
        {isScanning && progress && (
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 backdrop-blur">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-amber-200 font-medium">
                {progress.phase === 'discovery' ? 'Analyzing Narrative Patterns' : 'Tracing Formatting Threads'}
              </span>
              <span className="text-amber-400 font-mono">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300 ease-out rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center animate-pulse">
              Examining Chapter {progress.current + startChapter - 1}...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// EVIDENCE WALL COMPONENT
// ============================================================================

interface EvidenceWallProps {
  seeds: NarrativeSeed[];
  currentChapter: number;
  selectedSeed: NarrativeSeed | null;
  onSelectSeed: (seed: NarrativeSeed) => void;
  onApproveSeed: (seed: NarrativeSeed) => void;
  onRejectSeed: (seed: NarrativeSeed) => void;
  narrativeDebt?: NarrativeDebtBreakdown;
  novelState: NovelState;
  navigateToView: (view: any) => void;
}

const EvidenceWall: React.FC<EvidenceWallProps> = ({
  seeds,
  currentChapter,
  selectedSeed,
  onSelectSeed,
  onApproveSeed,
  onRejectSeed,
  narrativeDebt,
  novelState,
  navigateToView,
}) => {
  const [filterType, setFilterType] = useState<NarrativeSeedType | 'all'>('all');

  const activeSeeds = seeds.filter(s =>
    (s.status !== 'rejected' && s.status !== 'converted') &&
    (filterType === 'all' || s.seedType === filterType)
  );

  const recommendations = narrativeDebt ? getExcavationRecommendations(seeds, narrativeDebt) : [];

  // Sort by neglect score (descending)
  const sortedSeeds = [...activeSeeds].sort((a, b) => b.neglectScore - a.neglectScore);

  if (seeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8 text-center">
        <div className="w-24 h-24 bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <Pickaxe className="w-12 h-12 opacity-50 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-300 mb-2">No Seeds Excavated</h3>
        <p className="text-sm max-w-sm mx-auto">
          The Akasha records are currently silent. Return to the Scan Zone to begin an excavation of the narrative timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-900">
      {/* Seed Grid */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-800 flex gap-2 overflow-x-auto no-scrollbar items-center">
          <span className="text-xs font-semibold text-gray-500 uppercase mr-2 tracking-wider">Filter:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterType === 'all' ? 'bg-amber-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
          >
            All
          </button>

          {Object.entries(SEED_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setFilterType(type as NarrativeSeedType)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all ${filterType === type
                ? 'bg-gray-700 text-white ring-1 ring-inset ring-amber-500'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
              {config.icon}
              {config.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="mb-8 p-4 bg-gradient-to-r from-amber-900/40 to-transparent border-l-4 border-amber-500 rounded-r-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-amber-400 mb-2">Director's Review</h4>
                  <ul className="space-y-1.5 text-sm text-amber-100/80">
                    {recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Seed Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedSeeds.map((seed) => (
              <EvidenceCard
                key={seed.id}
                seed={seed}
                novelState={novelState}
                currentChapter={currentChapter}
                isSelected={selectedSeed?.id === seed.id}
                onSelect={() => onSelectSeed(seed)}
                onApprove={() => onApproveSeed(seed)}
                onReject={() => onRejectSeed(seed)}
                navigateToView={navigateToView}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {selectedSeed && (
        <div className="w-96 border-l border-gray-700 p-6 overflow-y-auto bg-gray-800/50">
          <SeedDetailPanel
            seed={selectedSeed}
            currentChapter={currentChapter}
            onApprove={() => onApproveSeed(selectedSeed)}
            onReject={() => onRejectSeed(selectedSeed)}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EVIDENCE CARD COMPONENT (Polaroid Style)
// ============================================================================

interface EvidenceCardProps {
  seed: NarrativeSeed;
  novelState: NovelState;
  currentChapter: number;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
  navigateToView: (view: any) => void;
}

const EvidenceCard: React.FC<EvidenceCardProps> = ({
  seed,
  novelState,
  currentChapter: _currentChapter,
  isSelected,
  onSelect,
  onApprove,
  onReject,
  navigateToView,
}) => {
  const isTracked = (seed as any).status === 'converted' || (seed as any).convertedThreadId || checkSeedAgainstThreads(seed, novelState.storyThreads || []);

  const config = SEED_TYPE_CONFIG[seed.seedType];
  const neglectLevel = seed.neglectScore >= NEGLECT_THRESHOLDS.critical ? 'critical' :
    seed.neglectScore >= NEGLECT_THRESHOLDS.stale ? 'stale' :
      seed.neglectScore >= NEGLECT_THRESHOLDS.warning ? 'warning' : 'ok';

  const neglectColors = {
    critical: 'border-red-500 bg-red-900/20',
    stale: 'border-orange-500 bg-orange-900/20',
    warning: 'border-yellow-500 bg-yellow-900/20',
    ok: 'border-gray-600 bg-gray-800',
  };

  return (
    <div
      onClick={onSelect}
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-[1.02] ${neglectColors[neglectLevel]
        } ${isSelected ? 'ring-2 ring-amber-500' : ''}`}
    >
      {/* Tracked Badge */}
      {isTracked && (
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-green-600/20 border border-green-600/50 rounded text-[10px] font-bold text-green-400 z-10 uppercase tracking-tighter">
          ✓ Tracked
        </div>
      )}
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-xs text-gray-400">{config.label}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Clock className="w-3 h-3" />
          <span className={neglectLevel === 'critical' ? 'text-red-400' : 'text-gray-400'}>
            Ch. {seed.originChapter}
          </span>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-white mb-2 line-clamp-2">{seed.title}</h4>

      {/* Quote (Polaroid style) */}
      <div className="bg-gray-900/50 p-3 rounded border-l-2 border-amber-500/50 mb-3">
        <Quote className="w-4 h-4 text-amber-500/50 mb-1" />
        <p className="text-sm text-gray-300 italic line-clamp-3">
          "{seed.originQuote.slice(0, 120)}..."
        </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded ${neglectLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
            neglectLevel === 'stale' ? 'bg-orange-500/20 text-orange-400' :
              'bg-gray-700 text-gray-400'
            }`}>
            {seed.neglectScore} ch. gap
          </span>
          <span className="text-gray-500">
            {seed.confidenceScore}% conf.
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-700">
        {isTracked ? (
          <button
            onClick={(e) => { e.stopPropagation(); navigateToView('story-threads'); }}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded text-sm transition-colors"
          >
            <BookOpen className="w-4 h-4" />
            View Thread
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-green-600/20 hover:bg-green-600/40 text-green-400 rounded text-sm transition-colors"
          >
            <ThumbsUp className="w-4 h-4" />
            Recover
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onReject(); }}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-sm transition-colors"
        >
          <ThumbsDown className="w-4 h-4" />
          Dismiss
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// SEED DETAIL PANEL
// ============================================================================

interface SeedDetailPanelProps {
  seed: NarrativeSeed;
  currentChapter: number;
  onApprove: () => void;
  onReject: () => void;
}

const SeedDetailPanel: React.FC<SeedDetailPanelProps> = ({
  seed,
  currentChapter,
  onApprove,
  onReject,
}) => {
  const config = SEED_TYPE_CONFIG[seed.seedType];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-sm text-gray-400">{config.label}</span>
        </div>
        <h3 className="text-xl font-bold text-white">{seed.title}</h3>
      </div>

      {/* Origin */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Origin</h4>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-amber-400">Chapter {seed.originChapter}</span>
          <span className="text-gray-500">→</span>
          <span className="text-gray-400">Current: Chapter {currentChapter}</span>
        </div>
        <div className="mt-2 text-red-400 text-sm font-semibold">
          {seed.neglectScore} chapters without mention
        </div>
      </div>

      {/* Original Quote */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Original Evidence</h4>
        <div className="bg-gray-900 p-4 rounded-lg border-l-4 border-amber-500">
          <Quote className="w-5 h-5 text-amber-500/50 mb-2" />
          <p className="text-gray-200 italic">"{seed.originQuote}"</p>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Analysis</h4>
        <p className="text-gray-300">{seed.description}</p>
      </div>

      {/* Mention History */}
      {seed.chaptersMentioned.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-400 mb-2">Mention History</h4>
          <div className="flex flex-wrap gap-2">
            {seed.chaptersMentioned.map((ch) => (
              <span key={ch} className="px-2 py-1 bg-gray-700 rounded text-sm">
                Ch. {ch}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence */}
      <div>
        <h4 className="text-sm font-semibold text-gray-400 mb-2">Confidence Score</h4>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${seed.confidenceScore >= 80 ? 'bg-green-500' :
                seed.confidenceScore >= 60 ? 'bg-amber-500' : 'bg-red-500'
                }`}
              style={{ width: `${seed.confidenceScore}%` }}
            />
          </div>
          <span className="text-sm font-semibold">{seed.confidenceScore}%</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={onApprove}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition-colors"
        >
          <CheckCircle className="w-5 h-5" />
          Approve Recovery
        </button>
        <button
          onClick={onReject}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-semibold transition-colors"
        >
          <XCircle className="w-5 h-5" />
          Dismiss
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// WEB OF FATE VIEW (Timeline Visualization)
// ============================================================================

interface WebOfFateViewProps {
  seed: NarrativeSeed;
  currentChapter: number;
}

const WebOfFateView: React.FC<WebOfFateViewProps> = ({ seed, currentChapter }) => {
  const config = SEED_TYPE_CONFIG[seed.seedType];

  // Build timeline nodes
  const nodes: Array<{
    chapter: number;
    type: 'origin' | 'mention' | 'gap' | 'current';
    label: string;
  }> = [];

  // Origin
  nodes.push({
    chapter: seed.originChapter,
    type: 'origin',
    label: 'Origin',
  });

  // Mentions
  for (const ch of seed.chaptersMentioned) {
    // logger.info(`Running Archeologist on Chapter ${ch}`, 'archeologist');
    nodes.push({
      chapter: ch,
      type: 'mention',
      label: `Mentioned`,
    });
  }

  // Current
  nodes.push({
    chapter: currentChapter,
    type: 'current',
    label: 'Now',
  });

  // Sort by chapter
  nodes.sort((a, b) => a.chapter - b.chapter);

  // Calculate gap regions
  const lastMention = seed.lastMentionedChapter || seed.originChapter;
  const gapStart = lastMention;
  const gapEnd = currentChapter;

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className={config.color}>{config.icon}</span>
            <span className="text-gray-400">{config.label}</span>
          </div>
          <h3 className="text-2xl font-bold text-white">{seed.title}</h3>
          <p className="text-gray-400 mt-2">Web of Fate Timeline</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-1 bg-gray-700 -translate-x-1/2" />

          {/* Gap Indicator */}
          {seed.neglectScore > 0 && (
            <div
              className="absolute left-1/2 w-1 bg-gradient-to-b from-amber-500/50 via-red-500/30 to-red-500/50 -translate-x-1/2 animate-pulse"
              style={{
                top: `${((gapStart - seed.originChapter) / (currentChapter - seed.originChapter)) * 100}%`,
                height: `${((gapEnd - gapStart) / (currentChapter - seed.originChapter)) * 100}%`,
              }}
            />
          )}

          {/* Nodes */}
          <div className="space-y-8">
            {nodes.map((node, index) => (
              <div
                key={`${node.chapter}-${index}`}
                className={`flex items-center gap-4 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'
                  }`}
              >
                {/* Content */}
                <div className={`flex-1 ${index % 2 === 0 ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-4 rounded-lg ${node.type === 'origin' ? 'bg-amber-900/30 border border-amber-500/50' :
                    node.type === 'current' ? 'bg-blue-900/30 border border-blue-500/50' :
                      'bg-gray-800 border border-gray-600'
                    }`}>
                    <div className="text-sm text-gray-400">{node.label}</div>
                    <div className="text-lg font-bold text-white">Chapter {node.chapter}</div>
                    {node.type === 'origin' && (
                      <p className="text-sm text-gray-300 mt-2 max-w-xs">
                        "{seed.originQuote.slice(0, 80)}..."
                      </p>
                    )}
                  </div>
                </div>

                {/* Node Dot */}
                <div className={`w-6 h-6 rounded-full border-4 z-10 ${node.type === 'origin' ? 'bg-amber-500 border-amber-300' :
                  node.type === 'current' ? 'bg-blue-500 border-blue-300 animate-pulse' :
                    'bg-gray-500 border-gray-400'
                  }`} />

                {/* Spacer */}
                <div className="flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Gap Summary */}
        <div className="mt-12 p-6 bg-red-900/20 border border-red-500/30 rounded-xl text-center">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <h4 className="text-xl font-bold text-red-400 mb-2">
            {seed.neglectScore} Chapter Gap Detected
          </h4>
          <p className="text-gray-300">
            This narrative thread has been dormant since Chapter {lastMention}.
            {seed.neglectScore >= NEGLECT_THRESHOLDS.critical && (
              <span className="block mt-2 text-red-400 font-semibold">
                CRITICAL: Readers may have forgotten this plot element.
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// NARRATIVE DEBT FOOTER
// ============================================================================

interface NarrativeDebtFooterProps {
  debt: NarrativeDebtBreakdown;
  seeds: NarrativeSeed[];
}

const NarrativeDebtFooter: React.FC<NarrativeDebtFooterProps> = ({ debt, seeds }) => {
  const activeSeeds = seeds.filter(s => s.status !== 'rejected' && s.status !== 'converted');
  const staleCount = activeSeeds.filter(s => s.neglectScore >= NEGLECT_THRESHOLDS.stale).length;
  const criticalCount = activeSeeds.filter(s => s.neglectScore >= NEGLECT_THRESHOLDS.critical).length;

  const debtLevel = debt.weightedDebtScore > 30 ? 'critical' :
    debt.weightedDebtScore > 15 ? 'high' :
      debt.weightedDebtScore > 5 ? 'medium' : 'low';

  const debtColors = {
    critical: 'bg-red-900/50 border-red-500',
    high: 'bg-orange-900/50 border-orange-500',
    medium: 'bg-yellow-900/50 border-yellow-500',
    low: 'bg-green-900/50 border-green-500',
  };

  return (
    <div className={`px-6 py-4 border-t-2 ${debtColors[debtLevel]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <div className="text-xs text-gray-400 uppercase">Narrative Debt</div>
            <div className={`text-2xl font-bold ${debtLevel === 'critical' ? 'text-red-400' :
              debtLevel === 'high' ? 'text-orange-400' :
                debtLevel === 'medium' ? 'text-yellow-400' : 'text-green-400'
              }`}>
              {debt.weightedDebtScore.toFixed(1)}
            </div>
          </div>
          <div className="h-10 w-px bg-gray-700" />
          <div>
            <div className="text-xs text-gray-400 uppercase">Seeds Found</div>
            <div className="text-xl font-semibold text-white">{activeSeeds.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase">Stale</div>
            <div className="text-xl font-semibold text-orange-400">{staleCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase">Critical</div>
            <div className="text-xl font-semibold text-red-400">{criticalCount}</div>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          D = Σ(Hook × Weight) — Higher debt means more forgotten threads
        </div>
      </div>
    </div>
  );
};

export default LoomExcavator;
