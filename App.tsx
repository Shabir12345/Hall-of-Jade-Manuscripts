
import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import type { NovelState, Chapter, WorldEntry, Character, Arc, Realm, Territory, Relationship, SystemLog, Scene, NovelItem, NovelTechnique, CharacterItemPossession, CharacterTechniqueMastery, ItemCategory, TechniqueCategory, TechniqueType, Antagonist, AntagonistRole, SymbolicElement } from './types';
import { getAntagonistsForArc, addAntagonistToChapter } from './services/antagonistService';
import { findMatchingAntagonist, mergeAntagonistInfo } from './utils/antagonistMatching';
import Sidebar from './components/Sidebar';
import LibraryView from './components/LibraryView';
import VoiceInput from './components/VoiceInput';
import CreativeSpark from './components/CreativeSpark';
import ConfirmDialog from './components/ConfirmDialog';
import GenerationProgressBar from './components/GenerationProgressBar';
import LoadingIndicator from './components/LoadingIndicator';
import NotificationPanel from './components/NotificationPanel';
import { useToast } from './contexts/ToastContext';
import { useLoading } from './contexts/LoadingContext';
import { logger } from './services/loggingService';
import { getWorldCategory, getCharacterStatus, getArcStatus } from './utils/typeGuards';
import { useAuth } from './contexts/AuthContext';
import { LoginForm } from './components/LoginForm';
import { validateWorldEntryInput } from './utils/validation';
import { novelChangeTracker } from './utils/novelTracking';
import { extractPostChapterUpdates, generateNextChapter, generatePortrait, planArc, processLoreDictation } from './services/aiService';
import { saveRevision } from './services/revisionService';
import { useNovel } from './contexts/NovelContext';
import { findOrCreateItem, findOrCreateTechnique } from './services/itemTechniqueService';
import { detectArchiveCandidates, archivePossession, restorePossession, archiveMastery, restoreMastery } from './services/archiveService';
import * as arcAnalyzer from './services/promptEngine/arcContextAnalyzer';
import { generateUUID } from './utils/uuid';
import { RelatedEntities } from './components/RelatedEntities';
import { analyzeAutoConnections } from './services/autoConnectionService';
import { generateExtractionPreview, calculateTrustScore } from './services/trustService';
import { generatePreGenerationSuggestions } from './services/gapDetectionService';
import { checkConsistency, checkChapterConsistency } from './services/consistencyChecker';
import { triggerEditorReview, shouldTriggerEditorReview, applyApprovedFixes } from './services/editorService';
import { useEditorFixApplication } from './hooks/useEditorFixApplication';
import { saveEditorReport } from './services/supabaseService';
import ManualEditorDialog from './components/ManualEditorDialog';
import FixApprovalDialog from './components/FixApprovalDialog';
import type { EditorFixProposal, EditorFix, EditorReportWithInternal } from './types/editor';

// Lazy load heavy components for code splitting
const ChapterEditor = lazy(() => import('./components/ChapterEditor'));
const WorldMapView = lazy(() => import('./components/WorldMapView'));
const AntagonistTracker = lazy(() => import('./components/AntagonistTracker'));
const StoryboardView = lazy(() => import('./components/StoryboardView'));
const TimelineView = lazy(() => import('./components/TimelineView'));
const BeatSheetView = lazy(() => import('./components/BeatSheetView'));
const MatrixView = lazy(() => import('./components/MatrixView'));
const ProgressDashboard = lazy(() => import('./components/ProgressDashboard'));
const GlobalSearch = lazy(() => import('./components/GlobalSearch'));
const WritingGoals = lazy(() => import('./components/WritingGoals'));
const ExportDialog = lazy(() => import('./components/ExportDialog'));
const AntagonistManager = lazy(() => import('./components/AntagonistManager'));
// World-Class Enhancements Components
const StructureVisualizer = lazy(() => import('./components/StructureVisualizer'));
const EngagementDashboard = lazy(() => import('./components/EngagementDashboard'));
const TensionCurveView = lazy(() => import('./components/TensionCurveView'));
const ThemeEvolutionView = lazy(() => import('./components/ThemeEvolutionView'));
const CharacterPsychologyView = lazy(() => import('./components/CharacterPsychologyView'));
const DeviceDashboard = lazy(() => import('./components/DeviceDashboard'));
const DraftComparisonView = lazy(() => import('./components/DraftComparisonView'));
const ExcellenceScorecard = lazy(() => import('./components/ExcellenceScorecard'));

