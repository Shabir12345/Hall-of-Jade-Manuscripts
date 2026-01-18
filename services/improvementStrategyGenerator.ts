import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, WeaknessAnalysis, CategoryWeaknessAnalysis } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeHeroJourney } from './heroJourneyTracker';
import { analyzeSaveTheCat } from './beatSheetAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';
import { analyzeCharacterPsychology } from './characterPsychologyService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeOriginality } from './originalityDetector';
import { analyzeVoiceUniqueness } from './voiceAnalysisService';
import { analyzeLiteraryDevices } from './literaryDeviceAnalyzer';
import { analyzeTension } from './tensionAnalyzer';
import { analyzeMarketReadiness } from './marketReadinessService';
import { generateRevisionPlan } from './revisionPlanner';
// NOE Module imports
import { StructureOptimizer } from './optimizationModules/structureOptimizer';
import { EngagementOptimizer } from './optimizationModules/engagementOptimizer';
import { TensionOptimizer } from './optimizationModules/tensionOptimizer';
import { ThemeOptimizer } from './optimizationModules/themeOptimizer';
import { PsychologyOptimizer } from './optimizationModules/psychologyOptimizer';
import { DeviceOptimizer } from './optimizationModules/deviceOptimizer';
import { ExcellenceOptimizer } from './optimizationModules/excellenceOptimizer';
import { normalizeCategory } from './optimizationModules/moduleRouter';

/**
 * Improvement Strategy Generator
 * Converts analysis weaknesses into concrete, executable improvement strategies
 */

/**
 * Generates comprehensive improvement strategy from analysis
 * Now integrates with NOE optimization modules
 */
export function generateImprovementStrategy(
  state: NovelState,
  request: ImprovementRequest
): ImprovementStrategy {
  // Normalize category (resolve aliases)
  const normalizedCategory = normalizeCategory(request.category);
  
  // Analyze weaknesses for the requested category
  const weaknesses = analyzeCategoryWeaknesses(state, normalizedCategory);
  
  // Map weaknesses to specific chapters
  const chapterMappings = mapWeaknessesToChapters(weaknesses, state);
  
  // Generate strategy using NOE modules when available
  let strategy: ImprovementStrategy;
  
  // Use NOE modules for supported categories
  const targetScore = request.targetScore || weaknesses.targetScore;
  
  switch (normalizedCategory) {
    case 'excellence':
      strategy = ExcellenceOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'structure':
      strategy = StructureOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'engagement':
      strategy = EngagementOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'tension':
      strategy = TensionOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'theme':
      strategy = ThemeOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'character':
    case 'psychology':
      strategy = PsychologyOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    case 'literary_devices':
      strategy = DeviceOptimizer.generateInterventions(state, weaknesses, targetScore);
      break;
    // Fallback to legacy strategies for other categories
    case 'prose':
      strategy = generateProseStrategy(state, weaknesses, request);
      break;
    case 'originality':
      strategy = generateOriginalityStrategy(state, weaknesses, request);
      break;
    case 'voice':
      strategy = generateVoiceStrategy(state, weaknesses, request);
      break;
    case 'market_readiness':
      strategy = generateMarketReadinessStrategy(state, weaknesses, request);
      break;
    default:
      // Fallback to excellence optimizer for unknown categories
      strategy = ExcellenceOptimizer.generateInterventions(state, weaknesses, targetScore);
  }
  
  return strategy;
}

/**
 * Generates module-specific strategy using NOE optimizers
 * This is the new preferred method
 */
export function generateModuleSpecificStrategy(
  state: NovelState,
  category: ImprovementRequest['category'],
  targetScore: number
): ImprovementStrategy {
  const normalizedCategory = normalizeCategory(category);
  const weaknesses = analyzeCategoryWeaknesses(state, normalizedCategory);
  
  switch (normalizedCategory) {
    case 'excellence':
      return ExcellenceOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'structure':
      return StructureOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'engagement':
      return EngagementOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'tension':
      return TensionOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'theme':
      return ThemeOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'character':
    case 'psychology':
      return PsychologyOptimizer.generateInterventions(state, weaknesses, targetScore);
    case 'literary_devices':
      return DeviceOptimizer.generateInterventions(state, weaknesses, targetScore);
    default:
      return ExcellenceOptimizer.generateInterventions(state, weaknesses, targetScore);
  }
}

