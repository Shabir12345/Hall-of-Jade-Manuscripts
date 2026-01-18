/**
 * Detector Feedback Service
 * 
 * Implements reinforcement learning-style feedback loop using
 * detection scores as reward signals for iterative improvement.
 * 
 * Based on AuthorMist research showing RL-based paraphrasing
 * reduces detectability by 80-90% while preserving meaning.
 */

import { grokText } from "./grokService";
import { rateLimiter } from "./rateLimiter";
import { checkMultipleDetectors, getChapterDetectionScore } from "./multiDetectorService";
import { AI_DETECTION_CONFIG } from "../constants";

export interface RLFeedbackResult {
  initialScore: number;
  finalScore: number;
  improvement: number;
  iterations: number;
  converged: boolean;
  finalText: string;
}

/**
 * Performs RL-based iterative improvement using detector feedback
 */
export async function improveWithRLFeedback(
  text: string,
  state: { id: string; chapters: unknown[] },
  maxIterations: number = 3,
  targetScore: number = 20
): Promise<RLFeedbackResult> {
  let currentText = text;
  let currentScore = await getChapterDetectionScore(text);
  const initialScore = currentScore;
  
  let iterations = 0;
  let converged = false;
  
  console.log(`[RL Feedback] Initial detection score: ${currentScore}% (target: ${targetScore}%)`);
  
  // Iterate until target score is reached or max iterations
  while (iterations < maxIterations && currentScore > targetScore) {
    iterations++;
    
    console.log(`[RL Feedback] Iteration ${iterations}/${maxIterations}, current score: ${currentScore}%`);
    
    // Calculate improvement needed
    const improvementNeeded = currentScore - targetScore;
    const improvementPercent = (improvementNeeded / currentScore) * 100;
    
    // Determine aggressiveness based on score
    let aggressiveness = 'moderate';
    if (currentScore > 60) {
      aggressiveness = 'very aggressive';
    } else if (currentScore > 40) {
      aggressiveness = 'aggressive';
    } else if (currentScore > 25) {
      aggressiveness = 'moderate';
    } else {
      aggressiveness = 'subtle';
    }
    
    // Get detailed feedback from multi-detector
    const detectorResult = await checkMultipleDetectors(currentText, {
      useInternalHeuristic: true,
    });
    
    // Build improvement prompt
    const improvementPrompt = `REINFORCEMENT LEARNING PARAPHRASING PASS:
Rewrite this text to reduce AI detection score from ${currentScore}% to below ${targetScore}%.

Current detection score: ${currentScore}%
Target score: <${targetScore}%
Improvement needed: ${improvementNeeded}% (${improvementPercent.toFixed(1)}% reduction)

Detector feedback:
${detectorResult.recommendations.map(r => `- ${r}`).join('\n')}

Original text:
${currentText}

PARAPHRASING STRATEGY (${aggressiveness}):
${aggressiveness === 'very aggressive' ? `
1. Dramatically restructure sentences - change clause order, break all patterns
2. Replace ALL common AI-typical phrases with highly varied alternatives
3. Add significant human quirks: informal language, imperfections, filler words
4. Extreme sentence rhythm variation: mix 2-word fragments with 50+ word sentences
5. Break ALL n-gram patterns - no repeating 3-word or 4-word phrases
6. Add contractions, colloquialisms, and dialectal phrasing
7. Include emotional texture, personal observations, rhetorical questions
8. Vary formality levels dramatically within the text
` : aggressiveness === 'aggressive' ? `
1. Restructure sentences significantly - change clause order, break patterns
2. Replace common AI-typical phrases with varied alternatives
3. Add human quirks: informal language, imperfections, filler words
4. Strong sentence rhythm variation: mix 3-word fragments with 40+ word sentences
5. Break n-gram patterns - avoid repeating 3-word or 4-word phrases
6. Add contractions and colloquialisms naturally
7. Include emotional texture and personal touches
8. Vary formality levels
` : aggressiveness === 'moderate' ? `
1. Restructure sentences - change clause order where natural
2. Replace predictable phrases with more varied alternatives
3. Add subtle human quirks: occasional imperfections, filler words
4. Vary sentence rhythm: mix fragments with longer sentences
5. Avoid repeating common n-gram patterns
6. Add some contractions naturally
7. Include emotional texture
` : `
1. Subtle sentence restructuring
2. Replace a few predictable phrases
3. Add minimal human quirks
4. Slight sentence rhythm variation
5. Minor n-gram pattern breaking
`}

CRITICAL REQUIREMENTS:
- Maintain the exact same meaning and story
- Preserve character voices and narrative style
- Keep all plot points and events identical
- Only change phrasing, structure, and word choice
- Target: Reduce detection score by at least ${Math.max(5, improvementNeeded * 0.3).toFixed(0)}%

Return ONLY the rewritten text (no JSON, no explanations).`;

    try {
      const improvedText = await rateLimiter.queueRequest('generate', async () => {
        const temperature = aggressiveness === 'very aggressive' ? 0.9 : aggressiveness === 'aggressive' ? 0.85 : 0.8;
        return await grokText({
          system: 'You are a professional editor specializing in making AI-generated text appear human-written while preserving meaning.',
          user: improvementPrompt,
          temperature,
          topP: 0.95,
          maxTokens: 8192,
        });
      }, `rl-feedback-${state.id}-${iterations}`);
      
      const trimmedText = improvedText?.trim() || currentText;
      
      if (!trimmedText || trimmedText.length < 100) {
        console.warn(`[RL Feedback] Iteration ${iterations} produced invalid text, keeping previous version`);
        continue;
      }
      
      // Check new score
      const newScore = await getChapterDetectionScore(trimmedText);
      const improvement = currentScore - newScore;
      
      console.log(`[RL Feedback] Iteration ${iterations} result: ${newScore}% (improvement: ${improvement > 0 ? '+' : ''}${improvement}%)`);
      
      // Only accept if improved or if we're close to target
      if (newScore < currentScore || (newScore <= targetScore + 5 && newScore < currentScore + 5)) {
        currentText = trimmedText;
        currentScore = newScore;
        
        // Check if converged (score is good enough)
        if (currentScore <= targetScore) {
          converged = true;
          console.log(`[RL Feedback] Converged at iteration ${iterations} with score ${currentScore}%`);
          break;
        }
        
        // Check if improvement is too small (converged to local minimum)
        if (improvement < 2 && iterations >= 2) {
          console.log(`[RL Feedback] Converged to local minimum at iteration ${iterations} (improvement: ${improvement}%)`);
          converged = true;
          break;
        }
      } else {
        console.log(`[RL Feedback] Iteration ${iterations} did not improve score, keeping previous version`);
      }
    } catch (error) {
      console.warn(`[RL Feedback] Iteration ${iterations} failed:`, error);
      // Continue with current text
    }
  }
  
  const finalImprovement = initialScore - currentScore;
  
  return {
    initialScore,
    finalScore: currentScore,
    improvement: finalImprovement,
    iterations,
    converged,
    finalText: currentText,
  };
}

/**
 * Applies RL feedback to a chapter if detection score is too high
 */
export async function applyRLFeedbackIfNeeded(
  chapterContent: string,
  state: { id: string; chapters: unknown[] }
): Promise<string> {
  if (!AI_DETECTION_CONFIG.adversarialParaphrasing?.enabled) {
    return chapterContent;
  }
  
  const targetScore = AI_DETECTION_CONFIG.adversarialParaphrasing.targetScore || 20;
  const maxIterations = AI_DETECTION_CONFIG.adversarialParaphrasing.maxIterations || 2;
  
  // Check initial score
  const initialScore = await getChapterDetectionScore(chapterContent);
  
  if (initialScore <= targetScore) {
    console.log(`[RL Feedback] Score ${initialScore}% already below target ${targetScore}%, skipping RL feedback`);
    return chapterContent;
  }
  
  console.log(`[RL Feedback] Score ${initialScore}% above target ${targetScore}%, applying RL feedback...`);
  
  const result = await improveWithRLFeedback(
    chapterContent,
    state,
    maxIterations,
    targetScore
  );
  
  console.log(`[RL Feedback] Final score: ${result.finalScore}% (improvement: ${result.improvement}%)`);
  
  return result.finalText;
}
