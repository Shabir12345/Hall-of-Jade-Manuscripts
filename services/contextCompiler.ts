/**
 * Context Compiler
 * 
 * Compiles retrieved context into structured format for LLM.
 * Organizes by priority and implements smart summarization to stay within token limits.
 */

import { RetrievedContext } from './semanticContextRetriever';

export interface CompiledContext {
  criticalState: string; // Current power levels, character status, active relationships
  recentContext: string; // Last 2-3 chapters' key events
  relevantHistory: string; // Older chapters' relevant events (summarized)
  worldRules: string; // Applicable world bible entries, power system rules
  totalTokens: number; // Estimated token count
}

export interface CompilationOptions {
  maxTokens?: number; // Maximum tokens for context (default: 3000)
  includePowerProgression?: boolean;
  includeRelationships?: boolean;
  includeWorldRules?: boolean;
  prioritizeRecent?: boolean;
}

export class ContextCompiler {
  private readonly TOKENS_PER_CHAR = 0.25; // Rough estimate: 4 chars per token

  /**
   * Compile context into structured format
   */
  compileContext(
    retrieved: RetrievedContext,
    options: CompilationOptions = {}
  ): CompiledContext {
    const maxTokens = options.maxTokens || 3000;
    const compiled: CompiledContext = {
      criticalState: '',
      recentContext: '',
      relevantHistory: '',
      worldRules: '',
      totalTokens: 0,
    };

    // 1. Critical State (highest priority)
    compiled.criticalState = this.compileCriticalState(retrieved, options);
    let usedTokens = this.estimateTokens(compiled.criticalState);

    // 2. Recent Context
    if (usedTokens < maxTokens * 0.4) {
      compiled.recentContext = this.compileRecentContext(retrieved, maxTokens * 0.3 - usedTokens);
      usedTokens += this.estimateTokens(compiled.recentContext);
    }

    // 3. Relevant History (summarized)
    if (usedTokens < maxTokens * 0.7) {
      compiled.relevantHistory = this.compileRelevantHistory(retrieved, maxTokens * 0.2 - (usedTokens - maxTokens * 0.4));
      usedTokens += this.estimateTokens(compiled.relevantHistory);
    }

    // 4. World Rules
    if (options.includeWorldRules !== false && usedTokens < maxTokens * 0.9) {
      compiled.worldRules = this.compileWorldRules(retrieved, maxTokens - usedTokens);
      usedTokens += this.estimateTokens(compiled.worldRules);
    }

    compiled.totalTokens = usedTokens;
    return compiled;
  }

