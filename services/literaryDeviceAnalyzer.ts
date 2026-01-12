import { NovelState, Chapter, LiteraryDevice } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Literary Device Analyzer
 * Tracks literary device usage (foreshadowing, symbolism, metaphor, etc.),
 * scores device effectiveness, and detects overuse/underuse
 */

export interface LiteraryDeviceAnalysis {
  devices: LiteraryDevice[];
  deviceFrequency: Record<string, number>; // Device type -> count
  overusedDevices: LiteraryDevice[];
  underusedDevices: LiteraryDevice[];
  effectiveDevices: LiteraryDevice[]; // High effectiveness score
  deviceSynergy: Array<{
    device1: string;
    device2: string;
    synergyScore: number; // 0-100
    description: string;
  }>;
  overallDeviceScore: number; // 0-100
  recommendations: string[];
}

/**
 * Analyzes literary devices across the story
 */
export function analyzeLiteraryDevices(state: NovelState): LiteraryDeviceAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      devices: [],
      deviceFrequency: {},
      overusedDevices: [],
      underusedDevices: [],
      effectiveDevices: [],
      deviceSynergy: [],
      overallDeviceScore: 0,
      recommendations: ['No chapters available for literary device analysis'],
    };
  }

  // Get or build devices
  let devices: LiteraryDevice[] = [];
  if (state.literaryDevices && state.literaryDevices.length > 0) {
    devices = [...state.literaryDevices];
  } else {
    devices = buildLiteraryDevices(chapters, state);
  }

  // Calculate device frequency
  const deviceFrequency = calculateDeviceFrequency(devices);

  // Identify overused devices
  const overusedDevices = identifyOverusedDevices(devices, chapters.length);

  // Identify underused devices
  const underusedDevices = identifyUnderusedDevices(devices, chapters.length);

  // Identify effective devices
  const effectiveDevices = identifyEffectiveDevices(devices);

  // Analyze device synergy
  const deviceSynergy = analyzeDeviceSynergy(devices, chapters);

  // Calculate overall device score
  const overallDeviceScore = calculateOverallDeviceScore(devices, deviceFrequency);

  // Generate recommendations
  const recommendations = generateDeviceRecommendations(
    devices,
    overusedDevices,
    underusedDevices,
    deviceFrequency,
    overallDeviceScore
  );

  return {
    devices,
    deviceFrequency,
    overusedDevices,
    underusedDevices,
    effectiveDevices,
    deviceSynergy,
    overallDeviceScore,
    recommendations,
  };
}

/**
 * Builds literary devices from chapters
 */
