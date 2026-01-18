import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeLiteraryDevices } from '../literaryDeviceAnalyzer';
import { ContextManager } from '../contextManager';

/**
 * Device Optimizer
 * Improves literary devices through rhetorical enhancement and device injection
 */
export class DeviceOptimizer {
  /**
   * Analyzes weaknesses in literary devices
   */
  static analyzeWeaknesses(state: NovelState): {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }>;
  } {
    // Literary device analysis needs prose style - sample content effectively
    const stateForAnalysis = state.chapters.length > 40
      ? {
          ...state,
          chapters: state.chapters.map(ch => ({
            ...ch,
            // Sample beginning, middle, and end for device detection
            content: ch.content.length > 3000
              ? ch.content.substring(0, 1000) + '\n...\n' + 
                ch.content.substring(Math.floor(ch.content.length / 2) - 500, Math.floor(ch.content.length / 2) + 500) + '\n...\n' +
                ch.content.substring(ch.content.length - 1000)
              : ch.content,
          })),
        }
      : state;
    
    const deviceAnalysis = analyzeLiteraryDevices(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check overall device usage
    if (deviceAnalysis.overallDeviceScore < 60) {
      issues.push({
        type: 'low_device_usage',
        description: `Overall literary device score is ${deviceAnalysis.overallDeviceScore}/100`,
        severity: deviceAnalysis.overallDeviceScore < 40 ? 'high' : 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Increase use of literary devices throughout the novel',
      });
    }

    // Find chapters with generic prose (low device usage)
    const genericProseChapters = this.detectGenericProse(state.chapters);

    if (genericProseChapters.length > 0) {
      issues.push({
        type: 'generic_prose',
        description: `Generic prose detected in ${genericProseChapters.length} chapter(s)`,
        severity: 'high',
        chaptersAffected: genericProseChapters,
        fix: 'Replace generic prose with specific literary devices',
      });
    }

    // Check for missing key devices
    const keyDevices = ['foreshadowing', 'irony', 'symbolism', 'metaphor'];
    const usedDevices = deviceAnalysis.deviceUsage.map(d => d.deviceType.toLowerCase());
    const missingDevices = keyDevices.filter(device => !usedDevices.some(used => used.includes(device)));

    if (missingDevices.length > 0) {
      issues.push({
        type: 'missing_devices',
        description: `Missing key literary devices: ${missingDevices.join(', ')}`,
        severity: 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Add missing literary devices to enhance prose quality',
      });
    }

    return {
      score: deviceAnalysis.overallDeviceScore,
      issues,
    };
  }

  /**
   * Detects chapters with generic prose (lacking literary devices)
   */
  private static detectGenericProse(chapters: Chapter[]): number[] {
    const genericChapters: number[] = [];

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      const lowerContent = content.toLowerCase();

      // Indicators of literary devices
      const deviceIndicators = [
        'like', 'as', // Simile
        'was', 'were', // Metaphor (often uses "was/were")
        'symbol', 'symbolic', 'represented', // Symbolism
        'foreshadow', 'hint', 'omen', 'sign', // Foreshadowing
        'irony', 'ironic', 'ironically', // Irony
        'juxtapos', 'contrast', 'opposite', // Juxtaposition
        'alliterat', 'repeated', 'echoed', // Alliteration
      ];

      const indicatorCount = deviceIndicators.filter(indicator => lowerContent.includes(indicator)).length;
      const totalWords = content.split(/\s+/).length;
      const deviceRatio = totalWords > 0 ? indicatorCount / totalWords : 0;

      // If very low device usage, mark as generic
      if (deviceRatio < 0.002 && totalWords > 500) {
        genericChapters.push(chapter.number);
      }
    });

    return genericChapters;
  }

  /**
   * Generates improvement interventions for devices
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const deviceAnalysis = analyzeLiteraryDevices(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];

    // Fix generic prose chapters
    const genericProseChapters = this.detectGenericProse(chapters);
    genericProseChapters.slice(0, 10).forEach((chapterNumber) => {
      const chapter = chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'modify_content',
          description: 'Replace generic prose with specific literary devices: add foreshadowing, metaphors, symbolism, irony, or alliteration to enhance prose quality.',
          estimatedWordCount: 300,
        });
      }
    });

    // Add missing devices
    const keyDevices = ['foreshadowing', 'irony', 'symbolism', 'metaphor'];
    const usedDevices = Object.keys(deviceAnalysis.deviceFrequency).map(d => d.toLowerCase());
    const missingDevices = keyDevices.filter(device => !usedDevices.some(used => used.includes(device)));

    // Add one missing device per chapter (distribute across chapters)
    missingDevices.forEach((device, index) => {
      const targetChapter = chapters[Math.floor((index / missingDevices.length) * chapters.length)];
      if (targetChapter && !editActions.some(a => a.chapterId === targetChapter.id)) {
        let deviceDescription = '';
        switch (device) {
          case 'foreshadowing':
            deviceDescription = 'Add foreshadowing: hints of future events, subtle clues, or symbolic omens';
            break;
          case 'irony':
            deviceDescription = 'Add irony: situational irony, dramatic irony, or verbal irony';
            break;
          case 'symbolism':
            deviceDescription = 'Add symbolism: symbolic objects, actions, or imagery with deeper meaning';
            break;
          case 'metaphor':
            deviceDescription = 'Add metaphors: vivid comparisons that enhance descriptions';
            break;
        }

        editActions.push({
          chapterId: targetChapter.id,
          chapterNumber: targetChapter.number,
          section: 'middle',
          improvementType: 'add_content',
          description: deviceDescription,
          estimatedWordCount: 200,
        });
      }
    });

    // Enhance existing device usage - find chapters with low device presence
    const lowDeviceChapters = this.detectGenericProse(chapters)
      .slice(0, 5)
      .map(chapterNumber => {
        const chapter = chapters.find(ch => ch.number === chapterNumber);
        return chapter;
      })
      .filter(ch => ch && !editActions.some(a => a.chapterId === ch!.id));

    lowDeviceChapters.forEach((chapter) => {
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: 'Enhance existing literary device usage. Add more devices or strengthen existing ones to improve prose quality.',
          estimatedWordCount: 250,
        });
      }
    });

    // Calculate expected improvement
    const currentScore = deviceAnalysis.overallDeviceScore;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor(editActions.length * 2))
    );

    return {
      id: generateUUID(),
      category: 'literary_devices',
      priority: editActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve literary devices: replace generic prose, add missing devices, enhance device usage`,
      rationale: `Current device score is ${currentScore}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: editActions.length > 0 ? editActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: editActions.length > 5 ? 'high' : editActions.length > 2 ? 'medium' : 'low',
      chaptersAffected: editActions.map(a => a.chapterNumber),
      expectedImprovement,
    };
  }
}
