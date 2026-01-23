
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense, useMemo } from 'react';
import type { NovelState, Chapter, WorldEntry, Character, Arc, Realm, Territory, Relationship, SystemLog, Scene, NovelItem, NovelTechnique, CharacterItemPossession, CharacterTechniqueMastery, ItemCategory, TechniqueCategory, TechniqueType, Antagonist, AntagonistRole, SymbolicElement } from './types';
import type { GlobalMarketState } from './types/market';
import { getAntagonistsForArc, addAntagonistToChapter } from './services/antagonistService';
import { createDefaultMarketState } from './services/market/marketService';
import { findMatchingAntagonist, mergeAntagonistInfo } from './utils/antagonistMatching';
import { findBestMatch } from './utils/characterNameMatching';
import Sidebar from './components/Sidebar';
import LibraryView from './components/LibraryView';
import VoiceInput from './components/VoiceInput';
import CreativeSpark from './components/CreativeSpark';
import ConfirmDialog from './components/ConfirmDialog';
import GenerationProgressBar from './components/GenerationProgressBar';
import LoadingIndicator from './components/LoadingIndicator';
import { LoadingSpinnerCentered } from './components/LoadingSpinner';
import NotificationPanel from './components/NotificationPanel';
import { Modal } from './components/Modal';
import { WorldEntryForm } from './components/forms/WorldEntryForm';
import { CharacterForm } from './components/forms/CharacterForm';
import { ArcForm } from './components/forms/ArcForm';
import { useToast } from './contexts/ToastContext';
import { useLoading } from './contexts/LoadingContext';
import { logger } from './services/loggingService';
import { getWorldCategory, getCharacterStatus, getArcStatus } from './utils/typeGuards';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { validateWorldEntryInput } from './utils/validation';
import { novelChangeTracker } from './utils/novelTracking';
import { extractPostChapterUpdates, generateNextChapter, planArc, processLoreDictation, ChapterGenerationResult } from './services/aiService';
import TribulationGateModal from './components/TribulationGateModal';
import ManualTribulationGateDialog from './components/ManualTribulationGateDialog';
import WhatIfGateReplayDialog from './components/WhatIfGateReplayDialog';
import { TribulationGate, TribulationTrigger } from './types/tribulationGates';
import {
  resolveGate,
  skipGate,
  getGateConfig,
  createManualGate,
  getPendingGate,
  buildWhatIfPromptInjection,
  saveWhatIfChapter,
  WhatIfChapter,
} from './services/tribulationGateService';
import { saveRevision } from './services/revisionService';
import { useNovel } from './contexts/NovelContext';
import { findOrCreateItem, findOrCreateTechnique } from './services/itemTechniqueService';
import { addOrUpdateRelationship } from './services/relationshipService';
import { logSupabaseVerification } from './utils/verifySupabaseDeletion';
import { detectArchiveCandidates, archivePossession, restorePossession, archiveMastery, restoreMastery } from './services/archiveService';
import { createNewCharacter } from './utils/entityFactories';
import * as arcAnalyzer from './services/promptEngine/arcContextAnalyzer';
import { generateUUID } from './utils/uuid';
import { coerceTechniqueCategory, coerceTechniqueType } from './utils/typeCoercion';
import { RelatedEntities } from './components/RelatedEntities';
import { analyzeAutoConnections } from './services/autoConnectionService';
import { captureChapterSnapshot } from './services/chapterStateSnapshotService';
import { markEntitiesWithChapter, trackArcChecklistCompletions, trackRealmChanges } from './utils/entityChapterTracker';
import { generateExtractionPreview, calculateTrustScore } from './services/trustService';
import { generatePreGenerationSuggestions, analyzeGaps } from './services/gapDetectionService';
import { TrustScoreWidget } from './components/TrustScoreWidget';
import { GapAnalysisPanel } from './components/widgets/GapAnalysisPanel';
import { MarketPanel } from './components/MarketPanel';
import { PreGenerationAnalysis } from './components/PreGenerationAnalysis';
import { analyzeStoryStructure } from './services/storyStructureAnalyzer';
import { analyzeEngagement } from './services/engagementAnalyzer';
import { analyzeTension } from './services/tensionAnalyzer';
import { checkConsistency, checkChapterConsistency } from './services/consistencyChecker';
import { triggerEditorReview, shouldTriggerEditorReview, applyApprovedFixes } from './services/editorService';
import { useEditorFixApplication } from './hooks/useEditorFixApplication';
import { saveEditorReport } from './services/supabaseService';
import ManualEditorDialog from './components/ManualEditorDialog';
import FixApprovalDialog from './components/FixApprovalDialog';
import type { EditorFixProposal, EditorFix, EditorReportWithInternal } from './types/editor';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import { useOnboarding } from './hooks/useOnboarding';
import { OnboardingTour } from './components/OnboardingTour';
import { getTourById, MAIN_ONBOARDING_TOUR } from './utils/onboardingTours';
import { AUTHENTICATION_ENABLED } from './config/supabase';
import LoomExcavator from './components/LoomExcavatorFull';
import { getFaceGraphConfig, extractKarmaFromChapter } from './services/faceGraph';

