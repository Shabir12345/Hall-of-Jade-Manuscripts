import { NovelState, BuiltPrompt } from '../../../types';
import { buildPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';
import { gatherPromptContext } from '../contextGatherer';
import {
  analyzeAllArcContexts,
  analyzeCharacterArcJourneys,
  analyzeArcProgression,
  formatArcContextForPrompt,
  analyzeArcTransitions,
  analyzeSetupPayoff,
  analyzeConflictEscalation,
  analyzeEmotionalArcs,
  analyzeThemesAndMotifs,
  calculateSmartArcTargetChapters,
  detectArcType,
  detectSuggestedArchetypes
} from '../arcContextAnalyzer';
import { getGrandSagaCharacters, getAllGrandSagaCharacterNames } from '../../grandSagaAnalyzer';

/**
 * Arc Prompt Writer
 * Creates prompts for arc planning that consider story progression
 * and apply literary principles with comprehensive arc context
 */

/**
 * Builds a prompt for planning a new arc
 */
export async function buildArcPrompt(state: NovelState): Promise<BuiltPrompt> {
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');
  const activeArc = state.plotLedger.find(a => a.status === 'active');

  // Gather comprehensive context including arc history
  const context = await gatherPromptContext(state, {
    includeFullHistory: false,
    maxRecentChapters: 5,
    includeStyleProfile: false,
    includeCharacterDevelopment: true,
    includeStoryProgression: true,
    includeArcHistory: true,
  });

  // Build comprehensive arc analysis
  const arcNeeds = determineComprehensiveArcNeeds(state, context);

  // Calculate suggested target chapters based on complexity
  const suggestedTargetChapters = calculateSmartArcTargetChapters(state, context.arcContext);

  // Detect arc type for better context
  const arcType = detectArcType(state, context.arcContext);

  // Define arc type descriptions (moved outside if block to be accessible)
  const arcTypeDescriptions: Record<ReturnType<typeof detectArcType>, string> = {
    'opening': 'Focus: Extensive world-building, character introduction, establishing initial conflict and Grand Saga setup. Needs more chapters (12-18) for proper establishment.',
    'setup': 'Focus: Introduces new elements, locations, characters, or conflicts. Establishes groundwork for future arcs.',
    'development': 'Focus: Advances plot threads, deepens character relationships, and builds tension. Core narrative progression.',
    'climax': 'Focus: Peak tension, major conflict resolution, significant aftermath handling. Needs more chapters (15-25) for proper resolution.',
    'denouement': 'Focus: Resolving remaining threads, providing closure. Shorter format (6-12 chapters) focusing on aftermath.',
    'interlude': 'Focus: Brief respite, character moments, world-building moments. Shorter format (5-8 chapters).',
    'transition': 'Focus: Bridging between major arcs, resolving some threads while setting up new conflicts.'
  };

  // Build arc context sections (optimized for length)
  let arcContextSection = '';
  if (context.arcContext && completedArcs.length > 0) {
    arcContextSection = formatArcContextForPrompt(context.arcContext.arcSummaries);

    // Add character arc journeys
    if (context.arcContext.characterArcJourneys.length > 0) {
      arcContextSection += '\n\n[CHARACTER ARC JOURNEYS]\n';
      context.arcContext.characterArcJourneys.slice(0, 5).forEach(journey => {
        arcContextSection += `${journey.characterName}: ${journey.overallProgression}\n`;
      });
    }

    // Add progression analysis
    const progression = context.arcContext.progressionAnalysis;

    arcContextSection += '\n\n[NARRATIVE MOMENTUM ANALYSIS]\n';
    arcContextSection += `Detected Arc Type: ${arcType.charAt(0).toUpperCase() + arcType.slice(1)} Arc\n`;
    arcContextSection += `Arc Type Description: ${arcTypeDescriptions[arcType]}\n`;
    arcContextSection += `Average Arc Length: ${progression.pacingAnalysis.averageArcLength} chapters\n`;
    arcContextSection += `Suggested Target Length: ${suggestedTargetChapters} chapters (based on complexity analysis)\n`;
    if (progression.pacingAnalysis.pacingIssues.length > 0) {
      arcContextSection += `Pacing Issues:\n`;
      progression.pacingAnalysis.pacingIssues.forEach(issue => {
        arcContextSection += `  - ${issue}\n`;
      });
    }
    if (progression.pacingAnalysis.recommendations.length > 0) {
      arcContextSection += `Recommendations:\n`;
      progression.pacingAnalysis.recommendations.forEach(rec => {
        arcContextSection += `  - ${rec}\n`;
      });
    }
    arcContextSection += `Arc Resolution Rate: ${Math.round(progression.completionPatterns.setupPayoffRatio * 100)}%\n`;
    arcContextSection += `Unresolved Elements Across All Arcs: ${progression.completionPatterns.unresolvedElements}`;
    if (progression.completionPatterns.highPriorityUnresolved && progression.completionPatterns.highPriorityUnresolved > 0) {
      arcContextSection += ` (${progression.completionPatterns.highPriorityUnresolved} high priority)\n`;
    } else {
      arcContextSection += '\n';
    }

    // Add transition analysis
    const transitions = analyzeArcTransitions(state);
    if (transitions.length > 0) {
      arcContextSection += '\n[ARC TRANSITION QUALITY]\n';
      const recentTransitions = transitions.slice(-2);
      recentTransitions.forEach(transition => {
        arcContextSection += `${transition.fromArc} → ${transition.toArc}: ${transition.transitionQuality}\n`;
        if (transition.issues.length > 0) {
          arcContextSection += `  Issues: ${transition.issues.join('; ')}\n`;
        }
        if (transition.recommendations.length > 0) {
          arcContextSection += `  Recommendations: ${transition.recommendations.join('; ')}\n`;
        }
      });
    }

    // Add setup/payoff analysis
    const setupPayoff = analyzeSetupPayoff(state);
    if (setupPayoff.setups.length > 0 || setupPayoff.payoffs.length > 0) {
      arcContextSection += '\n[SETUP/PAYOFF PATTERNS]\n';
      arcContextSection += `Setup-Payoff Ratio: ${Math.round(setupPayoff.setupPayoffRatio * 100)}%\n`;
      const unpaidSetups = setupPayoff.setups.filter(s => !s.paidOff);
      if (unpaidSetups.length > 0) {
        arcContextSection += `Unpaid Setups: ${unpaidSetups.length}\n`;
        unpaidSetups.slice(0, 3).forEach(setup => {
          arcContextSection += `  - "${setup.setup.substring(0, 100)}..." (from "${setup.arcTitle}", Ch ${setup.introducedInChapter})\n`;
        });
      }
      if (setupPayoff.recommendations.length > 0) {
        arcContextSection += `Recommendations:\n`;
        setupPayoff.recommendations.forEach(rec => {
          arcContextSection += `  - ${rec}\n`;
        });
      }
    }

    // Tension evolution
    if (progression.tensionEvolution.length > 0) {
      arcContextSection += '\nTension Evolution:\n';
      progression.tensionEvolution.slice(-3).forEach(evol => {
        arcContextSection += `  "${evol.arcTitle}": ${evol.tensionCurve.startLevel} → ${evol.tensionCurve.endLevel}\n`;
      });
    }

    // Power scaling for cultivation novels
    if (progression.powerScalingPattern) {
      arcContextSection += '\nPower Progression Pattern:\n';
      progression.powerScalingPattern.progression.slice(-3).forEach(prog => {
        arcContextSection += `  "${prog.arcTitle}": ${prog.powerLevel}${prog.breakthrough ? ' (Breakthrough)' : ''}\n`;
      });
      if (progression.powerScalingPattern.scalingIssues.length > 0) {
        arcContextSection += 'Power Scaling Issues:\n';
        progression.powerScalingPattern.scalingIssues.forEach(issue => {
          arcContextSection += `  - ${issue}\n`;
        });
      }
    }

    // Conflict escalation analysis
    const conflictEscalation = analyzeConflictEscalation(state);
    if (conflictEscalation.escalationPattern.length > 0) {
      arcContextSection += '\n[CONFLICT ESCALATION PATTERN]\n';
      conflictEscalation.escalationPattern.slice(-3).forEach(escalation => {
        arcContextSection += `"${escalation.arcTitle}": ${escalation.conflictTypes.join(', ')} - ${escalation.stakesLevel} stakes, ${escalation.intensity} intensity\n`;
      });
      if (conflictEscalation.escalationIssues.length > 0) {
        arcContextSection += 'Escalation Issues:\n';
        conflictEscalation.escalationIssues.forEach(issue => {
          arcContextSection += `  - ${issue}\n`;
        });
      }
      if (conflictEscalation.recommendations.length > 0) {
        arcContextSection += 'Escalation Recommendations:\n';
        conflictEscalation.recommendations.forEach(rec => {
          arcContextSection += `  - ${rec}\n`;
        });
      }
    }

    // Emotional arc analysis
    const emotionalArcs = analyzeEmotionalArcs(state);
    if (emotionalArcs.protagonistEmotionalJourney.length > 0) {
      arcContextSection += '\n[PROTAGONIST EMOTIONAL JOURNEY]\n';
      emotionalArcs.protagonistEmotionalJourney.slice(-3).forEach(journey => {
        arcContextSection += `"${journey.arcTitle}": ${journey.emotionalShift} (dominant: ${journey.dominantEmotion})\n`;
      });
      if (emotionalArcs.emotionalPatternIssues.length > 0) {
        arcContextSection += 'Emotional Pattern Issues:\n';
        emotionalArcs.emotionalPatternIssues.forEach(issue => {
          arcContextSection += `  - ${issue}\n`;
        });
      }
      if (emotionalArcs.recommendations.length > 0) {
        arcContextSection += 'Emotional Arc Recommendations:\n';
        emotionalArcs.recommendations.forEach(rec => {
          arcContextSection += `  - ${rec}\n`;
        });
      }
    }

    // Themes and motifs
    const themesMotifs = analyzeThemesAndMotifs(state);
    if (themesMotifs.recurringThemes.length > 0 || themesMotifs.motifs.length > 0) {
      arcContextSection += '\n[THEMES AND MOTIFS]\n';
      if (themesMotifs.recurringThemes.length > 0) {
        arcContextSection += 'Recurring Themes:\n';
        themesMotifs.recurringThemes.forEach(theme => {
          arcContextSection += `  - "${theme.theme}": appears in ${theme.arcs.length} arc(s) (${theme.arcs.join(', ')})\n`;
        });
      }
      if (themesMotifs.motifs.length > 0) {
        arcContextSection += 'Motifs:\n';
        themesMotifs.motifs.forEach(motif => {
          arcContextSection += `  - "${motif.motif}": appears in ${motif.arcs.length} arc(s)\n`;
        });
      }
      if (themesMotifs.themeConsistency.length > 0) {
        arcContextSection += 'Theme Consistency Notes:\n';
        themesMotifs.themeConsistency.forEach(note => {
          arcContextSection += `  - ${note}\n`;
        });
      }
    }
  }

  // Extract Grand Saga characters
  const grandSagaData = getAllGrandSagaCharacterNames(state);
  const grandSagaCharacters = grandSagaData.inCodex;
  const grandSagaExtracted = grandSagaData.notInCodex;

  // Build Grand Saga characters section
  let grandSagaCharactersSection = '';
  if (state.grandSaga && state.grandSaga.trim().length > 0) {
    grandSagaCharactersSection = '\n[CHARACTERS FROM GRAND SAGA]\n';

    if (grandSagaCharacters.length > 0) {
      grandSagaCharactersSection += 'Characters mentioned in Grand Saga (already in character codex):\n';
      grandSagaCharacters.forEach(char => {
        grandSagaCharactersSection += `  - ${char.name}${char.isProtagonist ? ' (Protagonist)' : ''}`;
        if (char.personality) {
          grandSagaCharactersSection += ` - ${char.personality.substring(0, 100)}`;
        }
        grandSagaCharactersSection += '\n';
      });
    }

    if (grandSagaExtracted.length > 0) {
      grandSagaCharactersSection += '\nPotential characters mentioned in Grand Saga (not yet in character codex):\n';
      grandSagaExtracted.forEach(extracted => {
        grandSagaCharactersSection += `  - ${extracted.name} (confidence: ${Math.round(extracted.confidence * 100)}%)`;
        if (extracted.context) {
          grandSagaCharactersSection += ` - Context: "${extracted.context.substring(0, 80)}..."`;
        }
        grandSagaCharactersSection += '\n';
      });
    }

    if (grandSagaCharacters.length === 0 && grandSagaExtracted.length === 0) {
      grandSagaCharactersSection += 'No specific character names detected in Grand Saga. Focus on the themes and narrative direction.\n';
    }

    grandSagaCharactersSection += '\nCRITICAL: The arc MUST feature and develop characters mentioned in the Grand Saga. ';
    grandSagaCharactersSection += 'If characters are mentioned in the Grand Saga, they should play significant roles in this arc.\n';
  }

  // Determine Grand Saga text length (up to 800 chars, or full if shorter)
  const grandSagaText = state.grandSaga && state.grandSaga.trim().length > 0
    ? (state.grandSaga.length > 800 ? state.grandSaga.substring(0, 800) + '...' : state.grandSaga)
    : 'No Grand Saga defined yet.';

  const taskDescription = `[ARC PLANNING TASK]

Plan the next major plot arc for "${state.title}".

[ARC TYPE ANALYSIS]
Arc Type: ${arcType.charAt(0).toUpperCase() + arcType.slice(1)} Arc
${arcTypeDescriptions[arcType]}

${grandSagaCharactersSection}

[ARC REQUIREMENTS ANALYSIS]
${arcNeeds}

${arcContextSection ? `\n[ARC CONTEXT & HISTORY]\n${arcContextSection}\n` : ''}

[ARC DESIGN REQUIREMENTS]

Core Narrative Principles:
• Law of Causality: Connect logically to recent events and previous arc outcomes using "BUT" or "THEREFORE" logic
• Principle of the Delta: Create meaningful value shifts that build on established character arcs
• Internal Friction: Characters must face difficult choices that challenge their growth and development

Story Progression Requirements:
• Advance the Grand Saga: "${grandSagaText}"
• Feature Grand Saga Characters: The arc MUST prominently feature and develop characters mentioned in the Grand Saga (see [CHARACTERS FROM GRAND SAGA] section above)
• Build on Character Development: Consider how characters have evolved across previous arcs and continue their growth
• Resolve or Advance Plot Threads: Address unresolved elements from previous arcs while introducing new challenges

Structural Requirements:
• Three-Act Structure: Ensure the arc has clear beginning, middle, and end while fitting into the larger narrative
• Tension Flow: Create appropriate tension transitions based on previous arc patterns
• Arc Type Alignment: As a ${arcType} arc, ensure structure and pacing align with its narrative function (${arcType === 'opening' ? 'extensive world-building' : arcType === 'climax' ? 'peak tension and major resolution' : arcType === 'denouement' ? 'resolution and closure' : 'development and progression'})

Quality Requirements:
• Meaningful Stakes: Introduce conflicts that matter to the characters and the overall story
• Conflict Escalation: Build on previous conflict escalation patterns while maintaining narrative logic
• Emotional Journey: Continue the protagonist's emotional development with appropriate emotional moments
• Theme Consistency: Uphold recurring themes while allowing for natural evolution and variation
• Genre Consistency: Maintain established world rules, power systems, and genre conventions

[ARC QUALITY STANDARDS]

The arc should feel like a natural, inevitable progression of the story while introducing new challenges, stakes, or developments that feel both surprising and earned. The arc description must be written in clear, accessible language suitable for readers aged 10-40, using common words over rare ones and maintaining professional quality.`;

  const outputFormat = `[OUTPUT FORMAT]

Return a JSON object with this structure:
{
  "arcTitle": "string (compelling, memorable title reflecting the arc's central theme and ${arcType} arc type)",
  "arcDescription": "string (comprehensive description of 200-500 words covering: central conflict, character goals, key events, how it builds on previous arcs, tension progression, resolution direction, and how it fulfills its ${arcType} arc narrative function)",
  "targetChapters": number (optimal chapter count for this ${arcType} arc, considering complexity, scope, and goals. Suggested: ${suggestedTargetChapters} chapters based on comprehensive analysis; adjust ±20% for narrative needs. Range: ${arcType === 'denouement' || arcType === 'interlude' ? '5-12' : arcType === 'climax' ? '15-30' : '8-25'} chapters. Must be an integer between 5 and 35)
}`;

  const specificConstraints = [
    'Arc Title Requirements: Create a memorable title that reflects the arc\'s central theme and ${arcType} arc type',
    'Arc Description Requirements (200-500 words): The description must comprehensively address:',
    '  • How this arc builds on the most recent arc\'s outcome and consequences',
    '  • Which unresolved elements from previous arcs it addresses or advances',
    '  • How characters will continue to develop based on their established journey arcs',
    '  • The central conflict, stakes, and what characters have to lose or gain',
    '  • Key events and narrative progression throughout the arc',
    '  • Tension evolution: how tension will evolve from start level → peak → resolution',
    '  • Grand Saga character integration: which characters from the Grand Saga will be featured and how they will be developed',
    'Story Continuity: Ensure the arc aligns with the story\'s genre and established world rules',
    'Character Development: Maintain continuity with character development patterns across previous arcs',
    'CRITICAL - Grand Saga Integration: The arc description MUST explicitly mention which characters from the Grand Saga will be featured in this arc',
    'CRITICAL - Character Roles: If characters are mentioned in the Grand Saga, they must play meaningful roles - do not ignore them or create unrelated characters',
    'Grand Saga Advancement: The arc must advance the Grand Saga narrative and feature its key characters as established in the Grand Saga',
    'Pacing Considerations: Consider the pacing recommendations and tension evolution patterns from previous arcs',
    'Power Scaling (if applicable): If this is a cultivation/power progression story, ensure appropriate power scaling that respects established progression patterns',
    'Conflict Escalation: Maintain conflict escalation patterns - stakes should generally increase or stay consistent across arcs',
    'Emotional Development: Ensure the protagonist\'s emotional journey continues to evolve and grow in meaningful ways',
    'Theme Consistency: Uphold established themes while allowing for natural thematic development and evolution',
    `Arc Length Determination (targetChapters): Calculate appropriate length based on:`,
    `  • Complexity: How many unresolved elements, plot threads, and character arcs need attention`,
    `  • Scope: Major arc (15-30 chapters), medium arc (10-15 chapters), or focused arc (5-10 chapters)`,
    `  • Historical patterns: Average previous arc length is ${context.arcContext?.progressionAnalysis.pacingAnalysis.averageArcLength || 10} chapters`,
    `  • Suggested target: ${suggestedTargetChapters} chapters (calculated from comprehensive complexity analysis)`,
    `  • Adjust as needed: Simple arcs resolving few threads may be shorter; complex arcs with many elements may be longer`,
    `  • Arc goals: What does this arc need to achieve? More goals typically require more chapters`,
  ];

  const builtPrompt = await buildPrompt(state, {
    role: 'You are a master plot architect specializing in Xianxia, Xuanhuan, and System epics. You excel at designing compelling narrative arcs that maintain momentum, build on established character journeys, resolve ongoing plot threads, and advance the overall story while developing characters and world-building. Your expertise includes three-act structure, tension curves, setup and payoff, and creating arcs that feel both surprising and inevitable.',
    taskDescription,
    userInstruction: 'Create a compelling arc plan that meaningfully advances the story while building on all previous arc context and character development.',
    outputFormat,
    specificConstraints,
  }, {
    includeFullContext: false,
    maxContextLength: 3000,
    prioritizeRecent: true,
    includeStyleGuidelines: false,
    includeCharacterDevelopment: true,
    includeStoryProgression: true,
    includeArcHistory: true,
  });

  return {
    ...builtPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
}

/**
 * Determines comprehensive arc needs based on full story context
 */
function determineComprehensiveArcNeeds(
  state: NovelState,
  context: any
): string {
  const completedArcs = state.plotLedger.filter(a => a.status === 'completed');
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  const recentChapters = state.chapters.slice(-5);
  const arcType = detectArcType(state, context.arcContext);

  if (state.chapters.length === 0) {
    // First arc - emphasize Grand Saga and its characters
    const needs: string[] = [];
    needs.push('ARC NEEDS: This is the beginning of the story. Plan the opening arc that establishes the protagonist, world, initial conflict, and sets up the Grand Saga.');

    // Extract and list Grand Saga characters
    if (state.grandSaga && state.grandSaga.trim().length > 0) {
      const grandSagaData = getAllGrandSagaCharacterNames(state);
      const grandSagaChars = grandSagaData.inCodex;
      const extractedNames = grandSagaData.notInCodex;

      needs.push('\nGRAND SAGA CONTEXT:');
      needs.push(`Full Grand Saga: "${state.grandSaga}"`);

      if (grandSagaChars.length > 0 || extractedNames.length > 0) {
        needs.push('\nCHARACTERS TO FEATURE FROM GRAND SAGA:');
        needs.push('This opening arc MUST introduce and establish the characters mentioned in the Grand Saga.');

        if (grandSagaChars.length > 0) {
          needs.push('\nCharacters from Grand Saga (already in character codex):');
          grandSagaChars.forEach(char => {
            needs.push(`  - ${char.name}${char.isProtagonist ? ' (Protagonist)' : ''}`);
            if (char.personality) {
              needs.push(`    Personality: ${char.personality.substring(0, 150)}`);
            }
            if (char.notes) {
              needs.push(`    Notes: ${char.notes.substring(0, 150)}`);
            }
          });
        }

        if (extractedNames.length > 0) {
          needs.push('\nPotential characters mentioned in Grand Saga (should be introduced in this arc):');
          extractedNames.forEach(extracted => {
            needs.push(`  - ${extracted.name} (mentioned in: "${extracted.context.substring(0, 100)}...")`);
          });
          needs.push('NOTE: These characters should be introduced and established in this opening arc.');
        }

        needs.push('\nCRITICAL REQUIREMENTS FOR OPENING ARC:');
        needs.push('1. The arc MUST introduce and establish ALL characters mentioned in the Grand Saga');
        needs.push('2. The arc MUST set up the Grand Saga narrative and its key themes');
        needs.push('3. The arc MUST feature these characters prominently - do not create unrelated characters');
        needs.push('4. The arc description MUST explicitly mention which Grand Saga characters will be featured');
      } else {
        needs.push('\nNOTE: No specific character names detected in Grand Saga.');
        needs.push('Focus on establishing the protagonist, world, and initial conflict that sets up the Grand Saga narrative.');
      }
    } else {
      needs.push('\nNOTE: No Grand Saga defined yet. Focus on establishing the protagonist, world, and initial conflict.');
    }

    return needs.join('\n');
  }

  let needs: string[] = [];

  // Add arc type context
  const arcTypeDescriptions: Record<ReturnType<typeof detectArcType>, string> = {
    'opening': 'Focus: Extensive world-building, character introduction, establishing initial conflict and Grand Saga setup. Needs more chapters (12-18) for proper establishment.',
    'setup': 'Focus: Introduces new elements, locations, characters, or conflicts. Establishes groundwork for future arcs.',
    'development': 'Focus: Advances plot threads, deepens character relationships, and builds tension. Core narrative progression.',
    'climax': 'Focus: Peak tension, major conflict resolution, significant aftermath handling. Needs more chapters (15-25) for proper resolution.',
    'denouement': 'Focus: Resolving remaining threads, providing closure. Shorter format (6-12 chapters) focusing on aftermath.',
    'interlude': 'Focus: Brief respite, character moments, world-building moments. Shorter format (5-8 chapters).',
    'transition': 'Focus: Bridging between major arcs, resolving some threads while setting up new conflicts.'
  };

  needs.push(`\nARC TYPE: ${arcType.charAt(0).toUpperCase() + arcType.slice(1)} Arc`);
  needs.push(arcTypeDescriptions[arcType]);

  // Add story position context
  const totalChapters = state.chapters.length;
  const estimatedStoryLength = totalChapters > 20
    ? Math.max(60, totalChapters * 2)
    : 60;
  const storyPosition = Math.round((totalChapters / estimatedStoryLength) * 100);
  needs.push(`\nSTORY POSITION: Approximately ${storyPosition}% through estimated story length.`);

  if (storyPosition < 30) {
    needs.push('Early story - Focus on world-building, character introduction, and establishing foundational conflicts.');
  } else if (storyPosition < 70) {
    needs.push('Mid story - Focus on developing conflicts, deepening relationships, and building toward climax.');
  } else if (storyPosition < 90) {
    needs.push('Late story - Building toward major climax. Resolve accumulated threads while maintaining tension.');
  } else {
    needs.push('Final story - Resolving remaining threads and providing satisfying conclusion.');
  }

  // SUGGESTED NARRATIVE ARCHETYPES
  if (context.arcContext) {
    const archetypes = detectSuggestedArchetypes(state, context.arcContext);
    if (archetypes.length > 0) {
      needs.push('\n[SUGGESTED NARRATIVE ARCHETYPES]');
      needs.push('Based on the current story state, unresolved threads, and plot rhythm, consider these archetypes:');
      archetypes.forEach(arch => {
        needs.push(`\n• **${arch.type.toUpperCase().replace('_', ' ')}** (Confidence: ${Math.round(arch.confidence * 100)}%)`);
        needs.push(`  Why: ${arch.reasoning}`);
        needs.push(`  Focus: ${arch.focus}`);
      });
      needs.push('\nYou are NOT required to choose one of these transparency, but if one fits naturally, it will likely improve narrative variety.');
    }
  }

  // STORY BRIDGE CONTEXT (Connecting recent events to new arc)
  const lastTenChapters = state.chapters.slice(-10);
  if (lastTenChapters.length > 0) {
    needs.push('\n[STORY BRIDGE CONTEXT - RECENT EVENTS]');
    needs.push('The new arc must follow logically from these recent events (Law of Causality):');
    lastTenChapters.forEach(ch => {
      needs.push(`  Ch ${ch.number}: ${ch.summary || ch.title}`);
    });
  }

  // Handle active arc situation
  if (activeArc) {
    needs.push(`CURRENT STATUS: There is an active arc "${activeArc.title}" in progress.`);
    needs.push(`Plan the next arc that will follow after this arc completes, considering how the current arc will likely resolve.`);

    if (activeArc.checklist) {
      const incompleteItems = activeArc.checklist.filter(item => !item.completed);
      if (incompleteItems.length > 0) {
        needs.push(`The current arc has ${incompleteItems.length} incomplete checklist items that may need resolution before transitioning.`);
      }
    }
  } else if (completedArcs.length > 0) {
    needs.push(`CURRENT STATUS: Ready to plan a new arc following ${completedArcs.length} completed arc(s).`);
  }

  // Analyze previous arc context
  if (context.arcContext && context.arcContext.arcSummaries.length > 0) {
    const recentArcs = context.arcContext.arcSummaries.filter(s => s.tier === 'recent');

    if (recentArcs.length > 0) {
      const mostRecent = recentArcs[recentArcs.length - 1];
      needs.push(`\nMOST RECENT ARC CONTEXT: "${mostRecent.title}"`);
      needs.push(`Tension Pattern: Started at ${mostRecent.tensionCurve.startLevel}, ended at ${mostRecent.tensionCurve.endLevel}`);

      if (mostRecent.unresolvedElements.length > 0) {
        needs.push(`CRITICAL: The previous arc left ${mostRecent.unresolvedElements.length} unresolved elements that should be addressed:`);
        // Extract just the element text (remove priority labels for display)
        const displayElements = mostRecent.unresolvedElements.slice(0, 5).map(elem => {
          // Remove [HIGH PRIORITY] or [MEDIUM] labels if present
          return elem.replace(/^\[(HIGH PRIORITY|MEDIUM|LOW)\]\s*/, '');
        });
        displayElements.forEach(elem => {
          needs.push(`  - ${elem}`);
        });
        needs.push(`The new arc should either resolve these elements or meaningfully advance them.`);

        // Count high priority elements
        const highPriorityCount = mostRecent.unresolvedElements.filter(e =>
          e.includes('[HIGH PRIORITY]')
        ).length;
        if (highPriorityCount > 0) {
          needs.push(`NOTE: ${highPriorityCount} of these are high-priority and should be addressed early in the new arc.`);
        }
      }

      needs.push(`Arc Outcome: ${mostRecent.arcOutcome.substring(0, 200)}`);
      needs.push(`The new arc must build directly on this outcome and continue the narrative momentum.`);
    }

    // Character development needs
    if (context.arcContext.characterArcJourneys.length > 0) {
      needs.push(`\nCHARACTER DEVELOPMENT CONTINUITY:`);
      const mainCharacters = context.arcContext.characterArcJourneys
        .filter(j => j.arcJourneys.length > 0)
        .slice(0, 3);

      mainCharacters.forEach(journey => {
        const recentJourney = journey.arcJourneys[journey.arcJourneys.length - 1];
        if (recentJourney && recentJourney.keyChanges.length > 0) {
          needs.push(`  - ${journey.characterName}: Recently experienced "${recentJourney.keyChanges[0]}". The new arc should continue this character's development journey.`);
        }
      });
    }

    // Progression analysis recommendations
    const progression = context.arcContext.progressionAnalysis;
    if (progression.pacingAnalysis.recommendations.length > 0) {
      needs.push(`\nPACING RECOMMENDATIONS:`);
      progression.pacingAnalysis.recommendations.forEach(rec => {
        needs.push(`  - ${rec}`);
      });
    }

    if (progression.completionPatterns.unresolvedElements > 5) {
      needs.push(`\nWARNING: There are ${progression.completionPatterns.unresolvedElements} unresolved elements across all arcs.`);
      needs.push(`Consider addressing some of these in the new arc to maintain narrative coherence.`);
    }

    // Tension flow
    if (progression.tensionEvolution.length > 0) {
      const lastTension = progression.tensionEvolution[progression.tensionEvolution.length - 1];
      needs.push(`\nTENSION FLOW: The last arc ended at "${lastTension.tensionCurve.endLevel}" tension.`);
      needs.push(`Consider an appropriate tension transition - typically following a high-tension arc with a brief respite before building again, or continuing the momentum if the story demands it.`);
    }

    // Power scaling for cultivation novels
    if (progression.powerScalingPattern) {
      const lastPower = progression.powerScalingPattern.progression[progression.powerScalingPattern.progression.length - 1];
      if (lastPower) {
        needs.push(`\nPOWER PROGRESSION: Last arc power level was "${lastPower.powerLevel}".`);
        needs.push(`The new arc should maintain appropriate power scaling. ${lastPower.breakthrough ? 'A recent breakthrough occurred, so allow time for stabilization.' : 'Consider whether a breakthrough is appropriate in this arc.'}`);
      }
    }
  }

  // Current story state
  if (context.narrativeContext.activePlotThreads && context.narrativeContext.activePlotThreads.length > 0) {
    needs.push(`\nACTIVE PLOT THREADS:`);
    context.narrativeContext.activePlotThreads.slice(0, 5).forEach(thread => {
      needs.push(`  - ${thread}`);
    });
    needs.push(`The new arc should advance or resolve some of these threads.`);
  }

  // Recent chapter analysis
  if (recentChapters.length > 0) {
    const lastChapter = recentChapters[recentChapters.length - 1];
    if (lastChapter.logicAudit) {
      needs.push(`\nRECENT NARRATIVE MOMENTUM:`);
      needs.push(`Last chapter ended with: "${lastChapter.logicAudit.resultingValue}" (${lastChapter.logicAudit.causalityType} logic)`);
      if (lastChapter.logicAudit.causalityType === 'But') {
        needs.push(`There's active conflict/disruption. The new arc should address the consequences.`);
      } else {
        needs.push(`There's logical progression. The new arc can build on this foundation or introduce new challenges.`);
      }
    }
  }

  return needs.join('\n');
}