// ============================================================================
// AUTHENTICATION CONTROL
// ============================================================================
// Set to false to disable authentication during development
// Set to true when ready to launch with authentication enabled
const AUTHENTICATION_ENABLED = false;
// ============================================================================

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

  // Show login form if authentication is enabled and user is not authenticated
  if (AUTHENTICATION_ENABLED) {
    if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
          <LoadingIndicator />
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
    onConfirm: () => {},
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [activeLogs, setActiveLogs] = useState<SystemLog[]>([]);
  
  const [editingWorld, setEditingWorld] = useState<WorldEntry | null>(null);
  const [editingChar, setEditingChar] = useState<Character | null>(null);
  const [editingArc, setEditingArc] = useState<Arc | null>(null);
  const [arcAntagonists, setArcAntagonists] = useState<Antagonist[]>([]);
  const [isLoadingArcAntagonists, setIsLoadingArcAntagonists] = useState(false);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showManualEditor, setShowManualEditor] = useState(false);
  const [pendingFixProposals, setPendingFixProposals] = useState<EditorFixProposal[]>([]);
  const [currentEditorReport, setCurrentEditorReport] = useState<EditorReport | null>(null);
  const activeGenerationIdRef = useRef<string | null>(null);

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
          if (phase === 'gemini_request_start') {
            setGenerationProgress(40);
            setGenerationStatus('Consulting the Muse...');
            addEphemeralLog('Calling the selected LLM to write the chapter...', 'discovery');
          }
          if (phase === 'gemini_request_end') {
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
        }
      });

      // If user cancelled while waiting, ignore the result.
      if (activeGenerationIdRef.current !== generationId) {
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
            
            // Validate updateType if provided
            const validUpdateTypes = ['new', 'cultivation', 'skill', 'item', 'status', 'notes', 'relationship'];
            if (update.updateType && !validUpdateTypes.includes(update.updateType)) {
              updateErrors.push(`Update ${index + 1}: Invalid updateType "${update.updateType}"`);
              // Continue processing with a default type
              update.updateType = 'notes';
            }
          
          const charIndex = existingCharacters.findIndex(c => c.name.toLowerCase() === update.name.toLowerCase());
          
          if (charIndex > -1) {
            const char = { ...existingCharacters[charIndex] };
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
            if (update.updateType === 'relationship' && update.targetName) {
              const targetChar = existingCharacters.find(c => c.name.toLowerCase() === update.targetName.toLowerCase());
              if (targetChar) {
                if (!char.relationships) {
                  char.relationships = [];
                }
                const relIndex = char.relationships.findIndex((r: Relationship) => r.characterId === targetChar.id);
                const newRel: Relationship = { 
                  characterId: targetChar.id, 
                  type: update.newValue || 'Unknown', 
                  history: 'Karma link discovered in chronicle.',
                  impact: 'Fate has intertwined their paths.' 
                };
                if (relIndex > -1) {
                  char.relationships[relIndex] = newRel;
                } else {
                  char.relationships.push(newRel);
                }
                localAddLog(`Karma Link: ${char.name} <-> ${targetChar.name} (${update.newValue || 'Unknown'})`, 'fate');
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

        const extraction = await extractPostChapterUpdates(workingNovelState, newChapter, activeArc);

        // If user cancelled while waiting, ignore the result.
        if (activeGenerationIdRef.current !== generationId) {
          return;
        }

        // Debug logging for extraction results
        if (!extraction || !extraction.worldEntryUpserts) {
          localAddLog(`Warning: Extraction returned no worldEntryUpserts (extraction: ${extraction ? 'exists' : 'null'})`, 'update');
        } else {
          localAddLog(`Extraction found ${extraction.worldEntryUpserts.length} world entry update(s)`, 'discovery');
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
        const mergedCharacters = [...workingNovelState.characterCodex];
        extraction.characterUpserts?.forEach((u) => {
          const name = String(u?.name || '').trim();
          if (!name) return;
          const idx = mergedCharacters.findIndex(c => normalize(c.name) === normalize(name));

          const applyTo = (char: Character): Character => {
            const next: Character = { ...char };
            const set = u?.set || {};
            if (typeof set.age === 'string' && set.age.trim()) next.age = set.age;
            if (typeof set.personality === 'string' && set.personality.trim()) next.personality = set.personality;
            if (typeof set.currentCultivation === 'string' && set.currentCultivation.trim()) next.currentCultivation = set.currentCultivation;
            if (typeof set.notes === 'string' && set.notes.trim()) next.notes = mergeAppend(next.notes || '', set.notes, newChapter.number);
            const status = coerceCharStatus(set.status);
            if (status) next.status = status;

            const addSkills: string[] = Array.isArray(u?.addSkills) ? u.addSkills : [];
            const addItems: string[] = Array.isArray(u?.addItems) ? u.addItems : [];
            if (addSkills.length) next.skills = [...new Set([...(next.skills || []), ...addSkills.filter((s) => String(s).trim())])];
            if (addItems.length) next.items = [...new Set([...(next.items || []), ...addItems.filter((s) => String(s).trim())])];

            // Relationship updates (resolve by targetName)
            const rels: any[] = Array.isArray(u?.relationships) ? u.relationships : [];
            if (rels.length) {
              for (const rel of rels) {
                const targetName = String(rel?.targetName || '').trim();
                const type = String(rel?.type || '').trim();
                if (!targetName || !type) continue;
                const target = mergedCharacters.find(c => normalize(c.name) === normalize(targetName));
                if (!target) continue;
                const relIndex = next.relationships.findIndex(r => r.characterId === target.id);
                const newRel: Relationship = {
                  characterId: target.id,
                  type,
                  history: String(rel?.history || 'Karma link recorded in chronicle.'),
                  impact: String(rel?.impact || 'Fate has shifted.'),
                };
                if (relIndex > -1) next.relationships[relIndex] = newRel;
                else next.relationships.push(newRel);
              }
            }

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
          extraction.itemUpdates.forEach((itemUpdate: { name?: unknown; characterName?: unknown; category?: unknown; description?: unknown; addPowers?: unknown[] }) => {
            const itemName = String(itemUpdate?.name || '').trim();
            const characterName = String(itemUpdate?.characterName || '').trim();
            if (!itemName || !characterName) return;
            
            // Find character
            const character = mergedCharacters.find(c => normalize(c.name) === normalize(characterName));
            if (!character) {
              localAddLog(`Skipped item "${itemName}": Character "${characterName}" not found`, 'update');
              return;
            }
            
            // Coerce category
            const coerceItemCategory = (cat: string): ItemCategory => {
              const categories: ItemCategory[] = ['Treasure', 'Equipment', 'Consumable', 'Essential'];
              const normalized = String(cat || '').trim();
              return categories.includes(normalized as ItemCategory) ? (normalized as ItemCategory) : 'Essential';
            };
            
            const category = coerceItemCategoryLocal(String(itemUpdate?.category || 'Essential'));
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
              
              // Create or update character possession
              if (!character.itemPossessions) character.itemPossessions = [];
              
              let possession = character.itemPossessions.find(p => p.itemId === item.id);
              if (possession) {
                // Update existing possession
                possession = {
                  ...possession,
                  status: 'active',
                  notes: possession.notes || '',
                  updatedAt: Date.now()
                };
                const posIndex = character.itemPossessions.findIndex(p => p.id === possession!.id);
                if (posIndex >= 0) {
                  character.itemPossessions[posIndex] = possession;
                }
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
                character.itemPossessions.push(newPossession);
              }
              
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
        }
        
        // Process technique updates
        if (extraction.techniqueUpdates && extraction.techniqueUpdates.length > 0) {
          extraction.techniqueUpdates.forEach((techUpdate: { name?: unknown; characterName?: unknown; category?: unknown; type?: unknown; description?: unknown; addFunctions?: unknown[]; masteryLevel?: unknown }) => {
            const techName = String(techUpdate?.name || '').trim();
            const characterName = String(techUpdate?.characterName || '').trim();
            if (!techName || !characterName) return;
            
            // Find character
            const character = mergedCharacters.find(c => normalize(c.name) === normalize(characterName));
            if (!character) {
              localAddLog(`Skipped technique "${techName}": Character "${characterName}" not found`, 'update');
              return;
            }
            
            // Use shared coercion utilities
            const coerceTechCategoryLocal = (cat: string) => coerceTechniqueCategory(cat);
            const coerceTechTypeLocal = (type: string) => coerceTechniqueType(type);
            
            const category = coerceTechCategory(String(techUpdate?.category || 'Basic'));
            const techType = coerceTechType(String(techUpdate?.type || 'Other'));
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
              
              // Create or update character mastery
              if (!character.techniqueMasteries) character.techniqueMasteries = [];
              
              let mastery = character.techniqueMasteries.find(m => m.techniqueId === technique.id);
              if (mastery) {
                // Update existing mastery
                mastery = {
                  ...mastery,
                  status: 'active',
                  masteryLevel: masteryLevel || mastery.masteryLevel,
                  notes: mastery.notes || '',
                  updatedAt: Date.now()
                };
                const mastIndex = character.techniqueMasteries.findIndex(m => m.id === mastery!.id);
                if (mastIndex >= 0) {
                  character.techniqueMasteries[mastIndex] = mastery;
                }
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
                character.techniqueMasteries.push(newMastery);
              }
              
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
        }

        // 3.5) Process antagonist updates with fuzzy matching
        let mergedAntagonists = [...(workingNovelState.antagonists || [])];
        
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

        workingNovelState = {
          ...workingNovelState,
          chapters: updatedChapters,
          characterCodex: mergedCharacters,
          worldBible: mergedWorldBible,
          territories: mergedTerritories,
          novelItems: mergedNovelItems,
          novelTechniques: mergedNovelTechniques,
          antagonists: mergedAntagonists,
          plotLedger: mergedLedger,
          updatedAt: now,
        };

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

          // 6. Add suggestions to logs
          if (extractionPreview.suggestions.length > 0) {
            extractionPreview.suggestions.slice(0, 3).forEach(suggestion => {
              localAddLog(`💡 ${suggestion}`, 'update');
            });
          }

          // 7. Log warnings
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

        // CONSISTENCY CHECKING
        try {
          // Check consistency for the new chapter
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

          // Run full consistency check periodically (every 5 chapters)
          if (newChapter.number % 5 === 0) {
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
        const saveChapterAppearances = async (retries = 8, initialDelay = 2000) => {
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
            const editorReportWithInternal = editorReport as EditorReportWithInternal;
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
        `Dao failure! Connection severed.\n\nError: ${errorMessage}\n\nPlease check:\n1. Your selected LLM API key is set in .env.local (GEMINI_API_KEY and/or DEEPSEEK_API_KEY)\n2. Your internet connection\n3. Browser console for more details (F12)`
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
    if (!activeNovel) return;
    setIsGeneratingPortrait(char.id);
    try {
      const url = await generatePortrait(char, activeNovel.worldBible?.[0]?.content || "");
      if (url) {
        updateActiveNovel(prev => ({
          ...prev,
          characterCodex: prev.characterCodex.map(c => c.id === char.id ? { ...c, portraitUrl: url } : c)
        }));
      }
    } catch (e) {
      logger.error('Error generating portrait', 'portraitGeneration', e instanceof Error ? e : new Error(String(e)), { characterId: char.id, characterName: char.name });
    } finally { setIsGeneratingPortrait(null); }
  };

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
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 selection:bg-amber-600/30">
      <LoadingIndicator
        isVisible={loadingState.isLoading}
        message={loadingState.message}
        progress={loadingState.progress}
        showProgressBar={loadingState.showProgressBar}
        variant="banner"
        position="top"
      />
      <Sidebar />

      <NotificationPanel activeLogs={activeLogs} />

      <main className="flex-1 relative overflow-y-auto mr-80">
        {isSaving && (
          <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 bg-zinc-900/95 backdrop-blur-sm border border-amber-600/50 rounded-xl px-3 md:px-4 py-2 md:py-2.5 flex items-center space-x-2 md:space-x-3 z-50 shadow-xl shadow-amber-900/20 animate-in slide-in duration-200">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-zinc-600 border-t-amber-600 flex-shrink-0"></div>
            <span className="text-xs md:text-sm text-amber-500 font-semibold whitespace-nowrap">Saving...</span>
          </div>
        )}
        <button 
          onClick={() => setView('library')}
          className="fixed top-4 left-[280px] z-50 p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2 hidden md:block"
          title="Return to Hall"
          aria-label="Return to library"
        >🏛️</button>
        <button 
          onClick={() => setView('library')}
          className="fixed top-4 left-4 z-50 p-3 bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-xl text-zinc-400 hover:text-amber-500 hover:border-amber-600/50 transition-all duration-200 shadow-lg hover:shadow-amber-900/10 focus-visible:outline-amber-600 focus-visible:outline-2 md:hidden"
          title="Return to Hall"
          aria-label="Return to library"
        >🏛️</button>

        {currentView === 'dashboard' && (
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
                        className={`py-3 md:py-4 rounded-xl font-fantasy text-base md:text-lg font-semibold transition-all duration-200 ${
                          isGenerating 
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
                <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 md:p-8 shadow-xl overflow-hidden">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-6">Protagonist</h3>
                  <div className="space-y-6 text-center">
                    {(() => {
                      // Find protagonist:
                      // 1) Explicit Codex protagonist flag
                      // 2) Most mentioned character in chapters
                      // 3) First character fallback
                      let protagonist = activeNovel.characterCodex.find(c => c.isProtagonist) || activeNovel.characterCodex[0];
                      if (!activeNovel.characterCodex.find(c => c.isProtagonist) && activeNovel.chapters.length > 0 && activeNovel.characterCodex.length > 0) {
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
                              className="w-32 h-32 rounded-full mx-auto border-2 border-amber-600 shadow-xl object-cover" 
                              alt={`Portrait of ${protagonist.name}`}
                            />
                          ) : (
                            <div className="w-32 h-32 rounded-full bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-4xl">👤</div>
                          )}
                          <div>
                            <h4 className="font-fantasy text-xl md:text-2xl font-bold text-amber-500">{protagonist.name}</h4>
                            <p className="text-xs md:text-sm text-emerald-500 font-bold uppercase mt-2 tracking-wider">{protagonist.currentCultivation}</p>
                          </div>
                        </>
                      ) : (
                        <div className="py-8">
                          <p className="text-sm text-zinc-500">No characters yet</p>
                        </div>
                      );
                    })()}
                  </div>
                </div>

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
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
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
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <WorldMapView state={activeNovel} onSaveTerritory={handleSaveTerritory} onDeleteTerritory={handleDeleteTerritory} />
          </Suspense>
        )}
        {currentView === 'storyboard' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <StoryboardView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'timeline' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <TimelineView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'beatsheet' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <BeatSheetView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'matrix' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <MatrixView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'analytics' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <ProgressDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'search' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <GlobalSearch novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'goals' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <WritingGoals 
              novelState={activeNovel} 
              onUpdateGoals={(goals) => updateActiveNovel(prev => ({ ...prev, writingGoals: goals }))}
            />
          </Suspense>
        )}
        {/* World-Class Enhancements Views */}
        {currentView === 'structure-visualizer' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <StructureVisualizer novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'engagement-dashboard' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <EngagementDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'tension-curve' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <TensionCurveView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'theme-evolution' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <ThemeEvolutionView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'character-psychology' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <CharacterPsychologyView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'device-dashboard' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <DeviceDashboard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'draft-comparison' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <DraftComparisonView novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'excellence-scorecard' && (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-4 border-zinc-700 border-t-amber-600"></div></div>}>
            <ExcellenceScorecard novelState={activeNovel} />
          </Suspense>
        )}
        {currentView === 'chapters' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-6 md:space-y-8 pt-20 md:pt-24">
            <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-zinc-700 pb-4 md:pb-6">
              <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Chronicles</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={fixExistingChapters}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
                  title="Fix duplicate chapter numbers and normalize titles (adds 'Chapter X: ' prefix if missing)"
                >
                  <span>🔧</span>
                  <span>Fix Chapters</span>
                </button>
                <button
                  onClick={() => setShowManualEditor(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
                  title="Manually trigger editor review for chapters"
                >
                  <span>✏️</span>
                  <span>Editor Review</span>
                </button>
              </div>
            </div>
            {activeNovel.chapters.length === 0 ? (
              <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
                <div className="text-6xl mb-4">📖</div>
                <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Chapters Yet</h3>
                <p className="text-sm text-zinc-500 mb-6">Start writing your epic by generating your first chapter from the Dashboard.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:gap-6">
                {[...activeNovel.chapters].reverse().map(chapter => (
                  <div 
                    key={chapter.id}
                    className="bg-zinc-900/60 border border-zinc-700 p-6 md:p-8 rounded-2xl hover:border-amber-500/50 transition-all duration-200 group relative hover:shadow-xl hover:shadow-amber-900/10"
                  >
                    <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
                      <button 
                        type="button"
                        onClick={() => { handleExportChapter(chapter); }} 
                        className="text-xs text-zinc-500 hover:text-emerald-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-emerald-500/50 transition-all duration-200 hover:bg-emerald-950/20 focus-visible:outline-emerald-600 focus-visible:outline-2 shadow-lg"
                        aria-label={`Export chapter ${chapter.number}`}
                      >
                        Export
                      </button>
                      <button 
                        type="button"
                        onClick={() => { handleDeleteChapter(chapter.id); }} 
                        className="text-xs text-zinc-500 hover:text-red-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-all duration-200 hover:bg-red-950/20 focus-visible:outline-red-600 focus-visible:outline-2 shadow-lg"
                        aria-label={`Delete chapter ${chapter.number}`}
                      >
                        Delete
                      </button>
                    </div>
                    <div className="flex items-center space-x-4 mb-3 flex-wrap gap-2 pr-32">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 bg-zinc-800/50 rounded-md">Sequence {chapter.number}</span>
                      {chapter.logicAudit && (
                        <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md border border-indigo-500/30 uppercase font-bold">Value Shifted</span>
                      )}
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => { setActiveChapterId(chapter.id); setView('editor'); }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setActiveChapterId(chapter.id);
                          setView('editor');
                        }
                      }}
                      className="block text-left w-full focus-visible:outline-amber-600 focus-visible:outline-2 rounded-lg pr-32 cursor-pointer"
                      aria-label={`Open chapter ${chapter.number}: ${chapter.title}`}
                    >
                      <h3 className="text-xl md:text-2xl font-fantasy font-bold text-zinc-200 group-hover:text-amber-500 transition-colors mt-1 break-words">{formatChapterTitleForDisplay(chapter)}</h3>
                      <p className="text-sm md:text-base text-zinc-400 mt-4 italic line-clamp-2 leading-relaxed font-serif-novel">"{chapter.summary || 'No summary available...'}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentView === 'world-bible' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
              <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">World Bible</h2>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
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

        {currentView === 'characters' && (
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

        {currentView === 'planning' && (
          <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-300 pt-20 md:pt-24">
            <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-zinc-700 pb-4 md:pb-6">
              <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Arc Ledger</h2>
              <button
                onClick={() => setShowManualEditor(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
                title="Manually trigger editor review for arcs or chapters"
              >
                <span>✏️</span>
                <span>Editor Review</span>
              </button>
            </div>
             <section className="bg-zinc-900/60 border border-zinc-700 p-6 md:p-10 rounded-2xl shadow-xl border-t-4 border-t-amber-600">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Grand Saga</h3>
                <div className="flex items-center space-x-2">
                  <CreativeSpark 
                    type="Grand Saga" 
                    currentValue={activeNovel.grandSaga} 
                    state={activeNovel} 
                    onIdea={(idea) => updateActiveNovel(prev => ({ ...prev, grandSaga: idea }))} 
                  />
                  <VoiceInput onResult={(text) => updateActiveNovel(prev => ({ ...prev, grandSaga: prev.grandSaga ? prev.grandSaga + " " + text : text }))} />
                </div>
              </div>
              <textarea 
                value={activeNovel.grandSaga} 
                onChange={(e) => updateActiveNovel(prev => ({ ...prev, grandSaga: e.target.value }))} 
                className="w-full bg-transparent border-none focus:ring-0 text-lg md:text-2xl font-serif-novel italic text-zinc-300 resize-none h-32 scrollbar-hide leading-relaxed"
                aria-label="Grand Saga"
                placeholder="Describe the overarching story..."
              />
            </section>
            <section className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Plot Arcs</h3>
                <button 
                  disabled={isPlanning} 
                  onClick={handlePlanNewArc} 
                  className="text-sm bg-zinc-800 hover:bg-zinc-700 px-6 py-2.5 rounded-xl font-semibold text-amber-500 border border-amber-900/30 hover:border-amber-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
                  title="AI will plan a new plot arc based on your story"
                  aria-label="Plan new plot arc"
                >
                  {isPlanning ? (
                    <span className="flex items-center">
                      <span className="animate-spin rounded-full h-3 w-3 border-2 border-amber-500/30 border-t-amber-500 mr-2"></span>
                      Planning...
                    </span>
                  ) : (
                    'Plan New Arc'
                  )}
                </button>
              </div>
              {activeNovel.plotLedger.length === 0 ? (
                <div className="py-12 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
                  <div className="text-5xl mb-4">🗺️</div>
                  <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Plot Arcs Yet</h3>
                  <p className="text-sm text-zinc-500 mb-4">Start planning your story by creating plot arcs.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:gap-6">
                  {activeNovel.plotLedger.map((arc, index) => {
                    const arcWithDefaults = ensureArcDefaults(arc, activeNovel);
                    
                    // Debug logging for troubleshooting
                    if (process.env.NODE_ENV === 'development') {
                      logger.debug(`Arc ${index + 1} "${arcWithDefaults.title}"`, 'arc', {
                        id: arcWithDefaults.id,
                        status: arcWithDefaults.status,
                        startedAtChapter: arcWithDefaults.startedAtChapter,
                        endedAtChapter: arcWithDefaults.endedAtChapter,
                        targetChapters: arcWithDefaults.targetChapters,
                        totalChapters: activeNovel.chapters.length,
                        chapterNumbers: activeNovel.chapters.map(ch => ch.number).sort((a, b) => a - b),
                      });
                    }
                    
                    // Use getArcChapters to get actual chapters instead of calculated range
                    const arcChapters = arcAnalyzer.getArcChapters(arcWithDefaults, activeNovel.chapters, activeNovel.plotLedger);
                    const chaptersWrittenInArc = arcChapters.length;
                    
                    // Debug logging for chapter assignment
                    if (process.env.NODE_ENV === 'development') {
                      logger.debug(`Arc "${arcWithDefaults.title}" chapters`, 'arc', {
                        found: chaptersWrittenInArc,
                        chapterNumbers: arcChapters.map(ch => ch.number).sort((a, b) => a - b),
                        startedAtChapter: arcWithDefaults.startedAtChapter,
                      });
                    }
                    
                    const checklist = arcWithDefaults.checklist || [];
                    const checklistDone = checklist.filter(i => i.completed).length;
                    const checklistPct = checklist.length ? Math.round((checklistDone / checklist.length) * 100) : 0;
                    
                    // Validation checks - run validation first
                    const validationResult = arcAnalyzer.validateArcState(arcWithDefaults, activeNovel.chapters, activeNovel.plotLedger);
                    const hasWarnings = validationResult.issues.length > 0;
                    
                    // Special fix: If arc has startedAtChapter but finds very few chapters, check if it's incorrectly set
                    // This handles cases where startedAtChapter was set incorrectly (e.g., to 21 instead of 11)
                    let displayArc = arcWithDefaults;
                    let needsBoundaryFix = false;
                    let boundaryFixMessage = '';
                    
                    // Detect if arc is showing too few chapters relative to what's expected
                    // This happens when startedAtChapter is set incorrectly (e.g., to the current chapter count instead of the actual start)
                    if (arcWithDefaults.startedAtChapter && arcWithDefaults.startedAtChapter > 0 && activeNovel.chapters.length > 10) {
                      const sortedArcs = [...activeNovel.plotLedger].sort((a, b) => {
                        const aStart = a.startedAtChapter || 0;
                        const bStart = b.startedAtChapter || 0;
                        return aStart - bStart;
                      });
                      const currentArcIndex = sortedArcs.findIndex(a => a.id === arcWithDefaults.id);
                      
                      // If this arc finds very few chapters (< 3) and we're past the first arc, likely a boundary issue
                      if (currentArcIndex > 0 && arcChapters.length < 3) {
                        const prevArc = sortedArcs[currentArcIndex - 1];
                        const sortedChapters = [...activeNovel.chapters].sort((a, b) => a.number - b.number);
                        let expectedStart: number | undefined = undefined;
                        
                        // Method 1: Previous arc has explicit end
                        if (prevArc.status === 'completed' && prevArc.endedAtChapter && prevArc.endedAtChapter > 0) {
                          expectedStart = prevArc.endedAtChapter + 1;
                        }
                        // Method 2: Find actual chapter distribution - if prev arc has ~10 chapters and we're the second arc
                        else if (currentArcIndex === 1 && prevArc.startedAtChapter === 1) {
                          // Second arc should typically start around chapter 11 if first arc has ~10 chapters
                          // Check how many chapters could belong to first arc
                          const firstArcPossibleChapters = sortedChapters.filter(ch => 
                            ch.number >= 1 && ch.number < arcWithDefaults.startedAtChapter!
                          );
                          // If there are ~10 chapters before current arc's start, likely first arc has ~10 chapters
                          if (firstArcPossibleChapters.length >= 8 && firstArcPossibleChapters.length <= 12) {
                            // First arc likely has ~10 chapters, so second should start at ~11
                            const maxFirstChapter = Math.max(...firstArcPossibleChapters.map(ch => ch.number));
                            expectedStart = maxFirstChapter + 1;
                            if (expectedStart === arcWithDefaults.startedAtChapter) {
                              expectedStart = undefined; // Already correct
                            }
                          }
                          // Also check: if current arc's start is very high (like 21) but there are many chapters total,
                          // and first arc started at 1, then second arc should probably start around 11
                          else if (arcWithDefaults.startedAtChapter! >= activeNovel.chapters.length - 1 && activeNovel.chapters.length >= 20) {
                            // Current arc starts at the very end - likely should start around chapter 11
                            // Estimate: if total is 21, first arc is ~10 chapters, second should start at 11
                            const estimatedSecondArcStart = Math.floor(activeNovel.chapters.length / 2) + 1;
                            if (estimatedSecondArcStart !== arcWithDefaults.startedAtChapter && estimatedSecondArcStart >= 10) {
                              expectedStart = estimatedSecondArcStart;
                            }
                          }
                        }
                        // Method 3: Estimate based on prev arc start + typical length
                        else if (prevArc.startedAtChapter) {
                          // If prev arc started at 1 and has no explicit end, estimate it ends around chapter 10
                          const estimatedPrevEnd = prevArc.startedAtChapter + 9; // Estimate 10 chapters
                          expectedStart = estimatedPrevEnd + 1;
                        }
                        
                        if (expectedStart && expectedStart !== arcWithDefaults.startedAtChapter && expectedStart <= activeNovel.chapters.length) {
                          // Verify the fix would actually give us more chapters
                          const testFixedArc = { ...arcWithDefaults, startedAtChapter: expectedStart };
                          const testChapters = arcAnalyzer.getArcChapters(testFixedArc, activeNovel.chapters, activeNovel.plotLedger);
                          if (testChapters.length > arcChapters.length) {
                            needsBoundaryFix = true;
                            displayArc = testFixedArc;
                            const prevArcEnd = prevArc.endedAtChapter || (expectedStart - 1);
                            boundaryFixMessage = `Arc should start at Ch ${expectedStart} instead of Ch ${arcWithDefaults.startedAtChapter}. First arc should end at Ch ${prevArcEnd}. This will correctly assign ${testChapters.length} chapters instead of ${arcChapters.length}.`;
                            if (process.env.NODE_ENV === 'development') {
                              logger.debug(`Auto-fixing arc "${arcWithDefaults.title}": startedAtChapter from ${arcWithDefaults.startedAtChapter} to ${expectedStart}. Will find ${testChapters.length} chapters instead of ${arcChapters.length}.`, 'arc', {
                                arcId: arcWithDefaults.id,
                                oldStart: arcWithDefaults.startedAtChapter,
                                newStart: expectedStart,
                                chaptersFound: testChapters.length,
                                chaptersBefore: arcChapters.length
                              });
                            }
                          }
                        }
                      } else if (currentArcIndex === 1 && !sortedArcs[0].endedAtChapter && sortedArcs[0].status === 'completed') {
                        // Special case: Second arc, first arc is completed but has no endedAtChapter
                        // This is a common issue - fix both arcs
                        const firstArc = sortedArcs[0];
                        // Estimate first arc ends around chapter 10 if it's the first arc
                        const estimatedFirstArcEnd = Math.min(10, activeNovel.chapters.length);
                        const expectedStart = estimatedFirstArcEnd + 1;
                        
                        if (expectedStart !== arcWithDefaults.startedAtChapter && expectedStart <= activeNovel.chapters.length && arcChapters.length < 5) {
                          const testFixedArc = { ...arcWithDefaults, startedAtChapter: expectedStart };
                          const testChapters = arcAnalyzer.getArcChapters(testFixedArc, activeNovel.chapters, activeNovel.plotLedger);
                          if (testChapters.length > arcChapters.length) {
                            needsBoundaryFix = true;
                            displayArc = testFixedArc;
                            boundaryFixMessage = `Both arcs need fixing: First arc should end at Ch ${estimatedFirstArcEnd}, second arc should start at Ch ${expectedStart} instead of Ch ${arcWithDefaults.startedAtChapter}. This will correctly assign ${testChapters.length} chapters instead of ${arcChapters.length}.`;
                            if (process.env.NODE_ENV === 'development') {
                              logger.debug(`Auto-fixing second arc "${arcWithDefaults.title}": startedAtChapter from ${arcWithDefaults.startedAtChapter} to ${expectedStart}. Will find ${testChapters.length} chapters instead of ${arcChapters.length}.`, 'arc', {
                                arcId: arcWithDefaults.id,
                                oldStart: arcWithDefaults.startedAtChapter,
                                newStart: expectedStart,
                                chaptersFound: testChapters.length,
                                chaptersBefore: arcChapters.length
                              });
                            }
                          }
                        }
                      }
                    }
                    
                    // If validation found issues and auto-repaired, use the repaired arc
                    if (validationResult.wasRepaired || needsBoundaryFix) {
                      displayArc = validationResult.wasRepaired ? validationResult.arc : displayArc;
                      // Recalculate chapters with repaired arc
                      const repairedArcChapters = arcAnalyzer.getArcChapters(displayArc, activeNovel.chapters, activeNovel.plotLedger);
                      if (repairedArcChapters.length !== arcChapters.length) {
                        // Update chapters count if repair changed it
                        arcChapters.length = repairedArcChapters.length;
                        arcChapters.splice(0, arcChapters.length, ...repairedArcChapters);
                      }
                    }
                    
                    // Calculate chapter range - use repaired arc if available
                    const arcToDisplay = displayArc;
                    const finalArcChapters = arcAnalyzer.getArcChapters(arcToDisplay, activeNovel.chapters, activeNovel.plotLedger);
                    const finalChaptersWrittenInArc = finalArcChapters.length;
                    
                    const chapterRange = finalArcChapters.length > 0 
                      ? `Ch ${Math.min(...finalArcChapters.map(ch => ch.number))}-${Math.max(...finalArcChapters.map(ch => ch.number))}`
                      : arcToDisplay.startedAtChapter 
                        ? `Starts at Ch ${arcToDisplay.startedAtChapter}` 
                        : 'No chapters yet';
                    
                    // Update the counts based on final chapters
                    const finalTargetChapters = arcToDisplay.targetChapters || DEFAULT_ARC_TARGET_CHAPTERS;
                    const finalChapterPct = finalTargetChapters > 0 ? Math.min(100, Math.round((finalChaptersWrittenInArc / finalTargetChapters) * 100)) : 0;
                    
                    // Check if arc is nearly complete or over target (using final counts)
                    const isNearlyComplete = finalChapterPct >= 80 && finalChaptersWrittenInArc < finalTargetChapters;
                    const isOverTarget = finalChaptersWrittenInArc > finalTargetChapters;

                    return (
                      <div key={arcWithDefaults.id} className={`p-6 md:p-8 border rounded-2xl transition-all duration-200 group relative ${arcWithDefaults.status === 'active' ? 'bg-amber-600/10 border-amber-600/40 shadow-lg shadow-amber-600/10' : 'bg-zinc-900 border-zinc-700 opacity-70 hover:opacity-100'} ${hasWarnings ? 'ring-2 ring-yellow-500/50' : ''}`}>
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1 w-full">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1">
                                <h4 
                                  className="font-fantasy text-xl md:text-2xl font-bold text-zinc-100 mb-1 cursor-pointer hover:text-amber-500 transition-colors inline-block"
                                  onClick={() => setEditingArc(arcWithDefaults)}
                                  title="Click to edit arc"
                                >
                                  {arcWithDefaults.title}
                                </h4>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  <span className="text-xs text-zinc-500 font-medium">{chapterRange}</span>
                                  {arcWithDefaults.status === 'completed' && arcWithDefaults.endedAtChapter && (
                                    <span className="text-xs text-zinc-600">• {finalArcChapters.length} chapters</span>
                                  )}
                                  {hasWarnings && (
                                    <span className="text-xs text-yellow-500 font-semibold flex items-center gap-1">
                                      ⚠️ {validationResult.issues.length} issue{validationResult.issues.length !== 1 ? 's' : ''}
                                    </span>
                                  )}
                                  {isNearlyComplete && (
                                    <span className="text-xs text-emerald-400 font-semibold">✓ Nearly Complete</span>
                                  )}
                                  {isOverTarget && (
                                    <span className="text-xs text-orange-400 font-semibold">📊 Exceeded Target</span>
                                  )}
                                </div>
                              </div>
                              <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full whitespace-nowrap ${arcWithDefaults.status === 'active' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' : 'bg-zinc-800 text-zinc-500'}`}>
                                {arcWithDefaults.status}
                              </span>
                            </div>
                            
                            <p className="text-sm md:text-base text-zinc-400 leading-relaxed font-serif-novel mb-5 line-clamp-2">{arcWithDefaults.description}</p>

                            <div className="space-y-3 mb-4">
                              <div>
                                <div className="flex justify-between items-center text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">
                                  <span>Chapter Progress</span>
                                  <span className={`normal-case font-bold ${isOverTarget ? 'text-orange-400' : finalChapterPct >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {finalChaptersWrittenInArc}/{finalTargetChapters} ({finalChapterPct}%)
                                  </span>
                                </div>
                                <div className="h-2.5 bg-zinc-950/40 rounded-full overflow-hidden border border-zinc-700/70 mt-1.5 relative">
                                  <div 
                                    className={`h-full transition-all duration-500 ${isOverTarget ? 'bg-orange-500/80' : finalChapterPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-500/80'}`} 
                                    style={{ width: `${Math.min(100, finalChapterPct)}%` }} 
                                  />
                                  {finalChapterPct > 100 && (
                                    <div className="absolute top-0 left-0 h-full w-full bg-orange-500/40" style={{ width: '100%' }} />
                                  )}
                                </div>
                              </div>
                              <div>
                                <div className="flex justify-between items-center text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-1">
                                  <span>Arc Elements</span>
                                  <span className={`normal-case font-bold ${checklistPct >= 100 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                                    {checklistDone}/{checklist.length} ({checklistPct}%)
                                  </span>
                                </div>
                                <div className="h-2.5 bg-zinc-950/40 rounded-full overflow-hidden border border-zinc-700/70 mt-1.5">
                                  <div className={`h-full transition-all duration-500 ${checklistPct >= 100 ? 'bg-indigo-500' : 'bg-indigo-500/80'}`} style={{ width: `${checklistPct}%` }} />
                                </div>
                              </div>
                            </div>
                            
                            {/* Chapter List - Collapsible */}
                            {finalArcChapters.length > 0 && (
                              <details className="mt-4 group/details">
                                <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300 font-semibold uppercase tracking-wider mb-2 flex items-center gap-2 select-none">
                                  <span className="transition-transform group-open/details:rotate-90">▶</span>
                                  View {finalArcChapters.length} Chapter{finalArcChapters.length !== 1 ? 's' : ''} ({chapterRange})
                                </summary>
                                <div className="mt-2 max-h-48 overflow-y-auto scrollbar-thin bg-zinc-950/50 rounded-lg p-3 border border-zinc-800">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {finalArcChapters.sort((a, b) => a.number - b.number).map((ch) => (
                                      <div 
                                        key={ch.id}
                                        onClick={() => {
                                          setActiveChapterId(ch.id);
                                          setView('chapters');
                                        }}
                                        className="text-xs p-2 rounded border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/10 cursor-pointer transition-all flex items-center justify-between gap-2"
                                        title={`Ch ${ch.number}: ${ch.title}`}
                                      >
                                        <span className="text-zinc-500 font-mono">#{ch.number}</span>
                                        <span className="text-zinc-300 truncate flex-1">{ch.title}</span>
                                        {ch.summary && (
                                          <span className="text-zinc-600 text-[10px]" title={ch.summary}>ℹ️</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </details>
                            )}
                            
                            {/* Validation Warnings & Boundary Fix */}
                            {(hasWarnings || needsBoundaryFix) && (
                              <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-700/50 rounded-lg">
                                <div className="flex items-start justify-between gap-3 mb-2">
                                  <div className="text-xs text-yellow-400 font-semibold">
                                    {needsBoundaryFix ? '🔧 Boundary Fix Needed:' : '⚠️ Validation Issues:'}
                                  </div>
                                  {(validationResult.wasRepaired || needsBoundaryFix) && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        // Apply the repaired/fixed arc state
                                        const fixedArc = needsBoundaryFix ? displayArc : validationResult.arc;
                                        
                                        // Also fix the first arc's endedAtChapter if needed (for boundary fixes)
                                        let repairedArcs = activeNovel.plotLedger.map(a => {
                                          if (a.id === arcWithDefaults.id) {
                                            return fixedArc;
                                          }
                                          // If fixing second arc and first arc is completed but has no end, fix it too
                                          if (needsBoundaryFix && a.id !== arcWithDefaults.id && a.status === 'completed' && !a.endedAtChapter) {
                                            const sortedArcs = [...activeNovel.plotLedger].sort((a1, b1) => {
                                              const aStart = a1.startedAtChapter || 0;
                                              const bStart = b1.startedAtChapter || 0;
                                              return aStart - bStart;
                                            });
                                            const firstArcIndex = sortedArcs.findIndex(a1 => a1.id === a.id);
                                            const secondArcIndex = sortedArcs.findIndex(a1 => a1.id === arcWithDefaults.id);
                                            if (firstArcIndex === 0 && secondArcIndex === 1 && fixedArc.startedAtChapter) {
                                              // First arc should end just before second arc starts
                                              const firstArcEnd = fixedArc.startedAtChapter - 1;
                                              return { ...a, endedAtChapter: firstArcEnd };
                                            }
                                          }
                                          return a;
                                        });
                                        
                                        const updatedNovel = {
                                          ...activeNovel,
                                          plotLedger: repairedArcs,
                                          updatedAt: Date.now(),
                                        };
                                        updateActiveNovel(() => updatedNovel);
                                        
                                        // Save to database
                                        try {
                                          const { saveNovel } = await import('./services/supabaseService');
                                          await saveNovel(updatedNovel);
                                          showSuccess(`Arc "${arcWithDefaults.title}" has been ${needsBoundaryFix ? 'boundary-corrected' : 'auto-repaired'} and saved! Found ${finalArcChapters.length} chapters.`);
                                          // Force a re-render - trigger update
                                          setTimeout(() => {
                                            updateActiveNovel((prev) => ({ ...prev, updatedAt: Date.now() }));
                                          }, 100);
                                        } catch (error) {
                                          logger.error('Failed to save repaired arc', 'arc', error instanceof Error ? error : new Error(String(error)));
                                          showError('Failed to save repaired arc. Changes are only local.');
                                        }
                                      }}
                                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 hover:border-emerald-500/50 px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 transition-all duration-200"
                                      title={needsBoundaryFix ? "Fix arc boundary and save" : "Apply auto-repairs to this arc"}
                                    >
                                      {needsBoundaryFix ? '🔧 Fix Boundary' : '✓ Apply Fixes'}
                                    </button>
                                  )}
                                </div>
                                <ul className="space-y-1">
                                  {needsBoundaryFix && (
                                    <li className="text-xs text-yellow-300/80">
                                      • {boundaryFixMessage ? boundaryFixMessage : `Arc startedAtChapter is ${arcWithDefaults.startedAtChapter} but should be ${displayArc.startedAtChapter}`}. 
                                      Currently showing {chaptersWrittenInArc} chapter(s) but should show {finalChaptersWrittenInArc} chapter(s).
                                    </li>
                                  )}
                                  {validationResult.issues.slice(0, needsBoundaryFix ? 2 : 3).map((issue, idx) => (
                                    <li key={idx} className="text-xs text-yellow-300/80">• {issue}</li>
                                  ))}
                                  {validationResult.issues.length > (needsBoundaryFix ? 2 : 3) && (
                                    <li className="text-xs text-yellow-500/60">... and {validationResult.issues.length - (needsBoundaryFix ? 2 : 3)} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                            
                            {/* Arc Stats Summary */}
                            {finalArcChapters.length > 0 && (
                              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800">
                                  <div className="text-zinc-500 uppercase tracking-wider mb-1">Chapter Range</div>
                                  <div className="text-zinc-200 font-mono font-semibold">{chapterRange}</div>
                                  <div className="text-[10px] text-zinc-600 mt-1">
                                    Start: Ch {arcToDisplay.startedAtChapter || '?'} • 
                                    {arcToDisplay.status === 'completed' && arcToDisplay.endedAtChapter ? ` End: Ch ${arcToDisplay.endedAtChapter}` : ' Active'}
                                  </div>
                                </div>
                                <div className="bg-zinc-950/50 rounded-lg p-2 border border-zinc-800">
                                  <div className="text-zinc-500 uppercase tracking-wider mb-1">Completion</div>
                                  <div className={`font-semibold ${finalChapterPct >= 100 ? 'text-emerald-400' : isNearlyComplete ? 'text-amber-400' : 'text-zinc-200'}`}>
                                    {finalChapterPct >= 100 ? '✓ Complete' : isNearlyComplete ? 'Nearly Done' : `${finalChapterPct}%`}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                            <button 
                              onClick={() => setEditingArc(arcWithDefaults)}
                              className="text-xs text-amber-500 hover:text-amber-400 font-semibold border border-amber-500/30 hover:border-amber-500/50 px-4 py-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 flex items-center justify-center gap-2"
                              title="Edit Plot Arc"
                              aria-label={`Edit arc: ${arcWithDefaults.title}`}
                            >
                              <span>✏️</span>
                              <span>Refine</span>
                            </button>
                            
                            {arcWithDefaults.status === 'completed' && arcChapters.length > 0 && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    setIsGenerating(true);
                                    startLoading(`Starting editor review for arc: ${arcWithDefaults.title}...`, true);
                                    setGenerationProgress(5);
                                    setGenerationStatus(`Starting editor review for arc "${arcWithDefaults.title}"...`);
                                    
                                    const editorReport = await triggerEditorReview(activeNovel, 'manual', arcWithDefaults, {
                                      onProgress: (phase, progress) => {
                                        if (progress !== undefined) {
                                          updateProgress(progress, `Editor: ${phase}`);
                                          setGenerationProgress(progress);
                                          setGenerationStatus(`Editor: ${phase}`);
                                        } else {
                                          updateMessage(`Editor: ${phase}`);
                                        }
                                        addEphemeralLog(`Editor: ${phase}`, 'discovery');
                                      },
                                      onAutoFix: (fix) => {
                                        addEphemeralLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
                                      },
                                    });

                                    if (editorReport) {
                                      await saveEditorReport(editorReport);
                                      setCurrentEditorReport(editorReport);
                                      
                                      // Update novel with fixed chapters if any auto-fixes were applied
                                      if ((editorReport as any)._updatedChapters && (editorReport as any)._updatedChapters.length > 0) {
                                        const updatedChapters = (editorReport as any)._updatedChapters as Chapter[];
                                        updateActiveNovel(prev => {
                                          const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
                                          const updatedNovel = {
                                            ...prev,
                                            chapters: prev.chapters.map(ch => updatedChapterMap.get(ch.id) || ch),
                                            updatedAt: Date.now(),
                                          };
                                          import('./services/supabaseService').then(({ saveNovel }) => {
                                            saveNovel(updatedNovel).catch(err => logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err))));
                                          });
                                          return updatedNovel;
                                        });
                                      }
                                      
                                      const { createFixProposals } = await import('./services/editorFixer');
                                      const proposals = createFixProposals(editorReport.analysis.issues, editorReport.fixes);
                                      
                                      if (proposals.length > 0) {
                                        setPendingFixProposals(proposals);
                                        setIsGenerating(false);
                                        stopLoading();
                                      } else {
                                        setIsGenerating(false);
                                        stopLoading();
                                        if (editorReport.autoFixedCount > 0) {
                                          showSuccess(`Editor fixed ${editorReport.autoFixedCount} issue(s) automatically`);
                                        }
                                        const arcAnalysis = editorReport.analysis as any;
                                        if (arcAnalysis?.readiness?.isReadyForRelease) {
                                          showSuccess(`Arc "${arcWithDefaults.title}" is ready for release!`);
                                        }
                                        showSuccess(`Editor review complete for arc "${arcWithDefaults.title}"`);
                                      }
                                    } else {
                                      stopLoading();
                                    }
                                  } catch (error) {
                                    logger.error('Error in arc editor review', 'editor', error instanceof Error ? error : new Error(String(error)));
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
                                className="text-xs text-blue-500 hover:text-blue-400 font-semibold border border-blue-500/30 hover:border-blue-500/50 px-4 py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-all duration-200 focus-visible:outline-blue-600 focus-visible:outline-2 flex items-center justify-center gap-2"
                                title="Run editor review on this arc"
                                aria-label={`Review arc: ${arcWithDefaults.title}`}
                              >
                                <span>📝</span>
                                <span>Review</span>
                              </button>
                            )}
                            
                            {arcWithDefaults.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => handleSetActiveArc(arcWithDefaults.id)}
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 hover:border-emerald-500/50 px-4 py-2.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-all duration-200 focus-visible:outline-emerald-600 focus-visible:outline-2 flex items-center justify-center gap-2"
                                title="Set this arc as the active arc"
                                aria-label={`Set active arc: ${arcWithDefaults.title}`}
                              >
                                <span>▶</span>
                                <span>Activate</span>
                              </button>
                            )}
                            
                            {arcChapters.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Jump to first chapter of this arc
                                  const firstChapter = arcChapters.sort((a, b) => a.number - b.number)[0];
                                  if (firstChapter) {
                                    setActiveChapterId(firstChapter.id);
                                    setView('chapters');
                                  }
                                }}
                                className="text-xs text-purple-400 hover:text-purple-300 font-semibold border border-purple-500/30 hover:border-purple-500/50 px-4 py-2.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 transition-all duration-200 focus-visible:outline-purple-600 focus-visible:outline-2 flex items-center justify-center gap-2"
                                title="Jump to first chapter of this arc"
                                aria-label={`View chapters for arc: ${arcWithDefaults.title}`}
                              >
                                <span>📖</span>
                                <span>Read</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {editingArc && (
          <div 
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setEditingArc(null)}
          >
            <div className="bg-zinc-900 border border-zinc-700 p-6 md:p-10 rounded-2xl w-full max-w-xl shadow-2xl animate-in scale-in max-h-[90vh] overflow-y-auto scrollbar-thin">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500">Refine Plot Arc</h3>
                <div className="flex items-center space-x-2">
                  <CreativeSpark 
                    type="Plot Arc expansion" 
                    currentValue={editingArc.description} 
                    state={activeNovel!} 
                    onIdea={(idea) => setEditingArc({...editingArc, description: idea})} 
                  />
                  <VoiceInput onResult={(text) => setEditingArc({...editingArc, description: text})} />
                  <button
                    onClick={() => setEditingArc(null)}
                    className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                    aria-label="Close dialog"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-title">Arc Title</label>
                    <VoiceInput onResult={(text) => setEditingArc({...editingArc, title: text})} />
                  </div>
                  <input 
                    id="arc-title"
                    value={editingArc.title} 
                    onChange={e => setEditingArc({...editingArc, title: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                    aria-label="Arc Title"
                    placeholder="Enter arc title..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-status">Arc Status</label>
                  <select
                    id="arc-status"
                    value={editingArc.status}
                    onChange={(e) => setEditingArc({ ...editingArc, status: e.target.value as any })}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all cursor-pointer"
                    aria-label="Arc Status"
                  >
                    <option value="active">Active (current focus)</option>
                    <option value="completed">Completed</option>
                  </select>
                  <p className="text-[11px] text-zinc-500">
                    Only one arc can be Active. Setting this to Active will automatically complete all others.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-target">
                    Target Chapters
                  </label>
                  <input
                    id="arc-target"
                    type="number"
                    min={1}
                    value={editingArc.targetChapters ?? DEFAULT_ARC_TARGET_CHAPTERS}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value || '', 10);
                      setEditingArc({
                        ...editingArc,
                        targetChapters: Number.isFinite(n) && n > 0 ? n : DEFAULT_ARC_TARGET_CHAPTERS,
                      });
                    }}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                    aria-label="Target chapters for this arc"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Used to calculate the arc chapters progress bar.
                  </p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
                      Arc Elements Checklist
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditingArc({ ...editingArc, checklist: buildDefaultArcChecklist() })}
                      className="text-[11px] uppercase font-semibold tracking-widest px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200 hover:border-amber-500/40 transition-all"
                      aria-label="Reset arc checklist"
                      title="Reset checklist to defaults"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingArc.checklist && editingArc.checklist.length > 0 ? editingArc.checklist : buildDefaultArcChecklist()).map((item) => (
                      <label
                        key={item.id}
                        className="flex items-start gap-3 p-3 rounded-xl border border-zinc-700/70 bg-zinc-950/30 hover:bg-zinc-950/40 transition-all"
                      >
                        <input
                          type="checkbox"
                          checked={!!item.completed}
                          onChange={(e) => {
                            const current = (editingArc.checklist && editingArc.checklist.length > 0)
                              ? editingArc.checklist
                              : buildDefaultArcChecklist();
                            const next = current.map((ci) => {
                              if (ci.id !== item.id) return ci;
                              const checked = e.target.checked;
                              return {
                                ...ci,
                                completed: checked,
                                completedAt: checked ? (ci.completedAt || Date.now()) : undefined,
                                sourceChapterNumber: checked ? (ci.sourceChapterNumber || activeNovel?.chapters.length) : undefined,
                              };
                            });
                            setEditingArc({ ...editingArc, checklist: next });
                          }}
                          className="mt-1 h-4 w-4 accent-amber-500"
                          aria-label={`Mark complete: ${item.label}`}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-zinc-200 font-semibold leading-snug">
                            {item.label}
                          </div>
                          {item.completed && (
                            <div className="text-[11px] text-zinc-500 mt-1">
                              {typeof item.sourceChapterNumber === 'number' ? `Updated by Chapter ${item.sourceChapterNumber}` : 'Completed'}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-description">Arc Vision</label>
                  <textarea 
                    id="arc-description"
                    value={editingArc.description} 
                    onChange={e => setEditingArc({...editingArc, description: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-48 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
                    aria-label="Arc Vision"
                    placeholder="Describe the arc vision..."
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-4 border-t border-zinc-700">
                  <button 
                    onClick={() => setEditingArc(null)} 
                    className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      updateActiveNovel(prev => {
                        const edited = ensureArcDefaults(editingArc);
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
                        const edited = ensureArcDefaults(editingArc, activeNovel);
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
                    }}
                    className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105"
                  >
                    Seal Fate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingWorld && (
          <div 
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setEditingWorld(null)}
          >
            <div className="bg-zinc-900 border border-zinc-700 p-6 md:p-10 rounded-2xl w-full max-w-xl shadow-2xl animate-in scale-in max-h-[90vh] overflow-y-auto scrollbar-thin">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500">Forge Knowledge</h3>
                <div className="flex items-center space-x-2">
                  {(editingWorld.category === 'PowerLevels' || editingWorld.category === 'Systems') && (
                    <CreativeSpark 
                      type={`${editingWorld.category} Architect Expansion`} 
                      currentValue={editingWorld.content} 
                      state={activeNovel!} 
                      onIdea={(idea) => setEditingWorld({...editingWorld, content: idea})} 
                      label="AI Help"
                      className="bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500"
                    />
                  )}
                  <CreativeSpark 
                    type={editingWorld.category} 
                    currentValue={editingWorld.content} 
                    state={activeNovel!} 
                    onIdea={(idea) => setEditingWorld({...editingWorld, content: idea})} 
                  />
                  <button
                    onClick={() => setEditingWorld(null)}
                    className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                    aria-label="Close dialog"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-category">Category</label>
                  <select 
                    id="world-category"
                    value={editingWorld.category} 
                    onChange={e => setEditingWorld({...editingWorld, category: getWorldCategory(e.target.value)})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all appearance-none cursor-pointer"
                    aria-label="World Entry Category"
                  >
                    <option>Geography</option>
                    <option>Sects</option>
                    <option>PowerLevels</option>
                    <option>Systems</option>
                    <option>Techniques</option>
                    <option>Laws</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-title">Title</label>
                    <VoiceInput onResult={(text) => setEditingWorld({...editingWorld, title: text})} />
                  </div>
                  <input 
                    id="world-title"
                    placeholder="Title" 
                    value={editingWorld.title} 
                    onChange={e => setEditingWorld({...editingWorld, title: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-content">Content</label>
                    <VoiceInput onResult={(text) => setEditingWorld({...editingWorld, content: editingWorld.content ? editingWorld.content + " " + text : text})} />
                  </div>
                  <textarea 
                    id="world-content"
                    placeholder="Content..." 
                    value={editingWorld.content} 
                    onChange={e => setEditingWorld({...editingWorld, content: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-64 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
                    aria-required="true"
                  />
                </div>
                <div className="flex justify-end space-x-4 pt-4 border-t border-zinc-700">
                  <button 
                    onClick={() => setEditingWorld(null)} 
                    className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      // Validate input with Zod
                      const validation = validateWorldEntryInput(editingWorld);
                      if (!validation.success) {
                        showWarning(validation.error || 'Please provide both a title and content for this world entry.');
                        return;
                      }
                      updateActiveNovel(prev => ({
                        ...prev,
                        worldBible: prev.worldBible.some(e => e.id === editingWorld.id) 
                          ? prev.worldBible.map(e => e.id === editingWorld.id ? editingWorld : e)
                          : [...prev.worldBible, editingWorld]
                      }));
                      setEditingWorld(null);
                    }} 
                    className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105"
                  >
                    Seal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {editingChar && (
          <div 
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-xl animate-in fade-in duration-200"
            onClick={(e) => e.target === e.currentTarget && setEditingChar(null)}
          >
            <div className="bg-zinc-900 border border-zinc-700 p-6 md:p-10 rounded-2xl w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[95vh] scrollbar-thin animate-in scale-in">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500">Character Manifestation</h3>
                <div className="flex items-center space-x-2">
                  <CreativeSpark 
                    type="Character Backstory" 
                    currentValue={editingChar.notes} 
                    state={activeNovel!} 
                    onIdea={(idea) => setEditingChar({...editingChar, notes: idea})} 
                  />
                  <VoiceInput onResult={(text) => setEditingChar({...editingChar, notes: editingChar.notes ? editingChar.notes + " " + text : text})} />
                  <button
                    onClick={() => setEditingChar(null)}
                    className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                    aria-label="Close dialog"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-name">Name</label>
                    <VoiceInput onResult={(text) => setEditingChar({...editingChar, name: text})} />
                  </div>
                  <input 
                    id="char-name"
                    placeholder="Name" 
                    value={editingChar.name} 
                    onChange={e => setEditingChar({...editingChar, name: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-realm">Realm</label>
                    <VoiceInput onResult={(text) => setEditingChar({...editingChar, currentCultivation: text})} />
                  </div>
                  <input 
                    id="char-realm"
                    placeholder="Realm" 
                    value={editingChar.currentCultivation} 
                    onChange={e => setEditingChar({...editingChar, currentCultivation: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2 pt-2">
                  <label className="flex items-center justify-between gap-4 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3">
                    <span className="text-sm font-semibold text-zinc-300">
                      Protagonist (main character)
                      <span className="block text-[11px] text-zinc-500 font-normal mt-1">
                        If enabled, this character will replace any existing protagonist.
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      checked={!!editingChar.isProtagonist}
                      onChange={(e) => setEditingChar({ ...editingChar, isProtagonist: e.target.checked })}
                      className="h-5 w-5 accent-amber-500"
                      aria-label="Mark as protagonist"
                    />
                  </label>
                </div>

                <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-700">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Techniques</label>
                      <CreativeSpark 
                        type="Spiritual Technique or Spell" 
                        currentValue="" 
                        state={activeNovel!} 
                        onIdea={(idea) => setEditingChar({...editingChar, skills: [...editingChar.skills, idea.split('\n')[0].replace('Name: ', '')]})} 
                        label="Forge Skill"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editingChar.skills.map((s, i) => (
                        <div key={i} className="flex items-center bg-emerald-950/40 border border-emerald-900/40 px-3 py-1.5 rounded-lg">
                          <span className="text-xs text-emerald-400 font-semibold">{s}</span>
                          <button 
                            onClick={() => setEditingChar({...editingChar, skills: editingChar.skills.filter((_, idx) => idx !== i)})} 
                            className="ml-2 text-emerald-700 hover:text-emerald-400 transition-colors"
                            aria-label={`Remove ${s}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {editingChar.skills.length === 0 && (
                        <p className="text-xs text-zinc-500 italic">No techniques added yet</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Treasures</label>
                      <CreativeSpark 
                        type="Magical Item or Treasure" 
                        currentValue="" 
                        state={activeNovel!} 
                        onIdea={(idea) => setEditingChar({...editingChar, items: [...editingChar.items, idea.split('\n')[0].replace('Name: ', '')]})} 
                        label="Forge Item"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {editingChar.items.map((it, i) => (
                        <div key={i} className="flex items-center bg-amber-950/40 border border-amber-900/40 px-3 py-1.5 rounded-lg">
                          <span className="text-xs text-amber-400 font-semibold">{it}</span>
                          <button 
                            onClick={() => setEditingChar({...editingChar, items: editingChar.items.filter((_, idx) => idx !== i)})} 
                            className="ml-2 text-amber-700 hover:text-amber-400 transition-colors"
                            aria-label={`Remove ${it}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {editingChar.items.length === 0 && (
                        <p className="text-xs text-zinc-500 italic">No treasures added yet</p>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2 space-y-4 pt-6 border-t border-zinc-700 mt-4">
                  <h4 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex justify-between items-center">
                    Karma Links
                    <button 
                      onClick={() => setEditingChar({
                        ...editingChar,
                        relationships: [...editingChar.relationships, { characterId: '', type: 'Ally', history: '', impact: '' }]
                      })}
                      className="text-xs bg-zinc-800 px-4 py-1.5 rounded-full text-amber-500 hover:bg-amber-600 hover:text-white transition-all duration-200 font-semibold"
                      aria-label="Add karma link"
                    >
                      + Add Karma
                    </button>
                  </h4>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    {editingChar.relationships.length > 0 ? editingChar.relationships.map((rel, idx) => (
                      <div key={idx} className="bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-700 space-y-4 relative group/rel shadow-lg">
                        <button 
                          onClick={() => setEditingChar({...editingChar, relationships: editingChar.relationships.filter((_, i) => i !== idx)})}
                          className="absolute top-3 right-3 text-zinc-600 hover:text-red-500 transition-colors duration-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10"
                          aria-label="Remove relationship"
                        >
                          ×
                        </button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-char-${idx}`}>Connect to Being</label>
                            <select 
                              id={`rel-char-${idx}`}
                              className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm w-full outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all"
                              value={rel.characterId}
                              onChange={(e) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].characterId = e.target.value;
                                setEditingChar({...editingChar, relationships: newRels});
                              }}
                              aria-label="Connect to Being"
                            >
                              <option value="">Select Being...</option>
                              {activeNovel.characterCodex.filter(c => c.id !== editingChar.id).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-type-${idx}`}>Connection Type</label>
                            <input 
                              id={`rel-type-${idx}`}
                              placeholder="e.g. Master, Rival, Family..." 
                              className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm w-full outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 text-amber-400 font-semibold transition-all"
                              value={rel.type}
                              onChange={(e) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].type = e.target.value;
                                setEditingChar({...editingChar, relationships: newRels});
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-history-${idx}`}>History of Fate</label>
                              <VoiceInput onResult={(text) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].history = text;
                                setEditingChar({...editingChar, relationships: newRels});
                              }} />
                            </div>
                            <textarea 
                              id={`rel-history-${idx}`}
                              placeholder="Describe how their lives collided..."
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 h-20 resize-none outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all leading-relaxed"
                              value={rel.history}
                              onChange={(e) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].history = e.target.value;
                                setEditingChar({...editingChar, relationships: newRels});
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-impact-${idx}`}>Impact on Dao</label>
                              <VoiceInput onResult={(text) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].impact = text;
                                setEditingChar({...editingChar, relationships: newRels});
                              }} />
                            </div>
                            <textarea 
                              id={`rel-impact-${idx}`}
                              placeholder="How this link changes their path..."
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 h-20 resize-none outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 italic transition-all leading-relaxed"
                              value={rel.impact}
                              onChange={(e) => {
                                const newRels = [...editingChar.relationships];
                                newRels[idx].impact = e.target.value;
                                setEditingChar({...editingChar, relationships: newRels});
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="py-12 text-center bg-zinc-950/50 border border-dashed border-zinc-700 rounded-2xl">
                        <p className="text-sm text-zinc-500 italic">No threads of fate yet connect this being to the world.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-2 mt-4">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-notes">Fate Summary</label>
                  <textarea 
                    id="char-notes"
                    placeholder="The legend of this being..." 
                    value={editingChar.notes} 
                    onChange={e => setEditingChar({...editingChar, notes: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-40 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
                  />
                </div>
                <div className="flex justify-end col-span-2 space-x-4 pt-6 border-t border-zinc-700 mt-4">
                  <button 
                    onClick={() => setEditingChar(null)} 
                    className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      updateActiveNovel(prev => {
                        const baseCodex = prev.characterCodex.some(c => c.id === editingChar.id)
                          ? prev.characterCodex.map(c => (c.id === editingChar.id ? editingChar : c))
                          : [...prev.characterCodex, editingChar];

                        // Enforce single protagonist if this character is set as protagonist.
                        const nextCodex = editingChar.isProtagonist
                          ? baseCodex.map(c => ({ ...c, isProtagonist: c.id === editingChar.id }))
                          : baseCodex;

                        return { ...prev, characterCodex: nextCodex };
                      });
                      setEditingChar(null);
                      
                      // Save immediately to ensure persistence
                      if (activeNovel) {
                        const baseCodex = activeNovel.characterCodex.some(c => c.id === editingChar.id)
                          ? activeNovel.characterCodex.map(c => (c.id === editingChar.id ? editingChar : c))
                          : [...activeNovel.characterCodex, editingChar];

                        const nextCodex = editingChar.isProtagonist
                          ? baseCodex.map(c => ({ ...c, isProtagonist: c.id === editingChar.id }))
                          : baseCodex;

                        const updatedNovel = {
                          ...activeNovel,
                          characterCodex: nextCodex,
                          updatedAt: Date.now(),
                        };
                        updateActiveNovel(() => updatedNovel);
                      }
                    }} 
                    className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/30"
                  >
                    Seal Fate
                  </button>
                </div>
              </div>
            </div>
          </div>
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

      {showExportDialog && activeNovel && (
        <Suspense fallback={null}>
          <ExportDialog novel={activeNovel} onClose={() => setShowExportDialog(false)} />
        </Suspense>
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
                        const { updatedChapters, appliedFixes, failedFixes } = applyApprovedFixes(chaptersToUpdate, validatedFixes);
                        
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
                        const { updatedChapters, appliedFixes, failedFixes } = applyApprovedFixes(chaptersToUpdate, validatedFixes);
                        
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
                        const { updatedChapters, appliedFixes, failedFixes } = applyApprovedFixes(chaptersToUpdate, validatedFixes);
                        
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
              const { updatedChapters, appliedFixes, failedFixes } = applyApprovedFixes(chaptersToUpdate, validatedFixes);
              
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
