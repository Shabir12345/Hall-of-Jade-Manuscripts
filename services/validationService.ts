import { NovelState } from '../types';
import { ValidationResult, ImprovementExecutionResult } from '../types/improvement';
import { WorldBibleExtractor } from './worldBibleExtractor';
import { ContinuityValidator } from './continuityValidator';
import { analyzeCategoryWeaknesses } from './improvementStrategyGenerator';

/**
 * Validation Service
 * Comprehensive validation of improved state and improvements
 */
export class ValidationService {
  /**
   * Validates improved state comprehensively
   */
  static validateImprovedState(
    originalState: NovelState,
    improvedState: NovelState,
    category: string
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic structure validation
    if (!improvedState.id) {
      errors.push('Improved state missing ID');
    }

    if (improvedState.id !== originalState.id) {
      errors.push('Improved state ID does not match original state ID');
    }

    if (!improvedState.chapters || improvedState.chapters.length === 0) {
      errors.push('Improved state has no chapters');
    }

    // Check for significant chapter loss
    if (improvedState.chapters.length < originalState.chapters.length * 0.5) {
      errors.push(`Chapter count reduced significantly (${originalState.chapters.length} → ${improvedState.chapters.length})`);
    }

    // Check for unexpected chapter gain (more than 50% increase)
    if (improvedState.chapters.length > originalState.chapters.length * 1.5) {
      warnings.push(`Chapter count increased significantly (${originalState.chapters.length} → ${improvedState.chapters.length})`);
    }

    // Validate chapter structure
    improvedState.chapters.forEach((chapter, index) => {
      if (!chapter.id) {
        warnings.push(`Improved chapter ${index + 1} is missing an ID`);
      }
      if (!chapter.content || chapter.content.trim().length === 0) {
        errors.push(`Improved chapter ${index + 1} has empty content`);
      }
      if (chapter.content && chapter.content.length < 100) {
        warnings.push(`Improved chapter ${index + 1} has very little content (${chapter.content.length} characters)`);
      }
    });

    // Validate World Bible constants
    const constants = WorldBibleExtractor.extractStoryConstants(originalState);
    const violations = WorldBibleExtractor.validateAgainstConstants(
      improvedState.chapters.map(ch => ch.content).join(' '),
      constants
    );

    violations.forEach(violation => {
      if (violation.severity === 'critical') {
        errors.push(`World Bible violation: ${violation.issue}`);
      } else {
        warnings.push(`World Bible warning: ${violation.issue}`);
      }
    });

    // Validate continuity
    const continuityValidation = ContinuityValidator.validateNovelContinuity(improvedState);
    if (!continuityValidation.valid) {
      warnings.push(`Continuity issues detected: ${continuityValidation.issues.length} issue(s)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detects logical contradictions using analysis
   * (Full LLM-based detection would be implemented separately)
   */
  static detectLogicalContradictions(
    originalState: NovelState,
    improvedState: NovelState
  ): { hasContradictions: boolean; contradictions: string[] } {
    const contradictions: string[] = [];

    // Basic contradiction detection
    // Check for character name changes
    const originalCharacters = originalState.characterCodex.map(c => c.name);
    const improvedCharacters = improvedState.characterCodex.map(c => c.name);
    
    const missingCharacters = originalCharacters.filter(name => !improvedCharacters.includes(name));
    if (missingCharacters.length > 0) {
      contradictions.push(`Characters removed: ${missingCharacters.join(', ')}`);
    }

    // Check for major plot inconsistencies
    // (Simplified - full detection would use LLM to analyze content)

    return {
      hasContradictions: contradictions.length > 0,
      contradictions,
    };
  }

  /**
   * Validates that score actually improved
   */
  static validateScoreImprovement(
    originalState: NovelState,
    improvedState: NovelState,
    category: string,
    executionResult: ImprovementExecutionResult
  ): { improved: boolean; scoreChange: number; message: string } {
    const originalWeaknesses = analyzeCategoryWeaknesses(originalState, category as any);
    const improvedWeaknesses = analyzeCategoryWeaknesses(improvedState, category as any);

    const originalScore = originalWeaknesses.overallScore;
    const improvedScore = improvedWeaknesses.overallScore;
    const scoreChange = improvedScore - originalScore;

    const improved = scoreChange > 0;

    let message = '';
    if (improved) {
      message = `Score improved from ${originalScore} to ${improvedScore} (+${scoreChange})`;
    } else if (scoreChange === 0) {
      message = `Score unchanged at ${originalScore}`;
    } else {
      message = `Score decreased from ${originalScore} to ${improvedScore} (${scoreChange})`;
    }

    return {
      improved,
      scoreChange,
      message,
    };
  }

  /**
   * Comprehensive validation of improvement execution
   */
  static validateImprovementExecution(
    originalState: NovelState,
    improvedState: NovelState,
    executionResult: ImprovementExecutionResult
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate state structure
    const stateValidation = this.validateImprovedState(
      originalState,
      improvedState,
      executionResult.category
    );
    errors.push(...stateValidation.errors);
    warnings.push(...stateValidation.warnings);

    // Check for logical contradictions
    const contradictions = this.detectLogicalContradictions(originalState, improvedState);
    if (contradictions.hasContradictions) {
      errors.push(...contradictions.contradictions);
    }

    // Validate score improvement
    const scoreValidation = this.validateScoreImprovement(
      originalState,
      improvedState,
      executionResult.category,
      executionResult
    );
    
    if (!scoreValidation.improved && executionResult.scoreImprovement <= 0) {
      warnings.push(`Score did not improve: ${scoreValidation.message}`);
    }

    // Check execution success
    if (!executionResult.success) {
      errors.push(`Improvement execution failed: ${executionResult.summary}`);
    }

    // Check for too many failures
    if (executionResult.actionsFailed > executionResult.actionsSucceeded) {
      warnings.push(`More actions failed (${executionResult.actionsFailed}) than succeeded (${executionResult.actionsSucceeded})`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      scoreImprovement: executionResult.scoreImprovement,
      goalsMet: executionResult.validationResults.allGoalsMet,
    };
  }
}
