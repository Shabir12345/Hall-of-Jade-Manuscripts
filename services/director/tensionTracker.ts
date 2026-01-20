/**
 * Tension Tracker
 * 
 * Tracks and analyzes tension levels across chapters for better
 * pacing decisions. Works with the Director Agent to ensure
 * proper tension curve management.
 */

import { NovelState, Chapter } from '../../types';
import { DirectorBeatSheet, PacingGuidance } from '../../types/director';
import { logger } from '../loggingService';

/**
 * Tension level entry for a chapter
 */
export interface TensionEntry {
  chapterNumber: number;
  startTension: number;
  endTension: number;
  averageTension: number;
  peakMoment?: string;
  tensionDelta: number;
  arcPhase?: string;
  timestamp: number;
}

/**
 * Tension curve analysis result
 */
export interface TensionCurveAnalysis {
  /** Overall trend across recent chapters */
  overallTrend: 'rising' | 'falling' | 'stable' | 'oscillating';
  /** Average tension across all tracked chapters */
  averageTension: number;
  /** Current tension level (from most recent chapter) */
  currentTension: number;
  /** Peak tension chapter */
  peakChapter: { number: number; tension: number } | null;
  /** Lowest tension chapter */
  valleyChapter: { number: number; tension: number } | null;
  /** Number of chapters since last significant tension release */
  chaptersSinceRelease: number;
  /** Pacing recommendations based on analysis */
  recommendations: string[];
  /** Warning flags */
  warnings: string[];
}

/**
 * Record tension from a Director beat sheet
 */
export function recordTensionFromBeatSheet(
  state: NovelState,
  beatSheet: DirectorBeatSheet
): TensionEntry {
  const entry: TensionEntry = {
    chapterNumber: beatSheet.chapterNumber,
    startTension: beatSheet.pacingGuidance.startingTensionLevel,
    endTension: beatSheet.pacingGuidance.endingTensionLevel,
    averageTension: (beatSheet.pacingGuidance.startingTensionLevel + beatSheet.pacingGuidance.endingTensionLevel) / 2,
    tensionDelta: beatSheet.pacingGuidance.endingTensionLevel - beatSheet.pacingGuidance.startingTensionLevel,
    arcPhase: beatSheet.arcPosition.arcPhase,
    timestamp: Date.now(),
  };

  // Find peak moment from beats
  const actionBeats = beatSheet.beats.filter(b => 
    b.type === 'action' || b.type === 'escalation' || b.type === 'breakthrough'
  );
  if (actionBeats.length > 0) {
    entry.peakMoment = actionBeats[0].description;
  }

  return entry;
}

/**
 * Analyze chapter content to estimate tension levels
 */
