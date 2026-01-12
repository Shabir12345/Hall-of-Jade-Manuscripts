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
  detectArcType
} from '../arcContextAnalyzer';

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
    
    // Define arc type descriptions (moved here to be accessible)
    const arcTypeDescriptions: Record<ReturnType<typeof detectArcType>, string> = {
      'opening': 'Focus: Extensive world-building, character introduction, establishing initial conflict and Grand Saga setup. Needs more chapters (12-18) for proper establishment.',
      'setup': 'Focus: Introduces new elements, locations, characters, or conflicts. Establishes groundwork for future arcs.',
      'development': 'Focus: Advances plot threads, deepens character relationships, and builds tension. Core narrative progression.',
      'climax': 'Focus: Peak tension, major conflict resolution, significant aftermath handling. Needs more chapters (15-25) for proper resolution.',
      'denouement': 'Focus: Resolving remaining threads, providing closure. Shorter format (6-12 chapters) focusing on aftermath.',
      'interlude': 'Focus: Brief respite, character moments, world-building moments. Shorter format (5-8 chapters).',
      'transition': 'Focus: Bridging between major arcs, resolving some threads while setting up new conflicts.'
    };
    
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

  const taskDescription = `Plan the next major plot arc for "${state.title}".

ARC TYPE DETECTED: ${arcType.charAt(0).toUpperCase() + arcType.slice(1)} Arc
${arcTypeDescriptions[arcType]}

${arcNeeds}

${arcContextSection ? `\n${arcContextSection}\n` : ''}

The arc must:
- Follow the Law of Causality: connect logically to recent events and previous arc outcomes with "BUT" or "THEREFORE"
- Apply the Principle of the Delta: create meaningful value shifts that build on established character arcs
- Include Internal Friction: characters must face difficult choices that challenge their growth
- Advance the Grand Saga: "${state.grandSaga.substring(0, 300)}"
- Build on Character Development: consider how characters have evolved across previous arcs
- Resolve or Advance Plot Threads: address unresolved elements from previous arcs while introducing new challenges
- Maintain Tension Flow: create appropriate tension transitions based on previous arc patterns
- Follow Three-Act Structure: ensure the arc has clear beginning, middle, and end while fitting into the larger narrative
- Maintain Genre Consistency: uphold established world rules, power systems, and genre conventions
- Create Meaningful Stakes: introduce conflicts that matter to the characters and the overall story
- Escalate Conflicts Appropriately: build on previous conflict escalation patterns while maintaining narrative logic
- Continue Emotional Journey: build on the protagonist's emotional development and provide appropriate emotional moments
- Maintain Theme Consistency: uphold recurring themes while allowing for natural evolution and variation
- Match Arc Type Requirements: As a ${arcType} arc, ensure the arc structure and pacing align with its narrative function (e.g., ${arcType === 'opening' ? 'extensive world-building' : arcType === 'climax' ? 'peak tension and major resolution' : arcType === 'denouement' ? 'resolution and closure' : 'development and progression'})

The arc should feel like a natural, inevitable progression of the story while introducing new challenges, stakes, or developments that feel both surprising and earned.`;

  const outputFormat = `Return a JSON object with this structure:
{
  "arcTitle": "string (compelling, memorable title that reflects the arc's central theme and type - ${arcType} arc)",
  "arcDescription": "string (detailed description of 200-500 words covering: central conflict, character goals, key events, how it builds on previous arcs, tension progression, resolution direction, and how it fulfills its ${arcType} arc function)",
  "targetChapters": number (optimal number of chapters for this ${arcType} arc, considering its complexity, scope, and goals. Suggested target: ${suggestedTargetChapters} chapters (calculated from comprehensive analysis), but you can adjust ±20% based on specific narrative needs. Range: ${arcType === 'denouement' || arcType === 'interlude' ? '5-12' : arcType === 'climax' ? '15-30' : '8-25'} chapters. Your value must be a valid integer between 5 and 35)
}`;

  const specificConstraints = [
    'The arc title should be memorable and reflect the arc\'s central theme',
    'The arc description should be comprehensive (200-500 words) and explicitly address:',
    '  - How this arc builds on the most recent arc\'s outcome',
    '  - Which unresolved elements from previous arcs it addresses',
    '  - How characters will continue to develop based on their journey so far',
    '  - The central conflict and stakes',
    '  - Key events and progression',
    '  - How tension will evolve (start level → peak → resolution)',
    'Ensure the arc aligns with the story\'s genre and established world rules',
    'Maintain continuity with character development patterns across previous arcs',
    'Consider the pacing recommendations and tension evolution from previous arcs',
    'If this is a cultivation/power progression story, ensure appropriate power scaling',
    'Maintain conflict escalation patterns - stakes should generally increase or stay consistent across arcs',
    'Ensure the protagonist\'s emotional journey continues to evolve and grow',
    'Uphold established themes while allowing for natural thematic development',
    `Determine appropriate arc length (targetChapters) based on:`,
    `  - Complexity: How many unresolved elements, plot threads, and character arcs need attention`,
    `  - Scope: Is this a major arc (15-30 chapters), medium arc (10-15 chapters), or focused arc (5-10 chapters)?`,
    `  - Historical patterns: Average previous arc length is ${context.arcContext?.progressionAnalysis.pacingAnalysis.averageArcLength || 10} chapters`,
    `  - Suggested target: ${suggestedTargetChapters} chapters (calculated from complexity analysis)`,
    `  - Adjust as needed: Simple arcs resolving few threads may be shorter. Complex arcs with many elements may be longer.`,
    `  - Arc goals: What does this arc need to achieve? More goals = more chapters needed.`,
  ];

  const builtPrompt = await buildPrompt(state, {
    role: 'You are a master plot architect specializing in Xianxia, Xuanhuan, and System epics. You design compelling arcs that maintain narrative momentum, build on established character journeys, resolve ongoing plot threads, and advance the overall story while developing characters and world. You understand three-act structure, tension curves, setup and payoff, and how to create arcs that feel both surprising and inevitable.',
    taskDescription,
    userInstruction: 'Plan a compelling arc that advances the story meaningfully while building on all previous arc context.',
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
    return 'ARC NEEDS: This is the beginning of the story. Plan the opening arc that establishes the protagonist, world, initial conflict, and sets up the Grand Saga.';
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