  /**
   * Compile critical state section
   */
  private compileCriticalState(retrieved: RetrievedContext, options: CompilationOptions): string {
    const sections: string[] = [];

    sections.push('[CRITICAL STATE - MUST MAINTAIN CONSISTENCY]');
    sections.push('These are the CURRENT states that MUST be maintained in the next chapter:');
    sections.push('');

    // Character states (prioritize protagonists and recently updated)
    const sortedCharacters = [...retrieved.characters].sort((a, b) => {
      // Protagonists first
      if (a.character.isProtagonist && !b.character.isProtagonist) return -1;
      if (!a.character.isProtagonist && b.character.isProtagonist) return 1;
      // Then by relevance score
      return b.relevanceScore - a.relevanceScore;
    });

    sections.push('CHARACTERS (Current State):');
    sortedCharacters.slice(0, 10).forEach(({ character, context }) => {
      sections.push(context);
      sections.push('');
    });

    // Power level progression
    if (options.includePowerProgression !== false && retrieved.powerLevelProgression.length > 0) {
      sections.push('POWER LEVEL PROGRESSION:');
      retrieved.powerLevelProgression.forEach(prog => {
        sections.push(`${prog.characterName}: ${prog.currentLevel}`);
        if (prog.progression) {
          sections.push(`  History: ${prog.progression}`);
        }
      });
      sections.push('');
    }

    // Active relationships
    if (options.includeRelationships !== false && retrieved.relationships.length > 0) {
      sections.push('ACTIVE RELATIONSHIPS:');
      retrieved.relationships.slice(0, 15).forEach(rel => {
        sections.push(`${rel.character1Name} ↔ ${rel.character2Name}: ${rel.relationshipType}`);
        if (rel.history) {
          sections.push(`  ${rel.history.substring(0, 100)}`);
        }
      });
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * Compile recent context section
   */
  private compileRecentContext(retrieved: RetrievedContext, maxTokens: number): string {
    const sections: string[] = [];
    sections.push('[RECENT CONTEXT]');
    sections.push('');

    let usedTokens = this.estimateTokens(sections.join('\n'));

    retrieved.recentEvents.forEach(event => {
      const eventText = `Chapter ${event.chapterNumber}: ${event.summary}`;
      const eventTokens = this.estimateTokens(eventText);

      if (usedTokens + eventTokens <= maxTokens) {
        sections.push(eventText);
        usedTokens += eventTokens;
      }
    });

    return sections.join('\n');
  }

  /**
   * Compile relevant history (summarized)
   */
  private compileRelevantHistory(retrieved: RetrievedContext, maxTokens: number): string {
    const sections: string[] = [];
    sections.push('[RELEVANT HISTORY]');
    sections.push('');

    // Summarize scenes
    if (retrieved.scenes.length > 0) {
      sections.push('Key Scenes:');
      let usedTokens = this.estimateTokens(sections.join('\n'));

      retrieved.scenes.slice(0, 5).forEach(scene => {
        const sceneText = `Ch ${scene.chapterNumber}, Scene ${scene.sceneNumber}: ${scene.title} - ${scene.summary.substring(0, 150)}`;
        const sceneTokens = this.estimateTokens(sceneText);

        if (usedTokens + sceneTokens <= maxTokens) {
          sections.push(sceneText);
          usedTokens += sceneTokens;
        }
      });
    }

    return sections.join('\n');
  }

  /**
   * Compile world rules section
   */
  private compileWorldRules(retrieved: RetrievedContext, maxTokens: number): string {
    const sections: string[] = [];
    sections.push('[WORLD RULES]');
    sections.push('');

    let usedTokens = this.estimateTokens(sections.join('\n'));

    // Sort by relevance and include top rules
    const sortedRules = [...retrieved.worldRules].sort((a, b) => b.relevanceScore - a.relevanceScore);

    sortedRules.slice(0, 8).forEach(rule => {
      const ruleText = `[${rule.category}] ${rule.title}\n${rule.content.substring(0, 200)}`;
      const ruleTokens = this.estimateTokens(ruleText);

      if (usedTokens + ruleTokens <= maxTokens) {
        sections.push(ruleText);
        sections.push('');
        usedTokens += ruleTokens;
      }
    });

    return sections.join('\n');
  }

  /**
   * Format complete context for prompt
   */
  formatForPrompt(compiled: CompiledContext): string {
    const sections: string[] = [];

    if (compiled.criticalState) {
      sections.push(compiled.criticalState);
      sections.push('');
    }

    if (compiled.recentContext) {
      sections.push(compiled.recentContext);
      sections.push('');
    }

    if (compiled.relevantHistory) {
      sections.push(compiled.relevantHistory);
      sections.push('');
    }

    if (compiled.worldRules) {
      sections.push(compiled.worldRules);
    }

    return sections.join('\n');
  }

  /**
   * Validate context completeness
   */
  validateCompleteness(
    compiled: CompiledContext,
    requiredCharacters: string[]
  ): {
    complete: boolean;
    missing: string[];
    warnings: string[];
  } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check if all required characters are in context
    requiredCharacters.forEach(charId => {
      if (!compiled.criticalState.includes(charId) && !compiled.criticalState.includes(charId)) {
        missing.push(charId);
      }
    });

    // Check token usage
    if (compiled.totalTokens > (compiled.totalTokens * 1.1)) {
      warnings.push('Context is approaching token limit. Consider summarizing further.');
    }

    return {
      complete: missing.length === 0,
      missing,
      warnings,
    };
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * this.TOKENS_PER_CHAR);
  }
}

// Singleton instance
let compilerInstance: ContextCompiler | null = null;

export function getContextCompiler(): ContextCompiler {
  if (!compilerInstance) {
    compilerInstance = new ContextCompiler();
  }
  return compilerInstance;
}
