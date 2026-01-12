import { NovelState, Chapter, Arc } from '../types';
import { 
  EditorReport, 
  EditorTriggerType, 
  EditorAnalysis, 
  EditorFix, 
  EditorIssue, 
  EditorFixProposal,
  ChapterBatchEditorInput,
  ArcEditorInput,
  EditorServiceOptions
} from '../types/editor';
import { analyzeChapterBatch, analyzeArc } from './editorAnalyzer';
import { 
  categorizeFixes, 
  applyAutoFixes, 
  createFixProposals,
  applyFixesToChapter
} from './editorFixer';
import { generateUUID } from '../utils/uuid';
import { detectRecurringPatterns, checkPatternResolution, getPatternStatistics } from './patternDetectionService';

/**
 * Editor Service
 * Main orchestration service for editor operations
 * Triggers analysis based on chapter count and arc completion
 * Coordinates between analysis and fixing phases
 */

/**
 * Triggers editor review for a batch of chapters (typically every 5 chapters)
 */
export async function triggerEditorReview(
  novelState: NovelState,
  triggerType: EditorTriggerType,
  arc?: Arc,
  options?: EditorServiceOptions
): Promise<EditorReport | null> {
  try {
    options?.onProgress?.('Starting editor review...', 5);

    let analysis: EditorAnalysis & { readiness?: { isReadyForRelease: boolean; blockingIssues: string[]; suggestedImprovements: string[] } };
    let chaptersAnalyzed: Chapter[] = [];
    let chaptersToAnalyze: number[] = [];

    if (triggerType === 'chapter_batch') {
      // Analyze the most recent 5 chapters (or specified range if manual)
      const recentChapters = novelState.chapters.slice(-5);
      chaptersAnalyzed = recentChapters;
      chaptersToAnalyze = recentChapters.map(ch => ch.number);

      if (recentChapters.length === 0) {
        console.warn('No chapters to analyze for editor review');
        return null;
      }

      options?.onProgress?.(`Analyzing chapters ${chaptersToAnalyze[0]}-${chaptersToAnalyze[chaptersToAnalyze.length - 1]}...`, 10);

      const input: ChapterBatchEditorInput = {
        chapters: recentChapters,
        novelState,
        startChapter: chaptersToAnalyze[0],
        endChapter: chaptersToAnalyze[chaptersToAnalyze.length - 1],
      };

      analysis = await analyzeChapterBatch(input, options);
    } else if (triggerType === 'manual') {
      // Manual trigger - requires either arc or chapter range
      if (arc) {
        // Manual arc review
        if (!arc.startedAtChapter || !arc.endedAtChapter) {
          console.warn('Arc missing start or end chapter numbers');
          return null;
        }

        chaptersAnalyzed = novelState.chapters.filter(ch => 
          ch.number >= arc.startedAtChapter! && ch.number <= arc.endedAtChapter!
        ).sort((a, b) => a.number - b.number);
        chaptersToAnalyze = chaptersAnalyzed.map(ch => ch.number);

        if (chaptersAnalyzed.length === 0) {
          console.warn('No chapters found in arc for editor review');
          return null;
        }

        options?.onProgress?.(`Manually analyzing arc "${arc.title}" (chapters ${chaptersToAnalyze[0]}-${chaptersToAnalyze[chaptersToAnalyze.length - 1]})...`, 10);

        const input: ArcEditorInput = {
          arc,
          chapters: novelState.chapters,
          novelState,
        };

        analysis = await analyzeArc(input, options);
      } else {
        // Manual chapter range review - use options to specify range
        const startChapter = (options as any)?.startChapter as number | undefined;
        const endChapter = (options as any)?.endChapter as number | undefined;
        const chapterNumbers = (options as any)?.chapterNumbers as number[] | undefined;

        if (chapterNumbers && chapterNumbers.length > 0) {
          // Specific chapters provided
          chaptersAnalyzed = novelState.chapters
            .filter(ch => chapterNumbers.includes(ch.number))
            .sort((a, b) => a.number - b.number);
          chaptersToAnalyze = chapterNumbers.sort((a, b) => a - b);
        } else if (startChapter && endChapter) {
          // Range provided
          chaptersAnalyzed = novelState.chapters
            .filter(ch => ch.number >= startChapter && ch.number <= endChapter)
            .sort((a, b) => a.number - b.number);
          chaptersToAnalyze = chaptersAnalyzed.map(ch => ch.number);
        } else {
          // Default to last 5 chapters
          const recentChapters = novelState.chapters.slice(-5);
          chaptersAnalyzed = recentChapters;
          chaptersToAnalyze = recentChapters.map(ch => ch.number);
        }

        if (chaptersAnalyzed.length === 0) {
          console.warn('No chapters found for manual editor review');
          return null;
        }

        // If more than 5 chapters, automatically batch them to prevent truncation
        // Analyzing too many chapters at once can cause response truncation
        const MAX_CHAPTERS_PER_BATCH = 5;
        
        if (chaptersAnalyzed.length > MAX_CHAPTERS_PER_BATCH) {
          // Split into batches and analyze sequentially
          console.log(`[Editor] Large chapter range detected (${chaptersAnalyzed.length} chapters). Splitting into batches of ${MAX_CHAPTERS_PER_BATCH} to prevent truncation.`);
          
          const allIssues: EditorIssue[] = [];
          const allFixes: EditorFix[] = [];
          let combinedAnalysis: EditorAnalysis = {
            overallFlow: 'adequate',
            continuityScore: 75,
            grammarScore: 75,
            styleScore: 75,
            summary: '',
            strengths: [],
            recommendations: [],
            issues: []
          };
          
          // Process chapters in batches
          for (let i = 0; i < chaptersAnalyzed.length; i += MAX_CHAPTERS_PER_BATCH) {
            const batch = chaptersAnalyzed.slice(i, i + MAX_CHAPTERS_PER_BATCH);
            const batchNumbers = batch.map(ch => ch.number);
            const batchStart = batchNumbers[0];
            const batchEnd = batchNumbers[batchNumbers.length - 1];
            
            const progressStart = 10 + (i / chaptersAnalyzed.length) * 70;
            const progressEnd = 10 + ((i + batch.length) / chaptersAnalyzed.length) * 70;
            
            options?.onProgress?.(`Analyzing batch ${Math.floor(i / MAX_CHAPTERS_PER_BATCH) + 1}/${Math.ceil(chaptersAnalyzed.length / MAX_CHAPTERS_PER_BATCH)}: chapters ${batchStart}-${batchEnd}...`, progressStart);

            try {
              const batchInput: ChapterBatchEditorInput = {
                chapters: batch,
                novelState,
                startChapter: batchStart,
                endChapter: batchEnd,
              };

              // Create a progress callback that maps to the overall progress range
              const batchOptions: EditorServiceOptions = {
                ...options,
                onProgress: (message, progress) => {
                  // Map batch progress (0-100) to overall progress range for this batch
                  const mappedProgress = progressStart + (progress / 100) * (progressEnd - progressStart);
                  options?.onProgress?.(message, mappedProgress);
                }
              };

              const batchAnalysis = await analyzeChapterBatch(batchInput, batchOptions);
              
              // Combine results
              allIssues.push(...batchAnalysis.issues);
              
              // Extract fixes from batch analysis
              const batchFixes = (batchAnalysis as any)._fixes || [];
              allFixes.push(...batchFixes);
              
              // Update combined analysis scores (average)
              const batchCount = i / MAX_CHAPTERS_PER_BATCH + 1;
              combinedAnalysis.continuityScore = 
                (combinedAnalysis.continuityScore * (batchCount - 1) + batchAnalysis.continuityScore) / batchCount;
              combinedAnalysis.grammarScore = 
                (combinedAnalysis.grammarScore * (batchCount - 1) + batchAnalysis.grammarScore) / batchCount;
              combinedAnalysis.styleScore = 
                (combinedAnalysis.styleScore * (batchCount - 1) + batchAnalysis.styleScore) / batchCount;
              
              // Combine strengths and recommendations (unique)
              combinedAnalysis.strengths = [
                ...new Set([...combinedAnalysis.strengths, ...batchAnalysis.strengths])
              ];
              combinedAnalysis.recommendations = [
                ...new Set([...combinedAnalysis.recommendations, ...batchAnalysis.recommendations])
              ];
              
              // Update overall flow (use worst rating)
              const flowRanking = { 'needs_work': 0, 'adequate': 1, 'good': 2, 'excellent': 3 };
              if (flowRanking[batchAnalysis.overallFlow] < flowRanking[combinedAnalysis.overallFlow]) {
                combinedAnalysis.overallFlow = batchAnalysis.overallFlow;
              }
              
            } catch (batchError) {
              // If batch fails, log and continue with other batches
              console.error(`[Editor] Failed to analyze batch ${batchStart}-${batchEnd}:`, batchError);
              if (batchError instanceof Error && batchError.message.includes('invalid JSON')) {
                console.warn(`[Editor] Batch ${batchStart}-${batchEnd} returned invalid JSON - may still be too large. Consider analyzing even smaller batches.`);
              }
              // Continue with next batch instead of failing completely
            }
          }
          
          // Build combined analysis result
          combinedAnalysis.issues = allIssues;
          combinedAnalysis.summary = `Analyzed ${chaptersAnalyzed.length} chapters in ${Math.ceil(chaptersAnalyzed.length / MAX_CHAPTERS_PER_BATCH)} batches.`;
          
          // Create a combined analysis object with fixes
          analysis = {
            ...combinedAnalysis,
            _fixes: allFixes
          } as EditorAnalysis & { _fixes?: EditorFix[] };
          
        } else {
          // Standard batch size (5 or fewer chapters) - analyze normally
          options?.onProgress?.(`Manually analyzing chapters ${chaptersToAnalyze[0]}-${chaptersToAnalyze[chaptersToAnalyze.length - 1]}...`, 10);

          const input: ChapterBatchEditorInput = {
            chapters: chaptersAnalyzed,
            novelState,
            startChapter: chaptersToAnalyze[0],
            endChapter: chaptersToAnalyze[chaptersToAnalyze.length - 1],
          };

          analysis = await analyzeChapterBatch(input, options);
        }
      }
    } else if (triggerType === 'arc_complete' && arc) {
      // Analyze all chapters in the arc
      if (!arc.startedAtChapter || !arc.endedAtChapter) {
        console.warn('Arc missing start or end chapter numbers');
        return null;
      }

      chaptersAnalyzed = novelState.chapters.filter(ch => 
        ch.number >= arc.startedAtChapter! && ch.number <= arc.endedAtChapter!
      ).sort((a, b) => a.number - b.number);
      chaptersToAnalyze = chaptersAnalyzed.map(ch => ch.number);

      if (chaptersAnalyzed.length === 0) {
        console.warn('No chapters found in arc for editor review');
        return null;
      }

      options?.onProgress?.(`Analyzing arc "${arc.title}" (chapters ${chaptersToAnalyze[0]}-${chaptersToAnalyze[chaptersToAnalyze.length - 1]})...`, 10);

      const input: ArcEditorInput = {
        arc,
        chapters: novelState.chapters,
        novelState,
      };

      analysis = await analyzeArc(input, options);
    } else {
      throw new Error(`Invalid trigger type: ${triggerType}`);
    }

    options?.onProgress?.('Categorizing fixes...', 50);

    // Extract fixes from analysis - check if fixes were provided by AI, otherwise create from issues
    let fixes: EditorFix[] = [];
    
    // Check if fixes were provided directly in the analysis (from AI response)
    if ((analysis as any)._fixes && Array.isArray((analysis as any)._fixes)) {
      fixes = (analysis as any)._fixes;
    } else {
      // Create fixes from issues that have fixable text
      fixes = analysis.issues
        .filter(issue => issue.originalText && issue.suggestion && issue.originalText.trim() !== issue.suggestion.trim())
        .map(issue => {
          return {
            id: generateUUID(),
            issueId: issue.id,
            chapterId: issue.chapterId || '',
            chapterNumber: issue.chapterNumber,
            fixType: issue.type,
            originalText: issue.originalText || '',
            fixedText: issue.suggestion || issue.originalText || '',
            reason: issue.description,
            status: 'pending' as const,
          };
        });
    }
    
    // Categorize fixes into auto-fixable and those requiring approval
    const { autoFixable, requiresApproval } = categorizeFixes(analysis.issues, fixes);

    options?.onProgress?.('Applying auto-fixes...', 60);

    // Apply auto-fixable fixes
    let appliedAutoFixes: EditorFix[] = [];
    let failedAutoFixes: EditorFix[] = [];
    let updatedChapters: Chapter[] = [];
    
    if (autoFixable.length > 0) {
      const result = applyAutoFixes(chaptersAnalyzed, autoFixable);
      updatedChapters = result.updatedChapters;
      appliedAutoFixes = result.appliedFixes;
      failedAutoFixes = result.failedFixes;
      
      // Update novel state with fixed chapters if any were modified
      if (updatedChapters.length > 0 && appliedAutoFixes.length > 0) {
        // Update the novel state with fixed chapters
        // Note: The caller should also update, but we do it here for immediate effect
        const fixSummary = failedAutoFixes.length > 0
          ? `Applied ${appliedAutoFixes.length} auto-fix(es) to ${updatedChapters.length} chapter(s). ${failedAutoFixes.length} auto-fix(es) failed.`
          : `Applied ${appliedAutoFixes.length} auto-fix(es) to ${updatedChapters.length} chapter(s)`;
        options?.onProgress?.(fixSummary, 70);
        
        // Update chapters in novelState for subsequent processing
        const updatedChapterMap = new Map(updatedChapters.map(ch => [ch.id, ch]));
        chaptersAnalyzed = chaptersAnalyzed.map(ch => updatedChapterMap.get(ch.id) || ch);
      } else if (failedAutoFixes.length > 0) {
        // Notify if fixes were attempted but all failed
        options?.onProgress?.(`Attempted ${autoFixable.length} auto-fix(es), but ${failedAutoFixes.length} failed to apply.`, 70);
      }
      
      // Notify about auto-fixes
      appliedAutoFixes.forEach(fix => {
        options?.onAutoFix?.(fix);
      });
    } else {
      updatedChapters = chaptersAnalyzed;
    }

    options?.onProgress?.('Creating fix proposals...', 80);

    // Create proposals for major fixes
    const fixProposals = createFixProposals(analysis.issues, fixes);

    // Build the editor report
    // Exclude failed auto-fixes from the main fixes list (they're stored separately)
    const failedAutoFixIds = new Set(failedAutoFixes.map(f => f.id));
    const availableFixes = fixes.filter(f => 
      !appliedAutoFixes.some(af => af.id === f.id) && 
      !failedAutoFixIds.has(f.id)
    );
    
    const report: EditorReport = {
      id: generateUUID(),
      novelId: novelState.id,
      triggerType,
      triggerId: triggerType === 'arc_complete' ? arc?.id : undefined,
      chaptersAnalyzed: chaptersToAnalyze,
      analysis,
      fixes: [...appliedAutoFixes, ...availableFixes],
      autoFixedCount: appliedAutoFixes.length,
      pendingFixCount: fixProposals.length,
      createdAt: Date.now(),
    };

    options?.onProgress?.('Editor review complete', 100);

    // Store updated chapters in report for later retrieval if needed
    // Only include chapters that were actually modified
    const modifiedChapters = updatedChapters.filter((updatedCh, index) => {
      const originalCh = chaptersAnalyzed[index];
      return originalCh && updatedCh.content !== originalCh.content;
    });
    
    (report as any)._updatedChapters = modifiedChapters;
    (report as any)._appliedAutoFixes = appliedAutoFixes;
    (report as any)._failedAutoFixes = failedAutoFixes;
    (report as any)._fixProposals = fixProposals;
    
    // Log for debugging
    console.log(`[Editor] Report created: ${report.autoFixedCount} auto-fixed, ${failedAutoFixes.length} auto-fixes failed, ${report.pendingFixCount} pending approval`);
    if (failedAutoFixes.length > 0) {
      console.log(`[Editor] Failed auto-fixes:`, failedAutoFixes.map(f => ({
        id: f.id,
        chapterNumber: f.chapterNumber,
        fixType: f.fixType,
        reason: f.reason
      })));
    }
    console.log(`[Editor] Modified chapters: ${modifiedChapters.map(ch => ch.number).join(', ')}`);

    // Detect recurring patterns from issues found
    try {
      if (analysis.issues && analysis.issues.length > 0) {
        options?.onProgress?.('Detecting recurring patterns...', 95);
        
        const patternResult = await detectRecurringPatterns(
          analysis.issues,
          novelState.id,
          report.id
        );

        if (patternResult.detectedPatterns.length > 0) {
          console.log(`[Pattern Detection] ✨ Found ${patternResult.detectedPatterns.length} new recurring patterns that exceeded threshold`);
          patternResult.detectedPatterns.forEach(pattern => {
            console.log(`[Pattern Detection]   → New pattern: ${pattern.issueType} at ${pattern.location} (${pattern.occurrenceCount} occurrences, threshold: ${pattern.thresholdCount})`);
          });
        }

        if (patternResult.updatedPatterns.length > 0) {
          console.log(`[Pattern Detection] Updated ${patternResult.updatedPatterns.length} existing patterns`);
        }

        if (patternResult.occurrenceCount > 0) {
          console.log(`[Pattern Detection] Tracked ${patternResult.occurrenceCount} issue occurrences`);
        }

        // Store pattern detection results in report for later reference
        (report as any)._patternDetection = patternResult;
      } else {
        // If no issues were found, check if active patterns should be resolved
        // This helps auto-resolve patterns when chapters are clean
        try {
          const resolvedCount = await checkPatternResolution(
            [],
            chaptersToAnalyze
          );
          if (resolvedCount > 0) {
            console.log(`[Pattern Detection] ✅ Auto-resolved ${resolvedCount} patterns based on clean chapter analysis`);
          }
        } catch (resolutionError) {
          console.warn('[Pattern Detection] Failed to check pattern resolution:', resolutionError);
        }
      }

      // Log pattern statistics periodically (every 10th report or so)
      if (Math.random() < 0.1) { // 10% chance to log stats
        try {
          const stats = await getPatternStatistics();
          console.log(`[Pattern Detection] Statistics: ${stats.activePatterns} active, ${stats.resolvedPatterns} resolved, ${stats.patternsAboveThreshold} above threshold`);
          if (stats.mostCommonType) {
            console.log(`[Pattern Detection] Most common: ${stats.mostCommonType} at ${stats.mostCommonLocation}`);
          }
        } catch (statsError) {
          // Silently fail stats logging
        }
      }
    } catch (error) {
      console.error('[Pattern Detection] Failed to detect recurring patterns:', error);
      // Don't fail the entire editor review if pattern detection fails
      // This is a non-critical enhancement feature
    }

    options?.onProgress?.('Editor review complete', 100);

    return report;
  } catch (error) {
    console.error('Error in editor review:', error);
    options?.onProgress?.(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 0);
    throw error;
  }
}