function buildLiteraryDevices(chapters: Chapter[], state: NovelState): LiteraryDevice[] {
  const devices: LiteraryDevice[] = [];
  const deviceMap = new Map<string, LiteraryDevice>(); // Track by type + content hash

  // Common literary device patterns
  const devicePatterns: Record<string, {
    keywords: string[];
    contextPatterns: RegExp[];
  }> = {
    foreshadowing: {
      keywords: ['future', 'later', 'would', 'soon', 'little did', 'unbeknownst', 'hint', 'sign'],
      contextPatterns: [
        /\b(will|would|shall|might)\s+(later|soon|eventually)/gi,
        /\blittle\s+did\s+\w+/gi,
        /\b(hint|clue|sign|omen)\s+(of|at|to)/gi
      ]
    },
    symbolism: {
      keywords: ['symbol', 'represent', 'signify', 'stand for', 'embody', 'metaphor'],
      contextPatterns: [
        /\b(represents|signifies|stands\s+for|embodies|symbolizes)/gi,
        /\blike\s+a\s+\w+\s+.*\s+(of|for)/gi
      ]
    },
    metaphor: {
      keywords: ['like', 'as', 'metaphor', 'comparison'],
      contextPatterns: [
        /\b(is|was|are|were)\s+\w+\s+(like|as)/gi,
        /\b\w+\s+(is|was|are|were)\s+\w+/gi // A is B (implied metaphor)
      ]
    },
    simile: {
      keywords: ['like', 'as'],
      contextPatterns: [
        /\b\w+\s+(like|as)\s+\w+/gi,
        /\bas\s+\w+\s+as\s+\w+/gi
      ]
    },
    irony: {
      keywords: ['ironically', 'irony', 'ironic', 'paradoxically', 'unexpectedly'],
      contextPatterns: [
        /\bironically\b/gi,
        /\b(but|however|yet)\s+(unexpectedly|surprisingly)/gi
      ]
    },
    allusion: {
      keywords: ['reference', 'allude', 'allusion', 'remind'],
      contextPatterns: [
        /\b(reference|allusion|reminiscent|evoke)\s+(to|of)/gi
      ]
    },
    imagery: {
      keywords: ['sight', 'sound', 'touch', 'taste', 'smell', 'visual', 'audible'],
      contextPatterns: [
        /\b(saw|heard|felt|tasted|smelled|glimpsed|watched|listened)/gi,
        /\b(sight|sound|touch|taste|smell|visual|audible)/gi
      ]
    },
    personification: {
      keywords: ['personify', 'human', 'alive', 'breathed', 'whispered'],
      contextPatterns: [
        /\b\w+\s+(whispered|screamed|laughed|cried|breathed)/gi, // Non-human doing human actions
        /\b(as\s+if|like)\s+\w+\s+was\s+(alive|human)/gi
      ]
    }
  };

  chapters.forEach(chapter => {
    const content = chapter.content || '';
    const contentLower = content.toLowerCase();

    // Detect each device type
    Object.entries(devicePatterns).forEach(([deviceType, patterns]) => {
      // Check keywords
      const hasKeywords = patterns.keywords.some(keyword => contentLower.includes(keyword.toLowerCase()));
      
      // Check context patterns
      const hasPatterns = patterns.contextPatterns.some(pattern => pattern.test(content));

      if (hasKeywords || hasPatterns) {
        // Extract device content
        const deviceContent = extractDeviceContent(content, deviceType, patterns);

        // Check if we've seen this device before
        const deviceKey = `${deviceType}:${hashContent(deviceContent)}`;
        let device = deviceMap.get(deviceKey);

        if (device) {
          // Update frequency
          device.frequencyCount++;
          device.updatedAt = Date.now();
        } else {
          // Create new device
          device = {
            id: generateUUID(),
            novelId: state.id,
            chapterId: chapter.id,
            deviceType: deviceType as LiteraryDevice['deviceType'],
            deviceContent: deviceContent.substring(0, 200), // Limit length
            frequencyCount: 1,
            effectivenessScore: 50, // Base score, will be calculated later
            isOverused: false,
            isUnderused: false,
            relatedDeviceIds: [],
            notes: `Detected in chapter ${chapter.number}`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          devices.push(device);
          deviceMap.set(deviceKey, device);
        }
      }
    });

    // Check existing foreshadowing and symbolism from state
    if (state.foreshadowingElements) {
      state.foreshadowingElements.forEach(element => {
        if (element.chapterId === chapter.id && !deviceMap.has(`foreshadowing:${element.id}`)) {
          const device: LiteraryDevice = {
            id: generateUUID(),
            novelId: state.id,
            chapterId: chapter.id,
            deviceType: 'foreshadowing',
            deviceContent: element.setupContent || element.description,
            frequencyCount: 1,
            effectivenessScore: 60,
            isOverused: false,
            isUnderused: false,
            relatedDeviceIds: [],
            notes: `From foreshadowing system`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          devices.push(device);
        }
      });
    }

    if (state.symbolicElements) {
      state.symbolicElements.forEach(element => {
        if (element.chaptersAppeared.includes(chapter.number)) {
          const deviceKey = `symbolism:${element.id}`;
          if (!deviceMap.has(deviceKey)) {
            const device: LiteraryDevice = {
              id: generateUUID(),
              novelId: state.id,
              chapterId: chapter.id,
              deviceType: 'symbolism',
              deviceContent: `${element.name}: ${element.symbolicMeaning}`,
              frequencyCount: element.chaptersAppeared.length,
              effectivenessScore: 70,
              isOverused: false,
              isUnderused: false,
              relatedDeviceIds: [],
              notes: `From symbolism system`,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            devices.push(device);
            deviceMap.set(deviceKey, device);
          }
        }
      });
    }
  });

  // Calculate effectiveness scores
  devices.forEach(device => {
    device.effectivenessScore = calculateDeviceEffectiveness(device, chapters, state);
  });

  // Link related devices
  linkRelatedDevices(devices, chapters);

  return devices;
}

/**
 * Extracts device content from text
 */
function extractDeviceContent(content: string, deviceType: string, patterns: { keywords: string[]; contextPatterns: RegExp[] }): string {
  // Try to extract sentence containing device
  const sentences = content.split(/[.!?]+/);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    const hasKeyword = patterns.keywords.some(kw => lowerSentence.includes(kw.toLowerCase()));
    const hasPattern = patterns.contextPatterns.some(pattern => pattern.test(sentence));
    
    if (hasKeyword || hasPattern) {
      return sentence.trim();
    }
  }

  // Fallback: return first 100 characters
  return content.substring(0, 100);
}

/**
 * Hashes content for deduplication
 */
function hashContent(content: string): string {
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Calculates device effectiveness (0-100)
 */
function calculateDeviceEffectiveness(device: LiteraryDevice, chapters: Chapter[], state: NovelState): number {
  let score = 50; // Base score

  // Effectiveness based on frequency (optimal: not too rare, not too common)
  const chaptersCount = chapters.length;
  const frequencyRate = device.frequencyCount / chaptersCount;
  
  if (frequencyRate >= 0.1 && frequencyRate <= 0.5) {
    score += 20; // Good frequency
  } else if (frequencyRate < 0.05) {
    score -= 10; // Too rare
  } else if (frequencyRate > 0.8) {
    score -= 15; // Too frequent
  }

  // Bonus for device content quality (longer, more descriptive)
  if (device.deviceContent && device.deviceContent.length > 50) {
    score += 10;
  }

  // Check if device has related devices (synergy)
  if (device.relatedDeviceIds.length > 0) {
    score += 10;
  }

  // Check chapter context (devices in significant chapters score higher)
  const deviceChapter = chapters.find(ch => ch.id === device.chapterId);
  if (deviceChapter) {
    // Bonus for devices in key chapters
    const chapterPosition = deviceChapter.number / chapters.length;
    if (chapterPosition >= 0.2 && chapterPosition <= 0.3) {
      score += 5; // Early chapters
    } else if (chapterPosition >= 0.45 && chapterPosition <= 0.55) {
      score += 10; // Midpoint (important)
    } else if (chapterPosition >= 0.8 && chapterPosition <= 0.9) {
      score += 10; // Climax (important)
    }
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Links related devices (devices that work together)
 */
function linkRelatedDevices(devices: LiteraryDevice[], chapters: Chapter[]): void {
  devices.forEach(device => {
    const relatedIds: string[] = [];

    devices.forEach(otherDevice => {
      if (otherDevice.id === device.id) return;

      // Devices are related if:
      // 1. Same chapter
      if (device.chapterId === otherDevice.chapterId) {
        relatedIds.push(otherDevice.id);
      }

      // 2. Complementary types (symbolism + metaphor, foreshadowing + irony, etc.)
      const complementaryPairs: Array<[string, string]> = [
        ['symbolism', 'metaphor'],
        ['foreshadowing', 'irony'],
        ['imagery', 'symbolism'],
        ['metaphor', 'simile'],
        ['allusion', 'imagery']
      ];

      const isComplementary = complementaryPairs.some(
        ([type1, type2]) =>
          (device.deviceType === type1 && otherDevice.deviceType === type2) ||
          (device.deviceType === type2 && otherDevice.deviceType === type1)
      );

      if (isComplementary) {
        relatedIds.push(otherDevice.id);
      }

      // 3. Similar content (might be related themes)
      if (device.deviceContent && otherDevice.deviceContent) {
        const similarity = calculateTextSimilarity(device.deviceContent, otherDevice.deviceContent);
        if (similarity > 0.3) {
          relatedIds.push(otherDevice.id);
        }
      }
    });

    device.relatedDeviceIds = relatedIds.slice(0, 5); // Limit to 5 related devices
  });
}

/**
 * Calculates device frequency
 */
function calculateDeviceFrequency(devices: LiteraryDevice[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  devices.forEach(device => {
    frequency[device.deviceType] = (frequency[device.deviceType] || 0) + device.frequencyCount;
  });

  return frequency;
}

/**
 * Identifies overused devices
 */
function identifyOverusedDevices(devices: LiteraryDevice[], totalChapters: number): LiteraryDevice[] {
  const deviceTypeCounts = new Map<string, number>();
  
  devices.forEach(device => {
    deviceTypeCounts.set(device.deviceType, (deviceTypeCounts.get(device.deviceType) || 0) + device.frequencyCount);
  });

  const overused: LiteraryDevice[] = [];
  const threshold = totalChapters * 0.5; // Used in >50% of chapters

  deviceTypeCounts.forEach((count, deviceType) => {
    if (count > threshold) {
      const devicesOfType = devices.filter(d => d.deviceType === deviceType);
      devicesOfType.forEach(device => {
        device.isOverused = true;
        overused.push(device);
      });
    }
  });

  return overused;
}

/**
 * Identifies underused devices
 */
function identifyUnderusedDevices(devices: LiteraryDevice[], totalChapters: number): LiteraryDevice[] {
  const deviceTypes = new Set(devices.map(d => d.deviceType));
  const underused: LiteraryDevice[] = [];

  // Expected device types that should be present
  const expectedDevices = ['foreshadowing', 'symbolism', 'metaphor', 'imagery'];
  
  expectedDevices.forEach(expectedType => {
    const devicesOfType = devices.filter(d => d.deviceType === expectedType);
    if (devicesOfType.length === 0) {
      // Device type not found at all
      return;
    }

    const totalFrequency = devicesOfType.reduce((sum, d) => sum + d.frequencyCount, 0);
    const frequencyRate = totalFrequency / totalChapters;

    // Underused if frequency < 10% of chapters
    if (frequencyRate < 0.1) {
      devicesOfType.forEach(device => {
        device.isUnderused = true;
        if (!underused.includes(device)) {
          underused.push(device);
        }
      });
    }
  });

  return underused;
}

/**
 * Identifies effective devices
 */
function identifyEffectiveDevices(devices: LiteraryDevice[]): LiteraryDevice[] {
  return devices
    .filter(d => d.effectivenessScore >= 70)
    .sort((a, b) => b.effectivenessScore - a.effectivenessScore)
    .slice(0, 20); // Top 20 effective devices
}

/**
 * Analyzes device synergy
 */
function analyzeDeviceSynergy(
  devices: LiteraryDevice[],
  chapters: Chapter[]
): LiteraryDeviceAnalysis['deviceSynergy'] {
  const synergy: LiteraryDeviceAnalysis['deviceSynergy'] = [];

  // Analyze pairs of devices
  for (let i = 0; i < devices.length; i++) {
    for (let j = i + 1; j < devices.length; j++) {
      const device1 = devices[i];
      const device2 = devices[j];

      // Check if devices are related
      if (device1.relatedDeviceIds.includes(device2.id) ||
          device2.relatedDeviceIds.includes(device1.id)) {
        const synergyScore = calculateDeviceSynergyScore(device1, device2, chapters);
        
        synergy.push({
          device1: device1.deviceType,
          device2: device2.deviceType,
          synergyScore,
          description: `${device1.deviceType} and ${device2.deviceType} work together effectively`,
        });
      }
    }
  }

  return synergy.sort((a, b) => b.synergyScore - a.synergyScore).slice(0, 10); // Top 10 synergies
}

/**
 * Calculates device synergy score
 */
function calculateDeviceSynergyScore(
  device1: LiteraryDevice,
  device2: LiteraryDevice,
  chapters: Chapter[]
): number {
  let score = 50; // Base score

  // Bonus if in same chapter (working together)
  if (device1.chapterId === device2.chapterId) {
    score += 30;
  } else {
    // Check proximity (close chapters = related)
    const chapter1 = chapters.find(ch => ch.id === device1.chapterId);
    const chapter2 = chapters.find(ch => ch.id === device2.chapterId);
    
    if (chapter1 && chapter2) {
      const distance = Math.abs(chapter1.number - chapter2.number);
      if (distance <= 3) {
        score += 20 - distance * 5; // Closer = better
      }
    }
  }

  // Bonus for both being effective
  if (device1.effectivenessScore >= 70 && device2.effectivenessScore >= 70) {
    score += 20;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall device score
 */
function calculateOverallDeviceScore(
  devices: LiteraryDevice[],
  frequency: Record<string, number>
): number {
  if (devices.length === 0) return 0;

  // Average effectiveness
  const avgEffectiveness = devices.reduce((sum, d) => sum + d.effectivenessScore, 0) / devices.length;

  // Bonus for device variety
  const deviceVariety = Object.keys(frequency).length;
  const varietyBonus = Math.min(20, deviceVariety * 3);

  // Penalty for overused devices
  const overusedCount = devices.filter(d => d.isOverused).length;
  const overusePenalty = Math.min(15, overusedCount * 2);

  // Bonus for effective devices
  const effectiveCount = devices.filter(d => d.effectivenessScore >= 70).length;
  const effectivenessBonus = Math.min(15, effectiveCount);

  return Math.min(100, Math.round(avgEffectiveness + varietyBonus - overusePenalty + effectivenessBonus));
}

/**
 * Generates device recommendations
 */
function generateDeviceRecommendations(
  devices: LiteraryDevice[],
  overusedDevices: LiteraryDevice[],
  underusedDevices: LiteraryDevice[],
  frequency: Record<string, number>,
  overallScore: number
): string[] {
  const recommendations: string[] = [];

  if (overusedDevices.length > 0) {
    const overusedTypes = new Set(overusedDevices.map(d => d.deviceType));
    recommendations.push(
      `Overused devices detected: ${Array.from(overusedTypes).join(', ')}. Consider reducing frequency for variety.`
    );
  }

  if (underusedDevices.length > 0) {
    const underusedTypes = new Set(underusedDevices.map(d => d.deviceType));
    recommendations.push(
      `Underused devices detected: ${Array.from(underusedTypes).join(', ')}. Consider incorporating these more.`
    );
  }

  // Check for missing important devices
  const expectedDevices = ['foreshadowing', 'symbolism', 'imagery'];
  const presentDevices = Object.keys(frequency);
  const missingDevices = expectedDevices.filter(d => !presentDevices.includes(d));
  
  if (missingDevices.length > 0) {
    recommendations.push(`Missing important devices: ${missingDevices.join(', ')}. Consider adding these for richer prose.`);
  }

  // Check device variety
  const deviceVariety = presentDevices.length;
  if (deviceVariety < 4) {
    recommendations.push(`Limited device variety (${deviceVariety} types). Consider adding more literary devices.`);
  }

  if (overallScore < 60) {
    recommendations.push(`Overall device score is ${overallScore}/100. Focus on effectiveness and variety.`);
  } else if (overallScore >= 80) {
    recommendations.push('Excellent literary device usage! Good variety, effectiveness, and balance.');
  }

  return recommendations;
}

/**
 * Helper: Calculate text similarity
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return union.size > 0 ? intersection.size / union.size : 0;
}