/**
 * Analyzes weaknesses for specific category
 */
export function analyzeCategoryWeaknesses(
  state: NovelState,
  category: ImprovementRequest['category']
): CategoryWeaknessAnalysis {
  const weaknesses: CategoryWeaknessAnalysis['weaknesses'] = [];
  let overallScore = 50;
  let targetScore = 75;
  
  switch (category) {
    case 'excellence': {
      const marketReadiness = analyzeMarketReadiness(state);
      overallScore = marketReadiness.overallReadiness;
      targetScore = Math.min(100, overallScore + 20);
      
      // Analyze all sub-categories
      const structure = analyzeStoryStructure(state);
      const character = analyzeCharacterPsychology(state);
      const engagement = analyzeEngagement(state);
      const prose = analyzeProseQuality(state);
      const themes = analyzeThemeEvolution(state);
      
      if (structure.overallStructureScore < 70) {
        weaknesses.push({
          id: generateUUID(),
          description: `Structure score is ${structure.overallStructureScore}/100`,
          severity: structure.overallStructureScore < 50 ? 'critical' : 'high',
          currentScore: structure.overallStructureScore,
          targetScore: 75,
          improvements: structure.recommendations.slice(0, 3),
        });
      }
      
      if (character.growthTrajectories.length > 0) {
        const avgGrowth = character.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / character.growthTrajectories.length;
        if (avgGrowth < 70) {
          weaknesses.push({
            id: generateUUID(),
            description: `Character development score is ${Math.round(avgGrowth)}/100`,
            severity: avgGrowth < 50 ? 'critical' : 'high',
            currentScore: Math.round(avgGrowth),
            targetScore: 75,
            improvements: character.recommendations.slice(0, 3),
          });
        }
      }
      
      if (engagement.overallEngagementScore < 70) {
        weaknesses.push({
          id: generateUUID(),
          description: `Engagement score is ${engagement.overallEngagementScore}/100`,
          severity: engagement.overallEngagementScore < 50 ? 'critical' : 'high',
          currentScore: engagement.overallEngagementScore,
          targetScore: 75,
          improvements: engagement.recommendations.slice(0, 3),
        });
      }
      
      if (prose.overallProseScore < 70) {
        weaknesses.push({
          id: generateUUID(),
          description: `Prose quality score is ${prose.overallProseScore}/100`,
          severity: prose.overallProseScore < 50 ? 'critical' : 'medium',
          currentScore: prose.overallProseScore,
          targetScore: 75,
          improvements: prose.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'structure': {
      const analysis = analyzeStoryStructure(state);
      overallScore = analysis.overallStructureScore;
      targetScore = Math.min(100, overallScore + 20);
      
      // Missing story beats
      const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax', 'resolution'];
      const detectedBeatTypes = analysis.detectedBeats.map(b => b.beatType);
      const missingBeats = requiredBeats.filter(beat => !detectedBeatTypes.includes(beat as any));
      
      if (missingBeats.length > 0) {
        weaknesses.push({
          id: generateUUID(),
          description: `Missing story beats: ${missingBeats.join(', ')}`,
          severity: 'critical',
          currentScore: overallScore,
          targetScore: Math.min(100, overallScore + 25),
          improvements: [`Add ${missingBeats.join(', ')} beats at appropriate positions`],
        });
      }
      
      // Act proportion issues
      const threeAct = analysis.threeActStructure;
      if (Math.abs(threeAct.act2.percentage - 50) > 10) {
        weaknesses.push({
          id: generateUUID(),
          description: `Act 2 proportion is ${threeAct.act2.percentage.toFixed(1)}% (ideal: 50%)`,
          severity: Math.abs(threeAct.act2.percentage - 50) > 20 ? 'high' : 'medium',
          currentScore: overallScore,
          targetScore: Math.min(100, overallScore + 15),
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'character': {
      const analysis = analyzeCharacterPsychology(state);
      const avgGrowth = analysis.growthTrajectories.length > 0
        ? analysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / analysis.growthTrajectories.length
        : 50;
      overallScore = Math.round(avgGrowth);
      targetScore = Math.min(100, overallScore + 20);
      
      const lowGrowthCharacters = analysis.growthTrajectories.filter(t => t.overallGrowthScore < 50);
      if (lowGrowthCharacters.length > 0) {
        weaknesses.push({
          id: generateUUID(),
          description: `Low character growth for: ${lowGrowthCharacters.map(c => c.characterName).join(', ')}`,
          severity: 'high',
          currentScore: overallScore,
          targetScore: 70,
          chaptersAffected: lowGrowthCharacters.flatMap(t => t.trajectory.map(p => p.chapterNumber).filter((n): n is number => n !== undefined)),
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'engagement': {
      const analysis = analyzeEngagement(state);
      overallScore = analysis.overallEngagementScore;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.fatigueChapters.length > 0) {
        weaknesses.push({
          id: generateUUID(),
          description: `Fatigue chapters detected: ${analysis.fatigueChapters.slice(0, 5).map(ch => ch.number).join(', ')}`,
          severity: 'high',
          currentScore: overallScore,
          targetScore: 75,
          chaptersAffected: analysis.fatigueChapters.map(ch => ch.number),
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'theme': {
      const analysis = analyzeThemeEvolution(state);
      overallScore = (analysis.overallConsistencyScore + analysis.philosophicalDepthScore) / 2;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.primaryThemes.length === 0) {
        weaknesses.push({
          id: generateUUID(),
          description: 'No primary themes established',
          severity: 'critical',
          currentScore: overallScore,
          targetScore: 70,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      if (analysis.overallConsistencyScore < 70) {
        weaknesses.push({
          id: generateUUID(),
          description: `Theme consistency is ${analysis.overallConsistencyScore}/100`,
          severity: analysis.overallConsistencyScore < 50 ? 'high' : 'medium',
          currentScore: analysis.overallConsistencyScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'tension': {
      const analysis = analyzeTension(state);
      overallScore = analysis.overallTensionScore;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.tensionReleaseBalance < 60) {
        weaknesses.push({
          id: generateUUID(),
          description: `Tension-release balance is ${analysis.tensionReleaseBalance}/100`,
          severity: 'high',
          currentScore: overallScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'prose': {
      const analysis = analyzeProseQuality(state);
      overallScore = analysis.overallProseScore;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.clichesDetected.length > 5) {
        weaknesses.push({
          id: generateUUID(),
          description: `Too many clichés detected: ${analysis.clichesDetected.length}`,
          severity: 'medium',
          currentScore: overallScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      if (analysis.showTellBalanceScore < 60) {
        weaknesses.push({
          id: generateUUID(),
          description: `Show/tell balance is ${analysis.showTellBalanceScore}/100`,
          severity: 'medium',
          currentScore: overallScore,
          targetScore: 70,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'originality': {
      const analysis = analyzeOriginality(state);
      overallScore = analysis.overallOriginality;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.commonTropesDetected.length > 10) {
        weaknesses.push({
          id: generateUUID(),
          description: `Many common tropes detected: ${analysis.commonTropesDetected.length}`,
          severity: 'medium',
          currentScore: overallScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'voice': {
      const analysis = analyzeVoiceUniqueness(state);
      overallScore = analysis.novelVoice.distinctivenessScore;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.novelVoice.distinctivenessScore < 70) {
        weaknesses.push({
          id: generateUUID(),
          description: `Voice distinctiveness is ${analysis.novelVoice.distinctivenessScore}/100`,
          severity: 'medium',
          currentScore: overallScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'literary_devices': {
      const analysis = analyzeLiteraryDevices(state);
      overallScore = analysis.overallDeviceScore;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.overusedDevices.length > 0) {
        weaknesses.push({
          id: generateUUID(),
          description: `Overused devices: ${analysis.overusedDevices.slice(0, 3).join(', ')}`,
          severity: 'medium',
          currentScore: overallScore,
          targetScore: 75,
          improvements: analysis.recommendations.slice(0, 3),
        });
      }
      
      break;
    }
    
    case 'market_readiness': {
      const analysis = analyzeMarketReadiness(state);
      overallScore = analysis.overallReadiness;
      targetScore = Math.min(100, overallScore + 20);
      
      if (analysis.weaknesses.length > 0) {
        analysis.weaknesses.slice(0, 3).forEach(weakness => {
          weaknesses.push({
            id: generateUUID(),
            description: weakness,
            severity: 'medium',
            currentScore: overallScore,
            targetScore: 75,
            improvements: analysis.recommendations.slice(0, 2),
          });
        });
      }
      
      break;
    }
  }
  
  return {
    category,
    overallScore,
    targetScore,
    weaknesses,
    recommendations: weaknesses.flatMap(w => w.improvements).slice(0, 5),
  };
}

/**
 * Maps weaknesses to specific chapter locations
 */
function mapWeaknessesToChapters(
  weaknesses: CategoryWeaknessAnalysis,
  state: NovelState
): Array<{ weaknessId: string; chapterId: string; chapterNumber: number; relevance: number }> {
  const mappings: Array<{ weaknessId: string; chapterId: string; chapterNumber: number; relevance: number }> = [];
  
  weaknesses.weaknesses.forEach(weakness => {
    if (weakness.chaptersAffected && weakness.chaptersAffected.length > 0) {
      weakness.chaptersAffected.forEach(chapterNumber => {
        const chapter = state.chapters.find(ch => ch.number === chapterNumber);
        if (chapter) {
          mappings.push({
            weaknessId: weakness.id,
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            relevance: 80, // High relevance if explicitly identified
          });
        }
      });
    } else {
      // If no specific chapters identified, map to all chapters
      state.chapters.forEach(chapter => {
        mappings.push({
          weaknessId: weakness.id,
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          relevance: 50, // Medium relevance if not specifically identified
        });
      });
    }
  });
  
  return mappings;
}

/**
 * Generates excellence strategy (multi-faceted)
 */
function generateExcellenceStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  // Sort weaknesses by severity and impact
  const sortedWeaknesses = weaknesses.weaknesses.sort((a, b) => {
    const severityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityRank[b.severity] - severityRank[a.severity];
  });
  
  // Focus on top 2-3 weaknesses
  const topWeaknesses = sortedWeaknesses.slice(0, 3);
  
  // Generate hybrid strategy
  const editActions: ImprovementStrategy['editActions'] = [];
  const insertActions: ImprovementStrategy['insertActions'] = [];
  const chaptersAffected = new Set<number>();
  
  topWeaknesses.forEach(weakness => {
    if (weakness.chaptersAffected && weakness.chaptersAffected.length > 0) {
      weakness.chaptersAffected.forEach(chapterNumber => {
        chaptersAffected.add(chapterNumber);
        
        if (weakness.severity === 'critical' || weakness.severity === 'high') {
          editActions.push({
            chapterId: state.chapters.find(ch => ch.number === chapterNumber)?.id || '',
            chapterNumber,
            section: 'throughout',
            improvementType: 'enhance_quality',
            description: weakness.description,
          });
        }
      });
    }
  });
  
  // For critical weaknesses, consider inserting chapters
  const criticalWeaknesses = topWeaknesses.filter(w => w.severity === 'critical');
  if (criticalWeaknesses.length > 0 && request.maxChaptersToInsert !== 0) {
    const firstCritical = criticalWeaknesses[0];
    const insertPosition = state.chapters.length > 0 
      ? Math.floor(state.chapters.length * 0.3)  // Insert around 30% mark
      : 1;
    
    insertActions.push({
      position: insertPosition,
      chapterCount: 1,
      purpose: `Address critical weakness: ${firstCritical.description}`,
    });
  }
  
  const strategyType: ImprovementStrategy['strategyType'] = 
    insertActions.length > 0 && editActions.length > 0 ? 'hybrid' :
    insertActions.length > 0 ? 'insert' :
    'edit';
  
  return {
    id: generateUUID(),
    category: 'excellence',
    priority: topWeaknesses[0]?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: `Improve overall excellence by addressing ${topWeaknesses.length} key weaknesses`,
    rationale: `Targeting highest-impact areas: ${topWeaknesses.map(w => w.description).join(', ')}`,
    strategyType,
    editActions: editActions.length > 0 ? editActions : undefined,
    insertActions: insertActions.length > 0 ? insertActions : undefined,
    estimatedImpact: topWeaknesses[0]?.severity === 'critical' ? 'high' : 'medium',
    estimatedEffort: editActions.length + insertActions.length > 5 ? 'high' : 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: Math.min(30, topWeaknesses.reduce((sum, w) => sum + (w.targetScore - w.currentScore), 0) / topWeaknesses.length),
  };
}

/**
 * Generates structure strategy
 */
function generateStructureStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const structureAnalysis = analyzeStoryStructure(state);
  const editActions: ImprovementStrategy['editActions'] = [];
  const insertActions: ImprovementStrategy['insertActions'] = [];
  const chaptersAffected = new Set<number>();
  
  // Missing story beats
  const missingBeatWeakness = weaknesses.weaknesses.find(w => w.description.includes('Missing story beats'));
  if (missingBeatWeakness) {
    const totalChapters = state.chapters.length || 100;
    const beatPositions: Record<string, number> = {
      'inciting_incident': Math.floor(totalChapters * 0.05),
      'plot_point_1': Math.floor(totalChapters * 0.25),
      'midpoint': Math.floor(totalChapters * 0.50),
      'plot_point_2': Math.floor(totalChapters * 0.75),
      'climax': Math.floor(totalChapters * 0.85),
      'resolution': Math.floor(totalChapters * 0.95),
    };
    
    // Extract missing beats from description
    const missingBeats = missingBeatWeakness.description.replace('Missing story beats: ', '').split(', ');
    missingBeats.forEach(beat => {
      const position = beatPositions[beat.toLowerCase().replace(' ', '_')] || Math.floor(totalChapters * 0.5);
      insertActions.push({
        position: Math.max(1, position - 1),
        chapterCount: 1,
        purpose: `Add ${beat} story beat`,
      });
    });
  }
  
  // Act proportion issues
  const proportionWeakness = weaknesses.weaknesses.find(w => w.description.includes('Act'));
  if (proportionWeakness && proportionWeakness.chaptersAffected) {
    proportionWeakness.chaptersAffected.forEach(chapterNumber => {
      chaptersAffected.add(chapterNumber);
      const chapter = state.chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber,
          section: 'throughout',
          improvementType: 'modify_content',
          description: proportionWeakness.description,
        });
      }
    });
  }
  
  const strategyType: ImprovementStrategy['strategyType'] = 
    insertActions.length > 0 && editActions.length > 0 ? 'hybrid' :
    insertActions.length > 0 ? 'insert' :
    'edit';
  
  return {
    id: generateUUID(),
    category: 'structure',
    priority: weaknesses.weaknesses[0]?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: `Improve story structure: ${weaknesses.weaknesses.map(w => w.description).join('; ')}`,
    rationale: 'Story structure improvements enhance reader satisfaction and narrative coherence',
    strategyType,
    editActions: editActions.length > 0 ? editActions : undefined,
    insertActions: insertActions.length > 0 ? insertActions : undefined,
    estimatedImpact: weaknesses.weaknesses[0]?.severity === 'critical' ? 'high' : 'medium',
    estimatedEffort: editActions.length + insertActions.length > 3 ? 'high' : 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: Math.min(25, weaknesses.weaknesses.reduce((sum, w) => sum + (w.targetScore - w.currentScore), 0) / weaknesses.weaknesses.length),
  };
}

/**
 * Generates character strategy
 */
function generateCharacterStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const characterAnalysis = analyzeCharacterPsychology(state);
  const editActions: ImprovementStrategy['editActions'] = [];
  const insertActions: ImprovementStrategy['insertActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness && topWeakness.chaptersAffected) {
    // For low growth, insert character development chapters
    if (topWeakness.description.includes('Low character growth') && request.maxChaptersToInsert !== 0) {
      const insertPosition = topWeakness.chaptersAffected[0] || Math.floor(state.chapters.length * 0.3);
      insertActions.push({
        position: insertPosition,
        chapterCount: 1,
        purpose: topWeakness.description,
      });
    } else {
      // Edit existing chapters
      topWeakness.chaptersAffected.forEach(chapterNumber => {
        chaptersAffected.add(chapterNumber);
        const chapter = state.chapters.find(ch => ch.number === chapterNumber);
        if (chapter) {
          editActions.push({
            chapterId: chapter.id,
            chapterNumber,
            section: 'throughout',
            improvementType: 'enhance_quality',
            description: topWeakness.description,
          });
        }
      });
    }
  }
  
  const strategyType: ImprovementStrategy['strategyType'] = 
    insertActions.length > 0 ? 'insert' : 'edit';
  
  return {
    id: generateUUID(),
    category: 'character',
    priority: topWeakness?.severity || 'high',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve character development',
    rationale: 'Character development improvements enhance reader investment and emotional connection',
    strategyType,
    editActions: editActions.length > 0 ? editActions : undefined,
    insertActions: insertActions.length > 0 ? insertActions : undefined,
    estimatedImpact: 'high',
    estimatedEffort: editActions.length + insertActions.length > 3 ? 'medium' : 'low',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(20, topWeakness.targetScore - topWeakness.currentScore) : 15,
  };
}

/**
 * Generates engagement strategy
 */
function generateEngagementStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const engagementAnalysis = analyzeEngagement(state);
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness && topWeakness.chaptersAffected) {
    topWeakness.chaptersAffected.forEach(chapterNumber => {
      chaptersAffected.add(chapterNumber);
      const chapter = state.chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber,
          section: chapterNumber === 1 ? 'beginning' : 'throughout',
          improvementType: 'enhance_quality',
          description: topWeakness.description,
        });
      }
    });
  }
  
  return {
    id: generateUUID(),
    category: 'engagement',
    priority: topWeakness?.severity || 'high',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve reader engagement',
    rationale: 'Engagement improvements enhance reader retention and page-turning quality',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'high',
    estimatedEffort: editActions.length > 5 ? 'high' : 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(25, topWeakness.targetScore - topWeakness.currentScore) : 20,
  };
}

/**
 * Generates theme strategy
 */
function generateThemeStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const insertActions: ImprovementStrategy['insertActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness) {
    // For missing themes, insert establishing chapters
    if (topWeakness.description.includes('No primary themes') && request.maxChaptersToInsert !== 0) {
      insertActions.push({
        position: Math.floor((state.chapters.length || 10) * 0.2),
        chapterCount: 1,
        purpose: 'Establish primary themes',
      });
    } else if (topWeakness.chaptersAffected) {
      topWeakness.chaptersAffected.forEach(chapterNumber => {
        chaptersAffected.add(chapterNumber);
        const chapter = state.chapters.find(ch => ch.number === chapterNumber);
        if (chapter) {
          editActions.push({
            chapterId: chapter.id,
            chapterNumber,
            section: 'throughout',
            improvementType: 'enhance_quality',
            description: topWeakness.description,
          });
        }
      });
    }
  }
  
  const strategyType: ImprovementStrategy['strategyType'] = 
    insertActions.length > 0 && editActions.length > 0 ? 'hybrid' :
    insertActions.length > 0 ? 'insert' :
    'edit';
  
  return {
    id: generateUUID(),
    category: 'theme',
    priority: topWeakness?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve thematic depth',
    rationale: 'Theme improvements enhance literary merit and philosophical resonance',
    strategyType,
    editActions: editActions.length > 0 ? editActions : undefined,
    insertActions: insertActions.length > 0 ? insertActions : undefined,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(20, topWeakness.targetScore - topWeakness.currentScore) : 15,
  };
}

/**
 * Generates tension strategy
 */
function generateTensionStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness && topWeakness.chaptersAffected) {
    topWeakness.chaptersAffected.forEach(chapterNumber => {
      chaptersAffected.add(chapterNumber);
      const chapter = state.chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: topWeakness.description,
        });
      }
    });
  }
  
  return {
    id: generateUUID(),
    category: 'tension',
    priority: topWeakness?.severity || 'high',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve tension management',
    rationale: 'Tension improvements enhance narrative momentum and reader engagement',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(20, topWeakness.targetScore - topWeakness.currentScore) : 15,
  };
}

/**
 * Generates prose strategy
 */
function generateProseStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  weaknesses.weaknesses.forEach(weakness => {
    if (weakness.chaptersAffected) {
      weakness.chaptersAffected.forEach(chapterNumber => {
        chaptersAffected.add(chapterNumber);
        const chapter = state.chapters.find(ch => ch.number === chapterNumber);
        if (chapter) {
          editActions.push({
            chapterId: chapter.id,
            chapterNumber,
            section: weakness.description.includes('hook') ? 'beginning' : 'throughout',
            improvementType: 'enhance_quality',
            description: weakness.description,
          });
        }
      });
    } else {
      // If no specific chapters, target all chapters
      state.chapters.slice(0, 5).forEach(chapter => {
        chaptersAffected.add(chapter.number);
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: weakness.description,
        });
      });
    }
  });
  
  return {
    id: generateUUID(),
    category: 'prose',
    priority: weaknesses.weaknesses[0]?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: `Improve prose quality: ${weaknesses.weaknesses.map(w => w.description).join('; ')}`,
    rationale: 'Prose improvements enhance readability and literary quality',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'medium',
    estimatedEffort: editActions.length > 5 ? 'high' : 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: Math.min(20, weaknesses.weaknesses.reduce((sum, w) => sum + (w.targetScore - w.currentScore), 0) / weaknesses.weaknesses.length),
  };
}

/**
 * Generates originality strategy
 */
function generateOriginalityStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness) {
    // Edit chapters to address tropes/clichés
    state.chapters.slice(0, 5).forEach(chapter => {
      chaptersAffected.add(chapter.number);
      editActions.push({
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        section: 'throughout',
        improvementType: 'fix_issue',
        description: topWeakness.description,
      });
    });
  }
  
  return {
    id: generateUUID(),
    category: 'originality',
    priority: topWeakness?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve originality',
    rationale: 'Originality improvements enhance uniqueness and market appeal',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(20, topWeakness.targetScore - topWeakness.currentScore) : 15,
  };
}

/**
 * Generates voice strategy
 */
function generateVoiceStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness) {
    // Edit chapters to improve voice
    state.chapters.slice(0, 5).forEach(chapter => {
      chaptersAffected.add(chapter.number);
      editActions.push({
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        section: 'throughout',
        improvementType: 'enhance_quality',
        description: topWeakness.description,
      });
    });
  }
  
  return {
    id: generateUUID(),
    category: 'voice',
    priority: topWeakness?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve voice uniqueness',
    rationale: 'Voice improvements enhance character distinctiveness and narrative style',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(20, topWeakness.targetScore - topWeakness.currentScore) : 15,
  };
}

/**
 * Generates literary devices strategy
 */
function generateLiteraryDevicesStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  const editActions: ImprovementStrategy['editActions'] = [];
  const chaptersAffected = new Set<number>();
  
  const topWeakness = weaknesses.weaknesses[0];
  if (topWeakness) {
    state.chapters.slice(0, 5).forEach(chapter => {
      chaptersAffected.add(chapter.number);
      editActions.push({
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        section: 'throughout',
        improvementType: 'enhance_quality',
        description: topWeakness.description,
      });
    });
  }
  
  return {
    id: generateUUID(),
    category: 'literary_devices',
    priority: topWeakness?.severity || 'medium',
    targetScore: weaknesses.overallScore,
    goalScore: request.targetScore || weaknesses.targetScore,
    description: topWeakness?.description || 'Improve literary device usage',
    rationale: 'Literary device improvements enhance artistic depth and prose quality',
    strategyType: 'edit',
    editActions: editActions.length > 0 ? editActions : undefined,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    chaptersAffected: Array.from(chaptersAffected),
    expectedImprovement: topWeakness ? Math.min(15, topWeakness.targetScore - topWeakness.currentScore) : 10,
  };
}

/**
 * Generates market readiness strategy
 */
function generateMarketReadinessStrategy(
  state: NovelState,
  weaknesses: CategoryWeaknessAnalysis,
  request: ImprovementRequest
): ImprovementStrategy {
  // Market readiness is a composite - use excellence strategy approach
  return generateExcellenceStrategy(state, weaknesses, request);
}
