/**
 * Loom Excavator Component (Full Version)
 * 
 * The "Archeology Dashboard" for narrative forensic scans.
 * Features:
 * - Scan Zone: Select excavation range
 * - Evidence Wall: Polaroid-style cards with original quotes
 * - Web of Fate View: Visual timeline showing the "Gap"
 */

import React, { useState, useCallback, useEffect } from 'react';
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
  const [endChapter, setEndChapter] = useState(novelState.chapters.length || 1);
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<ExcavationProgress | null>(null);
  const [result, setResult] = useState<ExcavationResult | null>(null);
  const [seeds, setSeeds] = useState<NarrativeSeed[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<NarrativeSeed | null>(null);

  const currentChapter = novelState.chapters.length || 1;

  // Persistence Key
  const STORAGE_KEY = `akasha_seeds_${novelState.id}`;

  // Load seeds on mount
  useEffect(() => {
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
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    } catch (e) {
      console.error('Failed to save seeds:', e);
    }
  }, [seeds, STORAGE_KEY]);

  // Handle scan
  const handleScan = useCallback(async () => {
    if (startChapter > endChapter || startChapter < 1) return;

    setIsScanning(true);
    setProgress({ phase: 'discovery', current: 0, total: endChapter - startChapter + 1, message: 'Initializing...' });
    setResult(null);

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
    if (window.confirm('Are you sure you want to permanently dismiss this seed?')) {
      // Remove from list entirely
      setSeeds(prev => prev.filter(s => s.id !== seed.id));
      onSeedRejected?.(rejectSeed(seed));
    }
  }, [onSeedRejected]);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-gray-950 text-gray-100 overflow-hidden">
      {/* Dynamic Header */}
      <div className="flex items-center justify-between px-8 py-6 bg-zinc-900/50 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <Pickaxe className="w-7 h-7 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent">Akasha Recall</h2>
            <p className="text-sm text-zinc-500 font-medium">Narrative Forensic Timeline</p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-1 bg-zinc-950/80 p-1.5 rounded-2xl border border-zinc-800 shadow-inner">
          {(['scan', 'evidence', 'timeline'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${viewMode === mode
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-white shadow-lg'
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
            >
              {mode === 'scan' ? 'Scan Zone' : mode === 'evidence' ? 'Evidence Wall' : 'Web of Fate'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden relative">
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
          />
        )}

        {viewMode === 'timeline' && selectedSeed && (
          <WebOfFateView
            seed={selectedSeed}
            currentChapter={currentChapter}
          />
        )}

        {viewMode === 'timeline' && !selectedSeed && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600 gap-4">
            <div className="p-6 bg-zinc-900/30 rounded-full border border-zinc-800/50">
              <Eye className="w-12 h-12 opacity-20" />
            </div>
            <p className="text-lg font-medium">Select a seed from the Evidence Wall to view its timeline</p>
          </div>
        )}
      </div>

      {/* Footer with Narrative Debt */}
      {(result || seeds.length > 0) && (
        <NarrativeDebtFooter
          debt={result?.narrativeDebt || { weightedDebtScore: 0, rawSeedCount: seeds.length, criticalDeficitCount: 0 }}
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
    <div className="flex flex-col items-center justify-center h-full p-8 relative overflow-hidden bg-zinc-950">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-amber-600/5 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="max-w-2xl w-full space-y-12 relative z-10 p-12 bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/50 rounded-[40px] shadow-2xl">
        {/* Title */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-[28px] shadow-2xl shadow-amber-900/30 transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <Pickaxe className="w-10 h-10 text-white" />
          </div>
          <div className="space-y-1">
            <h3 className="text-4xl font-black text-white tracking-tight">
              Begin Excavation
            </h3>
            <p className="text-zinc-500 text-lg font-medium">
              Specify the depth of your timeline reach
            </p>
          </div>
        </div>

        {/* Scan Controls */}
        <div className="space-y-10">
          {/* Progress Bar (Dual Range Slider Visual) */}
          <div className="space-y-6">
            <div className="flex justify-between items-end">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Temporal Range</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-500 tabular-nums">{startChapter}</span>
                <span className="text-zinc-600 font-bold">—</span>
                <span className="text-3xl font-black text-amber-500 tabular-nums">{endChapter}</span>
                <span className="text-zinc-600 text-sm font-bold uppercase ml-1">Chapters</span>
              </div>
            </div>

            <div className="h-4 bg-zinc-950 rounded-full relative border border-zinc-800/50 shadow-inner group">
              {/* Active Region */}
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-500 rounded-full"
                style={{
                  left: `${((startChapter - 1) / (maxChapter || 1)) * 100}%`,
                  width: `${((endChapter - startChapter + 1) / (maxChapter || 1)) * 100}%`,
                }}
              />
              {/* Hover Glow */}
              <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/5 transition-colors duration-500 rounded-full" />
            </div>

            <div className="flex justify-between text-[10px] text-zinc-600 font-black uppercase tracking-tighter">
              <span>Genesis</span>
              <span>Present Moment (Ch. {maxChapter})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Deep Root</label>
              <div className="relative group">
                <input
                  type="number"
                  min={1}
                  max={endChapter}
                  value={startChapter}
                  onChange={(e) => onStartChapterChange(Math.max(1, Math.min(endChapter, parseInt(e.target.value) || 1)))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white text-xl font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold uppercase text-[10px]">Start</span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-black text-zinc-500 uppercase tracking-widest ml-1">Surface Limit</label>
              <div className="relative group">
                <input
                  type="number"
                  min={startChapter}
                  max={maxChapter}
                  value={endChapter}
                  onChange={(e) => onEndChapterChange(Math.max(startChapter, Math.min(maxChapter, parseInt(e.target.value) || maxChapter)))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-white text-xl font-bold focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold uppercase text-[10px]">End</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="space-y-4 pt-4">
          <button
            onClick={onScan}
            disabled={isScanning || startChapter > endChapter}
            className={`group w-full py-5 rounded-[24px] font-black text-xl flex items-center justify-center gap-4 transition-all duration-500 relative overflow-hidden ${isScanning
              ? 'bg-zinc-800 text-zinc-600 cursor-wait'
              : 'bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-white/10'
              }`}
          >
            {isScanning ? (
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Synchronizing...</span>
              </div>
            ) : (
              <>
                <Sparkles className="w-6 h-6 text-amber-500" />
                RECALL RECORDS
              </>
            )}
          </button>

          {isScanning && progress && (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex justify-between text-xs font-black uppercase tracking-widest text-zinc-500">
                <span>{progress.message}</span>
                <span className="text-amber-500">{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-500 ease-out"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
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
}

const EvidenceWall: React.FC<EvidenceWallProps> = ({
  seeds,
  currentChapter,
  selectedSeed,
  onSelectSeed,
  onApproveSeed,
  onRejectSeed,
  narrativeDebt,
}) => {
  const [filterType, setFilterType] = useState<NarrativeSeedType | 'all'>('all');

  const activeSeeds = seeds.filter(s =>
    (s.status !== 'rejected' && s.status !== 'converted') &&
    (filterType === 'all' || s.seedType === filterType)
  );

  const recommendations = narrativeDebt ? getExcavationRecommendations(seeds, narrativeDebt) : [];
  const sortedSeeds = [...activeSeeds].sort((a, b) => b.neglectScore - a.neglectScore);

  if (seeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-zinc-600 p-8 text-center space-y-6 bg-zinc-950">
        <div className="w-32 h-32 bg-zinc-900 rounded-[40px] flex items-center justify-center border border-zinc-800 shadow-2xl transform rotate-6">
          <Pickaxe className="w-16 h-16 opacity-10 text-zinc-100" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-black text-zinc-300">The Akasha is Silent</h3>
          <p className="text-zinc-500 max-w-sm font-medium leading-relaxed">
            Return to the Scan Zone and begin an recruitment of the narrative timeline to discover forgotten seeds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-zinc-950">
      {/* Seed Grid */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-900">
        {/* Advanced Filters */}
        <div className="px-8 py-6 bg-zinc-900/20 backdrop-blur flex gap-3 overflow-x-auto no-scrollbar items-center border-b border-zinc-900">
          <div className="flex items-center gap-2 mr-4">
            <span className="p-2 bg-zinc-800 rounded-lg"><Search className="w-4 h-4 text-zinc-400" /></span>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Filter</span>
          </div>
          <button
            onClick={() => setFilterType('all')}
            className={`px-5 py-2 rounded-xl text-xs font-black tracking-widest uppercase transition-all duration-300 ${filterType === 'all'
              ? 'bg-white text-black shadow-lg shadow-white/5'
              : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200 border border-zinc-800'
              }`}
          >
            All
          </button>

          {Object.entries(SEED_TYPE_CONFIG).map(([type, config]) => (
            <button
              key={type}
              onClick={() => setFilterType(type as NarrativeSeedType)}
              className={`px-5 py-2 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2.5 transition-all duration-300 whitespace-nowrap ${filterType === type
                ? 'bg-zinc-200 text-black border-transparent'
                : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200 border border-zinc-800'
                }`}
            >
              <span className={config.color}>{config.icon}</span>
              {config.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-12 bg-zinc-950">
          {/* Recommendations Banner */}
          {recommendations.length > 0 && filterType === 'all' && (
            <div className="p-8 rounded-[32px] bg-gradient-to-br from-amber-600/10 via-amber-600/5 to-transparent border border-amber-500/10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                <Sparkles className="w-24 h-24 text-amber-500" />
              </div>
              <div className="flex items-start gap-6 relative z-10">
                <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/20">
                  <Sparkles className="w-6 h-6 text-amber-500" />
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xl font-black text-amber-400 uppercase tracking-tight">Fate Navigator Recommendations</h4>
                    <p className="text-amber-100/40 text-sm font-medium">Strategic insights derived from your narrative's current entropy.</p>
                  </div>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                    {recommendations.slice(0, 4).map((rec, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500/50 flex-shrink-0" />
                        <span className="text-amber-100/70 text-sm font-medium leading-relaxed">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Seed Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8">
            {sortedSeeds.map((seed) => (
              <EvidenceCard
                key={seed.id}
                seed={seed}
                currentChapter={currentChapter}
                isSelected={selectedSeed?.id === seed.id}
                onSelect={() => onSelectSeed(seed)}
                onApprove={() => onApproveSeed(seed)}
                onReject={() => onRejectSeed(seed)}
              />
            ))}
          </div>

          {sortedSeeds.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-700 space-y-4">
              <Search className="w-12 h-12 opacity-20" />
              <p className="text-xl font-bold">No results found for this selection</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedSeed && (
        <div className="w-[450px] bg-zinc-950 p-10 overflow-y-auto animate-in slide-in-from-right duration-500 border-l border-zinc-900 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
          <SeedDetailPanel
            seed={selectedSeed}
            currentChapter={currentChapter}
            onApprove={() => onApproveSeed(selectedSeed)}
            onReject={() => onRejectSeed(selectedSeed)}
            onClose={() => onSelectSeed(null as any)}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// EVIDENCE CARD COMPONENT
// ============================================================================

interface EvidenceCardProps {
  seed: NarrativeSeed;
  currentChapter: number;
  isSelected: boolean;
  onSelect: () => void;
  onApprove: () => void;
  onReject: () => void;
}

const EvidenceCard: React.FC<EvidenceCardProps> = ({
  seed,
  currentChapter: _currentChapter,
  isSelected,
  onSelect,
  onApprove,
  onReject,
}) => {
  const config = SEED_TYPE_CONFIG[seed.seedType];
  const neglectLevel = seed.neglectScore >= NEGLECT_THRESHOLDS.critical ? 'critical' :
    seed.neglectScore >= NEGLECT_THRESHOLDS.stale ? 'stale' :
      seed.neglectScore >= NEGLECT_THRESHOLDS.warning ? 'warning' : 'ok';

  const neglectColors = {
    critical: 'bg-red-500/10 border-red-500/30 group-hover:border-red-500/60',
    stale: 'bg-orange-500/10 border-orange-500/30 group-hover:border-orange-500/60',
    warning: 'bg-amber-500/10 border-amber-500/30 group-hover:border-amber-500/60',
    ok: 'bg-zinc-900/40 border-zinc-800 group-hover:border-zinc-700',
  };

  const statusLabel = {
    critical: 'Critical Neglect',
    stale: 'Stale Thread',
    warning: 'Dormant',
    ok: 'Active Trace'
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative p-6 rounded-[32px] border transition-all duration-500 cursor-pointer flex flex-col h-full bg-zinc-950 ${isSelected ? 'ring-2 ring-amber-500 shadow-2xl shadow-amber-900/20' : ''
        } ${neglectColors[neglectLevel]}`}
    >
      {/* Background Accent */}
      <div className={`absolute top-0 right-10 w-24 h-24 rounded-full blur-[40px] opacity-0 group-hover:opacity-10 transition-opacity ${neglectLevel === 'critical' ? 'bg-red-500' : 'bg-amber-500'
        }`} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-zinc-950 rounded-xl border border-zinc-800 group-hover:border-zinc-700 transition-colors">
            <span className={config.color}>{config.icon}</span>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{config.label}</span>
            <div className={`text-[10px] font-bold uppercase tracking-widest ${neglectLevel === 'critical' ? 'text-red-400' :
                neglectLevel === 'stale' ? 'text-orange-400' : 'text-zinc-600'
              }`}>
              {statusLabel[neglectLevel]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 p-2 bg-zinc-950/80 rounded-lg border border-zinc-800/50">
          <Clock className="w-3.3 h-3.3 text-zinc-500" />
          <span className="text-[10px] font-black tabular-nums text-zinc-400">
            CH.{seed.originChapter}
          </span>
        </div>
      </div>

      {/* Title */}
      <h4 className="text-lg font-black text-zinc-100 mb-4 line-clamp-2 leading-tight tracking-tight group-hover:text-amber-500 transition-colors">
        {seed.title}
      </h4>

      {/* Quote Evidence */}
      <div className="flex-1 space-y-4">
        <div className="relative">
          <div className="absolute -left-3 top-0 bottom-0 w-1 bg-amber-500/20 rounded-full" />
          <p className="text-zinc-400 text-sm font-medium italic leading-relaxed pl-3 line-clamp-4 group-hover:text-zinc-300 transition-colors">
            "{seed.originQuote}"
          </p>
        </div>
      </div>

      {/* Gap Stats */}
      <div className="mt-8 pt-6 border-t border-zinc-800/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Neglect Cache</div>
            <div className={`text-xl font-black tabular-nums ${neglectLevel === 'critical' ? 'text-red-400' :
                neglectLevel === 'stale' ? 'text-orange-400' : 'text-zinc-300'
              }`}>
              {seed.neglectScore}<span className="text-xs font-bold text-zinc-600 ml-1">Δ</span>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Certainty</div>
            <div className="text-xl font-black tabular-nums text-zinc-400">
              {seed.confidenceScore}%
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-500 hover:text-green-400 hover:border-green-500/50 hover:bg-green-500/5 transition-all"
            title="Approve Trace"
          >
            <ThumbsUp className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-zinc-500 hover:text-red-400 hover:border-red-500/50 hover:bg-red-500/5 transition-all"
            title="Dismiss Seed"
          >
            <ThumbsDown className="w-4 h-4" />
          </button>
        </div>
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
  onClose: () => void;
}

const SeedDetailPanel: React.FC<SeedDetailPanelProps> = ({
  seed,
  currentChapter,
  onApprove,
  onReject,
  onClose,
}) => {
  const config = SEED_TYPE_CONFIG[seed.seedType];

  return (
    <div className="space-y-12">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <button
          onClick={onClose}
          className="p-2 bg-zinc-900 rounded-lg text-zinc-500 hover:text-white transition-colors"
        >
          <XCircle className="w-5 h-5" />
        </button>
        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em]">Seed Analysis</span>
      </div>

      {/* Main Identity */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-4 bg-zinc-900 rounded-[20px] border border-zinc-800">
            <span className={config.color}>{config.icon}</span>
          </div>
          <div>
            <div className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{config.label}</div>
            <h3 className="text-2xl font-black text-white leading-tight">{seed.title}</h3>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-900 text-center">
            <div className="text-[10px] font-black text-zinc-600 uppercase mb-1">Origin</div>
            <div className="text-lg font-black text-zinc-200 tabular-nums">Ch.{seed.originChapter}</div>
          </div>
          <div className="flex-1 bg-zinc-900/50 p-4 rounded-2xl border border-zinc-900 text-center">
            <div className="text-[10px] font-black text-zinc-600 uppercase mb-1">Dormancy</div>
            <div className="text-lg font-black text-amber-500 tabular-nums">{seed.neglectScore} Δ</div>
          </div>
        </div>
      </div>

      {/* Analysis Content */}
      <div className="space-y-10">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Quote className="w-4 h-4 text-zinc-600" />
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Chronicle Trace</h4>
          </div>
          <div className="bg-zinc-950 p-6 rounded-[24px] border border-zinc-800 shadow-inner relative">
            <div className="absolute top-0 right-0 p-4 opacity-5"><Sparkles className="w-12 h-12" /></div>
            <p className="text-zinc-300 text-sm font-medium italic leading-relaxed tracking-wide">
              "{seed.originQuote}"
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen className="w-4 h-4 text-zinc-600" />
            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Lore Insight</h4>
          </div>
          <p className="text-zinc-400 text-sm font-medium leading-relaxed bg-zinc-900/10 p-4 rounded-xl">
            {seed.description}
          </p>
        </section>

        {seed.chaptersMentioned.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-4 h-4 text-zinc-600" />
              <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Vibration History</h4>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {seed.chaptersMentioned.map((ch) => (
                <span key={ch} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-black text-zinc-400 tabular-nums">
                  Chapter {ch}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4 pt-10 border-t border-zinc-900">
          <button
            onClick={onApprove}
            className="w-full py-5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-[24px] font-black text-lg shadow-xl shadow-green-950/20 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            <CheckCircle className="w-6 h-6" />
            WEAVE BACK INTO FATE
          </button>
          <button
            onClick={onReject}
            className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-red-400 rounded-[20px] font-black text-xs tracking-widest uppercase border border-zinc-800 transition-all flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            PERMANENT DISMISSAL
          </button>
        </section>
      </div>
    </div>
  );
};

// ============================================================================
// WEB OF FATE VIEW
// ============================================================================

interface WebOfFateViewProps {
  seed: NarrativeSeed;
  currentChapter: number;
}

const WebOfFateView: React.FC<WebOfFateViewProps> = ({ seed, currentChapter }) => {
  const config = SEED_TYPE_CONFIG[seed.seedType];
  const nodes = [
    { chapter: seed.originChapter, type: 'origin', label: 'Origin Point' },
    ...seed.chaptersMentioned.map(ch => ({ chapter: ch, type: 'mention', label: 'Ripple Effect' })),
    { chapter: currentChapter, type: 'current', label: 'Present Convergence' }
  ].sort((a, b) => a.chapter - b.chapter);

  const lastMention = seed.lastMentionedChapter || seed.originChapter;

  return (
    <div className="h-full p-12 overflow-y-auto bg-zinc-950">
      <div className="max-w-4xl mx-auto py-10">
        <div className="text-center mb-20 space-y-4">
          <div className="inline-block p-4 bg-zinc-900 rounded-[24px] border border-zinc-800 shadow-2xl">
            <span className={config.color}>{config.icon}</span>
          </div>
          <div>
            <h3 className="text-4xl font-black text-white tracking-tight">{seed.title}</h3>
            <p className="text-zinc-500 text-lg font-medium">Temporal Trajectory Visualization</p>
          </div>
        </div>

        <div className="relative pb-20">
          <div className="absolute left-1/2 top-0 bottom-0 w-2 bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-900 -translate-x-1/2 rounded-full" />

          {/* Entropy Zone Highlight */}
          <div
            className="absolute left-1/2 w-4 bg-gradient-to-b from-amber-500/0 via-red-500/20 to-red-600/40 -translate-x-1/2 blur-md"
            style={{
              top: `${((lastMention - seed.originChapter) / (currentChapter - seed.originChapter || 1)) * 100}%`,
              bottom: '0%'
            }}
          />

          <div className="space-y-24 relative z-10">
            {nodes.map((node, index) => (
              <div
                key={`${node.chapter}-${index}`}
                className={`flex items-center gap-12 ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
              >
                <div className={`flex-1 ${index % 2 === 0 ? 'text-right' : 'text-left'}`}>
                  <div className={`inline-block p-8 rounded-[36px] border ${node.type === 'origin' ? 'bg-amber-500 border-transparent text-black' :
                      node.type === 'current' ? 'bg-zinc-100 border-transparent text-black' :
                        'bg-zinc-900 border-zinc-800 text-white'
                    } shadow-2xl transition-transform hover:scale-105 duration-500`}>
                    <div className={`text-[10px] font-black uppercase tracking-widest mb-2 ${node.type === 'mention' ? 'text-zinc-500' : ''
                      }`}>{node.label}</div>
                    <div className="text-3xl font-black tabular-nums">Chapter {node.chapter}</div>
                    {node.type === 'origin' && (
                      <p className="text-sm font-medium mt-4 line-clamp-3 opacity-80 italic">
                        "{seed.originQuote.slice(0, 100)}..."
                      </p>
                    )}
                  </div>
                </div>

                <div className={`w-10 h-10 rounded-full border-[6px] shadow-2xl transition-all duration-700 ${node.type === 'origin' ? 'bg-amber-500 border-black scale-125' :
                    node.type === 'current' ? 'bg-white border-black animate-pulse scale-125' :
                      'bg-zinc-700 border-black'
                  }`} />

                <div className="flex-1" />
              </div>
            ))}
          </div>
        </div>

        {/* Temporal Gap Warning */}
        <div className="mt-20 p-12 bg-zinc-900/40 rounded-[48px] border border-zinc-800 shadow-2xl text-center space-y-6">
          <div className="inline-flex items-center justify-center p-6 bg-red-500/10 rounded-full">
            <AlertTriangle className="w-12 h-12 text-red-500" />
          </div>
          <div className="space-y-2">
            <h4 className="text-3xl font-black text-white tracking-tight">
              {seed.neglectScore} Chapter Resonance Gap
            </h4>
            <p className="text-zinc-500 text-lg max-w-lg mx-auto leading-relaxed">
              Thread energy is dissipating. Recover this frequency in the next chapter to maintain saga coherence.
            </p>
          </div>
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

  const score = debt.weightedDebtScore || (activeSeeds.length * 1.5 + criticalCount * 5);
  const status = score > 40 ? 'Destructive' : score > 20 ? 'Compelling' : 'Coherent';
  const statusColor = score > 40 ? 'text-red-500' : score > 20 ? 'text-amber-500' : 'text-green-500';

  return (
    <div className="px-10 py-6 bg-zinc-950 border-t border-zinc-900 shadow-[0_-20px_40px_rgba(0,0,0,0.5)] z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-10">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Saga Entropy</div>
            <div className={`text-2xl font-black tabular-nums transition-colors duration-1000 ${statusColor}`}>
              {score.toFixed(1)} <span className="text-xs font-bold uppercase ml-1 opacity-50">{status}</span>
            </div>
          </div>

          <div className="h-10 w-px bg-zinc-900" />

          <div className="flex gap-10">
            <div className="space-y-1">
              <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Seeds</div>
              <div className="text-xl font-black text-zinc-200 tabular-nums">{activeSeeds.length}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Stale</div>
              <div className="text-xl font-black text-amber-500 tabular-nums">{staleCount}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Critical</div>
              <div className="text-xl font-black text-red-500 tabular-nums">{criticalCount}</div>
            </div>
          </div>
        </div>

        <div className="text-[10px] font-black text-zinc-700 uppercase tracking-[0.2em] max-w-[200px] text-right leading-loose">
          Entropy Calculation based on Akasha Records V2.4
        </div>
      </div>
    </div>
  );
};

export default LoomExcavator;