/**
 * Applies approved fixes to chapters
 */
export function applyApprovedFixes(
  chapters: Chapter[],
  approvedFixes: EditorFix[]
): { updatedChapters: Chapter[]; appliedFixes: EditorFix[]; failedFixes: EditorFix[] } {
  return applyAutoFixes(chapters, approvedFixes);
}

/**
 * Gets editor report summary for display
 */
export function getEditorReportSummary(report: EditorReport): {
  overallFlow: string;
  scores: { continuity: number; grammar: number; style: number };
  issuesFound: number;
  autoFixed: number;
  pendingApproval: number;
  strengths: string[];
  recommendations: string[];
} {
  return {
    overallFlow: report.analysis.overallFlow,
    scores: {
      continuity: report.analysis.continuityScore,
      grammar: report.analysis.grammarScore,
      style: report.analysis.styleScore,
    },
    issuesFound: report.analysis.issues.length,
    autoFixed: report.autoFixedCount,
    pendingApproval: report.pendingFixCount,
    strengths: report.analysis.strengths,
    recommendations: report.analysis.recommendations,
  };
}

/**
 * Checks if editor should run (every 5 chapters)
 */
export function shouldTriggerEditorReview(chapterCount: number): boolean {
  return chapterCount > 0 && chapterCount % 5 === 0;
}

/**
 * Checks if editor should run for arc completion
 */
export function shouldTriggerArcEditorReview(arc: Arc): boolean {
  return arc.status === 'completed' && !!arc.startedAtChapter && !!arc.endedAtChapter;
}