// Helper to safely convert any value to a string
function safeToString(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (value instanceof Error) {
    return value.message || 'Error (no message)';
  }

  // For objects, try JSON.stringify with circular reference handling
  try {
    const seen = new WeakSet();
    return JSON.stringify(value, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch {
    // If JSON.stringify fails, try basic toString
    try {
      return String(value);
    } catch {
      return '[Unable to convert to string]';
    }
  }
}

// Helper to safely wrap lazy imports with error handling
function safeLazyImport<T extends React.ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(() => {
    return importFn().catch((error) => {
      // Log the error message safely to help with debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[safeLazyImport] Component failed to load:', errorMessage);

      // Return a fallback component that shows the error message
      const FallbackComponent: React.FC = () => (
        <div className="p-6 bg-red-950/40 border border-red-900/60 rounded-xl">
          <h2 className="text-xl font-bold text-red-400 mb-2">Component Failed to Load</h2>
          <p className="text-red-300">Please refresh the page to try again.</p>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-xs text-red-400 bg-zinc-950 p-2 rounded overflow-auto max-h-32">
              {errorMessage}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded"
          >
            Reload Page
          </button>
        </div>
      );

      return {
        default: FallbackComponent as T
      };
    });
  });
}

// Lazy load heavy components for code splitting with safe error handling
const ChapterEditor = safeLazyImport(() => import('./components/ChapterEditor'));
const WorldMapView = safeLazyImport(() => import('./components/WorldMapView'));
const AntagonistTracker = safeLazyImport(() => import('./components/AntagonistTracker'));
const StoryboardView = safeLazyImport(() => import('./components/StoryboardView'));
const TimelineView = safeLazyImport(() => import('./components/TimelineView'));
const BeatSheetView = safeLazyImport(() => import('./components/BeatSheetView'));
const MatrixView = safeLazyImport(() => import('./components/MatrixView'));
const ProgressDashboard = safeLazyImport(() => import('./components/ProgressDashboard'));
const GlobalSearch = safeLazyImport(() => import('./components/GlobalSearch'));
const WritingGoals = safeLazyImport(() => import('./components/WritingGoals'));
const ExportDialog = safeLazyImport(() => import('./components/ExportDialog'));
const AntagonistManager = safeLazyImport(() => import('./components/AntagonistManager'));
const SystemManager = safeLazyImport(() => import('./components/SystemManager'));
const StoryThreadsView = safeLazyImport(() => import('./components/StoryThreadsView'));
const LoomDashboard = safeLazyImport(() => import('./components/loom/LoomDashboard'));
// World-Class Enhancements Components
const StructureVisualizer = safeLazyImport(() => import('./components/StructureVisualizer'));
const EngagementDashboard = safeLazyImport(() => import('./components/EngagementDashboard'));
const TensionCurveView = safeLazyImport(() => import('./components/TensionCurveView'));
const ThemeEvolutionView = safeLazyImport(() => import('./components/ThemeEvolutionView'));
const CharacterPsychologyView = safeLazyImport(() => import('./components/CharacterPsychologyView'));
const DeviceDashboard = safeLazyImport(() => import('./components/DeviceDashboard'));
const DraftComparisonView = safeLazyImport(() => import('./components/DraftComparisonView'));
const ExcellenceScorecard = safeLazyImport(() => import('./components/ExcellenceScorecard'));
const ImprovementHistoryPage = safeLazyImport(() => import('./components/ImprovementHistoryPage'));
const MemoryDashboard = safeLazyImport(() => import('./components/MemoryDashboard'));
const DashboardView = safeLazyImport(() => import('./components/views/DashboardView'));
const CharactersView = lazy(() => import('./components/views/CharactersView'));
const ChaptersView = safeLazyImport(() => import('./components/views/ChaptersView'));
const PlanningView = safeLazyImport(() => import('./components/views/PlanningView'));
const TribulationGateHistoryView = safeLazyImport(() => import('./components/views/TribulationGateHistoryView'));
const KeyboardShortcutsHelp = safeLazyImport(() => import('./components/KeyboardShortcutsHelp'));

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { showError, showSuccess, showWarning } = useToast();
  const { loadingState, startLoading, stopLoading, updateProgress, updateMessage } = useLoading();
  const {
    library,
    currentView,
    isLoading,
    isSaving,
    activeNovel,
    activeChapter,
    setActiveNovelId,
    setView,
    setActiveChapterId,
    updateActiveNovel,
    createNovel,
    deleteNovelById,
    deleteChapterById,
    saveChapter,
  } = useNovel();
  const { applyFixes: applyEditorFixes, isApplying: isApplyingFixes } = useEditorFixApplication();

  // Onboarding
  const {
    isOnboardingComplete,
    activeTour,
    currentStep,
    markOnboardingComplete,
    startTour,
    nextStep,
    previousStep,
    endTour,
  } = useOnboarding();

  const [showOnboardingMenu, setShowOnboardingMenu] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Show onboarding tour for first-time users
  useEffect(() => {
    if (!isOnboardingComplete && library.length === 0 && !activeNovel) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startTour(MAIN_ONBOARDING_TOUR.id);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnboardingComplete, library.length, activeNovel, startTour]);

  // Global keyboard shortcuts
  useGlobalShortcuts({
    enabled: !!activeNovel,
    handlers: {
      onSearch: () => setView('search'),
      onNewChapter: () => {
        if (activeNovel && !isGenerating) {
          handleGenerateNext();
        }
      },
      onSave: async () => {
        if (activeChapter) {
          try {
            await handleSaveChapter(activeChapter);
            showSuccess('Chapter saved');
          } catch (error) {
            showError('Failed to save chapter');
          }
        }
      },
      onExport: () => setShowExportDialog(true),
      onDashboard: () => setView('dashboard'),
      onChapters: () => setView('chapters'),
      onCharacters: () => setView('characters'),
      onWorldBible: () => setView('world-bible'),
      onPlanning: () => setView('planning'),
      onHelp: () => setShowOnboardingMenu(true),
      onClose: () => {
        setShowOnboardingMenu(false);
        setShowExportDialog(false);
        setShowManualEditor(false);
        setMobileSidebarOpen(false);
        setMobileNotificationPanelOpen(false);
      },
    },
  });

  // Show login form if authentication is enabled and user is not authenticated
  if (AUTHENTICATION_ENABLED) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
          <LoadingSpinnerCentered />
        </div>
      );
    }

    if (!user) {
      return <LoginForm />;
    }
  }

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [activeLogs, setActiveLogs] = useState<SystemLog[]>([]);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mobileNotificationPanelOpen, setMobileNotificationPanelOpen] = useState(false);
  const [desktopNotificationPanelOpen, setDesktopNotificationPanelOpen] = useState(true);
  const [desktopNotificationPanelMinimized, setDesktopNotificationPanelMinimized] = useState(false);

  // Sidebar collapsed state for tablets (persisted in localStorage)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const [editingWorld, setEditingWorld] = useState<WorldEntry | null>(null);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [editingArc, setEditingArc] = useState<Arc | null>(null);
  const [showEconomyPanel, setShowEconomyPanel] = useState(false);
  const [arcAntagonists, setArcAntagonists] = useState<Antagonist[]>([]);
  const [isLoadingArcAntagonists, setIsLoadingArcAntagonists] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [pendingFixProposals, setPendingFixProposals] = useState<EditorFixProposal[]>([]);
  const [currentEditorReport, setCurrentEditorReport] = useState<EditorReport | null>(null);
  const activeGenerationIdRef = useRef<string | null>(null);

  // Tribulation Gate state
  const [showTribulationGate, setShowTribulationGate] = useState(false);
  const [currentTribulationGate, setCurrentTribulationGate] = useState<TribulationGate | null>(null);
  const [tribulationGateLoading, setTribulationGateLoading] = useState(false);
  const [showManualGateDialog, setShowManualGateDialog] = useState(false);
  const [manualGateLoading, setManualGateLoading] = useState(false);
  const [showWhatIfDialog, setShowWhatIfDialog] = useState(false);
  const [whatIfGate, setWhatIfGate] = useState<TribulationGate | null>(null);
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const pendingGenerationInstructionRef = useRef<string>('');

  // Warn user before closing if there are unsaved changes.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const changedNovelIds = novelChangeTracker.getChangedNovelIds();
      if (changedNovelIds.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Make verification function available in browser console
    (window as any).verifySupabase = logSupabaseVerification;

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Load antagonists when arc editor opens
  useEffect(() => {
    if (editingArc && activeNovel) {
      setIsLoadingArcAntagonists(true);
      getAntagonistsForArc(editingArc.id)
        .then(setArcAntagonists)
        .catch(error => {
          logger.error('Error loading arc antagonists', 'App', error instanceof Error ? error : new Error(String(error)));
          setArcAntagonists([]);
        })
        .finally(() => setIsLoadingArcAntagonists(false));
    } else {
      setArcAntagonists([]);
    }
  }, [editingArc?.id, activeNovel?.id]);

  const handleCreateNovel = useCallback(
    async (title: string, genre: string) => {
      await createNovel(title, genre);
    },
    [createNovel]
  );

  const addLog = (msg: string, type: SystemLog['type'] = 'discovery') => {
    const log: SystemLog = { id: crypto.randomUUID(), message: msg, type, timestamp: Date.now() };
    setActiveLogs(prev => [...prev, log]);
    updateActiveNovel(prev => ({ ...prev, systemLogs: [...prev.systemLogs, log] }));
    // No auto-removal - logs are now permanently stored in NotificationPanel
  };

  // Ephemeral UI-only log (does NOT persist into the novel's system logs)
  const addEphemeralLog = (msg: string, type: SystemLog['type'] = 'discovery') => {
    const log: SystemLog = { id: crypto.randomUUID(), message: msg, type, timestamp: Date.now() };
    setActiveLogs(prev => [...prev, log]);
    // No auto-removal - logs are now permanently stored in NotificationPanel
  };

  // Helper function to format comprehensive fix summary
  const formatFixSummary = (
    totalIssues: number,
    autoFixedCount: number,
    failedAutoFixes: EditorFix[],
    appliedInAutoMode: number,
    failedInAutoMode: EditorFix[],
    updatedChapters: number
  ): { summary: string; details?: string } => {
    const parts: string[] = [];
    const details: string[] = [];

    // Summary line
    parts.push(`${totalIssues} issue(s) found.`);

    if (autoFixedCount > 0 || failedAutoFixes.length > 0 || appliedInAutoMode > 0 || failedInAutoMode.length > 0) {
      const fixParts: string[] = [];

      if (autoFixedCount > 0) {
        fixParts.push(`${autoFixedCount} auto-fixed during review`);
      }
      if (appliedInAutoMode > 0) {
        fixParts.push(`${appliedInAutoMode} applied in automatic mode`);
      }

      const totalFixed = autoFixedCount + appliedInAutoMode;
      if (totalFixed > 0) {
        parts.push(`${totalFixed} fix(es) applied (${autoFixedCount} during review, ${appliedInAutoMode} in auto mode).`);
      }

      if (failedAutoFixes.length > 0 || failedInAutoMode.length > 0) {
        // Prevent double-counting: only count unique failures
        const failedAutoFixIds = new Set(failedAutoFixes.map(f => f.id));
        const uniqueFailedInAutoMode = failedInAutoMode.filter(f => !failedAutoFixIds.has(f.id));
        const totalFailed = failedAutoFixes.length + uniqueFailedInAutoMode.length;
        parts.push(`${totalFailed} fix(es) failed to apply.`);

        // Add details about failed fixes
        if (failedAutoFixes.length > 0) {
          details.push(`Failed during review (${failedAutoFixes.length}):`);
          failedAutoFixes.forEach(fix => {
            const failureReason = fix.failureReason || fix.reason || 'Unknown reason';
            details.push(`  - Chapter ${fix.chapterNumber}, ${fix.fixType}: ${failureReason}`);
          });
        }
        if (uniqueFailedInAutoMode.length > 0) {
          details.push(`Failed in automatic mode (${uniqueFailedInAutoMode.length}):`);
          uniqueFailedInAutoMode.forEach(fix => {
            const failureReason = fix.failureReason || 'Could not find text to replace';
            details.push(`  - Chapter ${fix.chapterNumber}, ${fix.fixType}: ${failureReason}`);
          });
        }

        // If same fixes failed in both modes, add note
        const duplicatedFails = failedInAutoMode.filter(f => failedAutoFixIds.has(f.id));
        if (duplicatedFails.length > 0) {
          details.push(`\nNote: ${duplicatedFails.length} fix(es) failed in both review and automatic mode (counted once above).`);
        }
      }

      if (updatedChapters > 0) {
        parts.push(`${updatedChapters} chapter(s) updated and saved.`);
      }
    }

    return {
      summary: parts.join(' '),
      details: details.length > 0 ? details.join('\n') : undefined
    };
  };

  // Helper function to format chapter title for display (ensures "Chapter X: " prefix)
  const formatChapterTitleForDisplay = (chapter: Chapter): string => {
    const titleLower = chapter.title.toLowerCase();
    const chapterPattern = /^chapter\s+\d+/i;

    if (!chapterPattern.test(titleLower)) {
      // Title doesn't start with "Chapter X", add it
      return `Chapter ${chapter.number}: ${chapter.title}`;
    }

    // Title has "Chapter X" but might have wrong number - extract and fix if needed
    const match = chapter.title.match(/^Chapter\s+(\d+)[:\s]+(.*)$/i);
    if (match) {
      const titleNumber = parseInt(match[1], 10);
      const titleContent = match[2].trim();
      if (titleNumber !== chapter.number) {
        // Number mismatch, fix it
        return `Chapter ${chapter.number}: ${titleContent || chapter.title.replace(/^Chapter\s+\d+[:\s]+/i, '').trim()}`;
      }
      // Number matches, return as-is (but ensure format)
      return `Chapter ${chapter.number}: ${titleContent || chapter.title.replace(/^Chapter\s+\d+[:\s]+/i, '').trim()}`;
    }

    // Has "Chapter X" but weird format, try to fix
    return chapter.title.replace(/^Chapter\s+\d+/i, `Chapter ${chapter.number}`);
  };

  // Function to fix existing chapters with duplicate numbers or missing "Chapter" prefix
  const fixExistingChapters = useCallback(() => {
    if (!activeNovel) return;

    updateActiveNovel(prev => {
      const chapters = [...prev.chapters];

      // Step 1: Fix duplicate chapter numbers by reassigning sequential numbers
      const sortedChapters = chapters.sort((a, b) => a.number - b.number || a.createdAt - b.createdAt);
      const numberMap = new Map<number, number[]>(); // Maps chapter number to array of indices

      // Find duplicates
      sortedChapters.forEach((ch, idx) => {
        if (!numberMap.has(ch.number)) {
          numberMap.set(ch.number, []);
        }
        numberMap.get(ch.number)!.push(idx);
      });

      // Fix duplicates by reassigning numbers sequentially
      let currentNumber = 1;
      const fixedChapters = sortedChapters.map((ch, idx) => {
        const indicesWithSameNumber = numberMap.get(ch.number) || [];
        if (indicesWithSameNumber.length > 1 && indicesWithSameNumber[0] === idx) {
          // First occurrence of this number - keep currentNumber
          const newNumber = currentNumber;
          currentNumber++;
          return { ...ch, number: newNumber };
        } else if (indicesWithSameNumber.length > 1) {
          // Duplicate - assign next number
          const newNumber = currentNumber;
          currentNumber++;
          return { ...ch, number: newNumber };
        } else {
          // No duplicate, but ensure sequential
          if (ch.number !== currentNumber) {
            const newNumber = currentNumber;
            currentNumber++;
            return { ...ch, number: newNumber };
          }
          currentNumber++;
          return ch;
        }
      });

      // Step 2: Normalize titles to include "Chapter X: " prefix
      const normalizedChapters = fixedChapters.map(ch => {
        const titleLower = ch.title.toLowerCase();
        const chapterPattern = /^chapter\s+\d+/i;

        if (!chapterPattern.test(titleLower)) {
          // Missing "Chapter X: " prefix
          return {
            ...ch,
            title: `Chapter ${ch.number}: ${ch.title}`
          };
        }

        // Has "Chapter X" but might have wrong number
        const match = ch.title.match(/^Chapter\s+(\d+)[:\s]+(.*)$/i);
        if (match) {
          const titleNumber = parseInt(match[1], 10);
          const titleContent = match[2].trim();
          if (titleNumber !== ch.number) {
            // Number mismatch, fix it
            return {
              ...ch,
              title: `Chapter ${ch.number}: ${titleContent || ch.title.replace(/^Chapter\s+\d+[:\s]+/i, '').trim()}`
            };
          }
          // Ensure proper format with colon
          if (!/^Chapter\s+\d+:\s/.test(ch.title)) {
            return {
              ...ch,
              title: `Chapter ${ch.number}: ${titleContent || ch.title.replace(/^Chapter\s+\d+[:\s]+/i, '').trim()}`
            };
          }
        }

        return ch;
      });

      // Sort by number again after fixing
      normalizedChapters.sort((a, b) => a.number - b.number);

      return {
        ...prev,
        chapters: normalizedChapters
      };
    });

    showSuccess('Chapters fixed: Duplicate numbers resolved and titles normalized');
  }, [activeNovel, updateActiveNovel, showSuccess]);

  const handleGenerateNext = async (customInstruction?: string) => {
    if (!activeNovel) return;
    const generationId = crypto.randomUUID();
    activeGenerationIdRef.current = generationId;
    setIsGenerating(true);
    setGenerationProgress(5);
    setGenerationStatus('Analyzing story context...');
    const newLogs: SystemLog[] = [];

    const localAddLog = (msg: string, type: SystemLog['type'] = 'discovery') => {
      const log: SystemLog = { id: crypto.randomUUID(), message: msg, type, timestamp: Date.now() };
      newLogs.push(log);
    };

    try {
      // Calculate next chapter number based on max existing chapter number (not array length)
      // This prevents duplicate chapter numbers when there are gaps
      const nextChapterNumber = activeNovel.chapters.length > 0
        ? Math.max(...activeNovel.chapters.map(c => c.number), 0) + 1
        : 1;

      // Pre-generation gap analysis
      try {
        const preGenerationSuggestions = generatePreGenerationSuggestions(activeNovel, nextChapterNumber);
        if (preGenerationSuggestions.length > 0) {
          addEphemeralLog('Analyzing story structure...', 'discovery');
          // Log critical suggestions
          preGenerationSuggestions.filter(s => s.includes('⚠️')).forEach(suggestion => {
            localAddLog(suggestion, 'update');
          });
          // Log auto-fixable suggestions
          preGenerationSuggestions.filter(s => s.includes('✨')).slice(0, 2).forEach(suggestion => {
            localAddLog(suggestion, 'discovery');
          });
        }
      } catch (gapAnalysisError) {
        logger.warn('Pre-generation gap analysis failed', 'chapterGeneration', {
          error: gapAnalysisError instanceof Error ? gapAnalysisError.message : String(gapAnalysisError)
        });
        // Don't block generation if gap analysis fails
      }

      addEphemeralLog('Building prompt context...', 'discovery');
      const result = await generateNextChapter(activeNovel, customInstruction || instruction, {
        onPhase: (phase, data) => {
          if (activeGenerationIdRef.current !== generationId) return; // cancelled

          if (phase === 'prompt_build_start') {
            setGenerationProgress(10);
            setGenerationStatus('Constructing narrative context...');
          }
          if (phase === 'prompt_build_end') {
            setGenerationProgress(20);
            setGenerationStatus('Context assembled. Preparing request...');
            const ms = data?.promptBuildMs;
            const tokens = data?.estimatedPromptTokens;
            addEphemeralLog(
              `Prompt built in ${typeof ms === 'number' ? ms : '?'}ms${typeof tokens === 'number' ? ` (≈${tokens} tokens)` : ''}.`,
              'discovery'
            );
          }
          if (phase === 'queue_estimate') {
            setGenerationProgress(25);
            setGenerationStatus('Checking system load...');
            const estimatedWaitMs = data?.estimatedWaitMs;
            if (typeof estimatedWaitMs === 'number' && estimatedWaitMs > 0) {
              addEphemeralLog(`Waiting for rate limiter (est. ${(estimatedWaitMs / 1000).toFixed(1)}s)...`, 'discovery');
            }
          }
          if (phase === 'queue_dequeued') {
            setGenerationProgress(30);
            setGenerationStatus('Starting generation...');
            const queueWaitMs = data?.queueWaitMs;
            if (typeof queueWaitMs === 'number' && queueWaitMs > 0) {
              addEphemeralLog(`Queued for ${(queueWaitMs / 1000).toFixed(1)}s before starting.`, 'discovery');
            }
          }
          if (phase === 'llm_request_start') {
            setGenerationProgress(40);
            setGenerationStatus('Consulting the Muse...');
            addEphemeralLog('Calling the selected LLM to write the chapter...', 'discovery');
          }
          if (phase === 'llm_request_end') {
            setGenerationProgress(80);
            setGenerationStatus('Content received. Processing...');
            const len = data?.responseTextLength;
            const requestDurationMs = data?.requestDurationMs;
            addEphemeralLog(
              `LLM returned${typeof requestDurationMs === 'number' ? ` in ${(requestDurationMs / 1000).toFixed(1)}s` : ''}${typeof len === 'number' ? ` (${len.toLocaleString()} chars)` : ''}.`,
              'discovery'
            );
          }
          if (phase === 'quality_check') {
            setGenerationProgress(8);
            setGenerationStatus('Validating narrative quality...');
            const qualityScore = data?.qualityScore;
            if (typeof qualityScore === 'number') {
              addEphemeralLog(`Pre-generation quality check: ${qualityScore}/100`, 'discovery');
              if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
                addEphemeralLog(`Quality suggestions: ${data.suggestions[0]}`, 'discovery');
              }
            }
          }
          if (phase === 'quality_validation') {
            setGenerationProgress(85);
            setGenerationStatus('Validating generated chapter quality...');
            const qualityScore = data?.qualityScore;
            if (typeof qualityScore === 'number') {
              addEphemeralLog(`Post-generation quality score: ${qualityScore}/100`, 'discovery');
              if (qualityScore < 70) {
                addEphemeralLog('Quality warnings detected. Review chapter content.', 'update');
              }
            }
          }
          if (phase === 'parse_start') {
            setGenerationProgress(85);
            setGenerationStatus('Structuring narrative elements...');
            addEphemeralLog('Parsing AI response and extracting story elements...', 'discovery');
          }
          if (phase === 'parse_end') {
            setGenerationProgress(95);
            setGenerationStatus('Finalizing chapter...');
            const parseMs = data?.parseMs;
            if (parseMs && typeof parseMs === 'number') {
              addEphemeralLog(`Parsed in ${Math.round(parseMs)}ms`, 'discovery');
            } else {
              addEphemeralLog('Parsing complete', 'discovery');
            }
          }
          // Tribulation Gate phases
          if (phase === 'tribulation_gate_check') {
            setGenerationProgress(12);
            setGenerationStatus('Consulting the Heavens...');
          }
          if (phase === 'tribulation_gate_triggered') {
            setGenerationProgress(15);
            setGenerationStatus('A Tribulation Gate appears!');
            addEphemeralLog(`⚡ Tribulation Gate triggered: ${data?.triggerType}`, 'fate');
          }
          if (phase === 'tribulation_gate_generating') {
            setGenerationProgress(18);
            setGenerationStatus('Weaving the threads of fate...');
            addEphemeralLog('Generating fate paths for your decision...', 'fate');
          }
          if (phase === 'tribulation_gate_ready') {
            setGenerationProgress(20);
            setGenerationStatus('Fate awaits your decision...');
          }
        }
      });

      // If user cancelled while waiting, ignore the result.
      if (activeGenerationIdRef.current !== generationId) {
        return;
      }

      // Check if we need to show a Tribulation Gate
      if (result?.requiresUserChoice && result?.tribulationGate) {
        // Store the instruction for when the user makes their choice
        pendingGenerationInstructionRef.current = customInstruction || instruction;

        // Show the Tribulation Gate modal
        setCurrentTribulationGate(result.tribulationGate);
        setShowTribulationGate(true);

        // Don't continue with chapter creation - wait for user choice
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStatus('');

        addEphemeralLog('⚡ A Tribulation Gate has appeared! Your choice will shape the story.', 'fate');
        return;
      }

      setGenerationProgress(100);
      setGenerationStatus('Chapter generation complete!');
      addEphemeralLog('Chapter generated successfully. Processing updates...', 'discovery');

      // Validate result data before creating chapter
      if (!result || !result.chapterContent || typeof result.chapterContent !== 'string') {
        throw new Error('Invalid chapter generation result: missing or invalid content');
      }

      // Normalize chapter title to always include "Chapter X: " prefix
      // (nextChapterNumber was already calculated above)
      let normalizedTitle = result.chapterTitle?.trim() || '';
      if (!normalizedTitle) {
        showWarning('Generated chapter has no title. Using default title.');
        normalizedTitle = `Chapter ${nextChapterNumber}`;
      } else {
        // Check if title already starts with "Chapter" (case insensitive)
        const titleLower = normalizedTitle.toLowerCase();
        const chapterPattern = /^chapter\s+\d+/i;
        if (!chapterPattern.test(titleLower)) {
          // Add "Chapter X: " prefix if missing
          normalizedTitle = `Chapter ${nextChapterNumber}: ${normalizedTitle}`;
        } else {
          // If it has "Chapter X" but wrong number, fix it
          // Extract the actual title part after "Chapter X: " or "Chapter X "
          const match = normalizedTitle.match(/^Chapter\s+\d+[:\s]+(.*)$/i);
          if (match && match[1]) {
            normalizedTitle = `Chapter ${nextChapterNumber}: ${match[1].trim()}`;
          } else {
            // Just replace the number
            normalizedTitle = normalizedTitle.replace(/^Chapter\s+\d+/i, `Chapter ${nextChapterNumber}`);
          }
        }
      }

      // Validate word count before creating chapter
      const wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.trim().length > 0).length;
      if (wordCount < 1500) {
        showWarning(`Generated chapter has ${wordCount} words, which is below the 1500 word minimum. The chapter will be saved, but consider regenerating for a longer version.`);
      } else if (wordCount > 5000) {
        showWarning(`Generated chapter has ${wordCount} words, which is quite long. Consider breaking it into multiple chapters.`);
      }

      // Validate content is not just whitespace
      if (result.chapterContent.trim().length < 500) {
        throw new Error('Generated chapter content is too short or contains only whitespace');
      }

      const newChapter: Chapter = {
        id: generateUUID(),
        number: nextChapterNumber,
        title: normalizedTitle,
        content: result.chapterContent.trim(),
        summary: (result.chapterSummary || '').trim() || `Chapter ${nextChapterNumber}: ${normalizedTitle.replace(/^Chapter\s+\d+[:\s]+/i, '').trim()}`,
        logicAudit: result.logicAudit,
        scenes: [],
        createdAt: Date.now()
      };

      // Validate logic audit if present
      if (newChapter.logicAudit) {
        const audit = newChapter.logicAudit;
        if (!audit.startingValue || !audit.resultingValue || !audit.theChoice || !audit.theFriction) {
          showWarning('Chapter logic audit is incomplete. Some fields are missing.');
          // Provide defaults for missing fields
          newChapter.logicAudit = {
            startingValue: audit.startingValue || 'Unknown',
            resultingValue: audit.resultingValue || 'Unknown',
            theChoice: audit.theChoice || 'No choice specified',
            theFriction: audit.theFriction || 'No friction specified',
            causalityType: audit.causalityType || 'action'
          };
        }
      }

      if (result.logicAudit) {
        localAddLog(`Value Shift: ${result.logicAudit.startingValue} → ${result.logicAudit.resultingValue}`, 'logic');
        localAddLog(`Causality: [${result.logicAudit.causalityType}] ${result.logicAudit.theChoice.slice(0, 40)}...`, 'logic');
      }

      // Helper functions for processing updates (defined early for use throughout)
      const normalize = (s: string) => (s || '').trim().toLowerCase();
      const mergeAppend = (existing: string, incoming: string, chapterNum: number) => {
        const cur = (existing || '').trim();
        const inc = (incoming || '').trim();
        if (!inc) return cur;
        if (!cur) return inc;
        // Avoid repeated appends (check if content is already present)
        if (normalize(cur).includes(normalize(inc))) return cur;
        // Limit merge append length to prevent excessive growth
        const maxLength = 5000;
        if (cur.length + inc.length > maxLength) {
          return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc.substring(0, maxLength - cur.length - 50)}...`;
        }
        return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc}`;
      };

      // Process character updates with comprehensive validation
      setGenerationStatus('Updating character information...');
      addEphemeralLog('Processing character updates...', 'discovery');

      const existingCharacters = [...activeNovel.characterCodex];
      let characterUpdateCount = 0;
      const updateErrors: string[] = [];

      if (result.characterUpdates && Array.isArray(result.characterUpdates) && result.characterUpdates.length > 0) {
        result.characterUpdates.forEach((update, index: number) => {
          try {
            // Comprehensive validation before processing
            if (!update || typeof update !== 'object') {
              updateErrors.push(`Update ${index + 1}: Invalid update object`);
              return;
            }

            if (!update.name || typeof update.name !== 'string' || update.name.trim().length < 1) {
              updateErrors.push(`Update ${index + 1}: Invalid or missing character name`);
              return;
            }

            // Normalize updateType variants to canonical values
            const updateTypeMap: Record<string, string> = {
              'cultivationstate': 'cultivation',
              'cultivation_state': 'cultivation',
              'cultivation': 'cultivation',
              'power': 'cultivation', // Map 'power' to 'cultivation' for power level changes
              'powerlevel': 'cultivation',
              'power_level': 'cultivation',
              'inventory': 'item',
              'items': 'item',
              'item': 'item',
              'relation': 'relationship',
              'relations': 'relationship',
              'relationships': 'relationship',
              'relationship': 'relationship',
              'skill': 'skill',
              'skills': 'skill',
              'status': 'status',
              'state': 'notes', // Map 'state' to 'notes' for general state changes (emotional, mental, etc.)
              'character_state': 'notes',
              'characterstate': 'notes',
              'condition': 'notes', // Map 'condition' to 'notes' for character conditions
              'notes': 'notes',
              'note': 'notes',
              'profile': 'notes',
              'emotional': 'notes', // Map 'emotional' to 'notes' for emotional state changes
              'emotion': 'notes',
              'emotional_state': 'notes',
              'emotionalstate': 'notes',
              'mood': 'notes',
              'mental': 'notes',
              'mentalstate': 'notes',
              'mental_state': 'notes',
              'physical': 'appearance', // Map 'physical' to 'appearance' for physical/appearance changes
              'physical_state': 'appearance',
              'physicalstate': 'appearance',
              'appearance': 'appearance',
              'looks': 'appearance',
              'body': 'appearance',
              'bodystate': 'appearance',
              'body_state': 'appearance',
              'new': 'new',
              'location': 'location',
              'cultivation_progress': 'cultivation',
              'cultivationlevel': 'cultivation',
              'cultivation_level': 'cultivation',
              'realm': 'cultivation',
              'strength': 'cultivation',
              'possession': 'notes',
              'possesses': 'notes',
              'has': 'notes',
              'holds': 'notes',
              'carries': 'notes',
            };

            // Normalize updateType (case-insensitive)
            if (update.updateType) {
              const normalizedType = updateTypeMap[update.updateType.toLowerCase()];
              if (normalizedType) {
                update.updateType = normalizedType;
              } else {
                // Unknown type - log warning but continue with 'notes' as default
                updateErrors.push(`Update ${index + 1}: Unknown updateType "${update.updateType}", defaulting to "notes"`);
                update.updateType = 'notes';
              }
            }

            const charIndex = existingCharacters.findIndex(c => c.name.toLowerCase() === update.name.toLowerCase());

            if (charIndex > -1) {
              let char = { ...existingCharacters[charIndex] };
              if (update.updateType === 'cultivation') {
                const cultivationValue = String(update.newValue || '').trim();
                if (cultivationValue && cultivationValue.length > 0) {
                  char.currentCultivation = cultivationValue;
                  localAddLog(`Breakthrough! ${char.name} reached ${cultivationValue}.`, 'update');
                }
              }
              if (update.updateType === 'skill' && update.newValue) {
                const skillValue = String(update.newValue).trim();
                if (skillValue && skillValue.length > 0) {
                  char.skills = [...new Set([...char.skills, skillValue])];
                  localAddLog(`${char.name} gained Technique: ${skillValue}.`, 'discovery');
                }
              }
              if (update.updateType === 'item') {
                const itemValue = String(update.newValue).trim();
                if (itemValue && itemValue.length > 0) {
                  char.items = [...new Set([...char.items, itemValue])];
                  localAddLog(`${char.name} acquired Treasure: ${itemValue}.`, 'discovery');
                }
              }
              if (update.updateType === 'status') {
                const statusValue = String(update.newValue || 'Alive').trim();
                if (statusValue === 'Alive' || statusValue === 'Deceased' || statusValue === 'Unknown') {
                  char.status = statusValue;
                  localAddLog(`${char.name} status updated: ${statusValue}`, 'update');
                }
              }
              if (update.updateType === 'notes' && update.newValue) {
                const notesValue = String(update.newValue).trim();
                if (notesValue && notesValue.length > 0) {
                  char.notes = notesValue;
                }
              }
              if (update.updateType === 'appearance' && update.newValue) {
                const appearanceValue = String(update.newValue).trim();
                if (appearanceValue && appearanceValue.length > 0) {
                  char.appearance = appearanceValue;
                  localAddLog(`${char.name}'s appearance updated.`, 'update');
                }
              }
              if (update.updateType === 'relationship' && update.targetName) {
                const targetChar = existingCharacters.find(c => c.name.toLowerCase() === update.targetName.toLowerCase());
                if (targetChar) {
                  // Use relationship service for bidirectional relationship creation
                  const relationshipType = update.newValue || 'Unknown';
                  const result = addOrUpdateRelationship(
                    existingCharacters,
                    char.id,
                    targetChar.id,
                    relationshipType,
                    'Karma link discovered in chronicle.',
                    'Fate has intertwined their paths.',
                    true // bidirectional
                  );

                  if (result.success) {
                    // Update existingCharacters array with bidirectional relationships
                    const sourceIndex = existingCharacters.findIndex(c => c.id === char.id);
                    const targetIndex = existingCharacters.findIndex(c => c.id === targetChar.id);
                    if (sourceIndex >= 0) {
                      existingCharacters[sourceIndex] = result.updatedCharacters[sourceIndex];
                    }
                    if (targetIndex >= 0) {
                      existingCharacters[targetIndex] = result.updatedCharacters[targetIndex];
                    }
                    // Update char reference for subsequent updates
                    if (sourceIndex >= 0) {
                      char = existingCharacters[sourceIndex];
                    }
                    localAddLog(`Karma Link: ${char.name} <-> ${targetChar.name} (${relationshipType})`, 'fate');
                  }
                }
              }
              existingCharacters[charIndex] = char;
              characterUpdateCount++;
            } else if (update.updateType === 'new' && update.name) {
              // Validate new character data
              const charName = String(update.name).trim();
              if (charName.length < 1) {
                updateErrors.push(`New character: Invalid name`);
                return;
              }

              // Check if character already exists (case-insensitive)
              const existingChar = existingCharacters.find(
                c => normalize(c.name) === normalize(charName)
              );

              if (existingChar) {
                // Character already exists, update instead of creating new
                localAddLog(`Character "${charName}" already exists, updating instead`, 'update');
                const char = { ...existingChar };
                if (update.newValue) {
                  char.currentCultivation = String(update.newValue).trim();
                }
                const charIndex = existingCharacters.findIndex(c => c.id === existingChar.id);
                if (charIndex > -1) {
                  existingCharacters[charIndex] = char;
                  characterUpdateCount++;
                }
              } else {
                const newChar = createNewCharacter({
                  name: charName,
                  currentCultivation: String(update.newValue || 'Unknown').trim(),
                  notes: 'Newly introduced character.',
                });
                existingCharacters.push(newChar);
                localAddLog(`Being Discovered: ${charName}`, 'discovery');
                characterUpdateCount++;
              }
            }
          } catch (error) {
            logger.error('Error processing character update', 'App', error instanceof Error ? error : new Error(String(error)), {
              characterName: update?.name || 'unknown',
              updateIndex: index
            });
            updateErrors.push(`Update ${index + 1} (${update?.name || 'unknown'}): ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });

        if (characterUpdateCount > 0) {
          addEphemeralLog(`Updated ${characterUpdateCount} character(s)`, 'discovery');
        }

        if (updateErrors.length > 0) {
          logger.warn('Character update errors', 'chapterProcessing', { errorCount: updateErrors.length, errors: updateErrors });
          localAddLog(`⚠️ ${updateErrors.length} character update error(s) encountered`, 'update');
        }
      }

      let newRealmId = activeNovel.currentRealmId;
      const realms = [...activeNovel.realms];
      const worldBible = [...activeNovel.worldBible];
      const territories = [...activeNovel.territories];

      // Helper functions for coercion (defined here so they're accessible)
      const coerceWorldCategoryLocal = (category: string): WorldEntry['category'] => {
        const c = String(category || '').trim();
        const allowed: WorldEntry['category'][] = ['Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other'];
        return (allowed as string[]).includes(c) ? (c as WorldEntry['category']) : 'Other';
      };

      const coerceTerritoryTypeLocal = (type: string): Territory['type'] => {
        const t = String(type || '').trim();
        const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
        return (allowed as string[]).includes(t) ? (t as Territory['type']) : 'Neutral';
      };

      // Process world updates with comprehensive validation
      if (result.worldUpdates && Array.isArray(result.worldUpdates)) {
        let worldUpdateCount = 0;
        let realmCreated = false;

        result.worldUpdates.forEach((w: { title?: unknown; content?: unknown; category?: unknown; isNewRealm?: unknown }) => {
          try {
            if (w.isNewRealm) {
              const realmTitle = String(w.title || 'New Realm').trim();
              const realmDescription = String(w.content || '').trim();

              if (!realmTitle || realmTitle === 'New Realm') {
                localAddLog('Skipped realm creation: Invalid or missing realm title', 'update');
                return;
              }

              const newRealm: Realm = {
                id: generateUUID(),
                name: realmTitle,
                description: realmDescription,
                status: 'current'
              };

              // Archive all existing realms
              realms.forEach(r => r.status = 'archived');
              realms.push(newRealm);
              newRealmId = newRealm.id;
              realmCreated = true;
              localAddLog(`Realm Ascended: Welcome to ${realmTitle}!`, 'discovery');
            } else {
              // Validate world entry before adding
              const title = String(w.title || '').trim();
              const content = String(w.content || '').trim();

              if (!title || title.length < 2) {
                localAddLog('Skipped world entry: Invalid or missing title', 'update');
                return;
              }

              if (!content || content.length < 10) {
                localAddLog(`Skipped world entry "${title}": Content too short or missing`, 'update');
                return;
              }

              if (!newRealmId || newRealmId.trim() === '') {
                localAddLog(`Skipped world entry "${title}": No valid realm available`, 'update');
                return;
              }

              // Check for duplicate entries (by title)
              const existingEntry = worldBible.find(
                entry => normalize(entry.title) === normalize(title) && entry.realmId === newRealmId
              );

              if (existingEntry) {
                // Update existing entry instead of creating duplicate
                existingEntry.content = mergeAppend(existingEntry.content, content, newChapter.number);
                localAddLog(`Updated world entry: ${title}`, 'discovery');
              } else {
                worldBible.push({
                  id: generateUUID(),
                  realmId: newRealmId,
                  category: coerceWorldCategoryLocal(String(w.category || 'Other')),
                  title,
                  content
                });
                localAddLog(`Lore Entry: ${title} (${w.category || 'Other'})`, 'discovery');
                worldUpdateCount++;
              }
            }
          } catch (error) {
            logger.error('Error processing world update', 'App', error instanceof Error ? error : new Error(String(error)));
            localAddLog(`Error processing world update: ${error instanceof Error ? error.message : 'Unknown error'}`, 'update');
          }
        });

        if (worldUpdateCount > 0) {
          addEphemeralLog(`Added ${worldUpdateCount} world entry/entries`, 'discovery');
        }
        if (realmCreated) {
          addEphemeralLog('New realm created', 'discovery');
        }
      }

      // Process territory updates with comprehensive validation
      if (result.territoryUpdates && Array.isArray(result.territoryUpdates)) {
        let territoryUpdateCount = 0;

        result.territoryUpdates.forEach((t: { name?: unknown; type?: unknown; description?: unknown }) => {
          try {
            const name = String(t.name || '').trim();

            if (!name || name.length < 2) {
              localAddLog('Skipped territory: Invalid or missing name', 'update');
              return;
            }

            if (!newRealmId || newRealmId.trim() === '') {
              localAddLog(`Skipped territory "${name}": No valid realm available`, 'update');
              return;
            }

            // Check for duplicate territories (by name in same realm)
            const existingTerritory = territories.find(
              territory => normalize(territory.name) === normalize(name) && territory.realmId === newRealmId
            );

            if (existingTerritory) {
              // Update existing territory instead of creating duplicate
              const description = String(t.description || '').trim();
              if (description && description.length > 0) {
                existingTerritory.description = mergeAppend(existingTerritory.description, description, newChapter.number);
              }
              existingTerritory.type = coerceTerritoryTypeLocal(String(t.type || existingTerritory.type || 'Neutral'));
              localAddLog(`Updated territory: ${name}`, 'discovery');
            } else {
              territories.push({
                id: generateUUID(),
                realmId: newRealmId,
                name,
                type: coerceTerritoryTypeLocal(String(t.type || 'Neutral')),
                description: String(t.description || '').trim()
              });
              localAddLog(`Domain Identified: ${name}`, 'discovery');
              territoryUpdateCount++;
            }
          } catch (error) {
            logger.error('Error processing territory update', 'App', error instanceof Error ? error : new Error(String(error)));
            localAddLog(`Error processing territory update: ${error instanceof Error ? error.message : 'Unknown error'}`, 'update');
          }
        });

        if (territoryUpdateCount > 0) {
          addEphemeralLog(`Added ${territoryUpdateCount} territory/territories`, 'discovery');
        }
      }

      let workingNovelState: NovelState = {
        ...activeNovel,
        chapters: [...activeNovel.chapters, newChapter],
        characterCodex: existingCharacters,
        realms,
        currentRealmId: newRealmId,
        worldBible,
        territories,
        updatedAt: Date.now()
      };

      // Track antagonist chapter appearances for saving after novel is saved to database
      // Declare outside try block so it's accessible after the try-catch
      const antagonistChapterAppearances: Array<{
        antagonistId: string;
        presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence';
        significance: 'major' | 'minor' | 'foreshadowing';
        notes: string;
      }> = [];

      // Track thread progression events for saving after chapter is saved to database
      // This prevents foreign key constraint errors - chapter must exist first
      const pendingThreadProgressionEvents: Array<{
        id: string;
        threadId: string;
        chapterNumber: number;
        chapterId: string;
        eventType: string;
        description: string;
        significance: 'major' | 'minor' | 'foreshadowing';
        createdAt: number;
      }> = [];

      // Process Heavenly Loom thread updates if available
      if (result && (result as any).loomThreadUpdates && Array.isArray((result as any).loomThreadUpdates)) {
        setGenerationProgress(96);
        setGenerationStatus('Updating Heavenly Loom threads...');
        addEphemeralLog('Processing Heavenly Loom thread updates...', 'update');

        try {
          const loomUpdates = (result as any).loomThreadUpdates;
          let threadUpdateCount = 0;

          // Merge Loom thread updates with existing threads
          const existingThreads = workingNovelState.storyThreads || [];
          const updatedThreads = existingThreads.map(existingThread => {
            const loomUpdate = loomUpdates.find((update: any) => update.id === existingThread.id);
            if (loomUpdate) {
              threadUpdateCount++;
              // Merge Loom updates into legacy thread format
              return {
                ...existingThread,
                // Map Loom fields to legacy fields
                status: loomUpdate.loomStatus === 'CLOSED' ? 'resolved' :
                  loomUpdate.loomStatus === 'ABANDONED' ? 'abandoned' :
                    loomUpdate.loomStatus === 'STALLED' ? 'paused' : 'active',
                priority: loomUpdate.karmaWeight >= 80 ? 'critical' :
                  loomUpdate.karmaWeight >= 60 ? 'high' :
                    loomUpdate.karmaWeight >= 40 ? 'medium' : 'low',
                lastUpdatedChapter: Math.max(existingThread.lastUpdatedChapter, loomUpdate.lastMentionedChapter),
                resolutionNotes: loomUpdate.loomStatus === 'CLOSED' ? 'Resolved via Heavenly Loom' : existingThread.resolutionNotes,
                progressionNotes: [
                  ...(existingThread.progressionNotes || []),
                  {
                    chapterNumber: newChapter.number,
                    note: `Loom: ${loomUpdate.loomStatus}${loomUpdate.lastProgressType ? ` (${loomUpdate.lastProgressType})` : ''}`,
                    significance: loomUpdate.loomStatus === 'CLOSED' ? 'major' : 'minor' as any
                  }
                ],
                updatedAt: Date.now(),
                lastActiveChapter: loomUpdate.lastMentionedChapter // NEW: Sync Loom activity to legacy field
              };
            }
            return existingThread;
          });

          // Add any new threads created by Loom
          const newThreads = loomUpdates
            .filter((update: any) => !existingThreads.find(t => t.id === update.id))
            .map((loomThread: any) => ({
              id: loomThread.id,
              novelId: activeNovel.id,
              title: loomThread.title,
              type: loomThread.category === 'SOVEREIGN' ? 'mystery' :
                loomThread.category === 'MAJOR' ? 'enemy' :
                  loomThread.category === 'MINOR' ? 'item' : 'quest',
              status: loomThread.loomStatus === 'CLOSED' ? 'resolved' :
                loomThread.loomStatus === 'ABANDONED' ? 'abandoned' :
                  loomThread.loomStatus === 'STALLED' ? 'paused' : 'active',
              priority: loomThread.karmaWeight >= 80 ? 'critical' :
                loomThread.karmaWeight >= 60 ? 'high' :
                  loomThread.karmaWeight >= 40 ? 'medium' : 'low',
              description: loomThread.summary,
              introducedChapter: loomThread.firstChapter,
              lastUpdatedChapter: loomThread.lastMentionedChapter,
              resolvedChapter: loomThread.loomStatus === 'CLOSED' ? loomThread.lastMentionedChapter : undefined,
              progressionNotes: [{
                chapterNumber: newChapter.number,
                note: `Created by Loom: ${loomThread.loomStatus}`,
                significance: 'minor' as any
              }],
              resolutionNotes: loomThread.loomStatus === 'CLOSED' ? 'Resolved via Heavenly Loom' : undefined,
              satisfactionScore: undefined,
              chaptersInvolved: [newChapter.number],
              createdAt: loomThread.createdAt,
              updatedAt: Date.now(),
              lastActiveChapter: loomThread.lastMentionedChapter
            }));

          // Update workingNovelState with merged threads
          workingNovelState = {
            ...workingNovelState,
            storyThreads: [...updatedThreads, ...newThreads]
          };

          if (threadUpdateCount > 0 || newThreads.length > 0) {
            addEphemeralLog(`Heavenly Loom: ${threadUpdateCount} thread(s) updated, ${newThreads.length} new thread(s) created`, 'update');
            localAddLog(`🧵 Heavenly Loom processed ${threadUpdateCount + newThreads.length} thread(s)`, 'update');
          }
        } catch (loomError) {
          logger.warn('Failed to process Loom thread updates', 'App', {
            error: loomError instanceof Error ? loomError.message : String(loomError)
          });
          addEphemeralLog('Failed to process some Loom thread updates', 'update');
        }
      }

      // Post-chapter extraction pass (Codex + World Bible + Territories + Arc checklist progress)
      try {
        setGenerationProgress(97);
        setGenerationStatus('Updating Codex & World Bible...');
        addEphemeralLog('Extracting post-chapter updates (Codex, World Bible, Territories, Arc progress)...', 'discovery');

        let activeArc = workingNovelState.plotLedger.find(a => a.status === 'active') || null;
        if (activeArc) {
          const ensured = ensureArcDefaults(activeArc);
          if (ensured !== activeArc) {
            workingNovelState = {
              ...workingNovelState,
              plotLedger: workingNovelState.plotLedger.map(a => (a.id === ensured.id ? ensured : a)),
            };
            activeArc = ensured;
          }
        }

        // Capture snapshot BEFORE processing post-chapter updates (for rollback)
        const oldRealmId = workingNovelState.currentRealmId;
        let snapshotCaptured = false;
        try {
          await captureChapterSnapshot(
            activeNovel.id,
            newChapter.id,
            newChapter.number,
            workingNovelState
          );
          snapshotCaptured = true;
          logger.info('Chapter snapshot captured', 'chapterGeneration', {
            chapterId: newChapter.id,
            chapterNumber: newChapter.number,
          });
        } catch (snapshotError) {
          logger.error('Failed to capture chapter snapshot', 'chapterGeneration', {
            chapterId: newChapter.id,
            error: snapshotError instanceof Error ? snapshotError : new Error(String(snapshotError)),
          });
          // Don't fail generation if snapshot fails - non-critical
        }

        // Initialize story threads if novel has none (critical for Chapter 17+)
        if (!workingNovelState.storyThreads || workingNovelState.storyThreads.length === 0) {
          try {
            const { initializeStoryThreads } = await import('./services/storyThreadInitializer');
            const initialThreads = initializeStoryThreads(workingNovelState);
            workingNovelState.storyThreads = initialThreads;

            localAddLog(`🧵 Initialized ${initialThreads.length} story threads`, 'update');
            logger.info('Story threads initialized during chapter generation', 'chapterGeneration', {
              chapterId: newChapter.id,
              chapterNumber: newChapter.number,
              threadCount: initialThreads.length
            });
          } catch (initError) {
            localAddLog(`⚠️ Warning: Failed to initialize story threads`, 'update');
            logger.warn('Story thread initialization failed', 'chapterGeneration', {
              error: initError instanceof Error ? initError.message : String(initError),
              chapterId: newChapter.id,
            });
          }
        }

        const extraction = await extractPostChapterUpdates(workingNovelState, newChapter, activeArc);

        // If user cancelled while waiting, ignore the result.
        if (activeGenerationIdRef.current !== generationId) {
          return;
        }

        // Comprehensive validation and logging for extraction results
        if (!extraction) {
          localAddLog(`⚠️ Warning: Extraction returned null - no data extracted`, 'update');
          logger.warn('Extraction returned null', 'chapterGeneration', {
            chapterId: newChapter.id,
            chapterNumber: newChapter.number,
          });
        } else {
          // Log extraction summary
          const scenesCount = extraction.scenes?.length || 0;
          const worldBibleCount = extraction.worldEntryUpserts?.length || 0;
          const territoriesCount = extraction.territoryUpserts?.length || 0;
          const antagonistsCount = extraction.antagonistUpdates?.length || 0;
          const arcProgressItems = extraction.arcChecklistProgress?.completedItemIds?.length || 0;
          const characterUpsertsCount = extraction.characterUpserts?.length || 0;
          const itemUpdatesCount = extraction.itemUpdates?.length || 0;
          const techniqueUpdatesCount = extraction.techniqueUpdates?.length || 0;
          const relationshipCount = extraction.characterUpserts?.reduce((sum, u) => sum + (u.relationships?.length || 0), 0) || 0;

          // #region agent log
          const itemUpdatesWithCharacterName = extraction.itemUpdates?.filter(i => i.characterName) || [];
          const techniqueUpdatesWithCharacterName = extraction.techniqueUpdates?.filter(t => t.characterName) || [];
          console.log('[DEBUG] Extraction summary:', {
            itemUpdatesCount,
            itemUpdatesWithCharacterName: itemUpdatesWithCharacterName.length,
            techniqueUpdatesCount,
            techniqueUpdatesWithCharacterName: techniqueUpdatesWithCharacterName.length,
            itemUpdates: extraction.itemUpdates,
            techniqueUpdates: extraction.techniqueUpdates
          });
          // #endregion

          localAddLog(`📊 Extraction summary: ${scenesCount} scene(s), ${worldBibleCount} world entry(ies), ${territoriesCount} territory(ies), ${antagonistsCount} antagonist(s), ${arcProgressItems} arc element(s)`, 'discovery');
          logger.info('Extraction details', 'chapterGeneration', {
            chapterId: newChapter.id,
            chapterNumber: newChapter.number,
            characterUpserts: characterUpsertsCount,
            itemUpdates: itemUpdatesCount,
            techniqueUpdates: techniqueUpdatesCount,
            relationships: relationshipCount,
          });

          // Validate each extraction type
          if (scenesCount === 0) {
            localAddLog(`⚠️ No scenes extracted from chapter ${newChapter.number}`, 'update');
          }
          if (worldBibleCount === 0) {
            localAddLog(`⚠️ No world bible entries extracted from chapter ${newChapter.number}`, 'update');
          }
          if (territoriesCount === 0) {
            localAddLog(`⚠️ No territories extracted from chapter ${newChapter.number}`, 'update');
          }
          if (antagonistsCount === 0) {
            localAddLog(`⚠️ No antagonists extracted from chapter ${newChapter.number}`, 'update');
          }

          // Validate scene structure
          if (extraction.scenes && extraction.scenes.length > 0) {
            extraction.scenes.forEach((scene, idx) => {
              if (!scene.number || !scene.title || !scene.contentExcerpt) {
                localAddLog(`⚠️ Scene ${idx + 1} missing required fields (number, title, or contentExcerpt)`, 'update');
              }
            });
          }

          // Validate world bible entries
          if (extraction.worldEntryUpserts && extraction.worldEntryUpserts.length > 0) {
            extraction.worldEntryUpserts.forEach((entry, idx) => {
              if (!entry.title || !entry.content || !entry.category) {
                localAddLog(`⚠️ World entry ${idx + 1} missing required fields (title, content, or category)`, 'update');
              }
            });
          }

          // Validate territories
          if (extraction.territoryUpserts && extraction.territoryUpserts.length > 0) {
            extraction.territoryUpserts.forEach((territory, idx) => {
              if (!territory.name || !territory.description || !territory.type) {
                localAddLog(`⚠️ Territory ${idx + 1} missing required fields (name, description, or type)`, 'update');
              }
            });
          }

          logger.info('Extraction completed', 'chapterGeneration', {
            chapterId: newChapter.id,
            chapterNumber: newChapter.number,
            scenesCount: scenesCount,
            worldBibleCount: worldBibleCount,
            territoriesCount: territoriesCount,
            antagonistsCount: antagonistsCount,
            arcProgressItems: arcProgressItems,
          });
        }

        const now = Date.now();

        // normalize and mergeAppend are already defined above

        const coerceWorldCategory = (category: any): WorldEntry['category'] => {
          const c = String(category || '').trim();
          const allowed: WorldEntry['category'][] = [
            'Geography',
            'Sects',
            'PowerLevels',
            'Laws',
            'Systems',
            'Techniques',
            'Other',
          ];
          return (allowed as string[]).includes(c) ? (c as WorldEntry['category']) : 'Other';
        };

        const coerceTerritoryType = (type: string): Territory['type'] => {
          const t = String(type || '').trim();
          const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
          return (allowed as string[]).includes(t) ? (t as Territory['type']) : 'Neutral';
        };

        const coerceCharStatus = (status: any): Character['status'] | undefined => {
          const s = String(status || '').trim();
          const allowed: Character['status'][] = ['Alive', 'Deceased', 'Unknown'];
          return (allowed as string[]).includes(s) ? (s as any) : undefined;
        };

        // 1) Character upserts
        let mergedCharacters = [...workingNovelState.characterCodex];

        // Debug: Log initial state
        logger.debug('Character upserts - initial state', 'chapterGeneration', {
          chapterId: newChapter.id,
          chapterNumber: newChapter.number,
          initialCharacterCount: mergedCharacters.length,
          characterUpsertsCount: extraction.characterUpserts?.length || 0,
          initialCharacters: mergedCharacters.slice(0, 3).map(c => ({ name: c.name, cultivation: c.currentCultivation }))
        });

        extraction.characterUpserts?.forEach((u) => {
          const name = String(u?.name || '').trim();
          if (!name) return;
          const matchedChar = findBestMatch(name, mergedCharacters);
          const idx = matchedChar ? mergedCharacters.findIndex(c => c.id === matchedChar.id) : -1;

          const applyTo = (char: Character): Character => {
            const next: Character = { ...char };
            const set = u?.set || {};
            if (typeof set.age === 'string' && set.age.trim()) next.age = set.age;
            if (typeof set.personality === 'string' && set.personality.trim()) next.personality = set.personality;
            if (typeof set.currentCultivation === 'string' && set.currentCultivation.trim()) next.currentCultivation = set.currentCultivation;
            if (typeof set.appearance === 'string' && set.appearance.trim()) next.appearance = set.appearance;
            if (typeof set.background === 'string' && set.background.trim()) next.background = mergeAppend(next.background || '', set.background, newChapter.number);
            if (typeof set.goals === 'string' && set.goals.trim()) next.goals = set.goals;
            if (typeof set.flaws === 'string' && set.flaws.trim()) next.flaws = set.flaws;
            if (typeof set.notes === 'string' && set.notes.trim()) next.notes = mergeAppend(next.notes || '', set.notes, newChapter.number);
            const status = coerceCharStatus(set.status);
            if (status) next.status = status;

            const addSkills: string[] = Array.isArray(u?.addSkills) ? u.addSkills : [];
            const addItems: string[] = Array.isArray(u?.addItems) ? u.addItems : [];
            if (addSkills.length) next.skills = [...new Set([...(next.skills || []), ...addSkills.filter((s) => String(s).trim())])];
            if (addItems.length) next.items = [...new Set([...(next.items || []), ...addItems.filter((s) => String(s).trim())])];

            // Relationships will be processed separately after character updates
            // to ensure bidirectional creation via relationship service

            return next;
          };

          if (idx > -1) {
            mergedCharacters[idx] = applyTo(mergedCharacters[idx]);
          } else {
            // Create new character
            const set = u?.set || {};
            const status = coerceCharStatus(set.status) || 'Alive';
            const newChar: Character = applyTo({
              id: generateUUID(),
              name,
              age: typeof set.age === 'string' && set.age.trim() ? set.age : 'Unknown',
              personality: typeof set.personality === 'string' && set.personality.trim() ? set.personality : 'Unknown',
              currentCultivation: typeof set.currentCultivation === 'string' && set.currentCultivation.trim() ? set.currentCultivation : 'Unknown',
              appearance: typeof set.appearance === 'string' && set.appearance.trim() ? set.appearance : undefined,
              background: typeof set.background === 'string' && set.background.trim() ? set.background : undefined,
              goals: typeof set.goals === 'string' && set.goals.trim() ? set.goals : undefined,
              flaws: typeof set.flaws === 'string' && set.flaws.trim() ? set.flaws : undefined,
              skills: [],
              items: [],
              notes: typeof set.notes === 'string' && set.notes.trim() ? set.notes : 'Newly introduced character.',
              status,
              relationships: [],
            });
            mergedCharacters.push(newChar);
            localAddLog(`Being Discovered (extracted): ${name}`, 'discovery');
          }
        });

        // Log character updates summary
        const charactersUpdated = mergedCharacters.length - workingNovelState.characterCodex.length;
        const charactersModified = extraction.characterUpserts?.filter(u => {
          const existing = findBestMatch(u.name || '', workingNovelState.characterCodex);
          return existing !== undefined;
        }).length || 0;
        logger.info('Character updates processed', 'chapterGeneration', {
          chapterId: newChapter.id,
          chapterNumber: newChapter.number,
          newCharacters: charactersUpdated,
          modifiedCharacters: charactersModified,
          totalCharacters: mergedCharacters.length,
          initialCount: workingNovelState.characterCodex.length,
          finalCount: mergedCharacters.length
        });

        // 1.5) Process relationships using relationship service for bidirectional creation
        extraction.characterUpserts?.forEach((u) => {
          const name = String(u?.name || '').trim();
          if (!name) return;

          const sourceChar = findBestMatch(name, mergedCharacters);
          if (!sourceChar) return;

          const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
          if (rels.length) {
            for (const rel of rels) {
              const targetName = String(rel?.targetName || '').trim();
              const type = String(rel?.type || '').trim();
              if (!targetName || !type) continue;

              const targetChar = findBestMatch(targetName, mergedCharacters);
              if (!targetChar) {
                localAddLog(`Skipped relationship: Target character "${targetName}" not found for "${name}"`, 'update');
                continue;
              }

              // Use relationship service to create bidirectional relationship
              const result = addOrUpdateRelationship(
                mergedCharacters,
                sourceChar.id,
                targetChar.id,
                type,
                String(rel?.history || 'Karma link recorded in chronicle.'),
                String(rel?.impact || 'Fate has shifted.'),
                true // bidirectional
              );

              if (result.success) {
                mergedCharacters = result.updatedCharacters;
                localAddLog(`Karma Link: ${sourceChar.name} <-> ${targetChar.name} (${type})`, 'fate');
              } else {
                logger.warn('Failed to create relationship', 'chapterGeneration', {
                  source: sourceChar.name,
                  target: targetChar.name,
                  errors: result.errors
                });
                localAddLog(`Failed to create relationship: ${result.errors.join(', ')}`, 'update');
              }
            }
          }
        });

        // Log relationship processing summary
        const relationshipsCreated = extraction.characterUpserts?.reduce((sum, u) => {
          const char = findBestMatch(u.name || '', mergedCharacters);
          return sum + (char?.relationships?.length || 0);
        }, 0) || 0;
        logger.info('Relationships processed', 'chapterGeneration', {
          chapterId: newChapter.id,
          chapterNumber: newChapter.number,
          relationshipsCreated: relationshipsCreated,
        });

        // 2) World entry upserts (by realmId + category + title)
        const mergedWorldBible = [...workingNovelState.worldBible];
        const initialWorldBibleCount = mergedWorldBible.length;
        extraction.worldEntryUpserts?.forEach((w: { title?: unknown; content?: unknown; category?: unknown }) => {
          const title = String(w?.title || '').trim();
          const content = String(w?.content || '').trim();
          if (!title || !content) return;
          const category = coerceWorldCategory(w?.category);
          // Use currentRealmId, but fallback to first realm if currentRealmId is invalid
          let realmId = workingNovelState.currentRealmId;
          if (!realmId || realmId.trim() === '' || !workingNovelState.realms.some(r => r.id === realmId)) {
            // Fallback to first realm if currentRealmId is invalid
            realmId = workingNovelState.realms.length > 0 ? workingNovelState.realms[0].id : '';
          }
          if (!realmId || realmId.trim() === '') {
            localAddLog(`Skipped world entry "${title}": No valid realm available`, 'update');
            return; // Skip if still no valid realm
          }
          const idx = mergedWorldBible.findIndex(
            (e) => e.realmId === realmId && e.category === category && normalize(e.title) === normalize(title)
          );
          if (idx > -1) {
            mergedWorldBible[idx] = {
              ...mergedWorldBible[idx],
              content: mergeAppend(mergedWorldBible[idx].content || '', content, newChapter.number),
            };
            localAddLog(`World Entry Updated (extracted): ${title} (${category})`, 'discovery');
          } else {
            // Generate id for validation
            const newId = generateUUID();
            // Validate basic world entry input (title/content/realmId). If invalid, skip.
            const validation = validateWorldEntryInput({ id: newId, realmId, category, title, content });
            if (!validation.success) {
              localAddLog(`Skipped invalid world entry "${title}": ${validation.error || 'validation failed'}`, 'update');
              return;
            }
            mergedWorldBible.push({
              id: newId,
              realmId,
              category,
              title,
              content,
            });
            localAddLog(`Lore Entry (extracted): ${title} (${category})`, 'discovery');
          }
        });

        // Log summary of world bible updates
        const finalWorldBibleCount = mergedWorldBible.length;
        if (finalWorldBibleCount > initialWorldBibleCount) {
          localAddLog(`World Bible updated: ${initialWorldBibleCount} → ${finalWorldBibleCount} entries (+${finalWorldBibleCount - initialWorldBibleCount})`, 'discovery');
        } else if (extraction.worldEntryUpserts && extraction.worldEntryUpserts.length > 0) {
          localAddLog(`World Bible: ${extraction.worldEntryUpserts.length} update(s) processed (entries merged or skipped)`, 'discovery');
        }

        // 3) Territory upserts (by realmId + name)
        const mergedTerritories = [...workingNovelState.territories];
        extraction.territoryUpserts?.forEach((t) => {
          const name = String(t?.name || '').trim();
          const description = String(t?.description || '').trim();
          if (!name || !description) return;
          const realmId = workingNovelState.currentRealmId;
          const idx = mergedTerritories.findIndex(
            (e) => e.realmId === realmId && normalize(e.name) === normalize(name)
          );
          if (idx > -1) {
            mergedTerritories[idx] = {
              ...mergedTerritories[idx],
              type: coerceTerritoryType(t?.type),
              description: mergeAppend(mergedTerritories[idx].description || '', description, newChapter.number),
            };
          } else {
            mergedTerritories.push({
              id: generateUUID(),
              realmId,
              name,
              type: coerceTerritoryType(t?.type),
              description,
            });
            localAddLog(`Domain Identified (extracted): ${name}`, 'discovery');
          }
        });

        // 3.5) Item and Technique processing
        const mergedNovelItems = [...(workingNovelState.novelItems || [])];
        const mergedNovelTechniques = [...(workingNovelState.novelTechniques || [])];

        // Process item updates

        if (extraction.itemUpdates && extraction.itemUpdates.length > 0) {
          const skippedItems: string[] = [];
          extraction.itemUpdates.forEach((itemUpdate: { name?: unknown; characterName?: unknown; category?: unknown; description?: unknown; addPowers?: unknown[] }) => {
            const itemName = String(itemUpdate?.name || '').trim();
            const characterName = String(itemUpdate?.characterName || '').trim();
            if (!itemName || !characterName) {
              skippedItems.push(`Item "${itemName}" skipped: ${!itemName ? 'missing name' : 'missing characterName'}`);
              return;
            }

            // Find character index (not the character itself for immutable updates)
            const matchedChar = findBestMatch(characterName, mergedCharacters);
            const characterIndex = matchedChar ? mergedCharacters.findIndex(c => c.id === matchedChar.id) : -1;

            if (characterIndex === -1) {
              localAddLog(`Skipped item "${itemName}": Character "${characterName}" not found`, 'update');
              return;
            }

            const character = mergedCharacters[characterIndex];

            // Coerce category
            const coerceItemCategory = (cat: string): ItemCategory => {
              const categories: ItemCategory[] = ['Treasure', 'Equipment', 'Consumable', 'Essential'];
              const normalized = String(cat || '').trim();
              return categories.includes(normalized as ItemCategory) ? (normalized as ItemCategory) : 'Essential';
            };

            const category = coerceItemCategory(String(itemUpdate?.category || 'Essential'));
            const description = String(itemUpdate?.description || '').trim();
            const powers = Array.isArray(itemUpdate?.addPowers) ? itemUpdate.addPowers.map((p: any) => String(p).trim()).filter((p: string) => p) : [];

            try {
              const { item, wasCreated } = findOrCreateItem(
                itemName,
                mergedNovelItems,
                workingNovelState.id,
                category,
                newChapter.number,
                description || undefined,
                powers.length > 0 ? powers : undefined
              );

              // Update or add item to registry
              const itemIndex = mergedNovelItems.findIndex(i => i.id === item.id);
              if (itemIndex >= 0) {
                mergedNovelItems[itemIndex] = item;
              } else {
                mergedNovelItems.push(item);
              }

              // Create or update character possession using immutable update
              const existingPossessions = character.itemPossessions || [];
              const existingPossessionIndex = existingPossessions.findIndex(p => p.itemId === item.id);

              let updatedPossessions: CharacterItemPossession[];
              if (existingPossessionIndex >= 0) {
                // Update existing possession
                updatedPossessions = existingPossessions.map((p, idx) =>
                  idx === existingPossessionIndex
                    ? {
                      ...p,
                      status: 'active' as const,
                      notes: p.notes || '',
                      updatedAt: Date.now()
                    }
                    : p
                );
              } else {
                // Create new possession
                const newPossession: CharacterItemPossession = {
                  id: generateUUID(),
                  characterId: character.id,
                  itemId: item.id,
                  status: 'active',
                  acquiredChapter: newChapter.number,
                  notes: '',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
                updatedPossessions = [...existingPossessions, newPossession];
              }

              // Create new character object with updated possessions (immutable update)
              const updatedCharacter: Character = {
                ...character,
                itemPossessions: updatedPossessions
              };

              // Update mergedCharacters array with new character object
              mergedCharacters[characterIndex] = updatedCharacter;

              localAddLog(
                wasCreated
                  ? `Item Discovered (extracted): ${itemName} (${category}) - ${characterName}`
                  : `Item Updated (extracted): ${itemName} - ${characterName}`,
                'discovery'
              );
            } catch (error) {
              logger.error(`Error processing item "${itemName}"`, 'chapterProcessing', error instanceof Error ? error : new Error(String(error)), { itemName, category });
              localAddLog(`Failed to process item "${itemName}": ${error}`, 'update');
            }
          });
          if (skippedItems.length > 0) {
            console.warn('[DEBUG] Skipped item updates:', skippedItems);
            localAddLog(`⚠️ ${skippedItems.length} item update(s) skipped due to missing characterName`, 'update');
          }
        }

        // Process technique updates

        if (extraction.techniqueUpdates && extraction.techniqueUpdates.length > 0) {
          const skippedTechniques: string[] = [];
          extraction.techniqueUpdates.forEach((techUpdate: { name?: unknown; characterName?: unknown; category?: unknown; type?: unknown; description?: unknown; addFunctions?: unknown[]; masteryLevel?: unknown }) => {
            const techName = String(techUpdate?.name || '').trim();
            const characterName = String(techUpdate?.characterName || '').trim();
            if (!techName || !characterName) {
              skippedTechniques.push(`Technique "${techName}" skipped: ${!techName ? 'missing name' : 'missing characterName'}`);
              return;
            }

            // Find character index (not the character itself for immutable updates)
            const matchedChar = findBestMatch(characterName, mergedCharacters);
            const characterIndex = matchedChar ? mergedCharacters.findIndex(c => c.id === matchedChar.id) : -1;
            if (characterIndex === -1) {
              localAddLog(`Skipped technique "${techName}": Character "${characterName}" not found`, 'update');
              return;
            }

            const character = mergedCharacters[characterIndex];

            // Use shared coercion utilities
            const category = coerceTechniqueCategory(techUpdate?.category || 'Basic');
            const techType = coerceTechniqueType(techUpdate?.type || 'Other');
            const description = String(techUpdate?.description || '').trim();
            const functions = Array.isArray(techUpdate?.addFunctions) ? techUpdate.addFunctions.map((f: unknown) => String(f).trim()).filter((f: string) => f) : [];
            const masteryLevel = String(techUpdate?.masteryLevel || 'Novice').trim();

            try {
              const { technique, wasCreated } = findOrCreateTechnique(
                techName,
                mergedNovelTechniques,
                workingNovelState.id,
                category,
                techType,
                newChapter.number,
                description || undefined,
                functions.length > 0 ? functions : undefined
              );

              // Update or add technique to registry
              const techIndex = mergedNovelTechniques.findIndex(t => t.id === technique.id);
              if (techIndex >= 0) {
                mergedNovelTechniques[techIndex] = technique;
              } else {
                mergedNovelTechniques.push(technique);
              }

              // Create or update character mastery using immutable update
              const existingMasteries = character.techniqueMasteries || [];
              const existingMasteryIndex = existingMasteries.findIndex(m => m.techniqueId === technique.id);

              let updatedMasteries: CharacterTechniqueMastery[];
              if (existingMasteryIndex >= 0) {
                // Update existing mastery
                updatedMasteries = existingMasteries.map((m, idx) =>
                  idx === existingMasteryIndex
                    ? {
                      ...m,
                      status: 'active' as const,
                      masteryLevel: masteryLevel || m.masteryLevel,
                      notes: m.notes || '',
                      updatedAt: Date.now()
                    }
                    : m
                );
              } else {
                // Create new mastery
                const newMastery: CharacterTechniqueMastery = {
                  id: generateUUID(),
                  characterId: character.id,
                  techniqueId: technique.id,
                  status: 'active',
                  masteryLevel: masteryLevel,
                  learnedChapter: newChapter.number,
                  notes: '',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };
                updatedMasteries = [...existingMasteries, newMastery];
              }

              // Create new character object with updated masteries (immutable update)
              const updatedCharacter: Character = {
                ...character,
                techniqueMasteries: updatedMasteries
              };

              // Update mergedCharacters array with new character object
              mergedCharacters[characterIndex] = updatedCharacter;

              localAddLog(
                wasCreated
                  ? `Technique Discovered (extracted): ${techName} (${category}, ${techType}) - ${characterName}`
                  : `Technique Updated (extracted): ${techName} - ${characterName}`,
                'discovery'
              );
            } catch (error) {
              logger.error('Error processing technique', 'App', error instanceof Error ? error : new Error(String(error)), {
                techName
              });
              localAddLog(`Failed to process technique "${techName}": ${error}`, 'update');
            }
          });
          if (skippedTechniques.length > 0) {
            console.warn('[DEBUG] Skipped technique updates:', skippedTechniques);
            localAddLog(`⚠️ ${skippedTechniques.length} technique update(s) skipped due to missing characterName`, 'update');
          }
        }

        // Log item and technique linking summary
        const itemsLinked = mergedCharacters.reduce((sum, char) => sum + (char.itemPossessions?.length || 0), 0);
        const techniquesLinked = mergedCharacters.reduce((sum, char) => sum + (char.techniqueMasteries?.length || 0), 0);
        logger.info('Items and techniques linked', 'chapterGeneration', {
          chapterId: newChapter.id,
          chapterNumber: newChapter.number,
          itemsLinked: itemsLinked,
          techniquesLinked: techniquesLinked,
          totalItems: mergedNovelItems.length,
          totalTechniques: mergedNovelTechniques.length,
        });

        // 3.5) Process antagonist updates with fuzzy matching
        let mergedAntagonists = [...(workingNovelState.antagonists || [])];
        let mergedThreads = [...(workingNovelState.storyThreads || [])];

        // Process story threads
        if (extraction.threadUpdates && extraction.threadUpdates.length > 0) {
          try {
            const { processThreadUpdates } = await import('./services/storyThreadService');
            const threadResults = processThreadUpdates(
              extraction.threadUpdates,
              mergedThreads,
              workingNovelState.id,
              newChapter.number,
              newChapter.id,
              {
                characterCodex: mergedCharacters,
                novelItems: mergedNovelItems,
                novelTechniques: mergedNovelTechniques,
                territories: mergedTerritories,
                antagonists: mergedAntagonists,
                plotLedger: workingNovelState.plotLedger, // Use original plotLedger since mergedLedger isn't created yet
                worldBible: workingNovelState.worldBible,
                realms: workingNovelState.realms,
              }
            );

            for (const result of threadResults) {
              const existingIndex = mergedThreads.findIndex(t => t.id === result.thread.id);
              if (existingIndex >= 0) {
                mergedThreads[existingIndex] = result.thread;
                if (result.wasUpdated) {
                  localAddLog(`Thread updated: ${result.thread.title}`, 'update');
                }
              } else {
                mergedThreads.push(result.thread);
                localAddLog(`Thread discovered: ${result.thread.title}`, 'discovery');
              }

              // Collect progression event for deferred saving (after chapter is saved to database)
              // This prevents foreign key constraint errors since thread_progression_events requires chapter_id to exist
              if (result.progressionEvent) {
                pendingThreadProgressionEvents.push(result.progressionEvent);
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error processing thread updates:', errorMessage);
            localAddLog(`Failed to process thread updates: ${errorMessage}`, 'update');
          }
        }

        if (extraction.antagonistUpdates && extraction.antagonistUpdates.length > 0) {
          extraction.antagonistUpdates.forEach((antUpdate) => {
            try {
              const antName = String(antUpdate?.name || '').trim();
              if (!antName) return;

              // Use fuzzy matching to find existing antagonist
              const matchResult = findMatchingAntagonist(antName, mergedAntagonists, 0.85);
              const existingAntagonist = matchResult.antagonist;
              const existingIndex = existingAntagonist
                ? mergedAntagonists.findIndex(a => a.id === existingAntagonist.id)
                : -1;

              // Determine action: if AI says "update" or we found a match, update; otherwise create
              const shouldUpdate = antUpdate.action === 'update' || (existingAntagonist && matchResult.similarity >= 0.85);

              if (shouldUpdate && existingIndex >= 0 && existingAntagonist) {
                // Update existing antagonist with intelligent merging
                const updates: Partial<Antagonist> = {
                  description: antUpdate.description,
                  motivation: antUpdate.motivation,
                  powerLevel: antUpdate.powerLevel,
                  status: antUpdate.status,
                  threatLevel: antUpdate.threatLevel,
                  lastAppearedChapter: newChapter.number,
                  notes: antUpdate.notes,
                  updatedAt: Date.now()
                };

                // Remove undefined values
                Object.keys(updates).forEach(key => {
                  if (updates[key as keyof Antagonist] === undefined) {
                    delete updates[key as keyof Antagonist];
                  }
                });

                mergedAntagonists[existingIndex] = mergeAntagonistInfo(existingAntagonist, updates);

                // Track chapter appearance for saving later
                if (antUpdate.presenceType && newChapter.id) {
                  antagonistChapterAppearances.push({
                    antagonistId: existingAntagonist.id,
                    presenceType: antUpdate.presenceType || 'mentioned',
                    significance: antUpdate.significance || 'minor',
                    notes: antUpdate.notes || ''
                  });
                }

                localAddLog(
                  matchResult.similarity < 1.0
                    ? `Antagonist Matched & Updated (fuzzy): ${antName} → ${existingAntagonist.name} (${Math.round(matchResult.similarity * 100)}% match)`
                    : `Antagonist Updated: ${antName} - Status: ${antUpdate.status || existingAntagonist.status}`,
                  'update'
                );
              } else if (antUpdate.action === 'create' || !existingAntagonist) {
                // Create new antagonist
                const antagonistId = crypto.randomUUID();
                const protagonist = mergedCharacters.find(c => c.isProtagonist);

                const newAntagonist: Antagonist = {
                  id: antagonistId,
                  novelId: activeNovel.id,
                  name: antName,
                  type: (antUpdate.type || 'individual') as Antagonist['type'],
                  description: antUpdate.description || '',
                  motivation: antUpdate.motivation || '',
                  powerLevel: antUpdate.powerLevel || '',
                  status: (antUpdate.status || 'active') as Antagonist['status'],
                  firstAppearedChapter: newChapter.number,
                  lastAppearedChapter: newChapter.number,
                  durationScope: (antUpdate.durationScope || 'arc') as Antagonist['durationScope'],
                  threatLevel: (antUpdate.threatLevel || 'medium') as Antagonist['threatLevel'],
                  notes: antUpdate.notes || '',
                  relationships: protagonist && antUpdate.relationshipWithProtagonist ? [{
                    id: generateUUID(),
                    antagonistId: antagonistId,
                    characterId: protagonist.id,
                    relationshipType: (antUpdate.relationshipWithProtagonist.relationshipType || 'primary_target') as any,
                    intensity: (antUpdate.relationshipWithProtagonist.intensity || 'enemy') as any,
                    history: '',
                    currentState: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  }] : [],
                  arcAssociations: activeArc && antUpdate.arcRole ? [{
                    id: generateUUID(),
                    antagonistId: antagonistId,
                    arcId: activeArc.id,
                    role: (antUpdate.arcRole || 'secondary') as AntagonistRole,
                    introducedInArc: true,
                    resolvedInArc: false,
                    notes: '',
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  }] : [],
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                };

                mergedAntagonists.push(newAntagonist);
                localAddLog(`Antagonist Discovered: ${antName} (${antUpdate.type || 'individual'}, ${antUpdate.threatLevel || 'medium'} threat)`, 'discovery');

                // Track chapter appearance for batch saving AFTER chapter is saved
                // Note: Chapter appearances will be saved after the novel (including antagonists) is saved,
                // to ensure both the antagonist and chapter exist in the database
                if (newChapter.id && antUpdate.presenceType) {
                  antagonistChapterAppearances.push({
                    antagonistId: antagonistId,
                    presenceType: antUpdate.presenceType || 'direct',
                    significance: antUpdate.significance || 'major',
                    notes: antUpdate.notes || ''
                  });
                }

                // Relationships and arc associations are stored in the antagonist object
                // They will be saved automatically when saveNovel is called (via upsert)
                // No need to save them immediately - this avoids errors if antagonist doesn't exist yet
              }
            } catch (error) {
              logger.error('Error processing antagonist', 'App', error instanceof Error ? error : new Error(String(error)), {
                antagonistName: antUpdate?.name || 'unknown'
              });
              localAddLog(`Failed to process antagonist "${antUpdate?.name}": ${error}`, 'update');
            }
          });
        }

        // 4) Scene extraction and creation with improved character linking
        const extractedScenes: Scene[] = [];
        if (extraction.scenes && extraction.scenes.length > 0) {
          extraction.scenes.forEach((s) => {
            const sceneNum = typeof s?.number === 'number' && s.number > 0 ? s.number : extractedScenes.length + 1;
            const sceneTitle = String(s?.title || '').trim() || `Scene ${sceneNum}`;
            const sceneSummary = String(s?.summary || '').trim() || '';
            const contentExcerpt = String(s?.contentExcerpt || '').trim() || '';

            // If we have a content excerpt, use it; otherwise try to extract from chapter content
            let sceneContent = contentExcerpt;
            if (!sceneContent && newChapter.content) {
              // Improved heuristic: split chapter by paragraph breaks and assign to scenes
              // Use more intelligent paragraph splitting with better scene boundaries
              const paragraphs = newChapter.content.split(/\n\n+/).filter(p => p.trim().length > 50);
              const scenesCount = extraction.scenes.length;
              const parasPerScene = Math.max(1, Math.ceil(paragraphs.length / scenesCount));
              const startIdx = (sceneNum - 1) * parasPerScene;
              const endIdx = Math.min(startIdx + parasPerScene, paragraphs.length);
              sceneContent = paragraphs.slice(startIdx, endIdx).join('\n\n') || newChapter.content.substring(0, 1000);
            }

            // Enhanced scene content: combine excerpt, summary, and full content for better analysis
            const fullSceneText = `${sceneTitle} ${sceneSummary} ${sceneContent}`.toLowerCase();

            // Automatically detect characters mentioned in this scene
            const mentionedCharacters = mergedCharacters.filter(char => {
              const charNameLower = char.name.toLowerCase();
              return fullSceneText.includes(charNameLower) ||
                sceneContent.toLowerCase().includes(charNameLower) ||
                sceneSummary.toLowerCase().includes(charNameLower);
            });

            if (sceneTitle || sceneSummary || sceneContent) {
              const newScene: Scene = {
                id: generateUUID(),
                chapterId: newChapter.id,
                number: sceneNum,
                title: sceneTitle,
                summary: sceneSummary,
                content: sceneContent,
                wordCount: sceneContent.split(/\s+/).filter(w => w.length > 0).length,
                tags: [],
                createdAt: now,
                updatedAt: now,
              };

              extractedScenes.push(newScene);

              // Log character connections for this scene
              if (mentionedCharacters.length > 0) {
                localAddLog(`Scene ${sceneNum}: ${mentionedCharacters.map(c => c.name).join(', ')} present`, 'discovery');
              }
            }
          });

          if (extractedScenes.length > 0) {
            localAddLog(`Scenes extracted: ${extractedScenes.length} scene(s) created with character linking`, 'discovery');

            // Count total character appearances across all scenes
            const allSceneTexts = extractedScenes.map(s => `${s.title} ${s.summary} ${s.content}`.toLowerCase()).join(' ');
            const charactersInScenes = mergedCharacters.filter(char =>
              allSceneTexts.includes(char.name.toLowerCase())
            );

            if (charactersInScenes.length > 0) {
              localAddLog(`Auto-linked ${charactersInScenes.length} character(s) to scenes`, 'discovery');
            }
          }
        }

        // 5) Arc checklist progress
        let mergedLedger = [...workingNovelState.plotLedger];
        const completedItemIds: string[] = extraction.arcChecklistProgress?.completedItemIds || [];
        const progressArcId = extraction.arcChecklistProgress?.arcId || activeArc?.id || null;
        if (progressArcId && completedItemIds.length) {
          mergedLedger = mergedLedger.map(a => {
            if (a.id !== progressArcId) return a;
            const checklist = (a.checklist || []).map(item => {
              if (!completedItemIds.includes(item.id)) return item;
              if (item.completed) return item;
              return { ...item, completed: true, completedAt: now, sourceChapterNumber: newChapter.number };
            });
            return { ...a, checklist };
          });
          localAddLog(`Arc Progress: advanced ${completedItemIds.length} element(s).`, 'update');
        }

        if (extraction.arcChecklistProgress?.notes) {
          localAddLog(`Arc Notes: ${extraction.arcChecklistProgress.notes}`, 'discovery');
        }

        // Update the chapter with extracted scenes if any were created
        const updatedChapter: Chapter = extractedScenes.length > 0
          ? { ...newChapter, scenes: extractedScenes }
          : newChapter;

        // Update workingNovelState with merged data AND updated chapter
        const updatedChapters = workingNovelState.chapters.map(c =>
          c.id === newChapter.id ? updatedChapter : c
        );

        // #region agent log
        const finalItemPossessionsCount = mergedCharacters.reduce((sum, char) => sum + (char.itemPossessions?.filter(p => p.status === 'active').length || 0), 0);
        const finalTechniqueMasteriesCount = mergedCharacters.reduce((sum, char) => sum + (char.techniqueMasteries?.filter(m => m.status === 'active').length || 0), 0);
        const charactersWithItems = mergedCharacters.filter(c => (c.itemPossessions || []).length > 0).map(c => ({ name: c.name, itemCount: c.itemPossessions?.length || 0, itemPossessions: c.itemPossessions }));
        const charactersWithTechniques = mergedCharacters.filter(c => (c.techniqueMasteries || []).length > 0).map(c => ({ name: c.name, techniqueCount: c.techniqueMasteries?.length || 0, techniqueMasteries: c.techniqueMasteries }));
        console.log('[DEBUG] Before state update - final counts', {
          finalItemPossessionsCount,
          finalTechniqueMasteriesCount,
          characterCount: mergedCharacters.length,
          charactersWithItems,
          charactersWithTechniques,
          alexData: mergedCharacters.find(c => c.name === 'ALEX')?.itemPossessions,
          meiLinData: mergedCharacters.find(c => c.name === 'MEI LIN')?.itemPossessions,
          zhaoData: mergedCharacters.find(c => c.name === 'ZHAO')?.itemPossessions
        });
        // #endregion

        // Debug: Verify mergedCharacters before assigning to workingNovelState
        logger.debug('Before workingNovelState update', 'chapterGeneration', {
          chapterId: newChapter.id,
          mergedCharactersCount: mergedCharacters.length,
          sampleCharacters: mergedCharacters.slice(0, 2).map(c => ({
            name: c.name,
            cultivation: c.currentCultivation,
            hasAppearance: !!c.appearance,
            hasBackground: !!c.background,
            hasGoals: !!c.goals,
            hasFlaws: !!c.flaws
          }))
        });

        workingNovelState = {
          ...workingNovelState,
          chapters: updatedChapters,
          characterCodex: mergedCharacters,
          worldBible: mergedWorldBible,
          territories: mergedTerritories,
          novelItems: mergedNovelItems,
          novelTechniques: mergedNovelTechniques,
          antagonists: mergedAntagonists,
          storyThreads: mergedThreads,
          plotLedger: mergedLedger,
          updatedAt: now,
        };

        // Debug: Verify workingNovelState.characterCodex after assignment
        logger.debug('After workingNovelState update', 'chapterGeneration', {
          chapterId: newChapter.id,
          characterCodexCount: workingNovelState.characterCodex.length,
          matchesMerged: workingNovelState.characterCodex.length === mergedCharacters.length
        });

        // Final summary log
        const totalRelationships = mergedCharacters.reduce((sum, char) => sum + (char.relationships?.length || 0), 0);
        const totalItemPossessions = mergedCharacters.reduce((sum, char) => sum + (char.itemPossessions?.length || 0), 0);
        const totalTechniqueMasteries = mergedCharacters.reduce((sum, char) => sum + (char.techniqueMasteries?.length || 0), 0);
        logger.info('Chapter processing complete - final summary', 'chapterGeneration', {
          chapterId: newChapter.id,
          chapterNumber: newChapter.number,
          totalCharacters: mergedCharacters.length,
          totalRelationships: totalRelationships,
          totalItemPossessions: totalItemPossessions,
          totalTechniqueMasteries: totalTechniqueMasteries,
          totalItems: mergedNovelItems.length,
          totalTechniques: mergedNovelTechniques.length,
          totalAntagonists: mergedAntagonists.length,
          totalScenes: extractedScenes.length,
        });
        localAddLog(`✅ Codex updated: ${mergedCharacters.length} character(s), ${totalRelationships} relationship(s), ${totalItemPossessions} item possession(s), ${totalTechniqueMasteries} technique mastery(ies)`, 'discovery');

        // Mark entities with chapter references for rollback tracking
        if (snapshotCaptured) {
          try {
            markEntitiesWithChapter(
              newChapter.id,
              newChapter.number,
              extraction,
              workingNovelState
            );

            // Track arc checklist completions
            trackArcChecklistCompletions(
              newChapter.id,
              newChapter.number,
              extraction,
              workingNovelState
            );

            // Check for realm changes
            const newRealmId = workingNovelState.currentRealmId;
            const realmCreated = extraction.worldEntryUpserts?.some(w => w.isNewRealm) || false;
            if (realmCreated && newRealmId && newRealmId !== oldRealmId) {
              trackRealmChanges(
                newChapter.id,
                newChapter.number,
                oldRealmId,
                newRealmId,
                true
              );
            }

            logger.info('Entities marked with chapter references', 'chapterGeneration', {
              chapterId: newChapter.id,
              chapterNumber: newChapter.number,
            });
          } catch (trackingError) {
            logger.error('Failed to mark entities with chapter references', 'chapterGeneration', {
              chapterId: newChapter.id,
              error: trackingError instanceof Error ? trackingError : new Error(String(trackingError)),
            });
            // Don't fail generation if tracking fails - non-critical
          }
        }

        // Chapter appearances will be saved after the novel (including antagonists and chapters) is saved to the database
        // This ensures both the antagonist and chapter exist before creating the relationship
        // The antagonistChapterAppearances array is stored for later saving

        // Run archive detection after processing items/techniques
        try {
          // Collect all character possessions and masteries for archive detection
          const allPossessions: CharacterItemPossession[] = [];
          const allMasteries: CharacterTechniqueMastery[] = [];

          mergedCharacters.forEach(char => {
            if (char.itemPossessions) {
              allPossessions.push(...char.itemPossessions);
            }
            if (char.techniqueMasteries) {
              allMasteries.push(...char.techniqueMasteries);
            }
          });

          const archiveResult = detectArchiveCandidates(
            mergedNovelItems,
            mergedNovelTechniques,
            allPossessions,
            allMasteries,
            newChapter.number,
            10 // 10 chapter threshold
          );

          // Add archive suggestions as system logs
          if (archiveResult.logs.length > 0) {
            archiveResult.logs.forEach(log => {
              localAddLog(log.message, log.type);
            });
          }
        } catch (archiveError) {
          logger.warn('Archive detection failed', 'archive', {
            error: archiveError instanceof Error ? archiveError.message : String(archiveError)
          });
          // Don't fail the whole chapter processing if archive detection fails
        }

        // AUTO-CONNECTION AND TRUST ANALYSIS
        try {
          // 1. Generate extraction preview for trust building
          const extractionPreview = generateExtractionPreview(
            extraction,
            {
              characters: mergedCharacters,
              items: mergedNovelItems,
              techniques: mergedNovelTechniques,
              antagonists: mergedAntagonists,
              arcs: workingNovelState.plotLedger
            },
            workingNovelState,
            updatedChapter,
            extractedScenes
          );

          // 2. Calculate trust score
          const trustScore = calculateTrustScore(extractionPreview);

          // 3. Analyze auto-connections
          const connectionAnalysis = analyzeAutoConnections(
            workingNovelState,
            updatedChapter,
            extractedScenes,
            mergedNovelItems.filter(i => extraction.itemUpdates?.some(item => normalize(String(item.name || '')) === normalize(i.name))),
            mergedNovelTechniques.filter(t => extraction.techniqueUpdates?.some(tech => normalize(String(tech.name || '')) === normalize(t.name)))
          );

          // 4. Apply high-confidence auto-connections
          const highConfidenceConnections = connectionAnalysis.connections.filter(c => c.confidence >= 0.8);

          if (highConfidenceConnections.length > 0) {
            localAddLog(`✨ Auto-connected ${highConfidenceConnections.length} entity(ies) with high confidence`, 'update');

            // Log connection details
            highConfidenceConnections.slice(0, 5).forEach(conn => {
              localAddLog(`  • ${conn.sourceName} → ${conn.targetName} (${conn.type.replace(/-/g, ' ')})`, 'discovery');
            });
          }

          // 5. Log trust score summary
          if (trustScore.overall >= 80) {
            localAddLog(`✅ High trust score: ${trustScore.overall}/100 - All extractions are reliable`, 'update');
          } else if (trustScore.overall >= 60) {
            localAddLog(`⚠️ Moderate trust score: ${trustScore.overall}/100 - Some extractions need review`, 'update');
          } else {
            localAddLog(`⚠️ Low trust score: ${trustScore.overall}/100 - Review extractions carefully`, 'update');
          }

          // 7. Add suggestions to logs
          if (extractionPreview.suggestions.length > 0) {
            extractionPreview.suggestions.slice(0, 3).forEach(suggestion => {
              localAddLog(`💡 ${suggestion}`, 'update');
            });
          }

          // 8. Log warnings
          if (extractionPreview.warnings.length > 0) {
            extractionPreview.warnings.slice(0, 3).forEach(warning => {
              localAddLog(`⚠️ ${warning}`, 'update');
            });
          }
        } catch (automationError) {
          logger.warn('Automation analysis failed', 'App', {
            error: automationError instanceof Error ? automationError.message : String(automationError)
          });
          // Don't fail the whole chapter processing if automation analysis fails
        }

        // ENHANCED CONSISTENCY CHECKING
        try {
          // Enhanced: Post-generation consistency check with knowledge graph
          const { getPostGenerationConsistencyChecker } = await import('./services/postGenerationConsistencyChecker');
          const extraction = await extractPostChapterUpdates(workingNovelState, newChapter, activeArc);
          const postChecker = getPostGenerationConsistencyChecker();
          const consistencyReport = postChecker.checkConsistency(workingNovelState, newChapter, extraction);

          if (!consistencyReport.valid) {
            const criticalIssues = consistencyReport.issues.filter(i => i.severity === 'critical');
            const warningIssues = consistencyReport.issues.filter(i => i.severity === 'warning');

            if (criticalIssues.length > 0) {
              localAddLog(`🔴 ${criticalIssues.length} critical consistency issue(s) detected`, 'update');
              criticalIssues.slice(0, 2).forEach(issue => {
                localAddLog(`  • ${issue.message}`, 'update');
              });
            }

            if (warningIssues.length > 0) {
              localAddLog(`⚠️ ${warningIssues.length} consistency warning(s)`, 'update');
              warningIssues.slice(0, 2).forEach(issue => {
                localAddLog(`  • ${issue.message}`, 'update');
              });
            }
          } else {
            localAddLog(`✅ Chapter consistency check passed (Score: ${consistencyReport.summary.overallScore}/100)`, 'discovery');
          }

          // Also run standard chapter consistency check
          const chapterConsistencyIssues = checkChapterConsistency(
            workingNovelState,
            newChapter.number
          );

          if (chapterConsistencyIssues.length > 0) {
            const criticalIssues = chapterConsistencyIssues.filter(i => i.severity === 'critical');
            const warningIssues = chapterConsistencyIssues.filter(i => i.severity === 'warning');

            if (criticalIssues.length > 0) {
              localAddLog(`🔴 ${criticalIssues.length} critical consistency issue(s) detected`, 'update');
              criticalIssues.slice(0, 2).forEach(issue => {
                localAddLog(`  • ${issue.message}`, 'update');
              });
            }

            if (warningIssues.length > 0) {
              localAddLog(`⚠️ ${warningIssues.length} consistency warning(s)`, 'update');
              warningIssues.slice(0, 2).forEach(issue => {
                localAddLog(`  • ${issue.message}`, 'update');
              });
            }
          } else {
            localAddLog(`✅ Chapter consistency check passed`, 'discovery');
          }

          // Enhanced: Run consistency check with knowledge graph
          try {
            const { checkConsistency } = await import('./services/consistencyChecker');
            const fullConsistencyReport = checkConsistency(workingNovelState);

            if (fullConsistencyReport.summary.overallScore >= 90) {
              localAddLog(`✅ Excellent consistency score: ${fullConsistencyReport.summary.overallScore}/100`, 'discovery');
            } else if (fullConsistencyReport.summary.overallScore >= 75) {
              localAddLog(`⚠️ Consistency score: ${fullConsistencyReport.summary.overallScore}/100 - ${fullConsistencyReport.summary.warnings} warning(s)`, 'update');
            } else {
              localAddLog(`🔴 Consistency score: ${fullConsistencyReport.summary.overallScore}/100 - ${fullConsistencyReport.summary.critical} critical, ${fullConsistencyReport.summary.warnings} warning(s)`, 'update');
            }

            if (fullConsistencyReport.recommendations.length > 0) {
              fullConsistencyReport.recommendations.slice(0, 2).forEach(rec => {
                localAddLog(`💡 ${rec}`, 'update');
              });
            }

            // Run full consistency check periodically (every 5 chapters)
            if (newChapter.number % 5 === 0 && fullConsistencyReport.summary.critical > 0) {
              localAddLog(`🔍 Full consistency audit: ${fullConsistencyReport.summary.total} issue(s) found`, 'update');
            }
          } catch (consistencyError) {
            logger.warn('Consistency check failed', 'chapterProcessing', {
              error: consistencyError instanceof Error ? consistencyError.message : String(consistencyError)
            });
          }
        } catch (consistencyError) {
          logger.warn('Consistency check failed', 'chapterProcessing', {
            error: consistencyError instanceof Error ? consistencyError.message : String(consistencyError)
          });
          // Don't fail the whole chapter processing if consistency check fails
        }
      } catch (extractionError) {
        logger.warn('Post-chapter extraction failed', 'App', {
          error: extractionError instanceof Error ? extractionError.message : String(extractionError)
        });
        addEphemeralLog('Post-chapter update failed; chapter saved without extra auto-updates.', 'update');
      }

      let finalNovelState: NovelState = {
        ...workingNovelState,
        systemLogs: [...activeNovel.systemLogs, ...newLogs],
        updatedAt: Date.now(),
      };

      // Debug: Verify finalNovelState includes updated characterCodex
      logger.debug('Final novel state created', 'chapterGeneration', {
        chapterId: newChapter.id,
        characterCodexCount: finalNovelState.characterCodex.length,
        workingNovelStateCharacterCount: workingNovelState.characterCodex.length,
        matches: finalNovelState.characterCodex.length === workingNovelState.characterCodex.length,
        sampleCharacter: finalNovelState.characterCodex[0] ? {
          name: finalNovelState.characterCodex[0].name,
          cultivation: finalNovelState.characterCodex[0].currentCultivation
        } : null
      });

      // #region agent log
      console.log('[DEBUG] Final Novel State Before Update]', {
        characterCodexCount: finalNovelState.characterCodex.length,
        alexItemPossessions: finalNovelState.characterCodex.find(c => c.name === 'ALEX')?.itemPossessions?.length || 0,
        alexTechniqueMasteries: finalNovelState.characterCodex.find(c => c.name === 'ALEX')?.techniqueMasteries?.length || 0,
        meiLinItemPossessions: finalNovelState.characterCodex.find(c => c.name === 'MEI LIN')?.itemPossessions?.length || 0,
        meiLinTechniqueMasteries: finalNovelState.characterCodex.find(c => c.name === 'MEI LIN')?.techniqueMasteries?.length || 0,
        zhaoItemPossessions: finalNovelState.characterCodex.find(c => c.name === 'ZHAO')?.itemPossessions?.length || 0,
        zhaoTechniqueMasteries: finalNovelState.characterCodex.find(c => c.name === 'ZHAO')?.techniqueMasteries?.length || 0,
        totalItemPossessions: finalNovelState.characterCodex.reduce((sum, c) => sum + (c.itemPossessions?.length || 0), 0),
        totalTechniqueMasteries: finalNovelState.characterCodex.reduce((sum, c) => sum + (c.techniqueMasteries?.length || 0), 0)
      });
      // #endregion

      // Update foreshadowing and symbolism elements after chapter generation
      try {
        const foreshadowingAnalysis = arcAnalyzer.analyzeForeshadowing(finalNovelState);
        const symbolismAnalysis = arcAnalyzer.analyzeSymbolism(finalNovelState);
        const emotionalPayoffAnalysis = arcAnalyzer.analyzeEmotionalPayoffs(finalNovelState);

        // Merge newly detected elements with existing ones (avoid duplicates)
        const existingForeshadowing = finalNovelState.foreshadowingElements || [];
        const existingSymbolism = finalNovelState.symbolicElements || [];
        const existingEmotionalPayoffs = finalNovelState.emotionalPayoffs || [];

        // Add new foreshadowing elements that don't already exist
        const newForeshadowing = foreshadowingAnalysis.activeForeshadowing.filter(newEl => {
          return !existingForeshadowing.some(existing =>
            existing.type === newEl.type &&
            existing.introducedChapter === newEl.introducedChapter &&
            existing.content.substring(0, 100) === newEl.content.substring(0, 100)
          );
        });

        // Add new symbolic elements that don't already exist
        const newSymbolism = symbolismAnalysis.symbolicElements.filter((newSym: SymbolicElement) => {
          return !existingSymbolism.some(existing =>
            existing.name.toLowerCase() === newSym.name.toLowerCase() &&
            existing.firstAppearedChapter === newSym.firstAppearedChapter
          );
        });

        // Add new emotional payoffs that don't already exist
        const newEmotionalPayoffs = emotionalPayoffAnalysis.recentPayoffs.filter(newPayoff => {
          return !existingEmotionalPayoffs.some(existing =>
            existing.type === newPayoff.type &&
            existing.chapterNumber === newPayoff.chapterNumber &&
            existing.description.substring(0, 100) === newPayoff.description.substring(0, 100)
          );
        });

        // Update final state with new elements (limit to prevent bloat - keep last 50 of each type)
        finalNovelState = {
          ...finalNovelState,
          foreshadowingElements: [...existingForeshadowing, ...newForeshadowing].slice(-50),
          symbolicElements: [...existingSymbolism, ...newSymbolism].slice(-50),
          emotionalPayoffs: [...existingEmotionalPayoffs, ...newEmotionalPayoffs].slice(-50),
        };
      } catch (error) {
        logger.warn('Error updating narrative elements (foreshadowing/symbolism/emotional payoffs)', 'novel', {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue even if this fails - these are enhancements, not critical
      }

      // Explicitly save the novel state to DB to ensure all new entities (Story Threads, etc) exist
      // This prevents foreign key constraint errors when saving dependent events in the next step
      try {
        const { saveNovel } = await import('./services/supabaseService');
        await saveNovel(finalNovelState);
        logger.info('Novel saved explicitly during generation to ensure entity existence', 'App');
      } catch (saveError) {
        logger.warn('Explicit novel save failed (will rely on context update save)', 'App', {
          error: saveError instanceof Error ? saveError.message : String(saveError)
        });
      }

      updateActiveNovel(() => finalNovelState);

      setActiveLogs(newLogs);
      // Use updatedChapter if scenes were added, otherwise use newChapter
      setActiveChapterId(workingNovelState.chapters.find(c => c.id === newChapter.id)?.id || newChapter.id);
      setView('editor');

      // No auto-clear - logs are now permanently stored in NotificationPanel

      // Save antagonist chapter appearances after novel is saved to database
      // Wait a bit for the novel save to complete, then retry if needed
      // Capture the chapter appearances and chapter ID for the async function
      const chapterAppearancesToSave = antagonistChapterAppearances;
      const chapterIdToSave = newChapter.id;
      if (chapterIdToSave && chapterAppearancesToSave.length > 0) {
        // Wait for novel to be saved, then save chapter appearances
        // The novel is saved asynchronously by NovelContext after updateActiveNovel
        // We'll retry with exponential backoff to handle the delay
        // Increased initial wait and retry count to ensure saveNovel completes
        const saveChapterAppearances = async (retries = 8, initialDelay = 5000) => {
          for (let i = 0; i < retries; i++) {
            try {
              // Exponential backoff: 2s, 3s, 4s, 5s, 6s, 7s, 8s, 9s
              await new Promise(resolve => setTimeout(resolve, initialDelay + (i * 1000)));

              const results = await Promise.allSettled(
                chapterAppearancesToSave.map((appearance: {
                  antagonistId: string;
                  presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence';
                  significance: 'major' | 'minor' | 'foreshadowing';
                  notes: string;
                }) =>
                  addAntagonistToChapter(
                    appearance.antagonistId,
                    chapterIdToSave,
                    appearance.presenceType,
                    appearance.significance,
                    appearance.notes
                  ).catch(err => {
                    // Silently handle "does not exist yet" errors - data will be saved via saveNovel
                    const errorMsg = err?.message || String(err);
                    if (errorMsg.includes('does not exist in database yet') ||
                      errorMsg.includes('Cannot create relationship until')) {
                      // Expected error - antagonist/chapter will be saved via saveNovel
                      // Return a resolved promise so Promise.allSettled doesn't mark it as rejected
                      return Promise.resolve(null);
                    }
                    // Re-throw unexpected errors
                    throw err;
                  })
                )
              );

              const successful = results.filter((r: PromiseSettledResult<any>) =>
                r.status === 'fulfilled' && r.value !== null
              ).length;
              const failed = results.filter((r: PromiseSettledResult<any>) =>
                r.status === 'rejected' || (r.status === 'fulfilled' && r.value === null)
              ).length;

              if (successful > 0) {
                localAddLog(`Saved ${successful} antagonist appearance(s) in this chapter`, 'update');
              }

              // If all succeeded or we're on the last retry, stop
              // Note: "failed" here includes expected "does not exist yet" cases
              // Those will be saved when saveNovel runs (via antagonist.arcAssociations)
              if (failed === 0 || i === retries - 1) {
                // Only log if there were actual unexpected failures
                // Expected "does not exist yet" errors are handled silently
                break;
              }
            } catch (err) {
              // Only log unexpected errors on the last retry
              if (i === retries - 1) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                // Skip logging for expected "does not exist yet" errors
                if (!errorMsg.includes('does not exist in database yet') &&
                  !errorMsg.includes('Cannot create relationship until')) {
                  logger.debug('Error saving antagonist chapter appearances after retries', 'App', {
                    error: err instanceof Error ? err.message : String(err)
                  });
                }
              }
            }
          }
        };

        // Start saving chapter appearances asynchronously (don't block)
        // Silently handle errors - data will be saved via saveNovel if direct save fails
        saveChapterAppearances().catch(() => {
          // Errors are already handled in the retry loop
          // Data will be saved when saveNovel runs (relationships/arcAssociations are in antagonist object)
        });
      }

      // Save thread progression events after chapter is saved to database
      // This prevents foreign key constraint errors (chapter must exist first)
      const threadEventsToSave = pendingThreadProgressionEvents;
      if (chapterIdToSave && threadEventsToSave.length > 0) {
        const saveThreadProgressionEvents = async (retries = 8, initialDelay = 5000) => {
          for (let i = 0; i < retries; i++) {
            try {
              // Exponential backoff: 2s, 3s, 4s, 5s, 6s, 7s, 8s, 9s
              await new Promise(resolve => setTimeout(resolve, initialDelay + (i * 1000)));

              const { saveThreadProgressionEvent } = await import('./services/threadService');

              const results = await Promise.allSettled(
                threadEventsToSave.map(event =>
                  saveThreadProgressionEvent(event).catch(err => {
                    // Handle foreign key constraint errors - chapter may not exist yet
                    const errorMsg = err?.message || String(err);
                    if (errorMsg.includes('foreign key constraint') ||
                      errorMsg.includes('23503') ||
                      errorMsg.includes('Key is not present')) {
                      // Expected error - chapter will be saved via saveNovel, retry later
                      throw err; // Re-throw to trigger retry
                    }
                    // For other errors, log and continue
                    console.warn('Unexpected error saving thread progression event:', errorMsg);
                    return Promise.resolve(null);
                  })
                )
              );

              const successful = results.filter((r: PromiseSettledResult<any>) =>
                r.status === 'fulfilled' && r.value !== null
              ).length;
              const failed = results.filter((r: PromiseSettledResult<any>) =>
                r.status === 'rejected'
              ).length;

              if (successful > 0) {
                localAddLog(`Saved ${successful} thread progression event(s)`, 'update');
              }

              // If all succeeded or we're on the last retry, stop
              if (failed === 0) {
                break;
              }

              // If still failing on last retry, log but don't crash
              if (i === retries - 1 && failed > 0) {
                console.warn(`Failed to save ${failed} thread progression event(s) after ${retries} retries`);
              }
            } catch (err) {
              // Only log on the last retry
              if (i === retries - 1) {
                console.warn('Error saving thread progression events after retries:', err);
              }
            }
          }
        };

        // Start saving thread progression events asynchronously (don't block)
        saveThreadProgressionEvents().catch(err => {
          console.warn('Thread progression events save failed:', err);
        });
      }

      // NEW: Extract karma events after novel is saved to database
      try {
        const faceConfig = await getFaceGraphConfig(activeNovel.id);
        if (faceConfig.enabled && faceConfig.autoExtractKarma) {
          const chapterForKarma = newChapter;
          const novelStateForKarma = workingNovelState;

          const extractKarmaWithRetry = async (retries = 8, initialDelay = 3000) => {
            logger.info('Initiating background karma extraction', 'faceGraph', {
              chapterNumber: chapterForKarma.number,
              chapterId: chapterForKarma.id
            });

            for (let i = 0; i < retries; i++) {
              try {
                // Wait for chapter record to potentially exist in DB
                await new Promise(resolve => setTimeout(resolve, initialDelay + (i * 1000)));

                // Extract and save karma events
                const karmaEvents = await extractKarmaFromChapter(novelStateForKarma, chapterForKarma, {
                  minSeverity: 'moderate'
                });

                if (karmaEvents && karmaEvents.length > 0) {
                  localAddLog(`Justice Recorded: ${karmaEvents.length} karma event(s) extracted from Chapter ${chapterForKarma.number}`, 'fate');
                  logger.info('Karma events extracted and saved successfully', 'faceGraph', {
                    eventCount: karmaEvents.length,
                    chapter: chapterForKarma.number
                  });
                  break; // Success!
                } else {
                  logger.debug('No karma events found in chapter', 'faceGraph', { chapter: chapterForKarma.number });
                  break; // No events found, also a success state for the process
                }
              } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                if (errorMsg.includes('violates foreign key constraint "karma_events_chapter_id_fkey"') ||
                  errorMsg.includes('23503') ||
                  errorMsg.includes('Key is not present')) {
                  logger.debug(`Retry ${i + 1}: Chapter ${chapterForKarma.number} not found in DB yet for karma recording. Retrying...`, 'faceGraph');
                  continue; // Retry
                } else {
                  logger.warn(`Unexpected error during karma extraction (Retry ${i + 1})`, 'faceGraph', { error: errorMsg });
                  // Still retry a few times then give up
                  if (i === retries - 1) break;
                }
              }
            }
          };
          void extractKarmaWithRetry();
        }
      } catch (karmaInitError) {
        logger.warn('Failed to initiate karma extraction', 'faceGraph', {
          error: karmaInitError instanceof Error ? karmaInitError.message : String(karmaInitError)
        });
      }

      // Stop showing "Generating..." as soon as content is applied to the UI.
      if (activeGenerationIdRef.current === generationId) {
        setIsGenerating(false);
        activeGenerationIdRef.current = null;
      }

      // Trigger editor review every 5 chapters
      if (shouldTriggerEditorReview(finalNovelState.chapters.length)) {
        try {
          startLoading(`Editor analyzing chapters ${finalNovelState.chapters.length - 4}-${finalNovelState.chapters.length}...`, true);
          addEphemeralLog(`Editor analyzing chapters ${finalNovelState.chapters.length - 4}-${finalNovelState.chapters.length}...`, 'discovery');
          const editorReport = await triggerEditorReview(finalNovelState, 'chapter_batch', undefined, {
            onProgress: (phase: string, progress?: number) => {
              if (progress !== undefined) {
                updateProgress(progress, `Editor: ${phase}`);
                setGenerationProgress(progress);
                setGenerationStatus(`Editor: ${phase}`);
              } else {
                updateMessage(`Editor: ${phase}`);
              }
              addEphemeralLog(`Editor: ${phase}`, 'discovery');
            },
            onAutoFix: (fix: EditorFix) => {
              addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
            },
          });

          if (editorReport) {
            // Save the report
            await saveEditorReport(editorReport);
            stopLoading();

            // Show notification
            if (editorReport.autoFixedCount > 0) {
              showSuccess(`Editor fixed ${editorReport.autoFixedCount} issue(s) automatically`);
            }
            if (editorReport.pendingFixCount > 0) {
              showWarning(`Editor found ${editorReport.pendingFixCount} issue(s) requiring review`);
              // TODO: Show approval dialog for pending fixes
            }

            // Update novel with fixed chapters if any auto-fixes were applied
            const editorReportWithInternal = editorReport as EditorReportWithInternal;
            if (editorReportWithInternal && editorReportWithInternal._updatedChapters && editorReportWithInternal._updatedChapters.length > 0) {
              const updatedChapters = editorReportWithInternal._updatedChapters;

              // Log what's being updated
              logger.debug('Applying auto-fixes to chapters', 'App', {
                chapterCount: updatedChapters.length,
                chapterNumbers: updatedChapters.map(ch => ch.number)
              });

              // Update novel state with fixed chapters and save to database
              updateActiveNovel(prev => {
                const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
                const updatedNovel = {
                  ...prev,
                  chapters: prev.chapters.map(ch => {
                    const updated = updatedChapterMap.get(ch.id);
                    if (updated && updated.content !== ch.content) {
                      logger.debug('Updating chapter content', 'App', {
                        chapterNumber: ch.number,
                        oldLength: ch.content.length,
                        newLength: updated.content.length
                      });
                      return updated;
                    }
                    return ch;
                  }),
                  updatedAt: Date.now(),
                };

                // Save to database asynchronously (don't await to avoid blocking)
                import('./services/supabaseService').then(({ saveNovel }) => {
                  saveNovel(updatedNovel).then(() => {
                    logger.info('Successfully saved chapters after auto-fixes', 'App', {
                      chapterCount: updatedChapters.length
                    });
                  }).catch(err => {
                    logger.error('Failed to save fixed chapters', 'App', err instanceof Error ? err : new Error(String(err)));
                    showError('Editor applied fixes but failed to save to database. Please save manually.');
                  });
                });

                return updatedNovel;
              });

              addEphemeralLog(`Updated ${updatedChapters.length} chapter(s) with auto-fixes. Saving to database...`, 'update');
            }

            // Check if there are fix proposals requiring approval
            const fixProposals = editorReportWithInternal._fixProposals || [];
            if (fixProposals.length > 0) {
              setPendingFixProposals(fixProposals);
              setCurrentEditorReport(editorReport);
              setIsGenerating(false);
              stopLoading();
            } else {
              setIsGenerating(false);
              stopLoading();
              addEphemeralLog(`Editor review complete: ${editorReport.analysis.issues.length} issue(s) found`, 'discovery');
            }
          }
        } catch (editorError) {
          logger.error('Error in editor review', 'chapterGeneration', editorError instanceof Error ? editorError : new Error(String(editorError)));
          stopLoading();
          // Don't block chapter generation if editor fails
          addEphemeralLog('Editor review failed - chapter saved successfully', 'update');
        }
      }

    } catch (e) {
      logger.error('Error generating chapter', 'App', e instanceof Error ? e : new Error(String(e)));
      const errorMessage = e instanceof Error ? e.message : String(e);
      showError(
        `Dao failure! Connection severed.\n\nError: ${errorMessage}\n\nPlease check:\n1. Your DEEPSEEK_API_KEY is set in .env.local\n2. Your internet connection\n3. Browser console for more details (F12)`
      );
    } finally {
      // Only end "generating" if this is still the active request (cancel may have already flipped it).
      if (activeGenerationIdRef.current === generationId) {
        setIsGenerating(false);
        activeGenerationIdRef.current = null;
      }
      setInstruction('');
    }
  };

  // Tribulation Gate handlers
  const handleTribulationGateSelect = useCallback(async (pathId: string) => {
    if (!currentTribulationGate || !activeNovel) return;

    setTribulationGateLoading(true);

    try {
      // Resolve the gate with the user's choice
      const resolvedGate = resolveGate(currentTribulationGate.id, pathId);

      if (!resolvedGate) {
        showError('Failed to save your choice. Please try again.');
        setTribulationGateLoading(false);
        return;
      }

      const selectedPath = currentTribulationGate.fatePaths.find(p => p.id === pathId);
      if (selectedPath) {
        addEphemeralLog(`⚡ Fate chosen: ${selectedPath.label}`, 'fate');
        showSuccess(`You have chosen: ${selectedPath.label}`);
      }

      // Close the modal
      setShowTribulationGate(false);
      setCurrentTribulationGate(null);
      setTribulationGateLoading(false);

      // Get the saved instruction
      const savedInstruction = pendingGenerationInstructionRef.current;
      pendingGenerationInstructionRef.current = '';

      // Build the fate instruction to inject into the chapter generation
      const fateInstruction = selectedPath
        ? `${savedInstruction}\n\n╔══════════════════════════════════════════════════════════════════╗
║  FATE DECISION: ${currentTribulationGate.triggerType.toUpperCase().replace(/_/g, ' ')}
╚══════════════════════════════════════════════════════════════════╝

The reader has chosen the protagonist's fate at this critical moment.

SITUATION: ${currentTribulationGate.situation}

CHOSEN PATH: ${selectedPath.label}
${selectedPath.description}

EXPECTED CONSEQUENCES:
${selectedPath.consequences.map(c => `• ${c}`).join('\n')}

EMOTIONAL TONE: ${selectedPath.emotionalTone}
RISK LEVEL: ${selectedPath.riskLevel}

CRITICAL INSTRUCTION: The chapter MUST follow this chosen path. Do not deviate from
the reader's choice. The consequences should begin to manifest in this chapter.
══════════════════════════════════════════════════════════════════════`
        : savedInstruction;

      // Resume chapter generation - the handleGenerateNext function will handle everything
      // We use a small delay to ensure state updates have propagated
      setTimeout(() => {
        handleGenerateNext(fateInstruction);
      }, 100);

    } catch (error) {
      logger.error('Error in Tribulation Gate selection', 'tribulationGate',
        error instanceof Error ? error : undefined);
      showError('An error occurred while processing your choice.');
      setTribulationGateLoading(false);
    }
  }, [currentTribulationGate, activeNovel, showError, showSuccess, addEphemeralLog, handleGenerateNext]);

  const handleTribulationGateSkip = useCallback(() => {
    if (!currentTribulationGate) return;

    // Skip the gate
    skipGate(currentTribulationGate.id, 'User chose to skip');

    addEphemeralLog('⚡ Tribulation Gate skipped. The AI will decide your fate...', 'fate');

    // Close modal
    setShowTribulationGate(false);
    setCurrentTribulationGate(null);

    const savedInstruction = pendingGenerationInstructionRef.current;
    pendingGenerationInstructionRef.current = '';

    // Resume generation without the gate choice - use setTimeout to ensure state updates
    setTimeout(() => {
      handleGenerateNext(savedInstruction);
    }, 100);
  }, [currentTribulationGate, addEphemeralLog, handleGenerateNext]);

  const handleTribulationGateLetFateDecide = useCallback(() => {
    if (!currentTribulationGate || currentTribulationGate.fatePaths.length === 0) return;

    // Randomly select a path
    const randomIndex = Math.floor(Math.random() * currentTribulationGate.fatePaths.length);
    const randomPath = currentTribulationGate.fatePaths[randomIndex];

    addEphemeralLog(`🎲 Fate has decided: ${randomPath.label}`, 'fate');

    // Process as if user selected this path
    handleTribulationGateSelect(randomPath.id);
  }, [currentTribulationGate, addEphemeralLog, handleTribulationGateSelect]);

  // Manual Tribulation Gate trigger handler
  const handleManualGateTrigger = useCallback(async (
    triggerType: TribulationTrigger,
    protagonistName: string,
    customSituation?: string
  ) => {
    if (!activeNovel) return;

    setManualGateLoading(true);

    try {
      const nextChapterNumber = activeNovel.chapters.length + 1;

      const gate = await createManualGate(
        activeNovel.id,
        nextChapterNumber,
        triggerType,
        protagonistName,
        customSituation
      );

      if (gate) {
        setCurrentTribulationGate(gate);
        setShowManualGateDialog(false);
        setShowTribulationGate(true);
        addEphemeralLog(`⚡ Manual Tribulation Gate summoned: ${triggerType}`, 'fate');
        showSuccess('Tribulation Gate has been summoned!');
      } else {
        showError('Failed to create Tribulation Gate. Please try again.');
      }
    } catch (error) {
      logger.error('Error creating manual gate', 'tribulationGate',
        error instanceof Error ? error : undefined);
      showError('An error occurred while summoning the gate.');
    } finally {
      setManualGateLoading(false);
    }
  }, [activeNovel, addEphemeralLog, showSuccess, showError]);

  // What If replay handler - generates alternate chapter based on different choice
  const handleWhatIfReplay = useCallback(async (
    gate: TribulationGate,
    alternatePathId: string
  ) => {
    if (!activeNovel) return;

    setWhatIfLoading(true);

    try {
      const alternatePath = gate.fatePaths.find(p => p.id === alternatePathId);
      if (!alternatePath) {
        showError('Selected path not found.');
        return;
      }

      addEphemeralLog(`🔮 Exploring alternate timeline: ${alternatePath.label}`, 'fate');

      // Get the original chapter content for context
      const originalChapter = activeNovel.chapters.find(c => c.number === gate.chapterNumber);

      // Build the What If prompt injection
      const whatIfPrompt = buildWhatIfPromptInjection(
        gate,
        alternatePathId,
        originalChapter?.content
      );

      // Generate alternate chapter using a simplified approach
      // This calls the AI directly with the What If context
      const result = await generateNextChapter(
        {
          ...activeNovel,
          // Temporarily adjust chapters to be "before" this gate
          chapters: activeNovel.chapters.filter(c => c.number < gate.chapterNumber),
        },
        whatIfPrompt,
        {
          skipTribulationGate: true, // Don't trigger another gate
          onPhase: (phase, data) => {
            if (phase === 'llm_request_start') {
              setGenerationStatus('Weaving alternate timeline...');
            }
            if (phase === 'llm_request_end') {
              setGenerationStatus('Alternate reality formed...');
            }
          },
        }
      );

      if (result && result.chapterContent && !result.requiresUserChoice) {
        // Save the What If chapter
        const whatIfChapter: WhatIfChapter = {
          id: generateUUID(),
          gateId: gate.id,
          novelId: activeNovel.id,
          originalChapterNumber: gate.chapterNumber,
          alternatePathId,
          alternatePathLabel: alternatePath.label,
          content: result.chapterContent,
          title: result.chapterTitle || `What If: ${alternatePath.label}`,
          summary: result.chapterSummary,
          createdAt: Date.now(),
        };

        saveWhatIfChapter(whatIfChapter);

        setShowWhatIfDialog(false);
        setWhatIfGate(null);

        showSuccess(`Alternate timeline generated: "${alternatePath.label}"`);
        addEphemeralLog(`🔮 Alternate chapter saved: ${whatIfChapter.title}`, 'fate');

        // Optionally show the alternate chapter content
        // For now, we just log success - could add a viewer in the future

      } else {
        showError('Failed to generate alternate timeline. Please try again.');
      }

    } catch (error) {
      logger.error('Error generating What If chapter', 'tribulationGate',
        error instanceof Error ? error : undefined);
      showError('An error occurred while exploring the alternate timeline.');
    } finally {
      setWhatIfLoading(false);
    }
  }, [activeNovel, addEphemeralLog, showSuccess, showError, generateNextChapter]);

  // Open What If dialog for a gate
  const openWhatIfDialog = useCallback((gate: TribulationGate) => {
    setWhatIfGate(gate);
    setShowWhatIfDialog(true);
  }, []);

  const handleBatchGenerate = async (customInstruction?: string) => {
    if (!activeNovel) return;
    const generationId = crypto.randomUUID();
    activeGenerationIdRef.current = generationId;
    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus('Starting optimized batch generation...');
    const newLogs: SystemLog[] = [];

    const localAddLog = (msg: string, type: SystemLog['type'] = 'discovery') => {
      const log: SystemLog = { id: generateUUID(), message: msg, type, timestamp: Date.now() };
      newLogs.push(log);
    };

    try {
      // Use optimized batch generator for faster processing
      const { createOptimizedBatchGenerator } = await import('./services/optimizedBatchGenerator');

      const batchGenerator = createOptimizedBatchGenerator({
        batchSize: 5,
        maxRegenerationAttempts: 2, // Reduced for speed
        timeoutMs: 600000, // 10 minutes per chapter
        enableParallelProcessing: false, // CRITICAL: Sequential for narrative consistency
        cacheContext: true,
      });

      const result = await batchGenerator.generateBatch(
        activeNovel,
        customInstruction || instruction,
        (progress, status) => {
          if (activeGenerationIdRef.current !== generationId) return;
          setGenerationProgress(progress);
          setGenerationStatus(status);
        }
      );

      // Process generated chapters
      let currentNovelState = activeNovel;
      const chaptersGenerated = result.chapters.length;

      for (const chapter of result.chapters) {
        // Update novel state with each chapter
        currentNovelState = {
          ...currentNovelState,
          chapters: [...currentNovelState.chapters, chapter],
        };

        // Process post-chapter updates (simplified for batch mode)
        try {
          const { processPostChapterUpdates } = await import('./services/chapterProcessingService');
          currentNovelState = await processPostChapterUpdates(currentNovelState, chapter);
        } catch (updateError) {
          logger.warn('Post-chapter update failed for batch chapter', 'chapterGeneration', {
            error: updateError instanceof Error ? updateError.message : String(updateError)
          });
        }
      }

      // Log any errors
      if (result.errors.length > 0) {
        result.errors.forEach(error => {
          localAddLog(`Chapter generation error: ${error}`, 'error');
        });
      }

      // Update active novel with all chapters
      updateActiveNovel(() => currentNovelState);
      setActiveLogs(newLogs);

      setGenerationProgress(100);
      setGenerationStatus(`Batch generation complete! Generated ${chaptersGenerated}/5 chapters`);
      addEphemeralLog(`Batch generation complete! Successfully generated ${chaptersGenerated} chapters.`, 'discovery');

      showSuccess(`Successfully generated ${chaptersGenerated} chapters!`);

    } catch (e) {
      logger.error('Error in optimized batch generation', 'App', e instanceof Error ? e : new Error(String(e)));
      const errorMessage = e instanceof Error ? e.message : String(e);
      showError(
        `Batch generation failed.\n\nError: ${errorMessage}\n\nPlease check your API keys and connection.`
      );

      // Save any partial progress
      if (activeGenerationIdRef.current === generationId) {
        showWarning('Batch generation was interrupted. Some chapters may have been saved.');
      }
    } finally {
      if (activeGenerationIdRef.current === generationId) {
        setIsGenerating(false);
        activeGenerationIdRef.current = null;
      }
      setInstruction('');
    }
  };

  const handleVoiceLore = async (transcript: string) => {
    if (!activeNovel) return;
    addLog("Refining dictated lore through Heavenly Record...", "discovery");
    try {
      const refined = await processLoreDictation(transcript);
      setEditingWorld({
        id: generateUUID(),
        realmId: activeNovel.currentRealmId,
        category: refined.category as any,
        title: refined.title,
        content: refined.content
      });
      addLog(`Lore Manifested: ${refined.title}`, "discovery");
    } catch (e) {
      logger.error('Transcription error', 'lore', e instanceof Error ? e : new Error(String(e)));
      addLog("Transcription error. Manual review required.", "discovery");
      setEditingWorld({
        id: generateUUID(),
        realmId: activeNovel.currentRealmId,
        category: 'Other',
        title: 'Spoken Lore',
        content: transcript
      });
    }
  };

  const handleGeneratePortrait = async (char: Character) => {
    // Portrait generation is no longer available (required Gemini API)
    logger.warn('Portrait generation is not available', 'portraitGeneration', { characterId: char.id, characterName: char.name });
    setIsGeneratingPortrait(null);
  };

  const handleSetProtagonist = useCallback((characterId: string) => {
    if (!activeNovel) return;
    updateActiveNovel(prev => ({
      ...prev,
      characterCodex: prev.characterCodex.map(c => ({
        ...c,
        isProtagonist: c.id === characterId ? !c.isProtagonist : c.isProtagonist,
      })),
      updatedAt: Date.now(),
    }));
  }, [activeNovel, updateActiveNovel]);

  const DEFAULT_ARC_TARGET_CHAPTERS = 10;
  const buildDefaultArcChecklist = (): NonNullable<Arc['checklist']> => ([
    { id: 'setup', label: 'Setup anchored (premise, goals, tone)', completed: false },
    { id: 'stakes', label: 'Stakes raised / clarified', completed: false },
    { id: 'antagonistPressure', label: 'Opposition pressure escalated', completed: false },
    { id: 'powerProgression', label: 'Cultivation / power progression advanced', completed: false },
    { id: 'relationshipShift', label: 'Relationship / karma thread advanced', completed: false },
    { id: 'worldDeepening', label: 'World-building deepened (lore/places/sects)', completed: false },
    { id: 'turningPoint', label: 'Major turning point / escalation', completed: false },
    { id: 'climaxSetup', label: 'Climax groundwork established', completed: false },
    { id: 'resolution', label: 'Arc resolution / aftermath', completed: false },
  ]);

  const ensureArcDefaults = useCallback((arc: Arc, novelState?: NovelState): Arc => {
    const needsTarget = typeof arc.targetChapters !== 'number' || arc.targetChapters <= 0;
    const needsChecklist = !Array.isArray(arc.checklist) || arc.checklist.length === 0;
    if (!needsTarget && !needsChecklist) return arc;

    // If we have novel state, use smart calculation, otherwise use default
    let targetChapters = arc.targetChapters;
    if (needsTarget && novelState) {
      try {
        // Gather context for smart calculation
        const arcContext = arcAnalyzer.analyzeAllArcContexts(novelState);
        const progression = arcAnalyzer.analyzeArcProgression(novelState);
        const context = { progressionAnalysis: progression, arcSummaries: arcContext };
        targetChapters = arcAnalyzer.calculateSmartArcTargetChapters(novelState, context);
      } catch (e) {
        logger.warn('Failed to calculate smart arc target, using default', 'arc', {
          error: e instanceof Error ? e.message : String(e)
        });
        targetChapters = DEFAULT_ARC_TARGET_CHAPTERS;
      }
    } else if (needsTarget) {
      targetChapters = DEFAULT_ARC_TARGET_CHAPTERS;
    }

    return {
      ...arc,
      targetChapters: targetChapters,
      checklist: needsChecklist ? buildDefaultArcChecklist() : arc.checklist,
    };
  }, []);

  const handlePlanNewArc = async () => {
    if (!activeNovel) return;
    setIsPlanning(true);
    try {
      const result = await planArc(activeNovel);

      // Use AI-suggested targetChapters if provided and valid, otherwise calculate smart default
      let targetChapters = result.targetChapters;
      if (!targetChapters || targetChapters < 5 || targetChapters > 30) {
        try {
          const arcContext = arcAnalyzer.analyzeAllArcContexts(activeNovel);
          const progression = arcAnalyzer.analyzeArcProgression(activeNovel);
          const context = { progressionAnalysis: progression, arcSummaries: arcContext };
          targetChapters = arcAnalyzer.calculateSmartArcTargetChapters(activeNovel, context);
        } catch (e) {
          logger.warn('Failed to calculate smart arc target, using default', 'arc', {
            error: e instanceof Error ? e.message : String(e)
          });
          targetChapters = DEFAULT_ARC_TARGET_CHAPTERS;
        }
      }

      const newArc: Arc = ensureArcDefaults({
        id: generateUUID(),
        title: result.arcTitle,
        description: result.arcDescription,
        status: 'active',
        startedAtChapter: activeNovel.chapters.length + 1,
        targetChapters: targetChapters,
      }, activeNovel);

      const updatedNovel = {
        ...activeNovel,
        plotLedger: [
          ...activeNovel.plotLedger.map(a => {
            // If we are completing a previously-active arc, stamp its end.
            if (a.status === 'active') {
              return ensureArcDefaults({ ...a, status: 'completed' as const, endedAtChapter: activeNovel.chapters.length }, activeNovel);
            }
            return ensureArcDefaults(a, activeNovel);
          }),
          newArc
        ],
        updatedAt: Date.now()
      };

      updateActiveNovel(() => updatedNovel);
    } catch (e) {
      logger.error('Error in planning logic', 'planning', e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsPlanning(false);
    }
  };

  const handleSetActiveArc = async (arcId: string) => {
    if (!activeNovel) return;
    const currentActive = activeNovel.plotLedger.find(a => a.status === 'active');
    if (currentActive?.id === arcId) return;

    const updatedNovel = {
      ...activeNovel,
      plotLedger: activeNovel.plotLedger.map(a => {
        if (a.id === arcId) {
          // Preserve existing startedAtChapter if valid, otherwise set to next chapter
          const preserveStartedAt = a.startedAtChapter &&
            a.startedAtChapter > 0 &&
            a.startedAtChapter <= activeNovel.chapters.length;
          return ensureArcDefaults({
            ...a,
            status: 'active' as const,
            startedAtChapter: preserveStartedAt
              ? a.startedAtChapter
              : (activeNovel.chapters.length + 1)
          }, activeNovel);
        }
        if (a.status === 'active') {
          return ensureArcDefaults({ ...a, status: 'completed' as const, endedAtChapter: activeNovel.chapters.length }, activeNovel);
        }
        return ensureArcDefaults({ ...a, status: 'completed' as const }, activeNovel);
      }),
      updatedAt: Date.now(),
    };

    updateActiveNovel(() => updatedNovel);
  };

  const handleSaveChapter = async (updatedChapter: Chapter) => {
    if (!activeNovel) return;

    // Create a revision checkpoint
    try {
      await saveRevision(
        'chapter',
        updatedChapter.id,
        updatedChapter,
        {
          wordCount: updatedChapter.content.split(/\s+/).filter(x => x).length,
          changeDescription: 'Manual save'
        }
      );
    } catch (e) {
      logger.error('Failed to save chapter revision', 'revision', e instanceof Error ? e : new Error(String(e)), { chapterId: chapter.id, chapterNumber: chapter.number });
      // We continue saving the novel even if revision history fails
    }

    await saveChapter(updatedChapter);
  };

  const handleExportChapter = (chapter: Chapter) => {
    const blob = new Blob([`${chapter.title}\n\n${chapter.content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Ch_${chapter.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveCharacter = useCallback((character: Character) => {
    updateActiveNovel(prev => {
      const nextCodex = prev.characterCodex.some(c => c.id === character.id)
        ? prev.characterCodex.map(c => (c.id === character.id ? character : c))
        : [...prev.characterCodex, character];

      return { ...prev, characterCodex: nextCodex };
    });
    setEditingChar(null);

    // Save immediately to ensure persistence
    if (activeNovel) {
      const nextCodex = activeNovel.characterCodex.some(c => c.id === character.id)
        ? activeNovel.characterCodex.map(c => (c.id === character.id ? character : c))
        : [...activeNovel.characterCodex, character];

      const updatedNovel = {
        ...activeNovel,
        characterCodex: nextCodex,
        updatedAt: Date.now(),
      };
      updateActiveNovel(() => updatedNovel);
    }
  }, [activeNovel, updateActiveNovel]);

  const handleSaveArc = useCallback(async (arc: Arc) => {
    updateActiveNovel(prev => {
      const edited = ensureArcDefaults(arc);
      // Find existing arc to preserve state
      const existingArc = prev.plotLedger.find(a => a.id === edited.id);
      const preserveStartedAt = existingArc?.startedAtChapter &&
        existingArc.startedAtChapter > 0 &&
        existingArc.startedAtChapter <= prev.chapters.length;

      const nextLedger =
        edited.status === 'active'
          ? prev.plotLedger.map(a => {
            if (a.id === edited.id) {
              return ensureArcDefaults({
                ...edited,
                status: 'active' as const,
                // Preserve existing start chapter if valid, otherwise set to next chapter
                startedAtChapter: preserveStartedAt
                  ? existingArc.startedAtChapter
                  : (prev.chapters.length + 1),
                endedAtChapter: undefined,
              });
            }
            // If we are completing a previously-active arc, stamp its end.
            if (a.status === 'active') {
              return ensureArcDefaults({ ...a, status: 'completed' as const, endedAtChapter: prev.chapters.length });
            }
            return ensureArcDefaults({ ...a, status: 'completed' as const });
          })
          : prev.plotLedger.map(a => {
            if (a.id === edited.id) {
              // For completed arcs, preserve endedAtChapter if editing, or use current chapter count
              const preserveEndedAt = existingArc?.endedAtChapter &&
                existingArc.endedAtChapter > 0 &&
                existingArc.endedAtChapter <= prev.chapters.length;
              return ensureArcDefaults({
                ...edited,
                status: 'completed' as const,
                endedAtChapter: edited.endedAtChapter ?? (preserveEndedAt ? existingArc.endedAtChapter : prev.chapters.length),
                // Also preserve startedAtChapter for completed arcs
                startedAtChapter: preserveStartedAt ? existingArc.startedAtChapter : edited.startedAtChapter,
              });
            }
            return ensureArcDefaults(a);
          });
      return { ...prev, plotLedger: nextLedger };
    });
    setEditingArc(null);

    // Save immediately to ensure persistence
    if (activeNovel) {
      const edited = ensureArcDefaults(arc, activeNovel);
      // Find existing arc to preserve state
      const existingArc = activeNovel.plotLedger.find(a => a.id === edited.id);
      const preserveStartedAt = existingArc?.startedAtChapter &&
        existingArc.startedAtChapter > 0 &&
        existingArc.startedAtChapter <= activeNovel.chapters.length;

      let nextLedger =
        edited.status === 'active'
          ? activeNovel.plotLedger.map(a => {
            if (a.id === edited.id) {
              return ensureArcDefaults({
                ...edited,
                status: 'active' as const,
                // Preserve existing start chapter if valid, otherwise set to next chapter
                startedAtChapter: preserveStartedAt
                  ? existingArc.startedAtChapter
                  : (activeNovel.chapters.length + 1),
                endedAtChapter: undefined,
              }, activeNovel);
            }
            if (a.status === 'active') {
              return ensureArcDefaults({ ...a, status: 'completed' as const, endedAtChapter: activeNovel.chapters.length }, activeNovel);
            }
            return ensureArcDefaults({ ...a, status: 'completed' as const }, activeNovel);
          })
          : activeNovel.plotLedger.map(a => {
            if (a.id === edited.id) {
              // For completed arcs, preserve endedAtChapter if editing, or use current chapter count
              const preserveEndedAt = existingArc?.endedAtChapter &&
                existingArc.endedAtChapter > 0 &&
                existingArc.endedAtChapter <= activeNovel.chapters.length;
              return ensureArcDefaults({
                ...edited,
                status: 'completed' as const,
                endedAtChapter: edited.endedAtChapter ?? (preserveEndedAt ? existingArc.endedAtChapter : activeNovel.chapters.length),
                // Also preserve startedAtChapter for completed arcs
                startedAtChapter: preserveStartedAt ? existingArc.startedAtChapter : edited.startedAtChapter,
              }, activeNovel);
            }
            return ensureArcDefaults(a, activeNovel);
          });

      // Validate and auto-repair arc states
      const validatedArcs = nextLedger.map(arc => {
        const result = arcAnalyzer.validateArcState(arc, activeNovel.chapters, nextLedger);
        if (result.wasRepaired && result.issues.length > 0) {
          // Log validation issues in console (can be shown to user if needed)
          logger.warn(`Arc validation for "${arc.title}"`, 'arc', {
            issues: result.issues
          });
        }
        return result.arc;
      });
      nextLedger = validatedArcs;

      const updatedNovel = {
        ...activeNovel,
        plotLedger: nextLedger,
        updatedAt: Date.now(),
      };
      updateActiveNovel(() => updatedNovel);

      // Trigger editor review if arc was completed
      const completedArc = nextLedger.find(a => a.id === edited.id && a.status === 'completed');
      if (completedArc && completedArc.startedAtChapter && completedArc.endedAtChapter) {
        try {
          startLoading(`Editor analyzing arc: ${completedArc.title}...`, true);
          addEphemeralLog(`Editor analyzing arc "${completedArc.title}"...`, 'discovery');
          const editorReport = await triggerEditorReview(updatedNovel, 'arc_complete', completedArc, {
            onProgress: (phase: string, progress?: number) => {
              if (progress !== undefined) {
                updateProgress(progress, `Editor: ${phase}`);
                setGenerationProgress(progress);
                setGenerationStatus(`Editor: ${phase}`);
              } else {
                updateMessage(`Editor: ${phase}`);
              }
              addEphemeralLog(`Editor: ${phase}`, 'discovery');
            },
            onAutoFix: (fix: EditorFix) => {
              addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
            },
          });

          if (editorReport) {
            // Save the report
            await saveEditorReport(editorReport);

            // Show notification with readiness status
            const arcAnalysis = editorReport.analysis as any;
            if (arcAnalysis && arcAnalysis.readiness) {
              const readiness = arcAnalysis.readiness;
              if (readiness.isReadyForRelease) {
                showSuccess(`Arc "${completedArc.title}" is ready for release! Editor review complete.`);
              } else if (readiness.blockingIssues && Array.isArray(readiness.blockingIssues)) {
                showWarning(`Arc "${completedArc.title}" needs ${readiness.blockingIssues.length} issue(s) fixed before release.`);
              }
            }

            addEphemeralLog(`Editor review complete for arc "${completedArc.title}"`, 'discovery');
            stopLoading();
          } else {
            stopLoading();
          }
        } catch (editorError) {
          logger.error('Error in arc editor review', 'editor', editorError instanceof Error ? editorError : new Error(String(editorError)));
          stopLoading();
          // Don't block arc completion if editor fails
          addEphemeralLog('Arc editor review failed - arc marked as completed', 'update');
        }
      }
    }
  }, [activeNovel, updateActiveNovel, ensureArcDefaults, startLoading, stopLoading, updateProgress, updateMessage, showSuccess, showWarning, addEphemeralLog, setGenerationProgress, setGenerationStatus]);

  const handleSaveTerritory = (territory: Territory) => {
    updateActiveNovel(prev => {
      const exists = prev.territories.some(t => t.id === territory.id);
      return {
        ...prev,
        territories: exists
          ? prev.territories.map(t => t.id === territory.id ? territory : t)
          : [...prev.territories, territory]
      };
    });
  };

  const handleDeleteTerritory = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Territory',
      message: 'Shatter this domain from history?',
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel(prev => ({
          ...prev,
          territories: prev.territories.filter(t => t.id !== id)
        }));
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        showSuccess('Territory deleted');
      },
    });
  };

  const handleDeleteWorldEntry = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete World Entry',
      message: 'Erase this knowledge from the world bible?',
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel(prev => ({
          ...prev,
          worldBible: prev.worldBible.filter(e => e.id !== id)
        }));
        setConfirmDialog({ ...confirmDialog, isOpen: false });
        showSuccess('World entry deleted');
      },
    });
  };

  /**
   * Handle market state updates from the MarketPanel
   */
  const handleUpdateMarketState = useCallback((marketState: GlobalMarketState) => {
    updateActiveNovel(prev => ({
      ...prev,
      globalMarketState: marketState,
      updatedAt: Date.now(),
    }));
  }, [updateActiveNovel]);

  /**
   * Loom Dashboard handlers
   */
  const handleUpdateThread = useCallback((thread: any) => {
    // Update thread in novel state
    updateActiveNovel(prev => ({
      ...prev,
      storyThreads: prev.storyThreads?.map(t =>
        t.id === thread.id ? { ...t, ...thread } : t
      ) || []
    }));
  }, [updateActiveNovel]);

  const handleForceAttention = useCallback((threadId: string) => {
    // This would typically update the Loom state
    // For now, just show a notification
    showSuccess('Director attention forced for thread');
  }, [showSuccess]);

  const handleBoostKarma = useCallback((threadId: string, amount: number) => {
    // Update thread's karma weight
    updateActiveNovel(prev => ({
      ...prev,
      storyThreads: prev.storyThreads?.map(t =>
        t.id === threadId
          ? { ...t, karmaWeight: Math.max(1, Math.min(100, (t.karmaWeight || 50) + amount)) }
          : t
      ) || []
    }));
    showSuccess(`Karma weight ${amount > 0 ? 'increased' : 'decreased'} by ${Math.abs(amount)}`);
  }, [updateActiveNovel, showSuccess]);

  const handleMarkAbandoned = useCallback((threadId: string, reason: string) => {
    // Mark thread as abandoned
    updateActiveNovel(prev => ({
      ...prev,
      storyThreads: prev.storyThreads?.map(t =>
        t.id === threadId
          ? { ...t, status: 'abandoned' as any, resolutionNotes: reason }
          : t
      ) || []
    }));
    showSuccess('Thread marked as abandoned');
  }, [updateActiveNovel, showSuccess]);

  /**
   * Initialize market state if it doesn't exist when Economy panel is opened
   */
  const handleToggleEconomyPanel = useCallback(() => {
    setShowEconomyPanel(prev => {
      const newValue = !prev;
      // Initialize market state if opening and it doesn't exist
      if (newValue && activeNovel && !activeNovel.globalMarketState) {
        const defaultMarketState = createDefaultMarketState(activeNovel.id);
        updateActiveNovel(prevNovel => ({
          ...prevNovel,
          globalMarketState: defaultMarketState,
          updatedAt: Date.now(),
        }));
      }
      return newValue;
    });
  }, [activeNovel, updateActiveNovel]);

  const handleDeleteNovel = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Novel',
      message: 'Shatter this jade slip forever? This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteNovelById(id);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        } catch (error) {
          logger.error('Error deleting novel', 'App', error instanceof Error ? error : new Error(String(error)));
          // If network error, maybe we should check if it was a local-only novel?
          // For now, simpler to just fail safe.
          showError('Failed to delete novel. Please try again.');
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      },
    });
  };

  const handleDeleteArc = useCallback((arcId: string) => {
    if (!activeNovel) return;
    const arc = activeNovel.plotLedger.find(a => a.id === arcId);
    if (!arc) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Plot Arc',
      message: `Shatter the arc "${arc.title}" from history? This cannot be undone.`,
      variant: 'danger',
      onConfirm: () => {
        updateActiveNovel(prev => ({
          ...prev,
          plotLedger: prev.plotLedger.filter(a => a.id !== arcId),
          updatedAt: Date.now(),
        }));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        showSuccess(`Arc "${arc.title}" deleted`);
      },
      onCancel: () => setConfirmDialog(prev => ({ ...prev, isOpen: false })),
    });
  }, [activeNovel, updateActiveNovel, showSuccess, setConfirmDialog]);

  const handleDeleteChapter = async (chapterId: string) => {
    if (!activeNovel) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Chapter',
      message: 'Erase this chapter from the chronicles? All related data will be removed.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteChapterById(chapterId);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          addLog('Chapter erased from the chronicles.', 'update');
        } catch (error) {
          logger.error('Error deleting chapter', 'App', error instanceof Error ? error : new Error(String(error)));
          showError('Failed to delete chapter. Please try again.');
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      },
    });
  };

  if (currentView === 'library' || !activeNovel) {
    return (
      <div className="relative">
        {isLoading && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 animate-in fade-in duration-200">
            <div className="text-center space-y-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-20 w-20 border-4 border-zinc-700 border-t-amber-600 mx-auto"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-amber-400/30 animate-spin-reverse mx-auto"></div>
              </div>
              <div>
                <p className="text-amber-500 font-fantasy text-2xl font-bold">Loading the Hall of Jade Manuscripts</p>
                <p className="text-zinc-400 text-sm mt-2">Gathering your epic collection...</p>
              </div>
            </div>
          </div>
        )}
        {isSaving && !isLoading && (
          <div className="fixed bottom-8 right-8 bg-zinc-900 border border-amber-600/50 rounded-xl px-4 py-2.5 flex items-center space-x-3 z-50 shadow-xl shadow-amber-900/20 animate-in slide-in duration-200">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-600 border-t-amber-600"></div>
            <span className="text-sm text-amber-500 font-semibold">Saving to database...</span>
          </div>
        )}
        <LibraryView
          novels={library}
          onSelect={(id) => { setActiveNovelId(id); setView('dashboard'); }}
          onCreate={handleCreateNovel}
          onDelete={handleDeleteNovel}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen h-dvh w-screen overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-amber-600/30">
      <LoadingIndicator
        isVisible={loadingState.isLoading}
        message={loadingState.message}
        progress={loadingState.progress}
        showProgressBar={loadingState.showProgressBar}
        variant="banner"
        position="top"
      />
      {/* Mobile Menu Button - positioned with safe area */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="md:hidden fixed z-50 p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', left: 'max(1rem, env(safe-area-inset-left, 1rem))' }}
        aria-label="Open navigation menu"
        title="Open menu"
      >
        <span className="text-xl">☰</span>
      </button>

      {/* Mobile Notification Panel Button - positioned with safe area */}
      <button
        onClick={() => setMobileNotificationPanelOpen(true)}
        className="md:hidden fixed z-50 p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', right: 'max(1rem, env(safe-area-inset-right, 1rem))' }}
        aria-label="Open notifications"
        title="Open notifications"
      >
        <span className="text-xl">🔔</span>
      </button>

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/95 backdrop-blur-xl z-40"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - Hidden on mobile when closed, shown on desktop or mobile when open */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 md:z-auto transform transition-all duration-300 ease-in-out ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          }`}
      >
        <Sidebar
          onNavigate={() => setMobileSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      </aside>

      <NotificationPanel
        activeLogs={activeLogs}
        isOpen={mobileNotificationPanelOpen}
        isDesktopOpen={desktopNotificationPanelOpen}
        isDesktopMinimized={desktopNotificationPanelMinimized}
        onClose={() => setMobileNotificationPanelOpen(false)}
        onDesktopToggle={() => setDesktopNotificationPanelOpen(!desktopNotificationPanelOpen)}
        onDesktopMinimize={() => setDesktopNotificationPanelMinimized(!desktopNotificationPanelMinimized)}
      />

      <main className={`flex-1 relative overflow-y-auto scroll-smooth-mobile ${desktopNotificationPanelOpen && !desktopNotificationPanelMinimized ? 'md:mr-80' : ''}`} data-tour="main-content">
        {/* Saving indicator - positioned with safe area */}
        {isSaving && (
          <div
            className="fixed bg-zinc-900/95 backdrop-blur-sm border border-amber-600/50 rounded-xl px-3 md:px-4 py-2 md:py-2.5 flex items-center space-x-2 md:space-x-3 z-50 shadow-xl shadow-amber-900/20 animate-in slide-in duration-200"
            style={{
              bottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
              right: 'max(1rem, env(safe-area-inset-right, 1rem))'
            }}
          >
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-600 border-t-amber-600 flex-shrink-0"></div>
            <span className="text-xs md:text-sm text-amber-500 font-semibold whitespace-nowrap">Saving...</span>
          </div>
        )}
        {/* Desktop Library Button - positioned relative to sidebar width */}
        <button
          onClick={() => setView('library')}
          className={`fixed top-4 z-50 p-2.5 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2 hidden md:block`}
          style={{ left: sidebarCollapsed ? '88px' : '272px' }}
          title="Return to Hall"
          aria-label="Return to library"
        >🏛️</button>
        {!desktopNotificationPanelOpen && (
          <button
            onClick={() => setDesktopNotificationPanelOpen(true)}
            className="fixed top-4 right-4 z-50 p-2.5 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2 hidden md:block"
            title="Show notifications"
            aria-label="Show notifications panel"
          >
            🔔
          </button>
        )}
        {/* Mobile Library Button - positioned with safe area, offset from menu button */}
        <button
          onClick={() => setView('library')}
          className="fixed z-50 p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2 md:hidden"
          style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', left: 'max(5rem, env(safe-area-inset-left, 5rem))' }}
          title="Return to Hall"
          aria-label="Return to library"
        >🏛️</button>

        {currentView === 'dashboard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <DashboardView
              novel={activeNovel}
              onGenerateChapter={handleGenerateNext}
              onBatchGenerate={handleBatchGenerate}
              isGenerating={isGenerating}
              generationProgress={generationProgress}
              generationStatus={generationStatus}
              instruction={instruction}
              onInstructionChange={setInstruction}
              onViewChange={setView}
              activeChapterId={activeChapter?.id || null}
              onChapterSelect={(chapterId) => {
                setActiveChapterId(chapterId);
                setView('editor');
              }}
              onUpdateNovel={updateActiveNovel}
              onManualTribulationGate={() => setShowManualGateDialog(true)}
            />
          </Suspense>
        )}
        {false && currentView === 'dashboard' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-300 pt-20 md:pt-24">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-zinc-700 pb-6 md:pb-8">
              <div className="flex-1 min-w-0">
                <h2 className="text-3xl md:text-4xl font-fantasy font-bold text-amber-500 break-words">{activeNovel.title}</h2>
                <p className="text-zinc-400 mt-3 flex items-center text-sm flex-wrap gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse flex-shrink-0"></span>
                  <span>Realm: <span className="text-amber-300 ml-1 font-semibold">{activeNovel.realms.find(r => r.id === activeNovel.currentRealmId)?.name || 'Unknown'}</span></span>
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-4xl md:text-5xl font-fantasy font-bold text-zinc-300">{activeNovel.chapters.length}</p>
                <p className="text-xs text-zinc-500 uppercase font-semibold mt-1">Chapters</p>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <div className="md:col-span-2 space-y-6 md:space-y-8">
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden shadow-xl relative">
                  <div className="absolute top-4 right-4 z-10">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider border border-indigo-500/30 px-3 py-1.5 rounded-full bg-indigo-950/40">First Principles Engine</span>
                  </div>
                  <div className="p-4 md:p-6 bg-zinc-800/30 border-b border-zinc-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex-shrink-0">Forge Destiny</h3>
                    <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                      <CreativeSpark
                        type="Plot Point"
                        currentValue={instruction}
                        state={activeNovel}
                        onIdea={(idea) => setInstruction(prev => prev ? prev + "\n\nExpansion: " + idea : idea)}
                      />
                      <VoiceInput onResult={(text) => setInstruction(prev => prev ? prev + " " + text : text)} />
                    </div>
                  </div>
                  <div className="p-6 md:p-8">
                    {/* Pre-Generation Analysis */}
                    {(() => {
                      try {
                        const nextChapterNumber = activeNovel.chapters.length > 0
                          ? Math.max(...activeNovel.chapters.map(c => c.number), 0) + 1
                          : 1;
                        const gapAnalysis = analyzeGaps(activeNovel, nextChapterNumber);

                        if (gapAnalysis.gaps.length > 0 && !isGenerating) {
                          return (
                            <div className="mb-6">
                              <PreGenerationAnalysis
                                gapAnalysis={gapAnalysis}
                                onProceed={() => {
                                  setShowPreGenerationAnalysis(false);
                                  handleGenerateNext();
                                }}
                                onReview={() => {
                                  setShowPreGenerationAnalysis(false);
                                  // Could navigate to a review view or scroll to gap analysis section
                                }}
                              />
                            </div>
                          );
                        }
                      } catch {
                        // Ignore errors
                      }
                      return null;
                    })()}

                    <textarea
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      placeholder="Input the Will of the Dao... Every instruction triggers a Logic Audit."
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 md:p-6 text-sm md:text-base text-zinc-300 h-40 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all resize-none mb-6 font-serif-novel leading-relaxed"
                      aria-label="Chapter instruction input"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        disabled={isGenerating}
                        onClick={() => handleGenerateNext()}
                        className={`py-3 md:py-4 rounded-xl font-fantasy text-base md:text-lg font-semibold transition-all duration-200 ${isGenerating
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                          : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 hover:scale-105 text-white shadow-lg shadow-amber-900/30'
                          }`}
                        aria-label={isGenerating ? 'Generating chapter...' : 'Generate next chapter'}
                      >
                        {isGenerating ? (
                          <span className="flex items-center justify-center">
                            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></span>
                            Manifesting...
                          </span>
                        ) : (
                          'Condense Chapter'
                        )}
                      </button>
                      {isGenerating ? (
                        <button
                          type="button"
                          onClick={() => {
                            activeGenerationIdRef.current = null;
                            setIsGenerating(false);
                            addEphemeralLog('Generation cancelled. If the AI returns later, the result will be ignored.', 'update');
                          }}
                          className="py-3 md:py-4 border border-zinc-700 rounded-xl font-fantasy text-sm md:text-base font-semibold text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-all duration-200 flex items-center justify-center space-x-2 hover:bg-zinc-900/40"
                          aria-label="Cancel chapter generation"
                          title="Cancel generation (does not stop the remote request, but ignores the result)"
                        >
                          <span>Cancel</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleGenerateNext("Introduce a shocking reversal or 'BUT' event.")}
                          className="py-3 md:py-4 border border-zinc-700 rounded-xl font-fantasy text-sm md:text-base font-semibold text-zinc-400 hover:text-red-400 hover:border-red-500/50 transition-all duration-200 flex items-center justify-center space-x-2 hover:bg-red-950/10"
                          title="Generate a chapter with a shocking reversal or 'BUT' event"
                          aria-label="Generate reversal chapter"
                        >
                          <span>⚡ Reversal (Δ)</span>
                        </button>
                      )}
                    </div>

                    <GenerationProgressBar
                      isVisible={isGenerating}
                      progress={generationProgress}
                      statusMessage={generationStatus}
                    />
                  </div>
                </div>

                {activeNovel.chapters.length > 0 && activeNovel.chapters[activeNovel.chapters.length - 1]?.logicAudit && (
                  <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-6 md:p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 px-4 md:px-6 py-2 bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-bl-xl">Chronicle Audit (Ch {activeNovel.chapters[activeNovel.chapters.length - 1]?.number})</div>
                    <div className="flex items-center space-x-6 md:space-x-8 pt-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-sm md:text-base font-fantasy font-semibold text-zinc-300">{activeNovel.chapters[activeNovel.chapters.length - 1].logicAudit?.startingValue}</span>
                          <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs font-bold text-indigo-400 animate-pulse">Δ Shift</span>
                          <span className="text-sm md:text-base font-fantasy font-semibold text-amber-500">{activeNovel.chapters[activeNovel.chapters.length - 1].logicAudit?.resultingValue}</span>
                        </div>
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-zinc-700 to-indigo-500 w-3/4"></div>
                        </div>
                        <p className="text-sm text-zinc-400 italic font-serif-novel leading-relaxed">
                          <span className="font-bold text-indigo-400 uppercase mr-2 text-xs">{activeNovel.chapters[activeNovel.chapters.length - 1].logicAudit?.causalityType}:</span>
                          {activeNovel.chapters[activeNovel.chapters.length - 1].logicAudit?.theChoice}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6 md:space-y-8">
                <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/95 to-zinc-900 border border-zinc-700/50 rounded-2xl p-6 md:p-8 shadow-xl overflow-hidden">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-lg">⭐</span>
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Protagonist</h3>
                  </div>
                  <div className="space-y-6 text-center">
                    {(() => {
                      // Find protagonist:
                      // 1) Explicit Codex protagonist flag
                      // 2) Most mentioned character in chapters
                      // 3) First character fallback
                      const protagonists = activeNovel.characterCodex.filter(c => c.isProtagonist);
                      let protagonist = protagonists.length > 0 ? protagonists[0] : activeNovel.characterCodex[0];
                      if (activeNovel.characterCodex.filter(c => c.isProtagonist).length === 0 && activeNovel.chapters.length > 0 && activeNovel.characterCodex.length > 0) {
                        const characterMentions = activeNovel.characterCodex.map(char => {
                          const mentions = activeNovel.chapters.reduce((count, chapter) => {
                            const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
                            const nameLower = char.name.toLowerCase();
                            const matches = content.match(new RegExp(nameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'));
                            return count + (matches ? matches.length : 0);
                          }, 0);
                          return { character: char, mentions };
                        });
                        characterMentions.sort((a, b) => b.mentions - a.mentions);
                        protagonist = characterMentions[0]?.character || activeNovel.characterCodex[0];
                      }
                      return protagonist ? (
                        <>
                          {protagonist.portraitUrl ? (
                            <img
                              src={protagonist.portraitUrl}
                              className="w-32 h-32 rounded-full mx-auto border-2 border-amber-600/50 shadow-xl shadow-amber-900/20 object-cover ring-2 ring-amber-600/20"
                              alt={`Portrait of ${protagonist.name}`}
                            />
                          ) : (
                            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 border-2 border-amber-600/30 mx-auto flex items-center justify-center text-5xl shadow-xl shadow-amber-900/10 ring-2 ring-amber-600/20">👤</div>
                          )}
                          <div className="space-y-2">
                            <h4 className="font-fantasy text-xl md:text-2xl font-bold text-amber-500 leading-tight break-words">{protagonist.name}</h4>
                            {protagonist.currentCultivation && (
                              <p className="text-xs md:text-sm text-zinc-400 font-medium mt-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 inline-block">
                                {protagonist.currentCultivation}
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="py-8">
                          <div className="text-4xl mb-3 opacity-50">👤</div>
                          <p className="text-sm text-zinc-500">No protagonist set</p>
                          <p className="text-xs text-zinc-600 mt-1">Mark a character as protagonist</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Automation Status - Trust Score */}
                {(() => {
                  try {
                    // Extract trust score from logs
                    const trustLog = activeNovel.systemLogs
                      .slice()
                      .reverse()
                      .find(log => log.message.includes('trust score') || log.message.includes('Trust score'));

                    let trustScore = null;
                    if (trustLog) {
                      const match = trustLog.message.match(/(\d+)\/100/);
                      if (match) {
                        const score = parseInt(match[1], 10);
                        // Return a simplified trust score (we don't have full breakdown from logs)
                        trustScore = {
                          overall: score,
                          extractionQuality: score,
                          connectionQuality: score,
                          dataCompleteness: score,
                          consistencyScore: score,
                          factors: {
                            highConfidenceExtractions: 0,
                            lowConfidenceExtractions: 0,
                            missingRequiredFields: 0,
                            inconsistencies: 0,
                            warnings: 0,
                          },
                        };
                      }
                    }

                    return (
                      <TrustScoreWidget
                        trustScore={trustScore}
                        size="sm"
                        onClick={() => setView('dashboard')}
                      />
                    );
                  } catch {
                    return null;
                  }
                })()}

                {/* Automation Status - Gap Analysis */}
                {(() => {
                  try {
                    const gapAnalysis = analyzeGaps(activeNovel, activeNovel.chapters.length || 0);
                    if (gapAnalysis.gaps.length > 0) {
                      return (
                        <GapAnalysisPanel
                          gapAnalysis={gapAnalysis}
                          collapsible={true}
                          defaultExpanded={false}
                          onReview={() => setView('dashboard')}
                        />
                      );
                    }
                  } catch {
                    // Ignore errors
                  }
                  return null;
                })()}

                <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-6">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mr-2 animate-pulse"></span> System Logs
                  </h3>
                  <div className="space-y-3 max-h-48 overflow-y-auto scrollbar-thin pr-2">
                    {activeNovel.systemLogs.slice().reverse().slice(0, 8).map(log => (
                      <div key={log.id} className="text-xs font-serif-novel text-zinc-400 border-l-2 border-zinc-700 pl-3 py-2 leading-relaxed">
                        <span className={`text-xs uppercase font-bold mr-2 ${log.type === 'logic' ? 'text-indigo-400' : 'text-amber-600'}`}>{log.type}</span>
                        {log.message}
                      </div>
                    ))}
                    {activeNovel.systemLogs.length === 0 && (
                      <p className="text-xs text-zinc-500 italic text-center py-4">No system logs yet...</p>
                    )}
                  </div>
                </div>

                {/* Antagonist Status */}
                {activeNovel.antagonists && activeNovel.antagonists.length > 0 && (
                  <div className="bg-zinc-900/60 border border-zinc-700 rounded-2xl p-6">
                    <Suspense fallback={<div className="text-zinc-400 text-sm">Loading antagonist status...</div>}>
                      <AntagonistTracker
                        novel={activeNovel}
                        currentChapterNumber={activeNovel.chapters.length}
                      />
                    </Suspense>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {currentView === 'editor' && activeChapter && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ChapterEditor
              chapter={activeChapter}
              novelState={activeNovel}
              onSave={handleSaveChapter}
              onClose={() => setView('chapters')}
              onNavigateChapter={(chapterId) => {
                setActiveChapterId(chapterId);
                setView('editor');
              }}
            />
          </Suspense>
        )}
        {currentView === 'world-map' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <WorldMapView state={activeNovel} onSaveTerritory={handleSaveTerritory} onDeleteTerritory={handleDeleteTerritory} />
          </Suspense>
        )}
        {currentView === 'storyboard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <StoryboardView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'timeline' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <TimelineView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'beatsheet' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <BeatSheetView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'matrix' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <MatrixView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'analytics' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ProgressDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'search' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <GlobalSearch novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'goals' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <WritingGoals
              novelState={activeNovel}
              onUpdateGoals={(goals) => updateActiveNovel(prev => ({ ...prev, writingGoals: goals }))}
            />
          </Suspense>
        )}
        {/* World-Class Enhancements Views */}
        {currentView === 'structure-visualizer' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <StructureVisualizer novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'engagement-dashboard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <EngagementDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'tension-curve' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <TensionCurveView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'theme-evolution' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ThemeEvolutionView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'character-psychology' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <CharacterPsychologyView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'device-dashboard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <DeviceDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'draft-comparison' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <DraftComparisonView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'excellence-scorecard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ExcellenceScorecard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'improvement-history' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ImprovementHistoryPage />
          </Suspense>
        )}
        {currentView === 'memory-dashboard' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <MemoryDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'chapters' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <ChaptersView
              novel={activeNovel}
              onChapterSelect={setActiveChapterId}
              onChapterDelete={handleDeleteChapter}
              onChapterExport={handleExportChapter}
              onFixChapters={fixExistingChapters}
              onEditorReview={() => setShowManualEditor(true)}
              onViewChange={setView}
            />
          </Suspense>
        )}

        {currentView === 'world-bible' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
              <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">World Bible</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                {/* Economy Toggle Button */}
                <button
                  onClick={handleToggleEconomyPanel}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 whitespace-nowrap ${showEconomyPanel
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-300'
                    }`}
                  title="Toggle Spirit Stone Market (Economic Simulation)"
                  aria-label="Toggle Economy Panel"
                >
                  <span>💰</span>
                  <span>Economy</span>
                  {activeNovel.globalMarketState && activeNovel.globalMarketState.standardItems.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${showEconomyPanel ? 'bg-emerald-600/30' : 'bg-zinc-700'
                      }`}>
                      {activeNovel.globalMarketState.standardItems.length}
                    </span>
                  )}
                </button>
                <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 space-x-3 flex-shrink-0">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide whitespace-nowrap">Dictate Lore:</span>
                  <VoiceInput onResult={handleVoiceLore} />
                </div>
                <button
                  onClick={() => setEditingWorld({ id: crypto.randomUUID(), realmId: activeNovel.currentRealmId, category: 'Geography', title: '', content: '' })}
                  className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold shadow-lg shadow-amber-900/20 text-sm transition-all duration-200 hover:scale-105 whitespace-nowrap"
                  title="Add new world knowledge entry"
                  aria-label="Add new world knowledge entry"
                >
                  + Add Knowledge
                </button>
              </div>
            </div>

            {/* Economy Panel - Spirit Stone Market */}
            {showEconomyPanel && (
              <div className="mb-8 md:mb-12 bg-zinc-900/50 border border-emerald-900/30 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    <h3 className="text-base md:text-lg font-bold text-emerald-400">Spirit Stone Market</h3>
                  </div>
                  <p className="text-xs text-zinc-500 hidden sm:block">
                    Track item prices for economic consistency across chapters
                  </p>
                </div>
                <MarketPanel
                  marketState={activeNovel.globalMarketState}
                  onUpdateMarketState={handleUpdateMarketState}
                  currentChapter={activeNovel.chapters.length}
                />
              </div>
            )}

            {activeNovel.worldBible.filter(e => e.realmId === activeNovel.currentRealmId).length === 0 ? (
              <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
                <div className="text-6xl mb-4">📜</div>
                <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No World Knowledge Yet</h3>
                <p className="text-sm text-zinc-500 mb-6">Start building your world by adding knowledge entries about geography, sects, power levels, and more.</p>
                <button
                  onClick={() => setEditingWorld({ id: crypto.randomUUID(), realmId: activeNovel.currentRealmId, category: 'Geography', title: '', content: '' })}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
                >
                  Add First Entry
                </button>
              </div>
            ) : (
              <div className="space-y-12 md:space-y-16">
                {['Geography', 'Sects', 'PowerLevels', 'Systems', 'Techniques', 'Laws', 'Other'].map(cat => {
                  const entries = activeNovel.worldBible.filter(e => e.category === cat && e.realmId === activeNovel.currentRealmId);
                  if (entries.length === 0) return null;
                  return (
                    <div key={cat} className="space-y-6">
                      <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider border-l-4 border-amber-600 pl-4">{cat}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {entries.map(entry => (
                          <div key={entry.id} className="bg-zinc-900 border border-zinc-700 p-6 md:p-8 rounded-2xl relative group hover:shadow-xl hover:shadow-amber-900/5 transition-all duration-200">
                            <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
                              <button
                                onClick={() => setEditingWorld(entry)}
                                className="text-xs text-zinc-400 hover:text-amber-500 hover:bg-amber-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-amber-500/50 transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 shadow-lg"
                                title="Edit World Entry"
                                aria-label={`Edit ${entry.title}`}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteWorldEntry(entry.id)}
                                className="text-xs text-zinc-400 hover:text-red-500 hover:bg-red-500/10 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200 focus-visible:outline-red-600 focus-visible:outline-2 shadow-lg"
                                title="Delete World Entry"
                                aria-label={`Delete ${entry.title}`}
                              >
                                Delete
                              </button>
                            </div>
                            <h4 className="font-fantasy text-lg md:text-xl font-bold text-zinc-200 mb-4 pr-28 break-words">{entry.title}</h4>
                            <p className="text-sm md:text-base text-zinc-400 leading-relaxed font-serif-novel">{entry.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {currentView === 'characters' && activeNovel && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <CharactersView
              novel={activeNovel}
              onEditCharacter={(char) => setEditingChar(char)}
              onAddCharacter={() => setEditingChar(createNewCharacter())}
              onSetProtagonist={handleSetProtagonist}
              onGeneratePortrait={handleGeneratePortrait}
              isGeneratingPortrait={isGeneratingPortrait}
              onUpdateNovel={updateActiveNovel}
              onNavigate={() => { }}
            />
          </Suspense>
        )}
        {false && currentView === 'characters_old' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
              <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Codex</h2>
              <button
                onClick={() => setEditingChar(createNewCharacter())}
                className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 whitespace-nowrap"
                aria-label="Add new character"
              >
                Add Being
              </button>
            </div>
            {activeNovel.characterCodex.length === 0 ? (
              <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Characters Yet</h3>
                <p className="text-sm text-zinc-500 mb-6">Start building your cast by adding characters to your codex.</p>
                <button
                  onClick={() => setEditingChar(createNewCharacter())}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
                >
                  Add First Character
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-8 md:gap-12">
                {activeNovel.characterCodex.map(char => (
                  <div key={char.id} className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden flex flex-col md:flex-row group transition-all duration-200 hover:shadow-xl hover:shadow-amber-900/5">
                    <div className="w-full md:w-80 bg-zinc-800/50 p-6 md:p-10 flex flex-col items-center justify-center text-center relative border-b md:border-b-0 md:border-r border-zinc-700">
                      {char.isProtagonist ? (
                        <span
                          className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-600/15 text-amber-400 shadow-lg"
                          title="This character is the protagonist"
                        >
                          ★ Protagonist
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!activeNovel) return;
                            // Enforce single protagonist across the codex and persist immediately.
                            const updatedNovel: NovelState = {
                              ...activeNovel,
                              characterCodex: activeNovel.characterCodex.map(c => ({
                                ...c,
                                isProtagonist: c.id === char.id,
                              })),
                              updatedAt: Date.now(),
                            };

                            updateActiveNovel(() => updatedNovel);
                          }}
                          className="absolute top-3 left-3 text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900/70 text-zinc-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all duration-200 shadow-lg focus-visible:outline-amber-600 focus-visible:outline-2"
                          title="Set as protagonist (main character)"
                          aria-label={`Set ${char.name || 'this character'} as protagonist`}
                        >
                          Set Protagonist
                        </button>
                      )}
                      <button
                        onClick={() => setEditingChar(char)}
                        className="absolute top-3 right-3 text-xs text-zinc-500 hover:text-amber-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 shadow-lg z-10"
                        aria-label={`Edit ${char.name}`}
                      >
                        Edit
                      </button>
                      {char.portraitUrl ? (
                        <img
                          src={char.portraitUrl}
                          className="w-32 h-32 rounded-full object-cover mb-6 border-4 border-amber-600/30 shadow-2xl"
                          alt={`Portrait of ${char.name}`}
                        />
                      ) : (
                        <div className="w-32 h-32 rounded-full bg-zinc-800 mb-6 flex items-center justify-center text-4xl border border-zinc-700">👤</div>
                      )}
                      <h3
                        className="font-fantasy text-xl md:text-2xl font-bold text-amber-500 truncate w-full px-4 cursor-pointer hover:text-amber-400 transition-colors"
                        onClick={() => {
                          // Could scroll to character details or highlight
                          // For now, just ensure we're on characters view
                          if (currentView !== 'characters') {
                            setView('characters');
                          }
                        }}
                        title="Click to view character details"
                      >
                        {char.name}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-2 uppercase font-bold tracking-wider">{char.currentCultivation}</p>
                      <button
                        disabled={isGeneratingPortrait === char.id}
                        onClick={() => handleGeneratePortrait(char)}
                        className="mt-6 md:mt-8 text-xs bg-zinc-700/50 hover:bg-zinc-700 px-4 py-2 rounded-full text-zinc-400 hover:text-amber-400 transition-all duration-200 font-semibold border border-zinc-700 hover:border-amber-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-700/50"
                        title="Generate AI Portrait for Character"
                        aria-label={`Generate portrait for ${char.name}`}
                      >
                        {isGeneratingPortrait === char.id ? (
                          <span className="flex items-center">
                            <span className="animate-spin rounded-full h-3 w-3 border-2 border-amber-400/30 border-t-amber-400 mr-2"></span>
                            Generating...
                          </span>
                        ) : (
                          '🎨 Manifest Portrait'
                        )}
                      </button>
                    </div>
                    <div className="flex-1 p-6 md:p-10 space-y-8 bg-zinc-900/30">
                      {/* Items Display - Grouped by Category */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                          <span className="w-2 h-2 rounded-full bg-amber-500 mr-2"></span> Items & Possessions
                        </h4>
                        {(() => {
                          // Get active possessions
                          const activePossessions = (char.itemPossessions || []).filter(p => p.status === 'active');
                          const archivedPossessions = (char.itemPossessions || []).filter(p => p.status !== 'active');

                          // Group active possessions by category
                          const itemsByCategory: Record<string, Array<{ possession: CharacterItemPossession; item: NovelItem }>> = {};
                          activePossessions.forEach(poss => {
                            const item = activeNovel.novelItems?.find(i => i.id === poss.itemId);
                            if (item) {
                              if (!itemsByCategory[item.category]) itemsByCategory[item.category] = [];
                              itemsByCategory[item.category].push({ possession: poss, item });
                            }
                          });

                          // Fallback to old items array for backward compatibility
                          const oldItems = char.items || [];
                          const hasNewFormat = activePossessions.length > 0 || archivedPossessions.length > 0;
                          const hasOldFormat = oldItems.length > 0 && !hasNewFormat;

                          if (hasOldFormat) {
                            // Display old format (backward compatibility)
                            return (
                              <div className="flex flex-wrap gap-2">
                                {oldItems.map((it, i) => (
                                  <span key={i} className="text-xs bg-amber-950/40 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-900/40 font-semibold">
                                    {it}
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          if (Object.keys(itemsByCategory).length === 0 && archivedPossessions.length === 0) {
                            return <p className="text-xs text-zinc-500 italic">No items recorded</p>;
                          }

                          return (
                            <div className="space-y-4">
                              {['Treasure', 'Equipment', 'Consumable', 'Essential'].map(category => {
                                const categoryItems = itemsByCategory[category] || [];
                                if (categoryItems.length === 0) return null;

                                return (
                                  <div key={category} className="space-y-2">
                                    <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{category}</h5>
                                    <div className="flex flex-wrap gap-2">
                                      {categoryItems.map(({ possession, item }) => {
                                        const currentChapter = activeNovel.chapters.length;
                                        return (
                                          <div key={possession.id} className="group relative flex items-center gap-1">
                                            <span className="text-xs bg-amber-950/40 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-900/40 font-semibold cursor-help">
                                              {item.name}
                                              {item.powers.length > 0 && (
                                                <span className="ml-1 text-amber-500/60">⚡</span>
                                              )}
                                            </span>
                                            {/* Archive button */}
                                            <button
                                              onClick={() => {
                                                if (!activeNovel) return;
                                                const updatedPossession = archivePossession(possession, currentChapter);
                                                updateActiveNovel(prev => ({
                                                  ...prev,
                                                  characterCodex: prev.characterCodex.map(c =>
                                                    c.id === char.id
                                                      ? {
                                                        ...c,
                                                        itemPossessions: (c.itemPossessions || []).map(p =>
                                                          p.id === possession.id ? updatedPossession : p
                                                        )
                                                      }
                                                      : c
                                                  ),
                                                  updatedAt: Date.now()
                                                }));
                                                addLog(`Item Archived: ${item.name} - ${char.name}`, 'update');
                                              }}
                                              className="text-[10px] text-zinc-500 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-zinc-800"
                                              title="Archive this item"
                                            >
                                              📦
                                            </button>
                                            {/* Tooltip with item details */}
                                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 bg-zinc-800 border border-amber-500/50 rounded-lg p-3 shadow-xl w-64">
                                              <p className="text-xs text-zinc-300 font-semibold mb-1">{item.name}</p>
                                              {item.description && (
                                                <p className="text-xs text-zinc-400 mb-2">{item.description}</p>
                                              )}
                                              {item.powers.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Powers:</p>
                                                  <ul className="text-xs text-amber-400 space-y-1">
                                                    {item.powers.slice(0, 3).map((power, i) => (
                                                      <li key={i}>• {power}</li>
                                                    ))}
                                                    {item.powers.length > 3 && (
                                                      <li className="text-zinc-500">+{item.powers.length - 3} more</li>
                                                    )}
                                                  </ul>
                                                </div>
                                              )}
                                              {possession.acquiredChapter && (
                                                <p className="text-[10px] text-zinc-500 mt-2">Acquired: Chapter {possession.acquiredChapter}</p>
                                              )}
                                              {item.history && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">History:</p>
                                                  <p className="text-xs text-zinc-400 italic line-clamp-2">{item.history}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Archived Items Section */}
                              {archivedPossessions.length > 0 && (
                                <details className="mt-4">
                                  <summary className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-400">
                                    Archived ({archivedPossessions.length})
                                  </summary>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {archivedPossessions.map(poss => {
                                      const item = activeNovel.novelItems?.find(i => i.id === poss.itemId);
                                      if (!item) return null;
                                      return (
                                        <div key={poss.id} className="group relative flex items-center gap-1">
                                          <span className="text-xs bg-zinc-800/40 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold line-through">
                                            {item.name} ({poss.status})
                                          </span>
                                          {/* Restore button */}
                                          <button
                                            onClick={() => {
                                              if (!activeNovel) return;
                                              const restoredPossession = restorePossession(poss);
                                              updateActiveNovel(prev => ({
                                                ...prev,
                                                characterCodex: prev.characterCodex.map(c =>
                                                  c.id === char.id
                                                    ? {
                                                      ...c,
                                                      itemPossessions: (c.itemPossessions || []).map(p =>
                                                        p.id === poss.id ? restoredPossession : p
                                                      )
                                                    }
                                                    : c
                                                ),
                                                updatedAt: Date.now()
                                              }));
                                              addLog(`Item Restored: ${item.name} - ${char.name}`, 'update');
                                            }}
                                            className="text-[10px] text-emerald-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-emerald-950/20"
                                            title="Restore this item"
                                          >
                                            ↻
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>

                      {/* Techniques Display - Grouped by Category */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></span> Techniques & Mastery
                        </h4>
                        {(() => {
                          // Get active masteries
                          const activeMasteries = (char.techniqueMasteries || []).filter(m => m.status === 'active');
                          const archivedMasteries = (char.techniqueMasteries || []).filter(m => m.status !== 'active');

                          // Group active masteries by category
                          const techniquesByCategory: Record<string, Array<{ mastery: CharacterTechniqueMastery; technique: NovelTechnique }>> = {};
                          activeMasteries.forEach(mast => {
                            const technique = activeNovel.novelTechniques?.find(t => t.id === mast.techniqueId);
                            if (technique) {
                              if (!techniquesByCategory[technique.category]) techniquesByCategory[technique.category] = [];
                              techniquesByCategory[technique.category].push({ mastery: mast, technique });
                            }
                          });

                          // Fallback to old skills array for backward compatibility
                          const oldSkills = char.skills || [];
                          const hasNewFormat = activeMasteries.length > 0 || archivedMasteries.length > 0;
                          const hasOldFormat = oldSkills.length > 0 && !hasNewFormat;

                          if (hasOldFormat) {
                            // Display old format (backward compatibility)
                            return (
                              <div className="flex flex-wrap gap-2">
                                {oldSkills.map((s, i) => (
                                  <span key={i} className="text-xs bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/40 font-semibold">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            );
                          }

                          if (Object.keys(techniquesByCategory).length === 0 && archivedMasteries.length === 0) {
                            return <p className="text-xs text-zinc-500 italic">No techniques recorded</p>;
                          }

                          return (
                            <div className="space-y-4">
                              {['Core', 'Important', 'Standard', 'Basic'].map(category => {
                                const categoryTechniques = techniquesByCategory[category] || [];
                                if (categoryTechniques.length === 0) return null;

                                return (
                                  <div key={category} className="space-y-2">
                                    <h5 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{category}</h5>
                                    <div className="flex flex-wrap gap-2">
                                      {categoryTechniques.map(({ mastery, technique }) => {
                                        const currentChapter = activeNovel.chapters.length;
                                        return (
                                          <div key={mastery.id} className="group relative flex items-center gap-1">
                                            <span className="text-xs bg-emerald-950/40 text-emerald-400 px-3 py-1.5 rounded-lg border border-emerald-900/40 font-semibold cursor-help">
                                              {technique.name}
                                              <span className="ml-1 text-emerald-500/60">({mastery.masteryLevel || 'Novice'})</span>
                                              {technique.functions.length > 0 && (
                                                <span className="ml-1 text-emerald-500/60">⚡</span>
                                              )}
                                            </span>
                                            {/* Archive button */}
                                            <button
                                              onClick={() => {
                                                if (!activeNovel) return;
                                                const updatedMastery = archiveMastery(mastery, currentChapter);
                                                updateActiveNovel(prev => ({
                                                  ...prev,
                                                  characterCodex: prev.characterCodex.map(c =>
                                                    c.id === char.id
                                                      ? {
                                                        ...c,
                                                        techniqueMasteries: (c.techniqueMasteries || []).map(m =>
                                                          m.id === mastery.id ? updatedMastery : m
                                                        )
                                                      }
                                                      : c
                                                  ),
                                                  updatedAt: Date.now()
                                                }));
                                                addLog(`Technique Archived: ${technique.name} - ${char.name}`, 'update');
                                              }}
                                              className="text-[10px] text-zinc-500 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-zinc-800"
                                              title="Archive this technique"
                                            >
                                              📦
                                            </button>
                                            {/* Tooltip with technique details */}
                                            <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 bg-zinc-800 border border-emerald-500/50 rounded-lg p-3 shadow-xl w-64">
                                              <p className="text-xs text-zinc-300 font-semibold mb-1">{technique.name}</p>
                                              <p className="text-[10px] text-zinc-500 mb-1">{technique.type} • {technique.category}</p>
                                              {technique.description && (
                                                <p className="text-xs text-zinc-400 mb-2">{technique.description}</p>
                                              )}
                                              {technique.functions.length > 0 && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">Functions:</p>
                                                  <ul className="text-xs text-emerald-400 space-y-1">
                                                    {technique.functions.slice(0, 3).map((func, i) => (
                                                      <li key={i}>• {func}</li>
                                                    ))}
                                                    {technique.functions.length > 3 && (
                                                      <li className="text-zinc-500">+{technique.functions.length - 3} more</li>
                                                    )}
                                                  </ul>
                                                </div>
                                              )}
                                              {mastery.learnedChapter && (
                                                <p className="text-[10px] text-zinc-500 mt-2">Learned: Chapter {mastery.learnedChapter}</p>
                                              )}
                                              {technique.history && (
                                                <div className="mt-2 pt-2 border-t border-zinc-700">
                                                  <p className="text-[10px] text-zinc-500 uppercase mb-1">History:</p>
                                                  <p className="text-xs text-zinc-400 italic line-clamp-2">{technique.history}</p>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Archived Techniques Section */}
                              {archivedMasteries.length > 0 && (
                                <details className="mt-4">
                                  <summary className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-400">
                                    Archived ({archivedMasteries.length})
                                  </summary>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {archivedMasteries.map(mast => {
                                      const technique = activeNovel.novelTechniques?.find(t => t.id === mast.techniqueId);
                                      if (!technique) return null;
                                      return (
                                        <div key={mast.id} className="group relative flex items-center gap-1">
                                          <span className="text-xs bg-zinc-800/40 text-zinc-500 px-3 py-1.5 rounded-lg border border-zinc-700 font-semibold line-through">
                                            {technique.name} ({mast.status})
                                          </span>
                                          {/* Restore button */}
                                          <button
                                            onClick={() => {
                                              if (!activeNovel) return;
                                              const restoredMastery = restoreMastery(mast);
                                              updateActiveNovel(prev => ({
                                                ...prev,
                                                characterCodex: prev.characterCodex.map(c =>
                                                  c.id === char.id
                                                    ? {
                                                      ...c,
                                                      techniqueMasteries: (c.techniqueMasteries || []).map(m =>
                                                        m.id === mast.id ? restoredMastery : m
                                                      )
                                                    }
                                                    : c
                                                ),
                                                updatedAt: Date.now()
                                              }));
                                              addLog(`Technique Restored: ${technique.name} - ${char.name}`, 'update');
                                            }}
                                            className="text-[10px] text-emerald-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-emerald-950/20"
                                            title="Restore this technique"
                                          >
                                            ↻
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="md:col-span-2 space-y-4 pt-4 border-t border-zinc-700">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center">
                          <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span> Karma Links (Relationships)
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {char.relationships.length > 0 ? char.relationships.map((rel, idx) => {
                            const target = activeNovel.characterCodex.find(c => c.id === rel.characterId);
                            const isEnemy = rel.type.toLowerCase().includes('enemy') || rel.type.toLowerCase().includes('rival');
                            return (
                              <div key={idx} className={`bg-zinc-800/40 p-4 rounded-xl border flex flex-col transition-all duration-200 hover:bg-zinc-800/60 ${isEnemy ? 'border-red-900/40' : 'border-amber-900/40'}`}>
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-md ${isEnemy ? 'bg-red-600/20 text-red-400' : 'bg-amber-600/20 text-amber-400'}`}>
                                    {rel.type}
                                  </span>
                                  <span className="text-xs text-zinc-500 font-semibold">Realm: {target?.currentCultivation.split(' ')[0] || '?'}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (target) {
                                      setView('characters');
                                      // Could scroll to character or highlight it
                                    }
                                  }}
                                  className="text-base md:text-lg font-fantasy font-bold text-zinc-100 mb-2 hover:text-amber-400 transition-colors text-left"
                                  title={`View ${target?.name || 'character'}`}
                                >
                                  {target?.name || "Unknown Being"}
                                </button>
                                <div className="mt-2 space-y-2">
                                  <p className="text-xs text-zinc-400 leading-relaxed font-serif-novel">
                                    <span className="font-bold text-amber-600/60 uppercase mr-1 text-[10px]">History:</span> {rel.history}
                                  </p>
                                  <p className="text-xs text-zinc-400 leading-relaxed font-serif-novel italic">
                                    <span className="font-bold text-indigo-400/60 uppercase mr-1 text-[10px]">Impact:</span> {rel.impact}
                                  </p>
                                </div>
                              </div>
                            )
                          }) : (
                            <p className="text-xs text-zinc-500 italic md:col-span-2">No significant karma discovered in this world segment...</p>
                          )}
                        </div>
                      </div>
                      <div className="md:col-span-2 pt-4 border-t border-zinc-700">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4">Fate Summary</h4>
                        <p className="text-base md:text-lg text-zinc-300 leading-relaxed italic border-l-2 border-amber-600/30 pl-6 font-serif-novel">"{char.notes || 'No fate summary recorded...'}"</p>
                      </div>
                      {activeNovel && (
                        <RelatedEntities
                          novelState={activeNovel}
                          entityType="character"
                          entityId={char.id}
                          maxItems={5}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {false && currentView === 'characters_old' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
            {/* Old inline characters view - disabled */}
          </div>
        )}

        {currentView === 'story-threads' && activeNovel && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <StoryThreadsView novelState={activeNovel} />
          </Suspense>
        )}

        {currentView === 'loom' && activeNovel && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <LoomDashboard
              novelState={activeNovel}
              onUpdateThread={handleUpdateThread}
              onForceAttention={handleForceAttention}
              onBoostKarma={handleBoostKarma}
              onMarkAbandoned={handleMarkAbandoned}
            />
          </Suspense>
        )}

        {currentView === 'narrative-forensics' && activeNovel && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <LoomExcavator
              novelState={activeNovel}
              onSeedApproved={(seed, thread) => {
                console.log('Seed approved:', seed.title, 'Thread:', thread);

                const approvedThread = thread as any;
                if (!approvedThread?.id) {
                  return;
                }

                updateActiveNovel(prev => {
                  const existing = prev.storyThreads || [];
                  const nextThreads = existing.some(t => t.id === approvedThread.id)
                    ? existing.map(t => (t.id === approvedThread.id ? { ...t, ...approvedThread } : t))
                    : [...existing, approvedThread];

                  return {
                    ...prev,
                    storyThreads: nextThreads,
                    updatedAt: Date.now(),
                  };
                });

                // TODO: Add thread to novel state
              }}
              onSeedRejected={(seed) => {
                console.log('Seed rejected:', seed.title);
              }}
              onScanComplete={(result) => {
                console.log('Scan complete:', result.summary);
              }}
            />
          </Suspense>
        )}

        {currentView === 'gate-history' && activeNovel && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
              <TribulationGateHistoryView
                novel={activeNovel}
                onViewChapter={(chapterNumber) => {
                  const chapter = activeNovel.chapters.find(c => c.number === chapterNumber);
                  if (chapter) {
                    setActiveChapterId(chapter.id);
                    setCurrentView('chapters');
                  }
                }}
                onClose={() => setCurrentView('dashboard')}
                onWhatIfReplay={openWhatIfDialog}
              />
            </div>
          </Suspense>
        )}

        {currentView === 'antagonists' && activeNovel && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
            <Suspense fallback={<div className="text-zinc-400 text-center py-12">Loading Opposition Registry...</div>}>
              <AntagonistManager
                novel={activeNovel}
                onUpdate={(updatedNovel) => {
                  updateActiveNovel(() => updatedNovel);
                }}
              />
            </Suspense>
          </div>
        )}

        {currentView === 'character-systems' && activeNovel && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
            <Suspense fallback={<div className="text-zinc-400 text-center py-12">Loading Character Systems Registry...</div>}>
              <SystemManager
                novel={activeNovel}
                onUpdate={(updatedNovel) => {
                  updateActiveNovel(() => updatedNovel);
                }}
              />
            </Suspense>
          </div>
        )}

        {currentView === 'planning' && (
          <Suspense fallback={<LoadingSpinnerCentered />}>
            <PlanningView
              novel={activeNovel}
              isPlanning={isPlanning}
              onPlanNewArc={handlePlanNewArc}
              onUpdateGrandSaga={(saga) => updateActiveNovel(prev => ({ ...prev, grandSaga: saga }))}
              onEditArc={setEditingArc}
              onSetActiveArc={handleSetActiveArc}
              onChapterSelect={setActiveChapterId}
              onViewChange={setView}
              onEditorReview={() => setShowManualEditor(true)}
              onUpdateNovel={updateActiveNovel}
              onShowSuccess={showSuccess}
              onShowError={showError}
              onStartLoading={startLoading}
              onStopLoading={stopLoading}
              onUpdateProgress={updateProgress}
              onUpdateMessage={updateMessage}
              onSetGenerationStatus={setGenerationStatus}
              onSetIsGenerating={setIsGenerating}
              onAddLog={addEphemeralLog}
              onSetCurrentEditorReport={setCurrentEditorReport}
              onSetPendingFixProposals={setPendingFixProposals}
              onDeleteArc={handleDeleteArc}
            />
          </Suspense>
        )}

        {editingArc && activeNovel && (
          <ArcForm
            arc={editingArc}
            novelState={activeNovel}
            onSave={handleSaveArc}
            onCancel={() => setEditingArc(null)}
            onUpdateArc={(arc) => setEditingArc(arc)}
          />
        )}

        {editingWorld && activeNovel && (
          <WorldEntryForm
            entry={editingWorld}
            novelState={activeNovel}
            onSave={(entry) => {
              updateActiveNovel(prev => ({
                ...prev,
                worldBible: prev.worldBible.some(e => e.id === entry.id)
                  ? prev.worldBible.map(e => e.id === entry.id ? entry : e)
                  : [...prev.worldBible, entry]
              }));
              setEditingWorld(null);
            }}
            onCancel={() => setEditingWorld(null)}
            onUpdateEntry={(entry) => setEditingWorld(entry)}
            showWarning={showWarning}
          />
        )}

        {editingChar && activeNovel && (
          <CharacterForm
            character={editingChar}
            novelState={activeNovel}
            onSave={handleSaveCharacter}
            onCancel={() => setEditingChar(null)}
            onUpdateCharacter={(character) => setEditingChar(character)}
          />
        )}
      </main>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
      />

      {/* Tribulation Gate Modal */}
      {showTribulationGate && currentTribulationGate && (
        <TribulationGateModal
          gate={currentTribulationGate}
          isOpen={showTribulationGate}
          onSelectPath={handleTribulationGateSelect}
          onSkip={handleTribulationGateSkip}
          onLetFateDecide={handleTribulationGateLetFateDecide}
          isLoading={tribulationGateLoading}
          autoSelectAfterMs={
            activeNovel?.tribulationGateConfig?.autoSelectAfterMs
          }
        />
      )}

      {/* Manual Tribulation Gate Dialog */}
      {showManualGateDialog && activeNovel && (
        <ManualTribulationGateDialog
          isOpen={showManualGateDialog}
          onClose={() => setShowManualGateDialog(false)}
          onTriggerGate={handleManualGateTrigger}
          novel={activeNovel}
          isLoading={manualGateLoading}
        />
      )}

      {/* What If Gate Replay Dialog */}
      {showWhatIfDialog && whatIfGate && activeNovel && (
        <WhatIfGateReplayDialog
          isOpen={showWhatIfDialog}
          onClose={() => {
            setShowWhatIfDialog(false);
            setWhatIfGate(null);
          }}
          gate={whatIfGate}
          novel={activeNovel}
          onReplay={handleWhatIfReplay}
          isLoading={whatIfLoading}
        />
      )}

      {showExportDialog && activeNovel && (
        <Suspense fallback={null}>
          <ExportDialog novel={activeNovel} onClose={() => setShowExportDialog(false)} />
        </Suspense>
      )}

      {/* Keyboard Shortcuts Help */}
      {showShortcutsHelp && (
        <Suspense fallback={null}>
          <KeyboardShortcutsHelp isOpen={showShortcutsHelp} onClose={() => setShowShortcutsHelp(false)} />
        </Suspense>
      )}

      {/* Onboarding Tour */}
      {activeTour && (() => {
        const tour = getTourById(activeTour);
        if (!tour) return null;
        return (
          <OnboardingTour
            tour={tour}
            currentStep={currentStep}
            onNext={nextStep}
            onPrevious={previousStep}
            onClose={() => endTour(activeTour)}
            onComplete={() => {
              if (activeTour === MAIN_ONBOARDING_TOUR.id) {
                markOnboardingComplete();
              }
              endTour(activeTour);
            }}
          />
        );
      })()}

      {/* Help Menu */}
      {showOnboardingMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-amber-600/50 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-fantasy font-bold text-amber-400">Help & Tours</h3>
              <button
                onClick={() => setShowOnboardingMenu(false)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Close help menu"
              >
                ×
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => {
                  startTour(MAIN_ONBOARDING_TOUR.id);
                  setShowOnboardingMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="font-semibold text-zinc-200">Welcome Tour</div>
                <div className="text-sm text-zinc-400">Get started with the basics</div>
              </button>
              <button
                onClick={() => {
                  startTour('dashboard-tour');
                  setShowOnboardingMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="font-semibold text-zinc-200">Dashboard Tour</div>
                <div className="text-sm text-zinc-400">Learn about dashboard features</div>
              </button>
              <button
                onClick={() => {
                  startTour('editor-tour');
                  setShowOnboardingMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="font-semibold text-zinc-200">Editor Tour</div>
                <div className="text-sm text-zinc-400">Master the chapter editor</div>
              </button>
              <button
                onClick={() => {
                  startTour('planning-tour');
                  setShowOnboardingMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="font-semibold text-zinc-200">Planning Tour</div>
                <div className="text-sm text-zinc-400">Plan your story arcs</div>
              </button>
              <button
                onClick={() => {
                  setShowShortcutsHelp(true);
                  setShowOnboardingMenu(false);
                }}
                className="w-full text-left px-4 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
              >
                <div className="font-semibold text-zinc-200">Keyboard Shortcuts</div>
                <div className="text-sm text-zinc-400">View all shortcuts</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Editor Dialog */}
      {activeNovel && (
        <ManualEditorDialog
          isOpen={showManualEditor}
          novelState={activeNovel}
          onSelectArc={async (arc, editMode) => {
            setShowManualEditor(false);
            try {
              setIsGenerating(true);
              startLoading(`Starting editor review for arc: ${arc.title}...`, true);
              setGenerationProgress(5);
              setGenerationStatus(`Starting ${editMode} arc editor review...`);

              const editorReport = await triggerEditorReview(activeNovel, 'manual', arc, {
                onProgress: (phase: string, progress?: number) => {
                  if (progress !== undefined) {
                    updateProgress(progress, `Editor: ${phase}`);
                    setGenerationProgress(progress);
                    setGenerationStatus(`Editor: ${phase}`);
                  } else {
                    updateMessage(`Editor: ${phase}`);
                  }
                  addEphemeralLog(`Editor: ${phase}`, 'discovery');
                },
                onAutoFix: (fix: EditorFix) => {
                  addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
                },
              });

              if (editorReport) {
                await saveEditorReport(editorReport);
                setCurrentEditorReport(editorReport);

                if (editMode === 'automatic') {
                  // Automatic mode: apply all fixes without user confirmation
                  setGenerationStatus('Applying all fixes automatically...');

                  // Get all fixes that weren't auto-applied (exclude those that already failed during review)
                  const failedAutoFixIds = new Set(((editorReport as any)._failedAutoFixes || []).map((f: EditorFix) => f.id));
                  const fixesToApply = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && !failedAutoFixIds.has(fix.id)
                  );

                  // Log if any fixes were skipped because they already failed
                  const skippedFixes = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && failedAutoFixIds.has(fix.id)
                  );
                  if (skippedFixes.length > 0) {
                    logger.info('Skipping fixes that already failed during review', 'editor', {
                      skippedCount: skippedFixes.length,
                      skippedFixIds: skippedFixes.map(f => f.id)
                    });
                  }

                  if (fixesToApply.length > 0) {
                    // Get chapters that need to be updated
                    const chaptersToUpdate = activeNovel.chapters.filter(ch => {
                      return fixesToApply.some((fix: EditorFix) =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                    });

                    // Validate all fixes belong to the chapters we're updating
                    const validatedFixes = fixesToApply.filter((fix: EditorFix) => {
                      const belongs = chaptersToUpdate.some(ch =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                      if (!belongs) {
                        logger.error('Fix targets chapter not in update list', 'editor', undefined, {
                          fixId: fix.id,
                          fixChapterNumber: fix.chapterNumber,
                          fixChapterId: fix.chapterId
                        });
                        return false;
                      }
                      return true;
                    });

                    if (validatedFixes.length > 0) {
                      // Apply fixes
                      const { updatedChapters, appliedFixes, failedFixes } = await applyApprovedFixes(chaptersToUpdate, validatedFixes);

                      // Get failed auto-fixes from review if available
                      const editorReportWithInternal = editorReport as EditorReportWithInternal;
                      const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];

                      // Log failed fixes with details
                      if (failedFixes.length > 0) {
                        console.warn(`[Editor] ${failedFixes.length} fix(es) failed to apply in automatic mode:`, failedFixes);
                      }

                      // Update novel state with fixed chapters and save to database
                      updateActiveNovel(prev => {
                        const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
                        const updatedNovel = {
                          ...prev,
                          chapters: prev.chapters.map(ch => {
                            const updated = updatedChapterMap.get(ch.id);
                            if (updated && updated.content !== ch.content) {
                              logger.debug('Updating chapter in novel state', 'editor', {
                                chapterNumber: ch.number,
                                chapterId: ch.id
                              });
                              return updated;
                            }
                            return ch;
                          }),
                          updatedAt: Date.now(),
                        };

                        // Save to database asynchronously
                        import('./services/supabaseService').then(({ saveNovel }) => {
                          saveNovel(updatedNovel).then(() => {
                            logger.info('Successfully saved updated chapters to database', 'editor', {
                              updatedChaptersCount: updatedChapters.length
                            });
                          }).catch(err => {
                            logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err)));
                            showError('Failed to save fixed chapters to database. Changes are in memory but not saved.');
                          });
                        });

                        return updatedNovel;
                      });

                      // Update fix status in database
                      const { updateEditorFixStatus } = await import('./services/supabaseService');
                      await Promise.all(
                        appliedFixes.map(fix =>
                          updateEditorFixStatus(fix.id, 'applied', fix.appliedAt).catch(err => {
                            logger.error('Failed to update fix status', 'editor', err instanceof Error ? err : new Error(String(err)), {
                              fixId: fix.id
                            });
                          })
                        )
                      );

                      // Format comprehensive summary
                      const uniqueUpdatedChapters = new Set(updatedChapters.map(ch => ch.id)).size;
                      const summary = formatFixSummary(
                        editorReport.analysis.issues.length,
                        editorReport.autoFixedCount || 0,
                        failedAutoFixes,
                        appliedFixes.length,
                        failedFixes,
                        uniqueUpdatedChapters
                      );

                      setIsGenerating(false);
                      stopLoading();

                      // Show success or warning based on whether there were failures
                      if (failedFixes.length > 0 || failedAutoFixes.length > 0) {
                        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                      } else {
                        showSuccess(summary.summary);
                      }
                    } else {
                      // No fixes to apply in automatic mode, but show summary of what happened during review
                      const editorReportWithInternal = editorReport as EditorReportWithInternal;
                      const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];
                      const summary = formatFixSummary(
                        editorReport.analysis.issues.length,
                        editorReport.autoFixedCount || 0,
                        failedAutoFixes,
                        0, // No fixes applied in auto mode
                        [], // No failures in auto mode
                        0 // No chapters updated (already updated during review)
                      );

                      setIsGenerating(false);
                      stopLoading();

                      if (failedAutoFixes.length > 0) {
                        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                      } else {
                        showSuccess(summary.summary);
                      }
                    }
                  } else {
                    // No fixes to apply in automatic mode, but show summary of what happened during review
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                } else {
                  // Manual mode: show FixApprovalDialog
                  // Extract fix proposals for major issues
                  const { createFixProposals } = await import('./services/editorFixer');
                  const proposals = createFixProposals(editorReport.analysis.issues, editorReport.fixes);

                  if (proposals.length > 0) {
                    setPendingFixProposals(proposals);
                    setIsGenerating(false);
                    stopLoading();
                  } else {
                    // Show summary even in manual mode when no proposals
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                }

                // Create comprehensive summary for log
                const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                const summaryText = failedAutoFixes.length > 0
                  ? `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed, ${failedAutoFixes.length} auto-fixes failed.`
                  : `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed during review.`;
                addEphemeralLog(summaryText, 'discovery');
              } else {
                stopLoading();
              }
            } catch (error) {
              logger.error('Error in manual editor review', 'editor', error instanceof Error ? error : new Error(String(error)));
              stopLoading();
              const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'Unknown error occurred';

              // Check if it's a module loading error
              if (errorMessage.includes('Failed to load') || errorMessage.includes('500') || errorMessage.includes('editorAnalyzer')) {
                showError(`Editor review module failed to load. Please refresh the page and try again. Error: ${errorMessage}`);
              } else {
                showError(`Editor review failed: ${errorMessage}`);
              }

              setIsGenerating(false);
              setGenerationProgress(0);
              setGenerationStatus('');
            }
          }}
          onSelectChapters={async (startChapter, endChapter, editMode) => {
            setShowManualEditor(false);
            try {
              setIsGenerating(true);
              startLoading(`Starting editor review for chapters ${startChapter}-${endChapter}...`, true);
              setGenerationProgress(5);
              setGenerationStatus(`Starting ${editMode} review for chapters ${startChapter}-${endChapter}...`);

              const editorReport = await triggerEditorReview(activeNovel, 'manual', undefined, {
                startChapter,
                endChapter,
                onProgress: (phase: string, progress?: number) => {
                  if (progress !== undefined) {
                    updateProgress(progress, `Editor: ${phase}`);
                    setGenerationProgress(progress);
                    setGenerationStatus(`Editor: ${phase}`);
                  } else {
                    updateMessage(`Editor: ${phase}`);
                  }
                  addEphemeralLog(`Editor: ${phase}`, 'discovery');
                },
                onAutoFix: (fix: EditorFix) => {
                  addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
                },
              } as any);

              if (editorReport) {
                await saveEditorReport(editorReport);
                setCurrentEditorReport(editorReport);

                if (editMode === 'automatic') {
                  // Automatic mode: apply all fixes without user confirmation
                  setGenerationStatus('Applying all fixes automatically...');

                  // Get all fixes that weren't auto-applied (exclude those that already failed during review)
                  const failedAutoFixIds = new Set(((editorReport as any)._failedAutoFixes || []).map((f: EditorFix) => f.id));
                  const fixesToApply = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && !failedAutoFixIds.has(fix.id)
                  );

                  // Log if any fixes were skipped because they already failed
                  const skippedFixes = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && failedAutoFixIds.has(fix.id)
                  );
                  if (skippedFixes.length > 0) {
                    logger.info('Skipping fixes that already failed during review', 'editor', {
                      skippedCount: skippedFixes.length,
                      skippedFixIds: skippedFixes.map(f => f.id)
                    });
                  }

                  if (fixesToApply.length > 0) {
                    // Get chapters that need to be updated
                    const chaptersToUpdate = activeNovel.chapters.filter(ch => {
                      return fixesToApply.some((fix: EditorFix) =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                    });

                    // Validate all fixes belong to the chapters we're updating
                    const validatedFixes = fixesToApply.filter((fix: EditorFix) => {
                      const belongs = chaptersToUpdate.some(ch =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                      if (!belongs) {
                        logger.error('Fix targets chapter not in update list', 'editor', undefined, {
                          fixId: fix.id,
                          fixChapterNumber: fix.chapterNumber,
                          fixChapterId: fix.chapterId
                        });
                        return false;
                      }
                      return true;
                    });

                    if (validatedFixes.length > 0) {
                      // Apply fixes
                      const { updatedChapters, appliedFixes, failedFixes } = await applyApprovedFixes(chaptersToUpdate, validatedFixes);

                      // Get failed auto-fixes from review if available
                      const editorReportWithInternal = editorReport as EditorReportWithInternal;
                      const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];

                      // Log failed fixes with details
                      if (failedFixes.length > 0) {
                        console.warn(`[Editor] ${failedFixes.length} fix(es) failed to apply in automatic mode:`, failedFixes);
                      }

                      // Update novel state with fixed chapters and save to database
                      updateActiveNovel(prev => {
                        const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
                        const updatedNovel = {
                          ...prev,
                          chapters: prev.chapters.map(ch => {
                            const updated = updatedChapterMap.get(ch.id);
                            if (updated && updated.content !== ch.content) {
                              logger.debug('Updating chapter in novel state', 'editor', {
                                chapterNumber: ch.number,
                                chapterId: ch.id
                              });
                              return updated;
                            }
                            return ch;
                          }),
                          updatedAt: Date.now(),
                        };

                        // Save to database asynchronously
                        import('./services/supabaseService').then(({ saveNovel }) => {
                          saveNovel(updatedNovel).then(() => {
                            logger.info('Successfully saved updated chapters to database', 'editor', {
                              updatedChaptersCount: updatedChapters.length
                            });
                          }).catch(err => {
                            logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err)));
                            showError('Failed to save fixed chapters to database. Changes are in memory but not saved.');
                          });
                        });

                        return updatedNovel;
                      });

                      // Update fix status in database
                      const { updateEditorFixStatus } = await import('./services/supabaseService');
                      await Promise.all(
                        appliedFixes.map(fix =>
                          updateEditorFixStatus(fix.id, 'applied', fix.appliedAt).catch(err => {
                            logger.error('Failed to update fix status', 'editor', err instanceof Error ? err : new Error(String(err)), {
                              fixId: fix.id
                            });
                          })
                        )
                      );

                      // Format comprehensive summary
                      const uniqueUpdatedChapters = new Set(updatedChapters.map(ch => ch.id)).size;
                      const summary = formatFixSummary(
                        editorReport.analysis.issues.length,
                        editorReport.autoFixedCount || 0,
                        failedAutoFixes,
                        appliedFixes.length,
                        failedFixes,
                        uniqueUpdatedChapters
                      );

                      setIsGenerating(false);
                      stopLoading();

                      // Show success or warning based on whether there were failures
                      if (failedFixes.length > 0 || failedAutoFixes.length > 0) {
                        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                      } else {
                        showSuccess(summary.summary);
                      }
                    } else {
                      setIsGenerating(false);
                      stopLoading();
                      if (editorReport.autoFixedCount > 0) {
                        showSuccess(`Editor fixed ${editorReport.autoFixedCount} issue(s) automatically`);
                      }
                      showSuccess(`Editor review complete for chapters ${startChapter}-${endChapter}`);
                    }
                  } else {
                    // No fixes to apply in automatic mode, but show summary of what happened during review
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                } else {
                  // Manual mode: show FixApprovalDialog
                  const { createFixProposals } = await import('./services/editorFixer');
                  const proposals = createFixProposals(editorReport.analysis.issues, editorReport.fixes);

                  if (proposals.length > 0) {
                    setPendingFixProposals(proposals);
                    setIsGenerating(false);
                    stopLoading();
                  } else {
                    // Show summary even in manual mode when no proposals
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                }

                // Create comprehensive summary for log
                const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                const summaryText = failedAutoFixes.length > 0
                  ? `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed, ${failedAutoFixes.length} auto-fixes failed.`
                  : `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed during review.`;
                addEphemeralLog(summaryText, 'discovery');
              } else {
                setIsGenerating(false);
                stopLoading();
                showWarning('Editor review returned no results. Please try again.');
              }
            } catch (error) {
              logger.error('Error in manual editor review', 'editor', error instanceof Error ? error : new Error(String(error)));
              stopLoading();
              const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'Unknown error occurred';

              // Check if it's a module loading error
              if (errorMessage.includes('Failed to load') || errorMessage.includes('500') || errorMessage.includes('editorAnalyzer')) {
                showError(`Editor review module failed to load. Please refresh the page and try again. Error: ${errorMessage}`);
              } else {
                showError(`Editor review failed: ${errorMessage}`);
              }

              setIsGenerating(false);
              setGenerationProgress(0);
              setGenerationStatus('');
            }
          }}
          onSelectSpecificChapters={async (chapterNumbers, editMode) => {
            setShowManualEditor(false);
            try {
              setIsGenerating(true);
              startLoading(`Starting editor review for chapters ${chapterNumbers.join(', ')}...`, true);
              setGenerationProgress(5);
              setGenerationStatus(`Starting ${editMode} review for chapters ${chapterNumbers.join(', ')}...`);

              const editorReport = await triggerEditorReview(activeNovel, 'manual', undefined, {
                chapterNumbers,
                onProgress: (phase: string, progress?: number) => {
                  if (progress !== undefined) {
                    updateProgress(progress, `Editor: ${phase}`);
                    setGenerationProgress(progress);
                    setGenerationStatus(`Editor: ${phase}`);
                  } else {
                    updateMessage(`Editor: ${phase}`);
                  }
                  addEphemeralLog(`Editor: ${phase}`, 'discovery');
                },
                onAutoFix: (fix: EditorFix) => {
                  addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
                },
              } as any);

              if (editorReport) {
                await saveEditorReport(editorReport);
                setCurrentEditorReport(editorReport);

                if (editMode === 'automatic') {
                  // Automatic mode: apply all fixes without user confirmation
                  setGenerationStatus('Applying all fixes automatically...');

                  // Get all fixes that weren't auto-applied (exclude those that already failed during review)
                  const failedAutoFixIds = new Set(((editorReport as any)._failedAutoFixes || []).map((f: EditorFix) => f.id));
                  const fixesToApply = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && !failedAutoFixIds.has(fix.id)
                  );

                  // Log if any fixes were skipped because they already failed
                  const skippedFixes = editorReport.fixes.filter((fix: EditorFix) =>
                    fix.status === 'pending' && failedAutoFixIds.has(fix.id)
                  );
                  if (skippedFixes.length > 0) {
                    logger.info('Skipping fixes that already failed during review', 'editor', {
                      skippedCount: skippedFixes.length,
                      skippedFixIds: skippedFixes.map(f => f.id)
                    });
                  }

                  if (fixesToApply.length > 0) {
                    // Get chapters that need to be updated
                    const chaptersToUpdate = activeNovel.chapters.filter(ch => {
                      return fixesToApply.some((fix: EditorFix) =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                    });

                    // Validate all fixes belong to the chapters we're updating
                    const validatedFixes = fixesToApply.filter((fix: EditorFix) => {
                      const belongs = chaptersToUpdate.some(ch =>
                        fix.chapterId === ch.id || fix.chapterNumber === ch.number
                      );
                      if (!belongs) {
                        logger.error('Fix targets chapter not in update list', 'editor', undefined, {
                          fixId: fix.id,
                          fixChapterNumber: fix.chapterNumber,
                          fixChapterId: fix.chapterId
                        });
                        return false;
                      }
                      return true;
                    });

                    if (validatedFixes.length > 0) {
                      // Apply fixes
                      const { updatedChapters, appliedFixes, failedFixes } = await applyApprovedFixes(chaptersToUpdate, validatedFixes);

                      // Get failed auto-fixes from review if available
                      const editorReportWithInternal = editorReport as EditorReportWithInternal;
                      const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];

                      // Log failed fixes with details
                      if (failedFixes.length > 0) {
                        console.warn(`[Editor] ${failedFixes.length} fix(es) failed to apply in automatic mode:`, failedFixes);
                      }

                      // Update novel state with fixed chapters and save to database
                      updateActiveNovel(prev => {
                        const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
                        const updatedNovel = {
                          ...prev,
                          chapters: prev.chapters.map(ch => {
                            const updated = updatedChapterMap.get(ch.id);
                            if (updated && updated.content !== ch.content) {
                              logger.debug('Updating chapter in novel state', 'editor', {
                                chapterNumber: ch.number,
                                chapterId: ch.id
                              });
                              return updated;
                            }
                            return ch;
                          }),
                          updatedAt: Date.now(),
                        };

                        // Save to database asynchronously
                        import('./services/supabaseService').then(({ saveNovel }) => {
                          saveNovel(updatedNovel).then(() => {
                            logger.info('Successfully saved updated chapters to database', 'editor', {
                              updatedChaptersCount: updatedChapters.length
                            });
                          }).catch(err => {
                            logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err)));
                            showError('Failed to save fixed chapters to database. Changes are in memory but not saved.');
                          });
                        });

                        return updatedNovel;
                      });

                      // Update fix status in database
                      const { updateEditorFixStatus } = await import('./services/supabaseService');
                      await Promise.all(
                        appliedFixes.map(fix =>
                          updateEditorFixStatus(fix.id, 'applied', fix.appliedAt).catch(err => {
                            logger.error('Failed to update fix status', 'editor', err instanceof Error ? err : new Error(String(err)), {
                              fixId: fix.id
                            });
                          })
                        )
                      );

                      // Format comprehensive summary
                      const uniqueUpdatedChapters = new Set(updatedChapters.map(ch => ch.id)).size;
                      const summary = formatFixSummary(
                        editorReport.analysis.issues.length,
                        editorReport.autoFixedCount || 0,
                        failedAutoFixes,
                        appliedFixes.length,
                        failedFixes,
                        uniqueUpdatedChapters
                      );

                      setIsGenerating(false);
                      stopLoading();

                      // Show success or warning based on whether there were failures
                      if (failedFixes.length > 0 || failedAutoFixes.length > 0) {
                        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                      } else {
                        showSuccess(summary.summary);
                      }
                    } else {
                      // No fixes to apply in automatic mode, but show summary of what happened during review
                      const editorReportWithInternal = editorReport as EditorReportWithInternal;
                      const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];
                      const summary = formatFixSummary(
                        editorReport.analysis.issues.length,
                        editorReport.autoFixedCount || 0,
                        failedAutoFixes,
                        0, // No fixes applied in auto mode
                        [], // No failures in auto mode
                        0 // No chapters updated (already updated during review if any)
                      );

                      setIsGenerating(false);
                      stopLoading();

                      if (failedAutoFixes.length > 0) {
                        showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                      } else {
                        showSuccess(summary.summary);
                      }
                    }
                  } else {
                    // No fixes to apply in automatic mode, but show summary of what happened during review
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                } else {
                  // Manual mode: show FixApprovalDialog
                  const { createFixProposals } = await import('./services/editorFixer');
                  const proposals = createFixProposals(editorReport.analysis.issues, editorReport.fixes);

                  if (proposals.length > 0) {
                    setPendingFixProposals(proposals);
                    setIsGenerating(false);
                    stopLoading();
                  } else {
                    // Show summary even in manual mode when no proposals
                    const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                    const summary = formatFixSummary(
                      editorReport.analysis.issues.length,
                      editorReport.autoFixedCount || 0,
                      failedAutoFixes,
                      0, // No fixes applied in auto mode
                      [], // No failures in auto mode
                      0 // No chapters updated (already updated during review if any)
                    );

                    setIsGenerating(false);
                    stopLoading();

                    if (failedAutoFixes.length > 0) {
                      showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
                    } else {
                      showSuccess(summary.summary);
                    }
                  }
                }

                // Create comprehensive summary for log
                const failedAutoFixes = (editorReport as any)._failedAutoFixes || [];
                const summaryText = failedAutoFixes.length > 0
                  ? `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed, ${failedAutoFixes.length} auto-fixes failed.`
                  : `Editor review complete: ${editorReport.analysis.issues.length} issue(s) found. ${editorReport.autoFixedCount || 0} auto-fixed during review.`;
                addEphemeralLog(summaryText, 'discovery');
              } else {
                setIsGenerating(false);
                stopLoading();
                showWarning('Editor review returned no results. Please try again.');
              }
            } catch (error) {
              logger.error('Error in manual editor review', 'editor', error instanceof Error ? error : new Error(String(error)));
              stopLoading();
              const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : 'Unknown error occurred';

              // Check if it's a module loading error
              if (errorMessage.includes('Failed to load') || errorMessage.includes('500') || errorMessage.includes('editorAnalyzer')) {
                showError(`Editor review module failed to load. Please refresh the page and try again. Error: ${errorMessage}`);
              } else {
                showError(`Editor review failed: ${errorMessage}`);
              }

              setIsGenerating(false);
              setGenerationProgress(0);
              setGenerationStatus('');
            }
          }}
          onCancel={() => setShowManualEditor(false)}
        />
      )}

      {/* Fix Approval Dialog */}
      <FixApprovalDialog
        isOpen={pendingFixProposals.length > 0}
        proposals={pendingFixProposals}
        onApprove={async (approvedFixIds) => {
          if (!currentEditorReport || !activeNovel) return;

          try {
            setIsGenerating(true);
            setGenerationStatus('Applying approved fixes...');

            // Get approved fixes
            const approvedFixes = currentEditorReport.fixes.filter((fix: EditorFix) =>
              approvedFixIds.includes(fix.id)
            );

            // CRITICAL: Get chapters that need to be updated - match by both ID and number for safety
            const chaptersToUpdate = activeNovel.chapters.filter(ch => {
              return approvedFixes.some((fix: EditorFix) =>
                fix.chapterId === ch.id || fix.chapterNumber === ch.number
              );
            });

            // Validate all fixes belong to the chapters we're updating
            const validatedFixes = approvedFixes.filter((fix: EditorFix) => {
              const belongs = chaptersToUpdate.some(ch =>
                fix.chapterId === ch.id || fix.chapterNumber === ch.number
              );
              if (!belongs) {
                logger.error('Fix targets chapter not in update list', 'editor', undefined, {
                  fixId: fix.id,
                  fixChapterNumber: fix.chapterNumber,
                  fixChapterId: fix.chapterId
                });
                showWarning(`Fix for chapter ${fix.chapterNumber} was skipped - chapter not found in update list.`);
                return false;
              }
              return true;
            });

            if (validatedFixes.length === 0) {
              showError('No valid fixes to apply. All fixes were filtered out.');
              setIsGenerating(false);
              return;
            }

            // Apply fixes
            const { updatedChapters, appliedFixes, failedFixes } = await applyApprovedFixes(chaptersToUpdate, validatedFixes);

            // Get failed auto-fixes from review if available
            const editorReportWithInternal = currentEditorReport as EditorReportWithInternal;
            const failedAutoFixes = editorReportWithInternal._failedAutoFixes || [];

            // Log failed fixes with details
            if (failedFixes.length > 0) {
              logger.warn(`${failedFixes.length} fix(es) failed to apply`, 'editor', {
                failedCount: failedFixes.length,
                failedFixes: failedFixes.map(f => ({ id: f.id, chapterNumber: f.chapterNumber, failureReason: f.failureReason }))
              });
            }

            // Log what was updated for debugging
            updatedChapters.forEach(updatedChapter => {
              const originalChapter = activeNovel.chapters.find(ch => ch.id === updatedChapter.id);
              if (originalChapter && originalChapter.content !== updatedChapter.content) {
                logger.debug('Chapter was updated', 'editor', {
                  chapterNumber: updatedChapter.number,
                  chapterId: updatedChapter.id,
                  oldLength: originalChapter.content.length,
                  newLength: updatedChapter.content.length
                });
              }
            });

            // Update novel state with fixed chapters and save to database
            updateActiveNovel(prev => {
              const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
              const updatedNovel = {
                ...prev,
                chapters: prev.chapters.map(ch => {
                  const updated = updatedChapterMap.get(ch.id);
                  if (updated && updated.content !== ch.content) {
                    logger.debug('Updating chapter in novel state', 'editor', {
                      chapterNumber: ch.number,
                      chapterId: ch.id
                    });
                    return updated;
                  }
                  return ch;
                }),
                updatedAt: Date.now(),
              };

              // Save to database asynchronously
              import('./services/supabaseService').then(({ saveNovel }) => {
                saveNovel(updatedNovel).then(() => {
                  logger.info('Successfully saved updated chapters to database', 'editor', {
                    updatedChaptersCount: updatedChapters.length
                  });
                }).catch(err => {
                  logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err)));
                  showError('Failed to save fixed chapters to database. Changes are in memory but not saved.');
                });
              });

              return updatedNovel;
            });

            // Update fix status in database
            const { updateEditorFixStatus } = await import('./services/supabaseService');
            await Promise.all(
              appliedFixes.map(fix =>
                updateEditorFixStatus(fix.id, 'applied', fix.appliedAt).catch(err => {
                  logger.error('Failed to update fix status', 'editor', err instanceof Error ? err : new Error(String(err)), {
                    fixId: fix.id
                  });
                })
              )
            );

            // Format comprehensive summary
            const uniqueUpdatedChapters = new Set(updatedChapters.map(ch => ch.id)).size;
            const summary = formatFixSummary(
              currentEditorReport.analysis.issues.length,
              currentEditorReport.autoFixedCount || 0,
              failedAutoFixes,
              appliedFixes.length,
              failedFixes,
              uniqueUpdatedChapters
            );

            setPendingFixProposals([]);
            setIsGenerating(false);
            stopLoading();

            // Show success or warning based on whether there were failures
            if (failedFixes.length > 0 || failedAutoFixes.length > 0) {
              showWarning(summary.summary + (summary.details ? '\n\nDetails:\n' + summary.details : ''));
            } else {
              showSuccess(summary.summary);
            }

          } catch (error) {
            logger.error('Error applying fixes', 'editor', error instanceof Error ? error : new Error(String(error)));
            showError(`Failed to apply fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setIsGenerating(false);
            stopLoading();
          }
        }}
        onReject={async (rejectedFixIds) => {
          try {
            // Update rejected fixes in database
            const { updateEditorFixStatus } = await import('./services/supabaseService');
            await Promise.all(
              rejectedFixIds.map(fixId =>
                updateEditorFixStatus(fixId, 'rejected', undefined, 'Rejected by user')
              )
            );

            setPendingFixProposals([]);
            showWarning(`${rejectedFixIds.length} fix(es) rejected`);
          } catch (error) {
            logger.error('Error rejecting fixes', 'editor', error instanceof Error ? error : new Error(String(error)));
            showError(`Failed to reject fixes: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }}
        onCancel={() => {
          setPendingFixProposals([]);
          setIsGenerating(false);
          stopLoading();
        }}
      />
    </div>
  );
};

export default App;