export function analyzeTensionFromContent(chapter: Chapter): {
  estimatedTension: number;
  tensionIndicators: string[];
} {
  const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
  let tensionScore = 30; // Base tension
  const indicators: string[] = [];

  // High tension indicators
  const highTensionWords = [
    'battle', 'fight', 'death', 'kill', 'danger', 'enemy', 'attack',
    'tribulation', 'breakthrough', 'lightning', 'crisis', 'desperate',
    'blood', 'wound', 'clash', 'explosion', 'power', 'destroy',
    'confrontation', 'showdown', 'war', 'assassin', 'ambush'
  ];

  // Medium tension indicators
  const mediumTensionWords = [
    'tension', 'worry', 'concern', 'fear', 'threat', 'rival',
    'competition', 'challenge', 'test', 'trial', 'secret', 'mystery',
    'discover', 'reveal', 'plot', 'scheme', 'suspect'
  ];

  // Low tension / release indicators
  const releaseTensionWords = [
    'peace', 'calm', 'rest', 'laugh', 'smile', 'joy', 'celebration',
    'victory', 'success', 'safe', 'home', 'friend', 'love', 'relax',
    'meditate', 'recover', 'heal'
  ];

  // Count indicators
  for (const word of highTensionWords) {
    const count = (content.match(new RegExp(word, 'gi')) || []).length;
    if (count > 0) {
      tensionScore += count * 5;
      if (count > 2) indicators.push(`High tension: "${word}" (${count}x)`);
    }
  }

  for (const word of mediumTensionWords) {
    const count = (content.match(new RegExp(word, 'gi')) || []).length;
    if (count > 0) {
      tensionScore += count * 2;
      if (count > 3) indicators.push(`Medium tension: "${word}" (${count}x)`);
    }
  }

  for (const word of releaseTensionWords) {
    const count = (content.match(new RegExp(word, 'gi')) || []).length;
    if (count > 0) {
      tensionScore -= count * 3;
      if (count > 2) indicators.push(`Tension release: "${word}" (${count}x)`);
    }
  }

  // Check for exclamation marks (urgency indicator)
  const exclamations = (content.match(/!/g) || []).length;
  if (exclamations > 10) {
    tensionScore += 5;
    indicators.push(`High urgency (${exclamations} exclamations)`);
  }

  // Check dialogue ratio (more dialogue often means lower action tension)
  const dialogueMatches = content.match(/["「『]/g) || [];
  const dialogueRatio = dialogueMatches.length / (content.length / 100);
  if (dialogueRatio > 5) {
    tensionScore -= 5;
    indicators.push('Dialogue-heavy chapter');
  }

  // Clamp tension score
  const estimatedTension = Math.max(10, Math.min(100, tensionScore));

  return { estimatedTension, tensionIndicators: indicators };
}

/**
 * Get tension history for a novel
 */
export function getTensionHistory(state: NovelState): TensionEntry[] {
  return state.tensionHistory?.map(h => ({
    chapterNumber: h.chapterNumber,
    startTension: h.startTension,
    endTension: h.endTension,
    averageTension: h.averageTension,
    peakMoment: h.peakMoment,
    tensionDelta: h.endTension - h.startTension,
    timestamp: 0,
  })) || [];
}

/**
 * Analyze the tension curve across chapters
 */
export function analyzeTensionCurve(
  state: NovelState,
  recentChapterCount: number = 10
): TensionCurveAnalysis {
  const history = getTensionHistory(state);
  const recommendations: string[] = [];
  const warnings: string[] = [];

  // If no history, analyze from chapter content
  if (history.length === 0 && state.chapters.length > 0) {
    const recentChapters = state.chapters.slice(-recentChapterCount);
    const analyzedHistory: TensionEntry[] = recentChapters.map(ch => {
      const { estimatedTension } = analyzeTensionFromContent(ch);
      return {
        chapterNumber: ch.number,
        startTension: estimatedTension - 5,
        endTension: estimatedTension + 5,
        averageTension: estimatedTension,
        tensionDelta: 10,
        timestamp: ch.createdAt,
      };
    });
    
    return analyzeFromHistory(analyzedHistory, recommendations, warnings);
  }

  const recentHistory = history.slice(-recentChapterCount);
  return analyzeFromHistory(recentHistory, recommendations, warnings);
}

/**
 * Internal analysis from history entries
 */
function analyzeFromHistory(
  history: TensionEntry[],
  recommendations: string[],
  warnings: string[]
): TensionCurveAnalysis {
  if (history.length === 0) {
    return {
      overallTrend: 'stable',
      averageTension: 50,
      currentTension: 50,
      peakChapter: null,
      valleyChapter: null,
      chaptersSinceRelease: 0,
      recommendations: ['No tension history available - start tracking with Director agent'],
      warnings: [],
    };
  }

  // Calculate averages and find peaks/valleys
  const tensions = history.map(h => h.averageTension);
  const averageTension = tensions.reduce((a, b) => a + b, 0) / tensions.length;
  const currentTension = tensions[tensions.length - 1];

  // Find peak and valley
  let peakChapter: { number: number; tension: number } | null = null;
  let valleyChapter: { number: number; tension: number } | null = null;
  let maxTension = 0;
  let minTension = 100;

  for (const entry of history) {
    if (entry.averageTension > maxTension) {
      maxTension = entry.averageTension;
      peakChapter = { number: entry.chapterNumber, tension: entry.averageTension };
    }
    if (entry.averageTension < minTension) {
      minTension = entry.averageTension;
      valleyChapter = { number: entry.chapterNumber, tension: entry.averageTension };
    }
  }

  // Determine trend
  let overallTrend: TensionCurveAnalysis['overallTrend'] = 'stable';
  if (history.length >= 3) {
    const firstHalf = tensions.slice(0, Math.floor(tensions.length / 2));
    const secondHalf = tensions.slice(Math.floor(tensions.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const diff = secondAvg - firstAvg;

    if (diff > 10) {
      overallTrend = 'rising';
    } else if (diff < -10) {
      overallTrend = 'falling';
    } else {
      // Check for oscillation
      let oscillations = 0;
      for (let i = 1; i < tensions.length; i++) {
        if (Math.abs(tensions[i] - tensions[i - 1]) > 15) {
          oscillations++;
        }
      }
      if (oscillations > tensions.length / 3) {
        overallTrend = 'oscillating';
      }
    }
  }

  // Find chapters since last release (tension drop)
  let chaptersSinceRelease = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].tensionDelta < -10) {
      break;
    }
    chaptersSinceRelease++;
  }

  // Generate recommendations
  if (currentTension > 85 && overallTrend === 'rising') {
    recommendations.push('Tension is very high - consider a release beat or resolution soon');
  }
  if (currentTension < 30 && overallTrend !== 'rising') {
    recommendations.push('Tension is low - consider introducing new conflict or escalation');
  }
  if (chaptersSinceRelease > 5 && currentTension > 70) {
    recommendations.push(`${chaptersSinceRelease} chapters without tension release - readers may need a breather`);
  }
  if (overallTrend === 'oscillating') {
    recommendations.push('Tension is oscillating rapidly - consider smoothing the pacing');
  }

  // Generate warnings
  if (currentTension > 95) {
    warnings.push('CRITICAL: Tension at maximum - any higher risks reader fatigue');
  }
  if (chaptersSinceRelease > 8 && currentTension > 80) {
    warnings.push('Extended high tension without release may exhaust readers');
  }
  if (overallTrend === 'falling' && currentTension < 40) {
    warnings.push('Tension declining to low levels - story may feel slow');
  }

  return {
    overallTrend,
    averageTension,
    currentTension,
    peakChapter,
    valleyChapter,
    chaptersSinceRelease,
    recommendations,
    warnings,
  };
}

/**
 * Get recommended tension for next chapter based on analysis
 */
export function getRecommendedTension(
  state: NovelState,
  arcPhase: string
): { start: number; end: number; notes: string[] } {
  const analysis = analyzeTensionCurve(state);
  const notes: string[] = [];

  // Base tension on arc phase
  const phaseBaseTension: Record<string, { start: number; end: number }> = {
    opening: { start: 25, end: 35 },
    rising_action: { start: 40, end: 55 },
    midpoint: { start: 55, end: 65 },
    escalation: { start: 65, end: 80 },
    climax_approach: { start: 75, end: 88 },
    climax: { start: 85, end: 95 },
    resolution: { start: 50, end: 35 },
  };

  const baseTension = phaseBaseTension[arcPhase] || { start: 50, end: 55 };
  let { start, end } = baseTension;

  // Adjust based on current state
  if (analysis.chaptersSinceRelease > 5 && analysis.currentTension > 70) {
    // Need a release
    end = Math.min(end, analysis.currentTension - 15);
    notes.push('Tension release recommended after sustained high tension');
  }

  if (analysis.overallTrend === 'falling' && arcPhase !== 'resolution') {
    // Need to rebuild
    start = Math.max(start, analysis.currentTension + 5);
    end = Math.max(end, start + 10);
    notes.push('Rebuilding tension after decline');
  }

  if (analysis.overallTrend === 'rising' && analysis.currentTension > 85 && arcPhase !== 'climax') {
    // Cap the rise
    end = Math.min(end, 85);
    notes.push('Capping tension to preserve climax impact');
  }

  // Ensure smooth transition from current
  if (Math.abs(start - analysis.currentTension) > 20) {
    start = analysis.currentTension + (start > analysis.currentTension ? 10 : -10);
    notes.push('Smoothed tension transition from previous chapter');
  }

  return { start: Math.round(start), end: Math.round(end), notes };
}

/**
 * Save tension entry to state
 */
export function saveTensionEntry(
  state: NovelState,
  entry: TensionEntry
): NovelState {
  const existingHistory = state.tensionHistory || [];
  
  // Check if entry for this chapter already exists
  const existingIndex = existingHistory.findIndex(h => h.chapterNumber === entry.chapterNumber);
  
  const newEntry = {
    chapterNumber: entry.chapterNumber,
    startTension: entry.startTension,
    endTension: entry.endTension,
    averageTension: entry.averageTension,
    peakMoment: entry.peakMoment,
  };

  let newHistory;
  if (existingIndex >= 0) {
    // Update existing
    newHistory = [...existingHistory];
    newHistory[existingIndex] = newEntry;
  } else {
    // Add new
    newHistory = [...existingHistory, newEntry];
  }

  // Sort by chapter number
  newHistory.sort((a, b) => a.chapterNumber - b.chapterNumber);

  // Keep only last 100 entries
  if (newHistory.length > 100) {
    newHistory = newHistory.slice(-100);
  }

  return {
    ...state,
    tensionHistory: newHistory,
  };
}

/**
 * Format tension analysis for display
 */
export function formatTensionAnalysis(analysis: TensionCurveAnalysis): string {
  const lines: string[] = [];
  
  lines.push('=== TENSION CURVE ANALYSIS ===');
  lines.push(`Overall Trend: ${analysis.overallTrend.toUpperCase()}`);
  lines.push(`Current Tension: ${analysis.currentTension.toFixed(0)}%`);
  lines.push(`Average Tension: ${analysis.averageTension.toFixed(0)}%`);
  
  if (analysis.peakChapter) {
    lines.push(`Peak: Chapter ${analysis.peakChapter.number} (${analysis.peakChapter.tension.toFixed(0)}%)`);
  }
  if (analysis.valleyChapter) {
    lines.push(`Valley: Chapter ${analysis.valleyChapter.number} (${analysis.valleyChapter.tension.toFixed(0)}%)`);
  }
  
  lines.push(`Chapters Since Release: ${analysis.chaptersSinceRelease}`);
  
  if (analysis.recommendations.length > 0) {
    lines.push('');
    lines.push('Recommendations:');
    analysis.recommendations.forEach(r => lines.push(`  • ${r}`));
  }
  
  if (analysis.warnings.length > 0) {
    lines.push('');
    lines.push('Warnings:');
    analysis.warnings.forEach(w => lines.push(`  ⚠️ ${w}`));
  }
  
  return lines.join('\n');
}
