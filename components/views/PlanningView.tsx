/**
 * Planning View Component
 * Arc planning and management interface
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import type { NovelState, Arc, Chapter } from '../../types';
import CreativeSpark from '../CreativeSpark';
import VoiceInput from '../VoiceInput';
import * as arcAnalyzer from '../../services/promptEngine/arcContextAnalyzer';
import { logger } from '../../services/loggingService';
import { triggerEditorReview, applyApprovedFixes } from '../../services/editorService';
import { saveEditorReport } from '../../services/supabaseService';
import type { EditorFix, EditorReportWithInternal } from '../../types/editor';
import { backfillAllChapters } from '../../services/chapterBackfillService';

const DEFAULT_ARC_TARGET_CHAPTERS = 10;

interface PlanningViewProps {
  novel: NovelState;
  isPlanning: boolean;
  onPlanNewArc: () => void;
  onUpdateGrandSaga: (saga: string) => void;
  onEditArc: (arc: Arc) => void;
  onSetActiveArc: (arcId: string) => void;
  onChapterSelect: (chapterId: string) => void;
  onViewChange: (view: string) => void;
  onEditorReview: () => void;
  onUpdateNovel: (updater: (prev: NovelState) => NovelState) => void;
  onShowSuccess: (message: string) => void;
  onShowError: (message: string) => void;
  onStartLoading: (message: string, showProgressBar?: boolean) => void;
  onStopLoading: () => void;
  onUpdateProgress: (progress: number, message?: string) => void;
  onUpdateMessage: (message: string) => void;
  onSetGenerationStatus: (status: string) => void;
  onSetIsGenerating: (isGenerating: boolean) => void;
  onAddLog: (message: string, type?: 'discovery' | 'update' | 'fate' | 'logic') => void;
  onSetCurrentEditorReport: (report: any) => void;
  onSetPendingFixProposals: (proposals: any[]) => void;
}

const PlanningViewComponent: React.FC<PlanningViewProps> = ({
  novel,
  isPlanning,
  onPlanNewArc,
  onUpdateGrandSaga,
  onEditArc,
  onSetActiveArc,
  onChapterSelect,
  onViewChange,
  onEditorReview,
  onUpdateNovel,
  onShowSuccess,
  onShowError,
  onStartLoading,
  onStopLoading,
  onUpdateProgress,
  onUpdateMessage,
  onSetGenerationStatus,
  onSetIsGenerating,
  onAddLog,
  onSetCurrentEditorReport,
  onSetPendingFixProposals,
}) => {
  const [isBackfilling, setIsBackfilling] = useState(false);
  const handleBackfillChapters = useCallback(async () => {
    if (isBackfilling) return;
    
    const confirmed = window.confirm(
      `This will extract scenes, world bible entries, territories, antagonists, and arc progress for all ${novel.chapters.length} chapters. ` +
      `Chapters that already have scenes will be skipped. This may take several minutes. Continue?`
    );
    
    if (!confirmed) return;
    
    setIsBackfilling(true);
    onStartLoading('Starting chapter backfill...', true);
    onAddLog('Starting chapter backfill process...', 'discovery');
    
    try {
      let currentState = novel;
      
      const result = await backfillAllChapters(
        currentState,
        (chapterNumber, total, chapter) => {
          const progress = Math.round((chapterNumber / total) * 100);
          onUpdateProgress(progress, `Processing chapter ${chapterNumber}/${total}: ${chapter.title}`);
        },
        (message) => {
          onAddLog(message, 'update');
        }
      );
      
      if (result.updatedState) {
        onUpdateNovel(() => result.updatedState!);
        
        // Reload novel from database to get updated data
        try {
          const { fetchNovel } = await import('../../services/supabaseService');
          const updatedNovel = await fetchNovel(novel.id);
          if (updatedNovel) {
            onUpdateNovel(() => updatedNovel);
          }
        } catch (error) {
          logger.warn('Failed to reload novel after backfill', 'backfill', error instanceof Error ? error : new Error(String(error)));
        }
      }
      
      if (result.errors.length > 0) {
        onShowError(
          `Backfill completed with ${result.errors.length} error(s): ${result.errors.slice(0, 3).map(e => `Ch ${e.chapter}`).join(', ')}`
        );
        onAddLog(`⚠️ ${result.errors.length} chapter(s) failed during backfill`, 'update');
      } else {
        onShowSuccess(`Successfully backfilled ${result.processed} chapter(s)!`);
        onAddLog(`✅ Backfill completed: ${result.processed} chapter(s) processed`, 'discovery');
      }
      
      onAddLog(`Backfill summary: ${result.processed} processed, ${result.errors.length} error(s)`, 'discovery');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      onShowError(`Backfill failed: ${errorMessage}`);
      onAddLog(`❌ Backfill failed: ${errorMessage}`, 'update');
      logger.error('Backfill failed', 'backfill', error instanceof Error ? error : new Error(errorMessage));
    } finally {
      setIsBackfilling(false);
      onStopLoading();
    }
  }, [novel, isBackfilling, onStartLoading, onStopLoading, onUpdateProgress, onUpdateNovel, onShowSuccess, onShowError, onAddLog]);

  const ensureArcDefaults = useCallback((arc: Arc): Arc => {
    const needsTarget = typeof arc.targetChapters !== 'number' || arc.targetChapters <= 0;
    const needsChecklist = !Array.isArray(arc.checklist) || arc.checklist.length === 0;
    if (!needsTarget && !needsChecklist) return arc;

    let targetChapters = arc.targetChapters;
    if (needsTarget) {
      try {
        const arcContext = arcAnalyzer.analyzeAllArcContexts(novel);
        const progression = arcAnalyzer.analyzeArcProgression(novel);
        const context = { progressionAnalysis: progression, arcSummaries: arcContext };
        targetChapters = arcAnalyzer.calculateSmartArcTargetChapters(novel, context);
      } catch (e) {
        logger.warn('Failed to calculate smart arc target, using default', 'arc', {
          error: e instanceof Error ? e.message : String(e)
        });
        targetChapters = DEFAULT_ARC_TARGET_CHAPTERS;
      }
    }

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

    return {
      ...arc,
      targetChapters: targetChapters,
      checklist: needsChecklist ? buildDefaultArcChecklist() : arc.checklist,
    };
  }, [novel]);

  const handleApplyArcFix = useCallback(async (
    arcWithDefaults: Arc,
    displayArc: Arc,
    needsBoundaryFix: boolean,
    validationResult: any,
    finalArcChapters: Chapter[]
  ) => {
    const fixedArc = needsBoundaryFix ? displayArc : validationResult.arc;
    
    let repairedArcs = novel.plotLedger.map(a => {
      if (a.id === arcWithDefaults.id) {
        return fixedArc;
      }
      if (needsBoundaryFix && a.id !== arcWithDefaults.id && a.status === 'completed' && !a.endedAtChapter) {
        const sortedArcs = [...novel.plotLedger].sort((a1, b1) => {
          const aStart = a1.startedAtChapter || 0;
          const bStart = b1.startedAtChapter || 0;
          return aStart - bStart;
        });
        const firstArcIndex = sortedArcs.findIndex(a1 => a1.id === a.id);
        const secondArcIndex = sortedArcs.findIndex(a1 => a1.id === arcWithDefaults.id);
        if (firstArcIndex === 0 && secondArcIndex === 1 && fixedArc.startedAtChapter) {
          const firstArcEnd = fixedArc.startedAtChapter - 1;
          return { ...a, endedAtChapter: firstArcEnd };
        }
      }
      return a;
    });
    
    const updatedNovel = {
      ...novel,
      plotLedger: repairedArcs,
      updatedAt: Date.now(),
    };
    onUpdateNovel(() => updatedNovel);
    
    try {
      const { saveNovel } = await import('../../services/supabaseService');
      await saveNovel(updatedNovel);
      onShowSuccess(`Arc "${arcWithDefaults.title}" has been ${needsBoundaryFix ? 'boundary-corrected' : 'auto-repaired'} and saved! Found ${finalArcChapters.length} chapters.`);
      setTimeout(() => {
        onUpdateNovel((prev) => ({ ...prev, updatedAt: Date.now() }));
      }, 100);
    } catch (error) {
      logger.error('Failed to save repaired arc', 'arc', error instanceof Error ? error : new Error(String(error)));
      onShowError('Failed to save repaired arc. Changes are only local.');
    }
  }, [novel, onUpdateNovel, onShowSuccess, onShowError]);

  const handleArcEditorReview = useCallback(async (arc: Arc) => {
    try {
      onSetIsGenerating(true);
      onStartLoading(`Starting editor review for arc: ${arc.title}...`, true);
      onUpdateProgress(5);
      onSetGenerationStatus(`Starting editor review for arc "${arc.title}"...`);
      
      const editorReport = await triggerEditorReview(novel, 'manual', arc, {
        onProgress: (phase: string, progress?: number) => {
          if (progress !== undefined) {
            onUpdateProgress(progress, `Editor: ${phase}`);
            onSetGenerationStatus(`Editor: ${phase}`);
          } else {
            onUpdateMessage(`Editor: ${phase}`);
          }
          onAddLog(`Editor: ${phase}`, 'discovery');
        },
        onAutoFix: (fix: EditorFix) => {
          onAddLog(`Auto-fixed: ${fix.fixType} issue`, 'update');
        },
      });

      if (editorReport) {
        await saveEditorReport(editorReport);
        onSetCurrentEditorReport(editorReport);
        
        if ((editorReport as any)._updatedChapters && (editorReport as any)._updatedChapters.length > 0) {
          const updatedChapters = (editorReport as any)._updatedChapters as Chapter[];
          onUpdateNovel(prev => {
            const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
            const updatedNovel = {
              ...prev,
              chapters: prev.chapters.map(ch => updatedChapterMap.get(ch.id) || ch),
              updatedAt: Date.now(),
            };
            import('../../services/supabaseService').then(({ saveNovel }) => {
              saveNovel(updatedNovel).catch(err => logger.error('Failed to save fixed chapters', 'editor', err instanceof Error ? err : new Error(String(err))));
            });
            return updatedNovel;
          });
        }
        
        const { createFixProposals } = await import('../../services/editorFixer');
        const proposals = createFixProposals(editorReport.analysis.issues, editorReport.fixes);
        
        if (proposals.length > 0) {
          onSetPendingFixProposals(proposals);
          onSetIsGenerating(false);
          onStopLoading();
        } else {
          onSetIsGenerating(false);
          onStopLoading();
          if (editorReport.autoFixedCount > 0) {
            onShowSuccess(`Editor fixed ${editorReport.autoFixedCount} issue(s) automatically`);
          }
          const arcAnalysis = editorReport.analysis as any;
          if (arcAnalysis?.readiness?.isReadyForRelease) {
            onShowSuccess(`Arc "${arc.title}" is ready for release!`);
          }
          onShowSuccess(`Editor review complete for arc "${arc.title}"`);
        }
      } else {
        onStopLoading();
      }
    } catch (error) {
      logger.error('Error in arc editor review', 'editor', error instanceof Error ? error : new Error(String(error)));
      onStopLoading();
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
          ? error 
          : 'Unknown error occurred';
      
      if (errorMessage.includes('Failed to load') || errorMessage.includes('500') || errorMessage.includes('editorAnalyzer')) {
        onShowError(`Editor review module failed to load. Please refresh the page and try again. Error: ${errorMessage}`);
      } else {
        onShowError(`Editor review failed: ${errorMessage}`);
      }
      
      onSetIsGenerating(false);
      onSetGenerationStatus('');
    }
  }, [novel, onSetIsGenerating, onStartLoading, onUpdateProgress, onSetGenerationStatus, onUpdateMessage, onAddLog, onSetCurrentEditorReport, onSetPendingFixProposals, onUpdateNovel, onShowSuccess, onShowError, onStopLoading]);

  // Render arc with all its complex logic
  const renderArc = useCallback((arc: Arc, index: number) => {
    const arcWithDefaults = ensureArcDefaults(arc);
    
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Arc ${index + 1} "${arcWithDefaults.title}"`, 'arc', {
        id: arcWithDefaults.id,
        status: arcWithDefaults.status,
        startedAtChapter: arcWithDefaults.startedAtChapter,
        endedAtChapter: arcWithDefaults.endedAtChapter,
        targetChapters: arcWithDefaults.targetChapters,
        totalChapters: novel.chapters.length,
        chapterNumbers: novel.chapters.map(ch => ch.number).sort((a, b) => a - b),
      });
    }
    
    const arcChapters = arcAnalyzer.getArcChapters(arcWithDefaults, novel.chapters, novel.plotLedger);
    const chaptersWrittenInArc = arcChapters.length;
    
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
    
    const validationResult = arcAnalyzer.validateArcState(arcWithDefaults, novel.chapters, novel.plotLedger);
    const hasWarnings = validationResult.issues.length > 0;
    
    let displayArc = arcWithDefaults;
    let needsBoundaryFix = false;
    let boundaryFixMessage = '';
    
    // Boundary fix logic (simplified version)
    if (arcWithDefaults.startedAtChapter && arcWithDefaults.startedAtChapter > 0 && novel.chapters.length > 10) {
      const sortedArcs = [...novel.plotLedger].sort((a, b) => {
        const aStart = a.startedAtChapter || 0;
        const bStart = b.startedAtChapter || 0;
        return aStart - bStart;
      });
      const currentArcIndex = sortedArcs.findIndex(a => a.id === arcWithDefaults.id);
      
      if (currentArcIndex > 0 && arcChapters.length < 3) {
        const prevArc = sortedArcs[currentArcIndex - 1];
        let expectedStart: number | undefined = undefined;
        
        if (prevArc.status === 'completed' && prevArc.endedAtChapter && prevArc.endedAtChapter > 0) {
          expectedStart = prevArc.endedAtChapter + 1;
        } else if (currentArcIndex === 1 && prevArc.startedAtChapter === 1) {
          const sortedChapters = [...novel.chapters].sort((a, b) => a.number - b.number);
          const firstArcPossibleChapters = sortedChapters.filter(ch => 
            ch.number >= 1 && ch.number < arcWithDefaults.startedAtChapter!
          );
          if (firstArcPossibleChapters.length >= 8 && firstArcPossibleChapters.length <= 12) {
            const maxFirstChapter = Math.max(...firstArcPossibleChapters.map(ch => ch.number));
            expectedStart = maxFirstChapter + 1;
            if (expectedStart === arcWithDefaults.startedAtChapter) {
              expectedStart = undefined;
            }
          }
        }
        
        if (expectedStart && expectedStart !== arcWithDefaults.startedAtChapter && expectedStart <= novel.chapters.length) {
          const testFixedArc = { ...arcWithDefaults, startedAtChapter: expectedStart };
          const testChapters = arcAnalyzer.getArcChapters(testFixedArc, novel.chapters, novel.plotLedger);
          if (testChapters.length > arcChapters.length) {
            needsBoundaryFix = true;
            displayArc = testFixedArc;
            const prevArcEnd = prevArc.endedAtChapter || (expectedStart - 1);
            boundaryFixMessage = `Arc should start at Ch ${expectedStart} instead of Ch ${arcWithDefaults.startedAtChapter}. First arc should end at Ch ${prevArcEnd}. This will correctly assign ${testChapters.length} chapters instead of ${arcChapters.length}.`;
          }
        }
      }
    }
    
    if (validationResult.wasRepaired || needsBoundaryFix) {
      displayArc = validationResult.wasRepaired ? validationResult.arc : displayArc;
      const repairedArcChapters = arcAnalyzer.getArcChapters(displayArc, novel.chapters, novel.plotLedger);
      if (repairedArcChapters.length !== arcChapters.length) {
        arcChapters.length = repairedArcChapters.length;
        arcChapters.splice(0, arcChapters.length, ...repairedArcChapters);
      }
    }
    
    const arcToDisplay = displayArc;
    const finalArcChapters = arcAnalyzer.getArcChapters(arcToDisplay, novel.chapters, novel.plotLedger);
    const finalChaptersWrittenInArc = finalArcChapters.length;
    
    const chapterRange = finalArcChapters.length > 0 
      ? `Ch ${Math.min(...finalArcChapters.map(ch => ch.number))}-${Math.max(...finalArcChapters.map(ch => ch.number))}`
      : arcToDisplay.startedAtChapter 
        ? `Starts at Ch ${arcToDisplay.startedAtChapter}` 
        : 'No chapters yet';
    
    const finalTargetChapters = arcToDisplay.targetChapters || DEFAULT_ARC_TARGET_CHAPTERS;
    const finalChapterPct = finalTargetChapters > 0 ? Math.min(100, Math.round((finalChaptersWrittenInArc / finalTargetChapters) * 100)) : 0;
    
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
                  onClick={() => onEditArc(arcWithDefaults)}
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
                          onChapterSelect(ch.id);
                          onViewChange('chapters');
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
            
            {(hasWarnings || needsBoundaryFix) && (
              <div className="mt-4 p-3 bg-yellow-950/30 border border-yellow-700/50 rounded-lg">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="text-xs text-yellow-400 font-semibold">
                    {needsBoundaryFix ? '🔧 Boundary Fix Needed:' : '⚠️ Validation Issues:'}
                  </div>
                  {(validationResult.wasRepaired || needsBoundaryFix) && (
                    <button
                      type="button"
                      onClick={() => handleApplyArcFix(arcWithDefaults, displayArc, needsBoundaryFix, validationResult, finalArcChapters)}
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
                      • {boundaryFixMessage || `Arc startedAtChapter is ${arcWithDefaults.startedAtChapter} but should be ${displayArc.startedAtChapter}`}. 
                      Currently showing {chaptersWrittenInArc} chapter(s) but should show {finalChaptersWrittenInArc} chapter(s).
                    </li>
                  )}
                  {validationResult.issues.slice(0, needsBoundaryFix ? 2 : 3).map((issue: string, idx: number) => (
                    <li key={idx} className="text-xs text-yellow-300/80">• {issue}</li>
                  ))}
                  {validationResult.issues.length > (needsBoundaryFix ? 2 : 3) && (
                    <li className="text-xs text-yellow-500/60">... and {validationResult.issues.length - (needsBoundaryFix ? 2 : 3)} more</li>
                  )}
                </ul>
              </div>
            )}
            
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
              onClick={() => onEditArc(arcWithDefaults)}
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
                onClick={() => handleArcEditorReview(arcWithDefaults)}
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
                onClick={() => onSetActiveArc(arcWithDefaults.id)}
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
                  const firstChapter = arcChapters.sort((a, b) => a.number - b.number)[0];
                  if (firstChapter) {
                    onChapterSelect(firstChapter.id);
                    onViewChange('chapters');
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
  }, [novel, ensureArcDefaults, onEditArc, onSetActiveArc, onChapterSelect, onViewChange, handleArcEditorReview, handleApplyArcFix]);

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-300 pt-20 md:pt-24">
      <div className="flex justify-between items-center mb-6 md:mb-8 border-b border-zinc-700 pb-4 md:pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Arc Ledger</h2>
        <button
          onClick={onEditorReview}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-2"
          title="Manually trigger editor review for arcs or chapters"
          aria-label="Trigger editor review"
        >
          <span>✏️</span>
          <span>Editor Review</span>
        </button>
      </div>
      <section className="bg-zinc-900/60 border border-zinc-700 p-6 md:p-10 rounded-2xl shadow-xl border-t-4 border-t-amber-600">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider" data-tour="grand-saga">Grand Saga</h3>
          <div className="flex items-center space-x-2">
            <CreativeSpark 
              type="Grand Saga" 
              currentValue={novel.grandSaga} 
              state={novel} 
              onIdea={(idea) => onUpdateGrandSaga(idea)} 
            />
            <VoiceInput onResult={(text) => onUpdateGrandSaga(novel.grandSaga ? novel.grandSaga + " " + text : text)} />
          </div>
        </div>
        <textarea 
          value={novel.grandSaga} 
          onChange={(e) => onUpdateGrandSaga(e.target.value)} 
          className="w-full bg-transparent border-none focus:ring-0 text-lg md:text-2xl font-serif-novel italic text-zinc-300 resize-none h-32 scrollbar-hide leading-relaxed"
          aria-label="Grand Saga"
          placeholder="Describe the overarching story..."
        />
      </section>
      <section className="space-y-6" data-tour="plot-arcs">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Plot Arcs</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBackfillChapters}
              disabled={isBackfilling || novel.chapters.length === 0}
              className="text-xs bg-zinc-800 hover:bg-zinc-700 px-4 py-2.5 rounded-xl font-semibold text-zinc-300 border border-zinc-700/50 hover:border-zinc-600/70 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-zinc-800"
              title="Extract scenes, world bible entries, territories, antagonists, and arc progress for all chapters"
              aria-label="Backfill chapters"
            >
              {isBackfilling ? (
                <span className="flex items-center">
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-500/30 border-t-zinc-500 mr-2"></span>
                  Backfilling...
                </span>
              ) : (
                'Backfill Chapters'
              )}
            </button>
            <button 
              disabled={isPlanning} 
              onClick={onPlanNewArc} 
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
        </div>
        {novel.plotLedger.length === 0 ? (
          <div className="py-12 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
            <div className="text-5xl mb-4">🗺️</div>
            <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Plot Arcs Yet</h3>
            <p className="text-sm text-zinc-500 mb-4">Start planning your story by creating plot arcs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:gap-6">
            {novel.plotLedger.map((arc, index) => renderArc(arc, index))}
          </div>
        )}
      </section>
    </div>
  );
};

const PlanningView = memo(PlanningViewComponent);
export default PlanningView;
