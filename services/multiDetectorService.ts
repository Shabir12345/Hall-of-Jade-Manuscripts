/**
 * Multi-Detector Service
 * 
 * Integrates with multiple AI detection APIs to get comprehensive
 * detection scores. Uses worst-case (highest) score for decisions.
 * 
 * Note: This is a framework for integration. Actual API keys would
 * need to be configured in environment variables.
 */

export interface DetectorResult {
  detectorName: string;
  score: number; // 0-100, higher = more AI-like
  confidence?: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface MultiDetectorResult {
  results: DetectorResult[];
  worstCaseScore: number; // Highest score (most AI-like)
  averageScore: number;
  bestCaseScore: number; // Lowest score (least AI-like)
  recommendations: string[];
}

/**
 * Simulates detection from GPTZero API
 * In production, this would make actual API calls
 */
async function checkGPTZero(text: string): Promise<DetectorResult> {
  // Simulated - would use actual GPTZero API
  // const response = await fetch('https://api.gptzero.me/v2/predict/text', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'X-API-Key': process.env.GPTZERO_API_KEY },
  //   body: JSON.stringify({ document: text })
  // });
  
  // For now, return a placeholder
  return {
    detectorName: 'GPTZero',
    score: 0, // Would be calculated from API response
    confidence: 0,
    error: 'API key not configured',
  };
}

/**
 * Simulates detection from Originality.ai API
 * In production, this would make actual API calls
 */
async function checkOriginalityAI(text: string): Promise<DetectorResult> {
  // Simulated - would use actual Originality.ai API
  // const response = await fetch('https://api.originality.ai/api/v1/scan/ai', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'X-OAI-API-KEY': process.env.ORIGINALITY_API_KEY },
  //   body: JSON.stringify({ content: text })
  // });
  
  return {
    detectorName: 'Originality.ai',
    score: 0,
    confidence: 0,
    error: 'API key not configured',
  };
}

/**
 * Simulates detection from ZeroGPT API
 * In production, this would make actual API calls
 */
async function checkZeroGPT(text: string): Promise<DetectorResult> {
  // Simulated - would use actual ZeroGPT API
  // const response = await fetch('https://api.zerogpt.com/detect', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.ZEROGPT_API_KEY}` },
  //   body: JSON.stringify({ text })
  // });
  
  return {
    detectorName: 'ZeroGPT',
    score: 0,
    confidence: 0,
    error: 'API key not configured',
  };
}

/**
 * Internal heuristic-based detector
 * Uses our own metrics as a fallback
 */
async function checkInternalHeuristic(text: string): Promise<DetectorResult> {
  try {
    const { analyzeNGramUnpredictability } = await import('./nGramAnalyzer');
    const { analyzeLexicalBalance } = await import('./lexicalBalanceAnalyzer');
    const { validateBurstinessPattern } = await import('../utils/burstinessValidator');
    const { checkForForbiddenWords, checkForForbiddenStructures } = await import('../utils/aiDetectionBlacklist');
    const { verifyPerplexityThreshold } = await import('./perplexityVerification');
    const { AI_DETECTION_CONFIG } = await import('../constants');
    
    // Calculate various metrics
    const ngramMetrics = analyzeNGramUnpredictability(text);
    const lexicalMetrics = analyzeLexicalBalance(text);
    const burstinessResult = validateBurstinessPattern(text, {
      maxSimilarSequences: AI_DETECTION_CONFIG.burstiness.maxSimilarSequences,
      similarityThreshold: AI_DETECTION_CONFIG.burstiness.similarityThreshold,
    });
    const blacklistWords = checkForForbiddenWords(text);
    const blacklistStructures = checkForForbiddenStructures(text);
    const perplexityResult = verifyPerplexityThreshold(
      text,
      AI_DETECTION_CONFIG.perplexity.threshold,
      { checkParagraphs: AI_DETECTION_CONFIG.perplexity.checkParagraphs }
    );
    
    // Calculate composite score (higher = more AI-like)
    // Invert scores so higher = more AI-like
    const ngramScore = 100 - ngramMetrics.overallScore;
    const lexicalScore = 100 - lexicalMetrics.balanceScore;
    const burstinessScore = 100 - (burstinessResult.overallScore || 100);
    const perplexityScore = 100 - (perplexityResult.overallPerplexity || 100);
    
    // Blacklist penalty
    const blacklistPenalty = Math.min(30, (blacklistWords.length + blacklistStructures.length) * 5);
    
    // Weighted average
    const compositeScore = Math.min(100, Math.max(0,
      ngramScore * 0.2 +
      lexicalScore * 0.15 +
      burstinessScore * 0.25 +
      perplexityScore * 0.25 +
      blacklistPenalty * 0.15
    ));
    
    return {
      detectorName: 'Internal Heuristic',
      score: Math.round(compositeScore),
      confidence: 0.7,
      details: {
        ngramScore,
        lexicalScore,
        burstinessScore,
        perplexityScore,
        blacklistViolations: blacklistWords.length + blacklistStructures.length,
      },
    };
  } catch (error) {
    return {
      detectorName: 'Internal Heuristic',
      score: 0,
      confidence: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Checks text against multiple AI detection services
 * Returns worst-case (highest) score for conservative decisions
 */
export async function checkMultipleDetectors(
  text: string,
  options: {
    useGPTZero?: boolean;
    useOriginalityAI?: boolean;
    useZeroGPT?: boolean;
    useInternalHeuristic?: boolean;
  } = {}
): Promise<MultiDetectorResult> {
  const {
    useGPTZero = false,
    useOriginalityAI = false,
    useZeroGPT = false,
    useInternalHeuristic = true, // Default to true as fallback
  } = options;
  
  const results: DetectorResult[] = [];
  
  // Check each detector (in parallel for speed)
  const promises: Promise<DetectorResult>[] = [];
  
  if (useGPTZero) {
    promises.push(checkGPTZero(text));
  }
  
  if (useOriginalityAI) {
    promises.push(checkOriginalityAI(text));
  }
  
  if (useZeroGPT) {
    promises.push(checkZeroGPT(text));
  }
  
  if (useInternalHeuristic) {
    promises.push(checkInternalHeuristic(text));
  }
  
  const detectorResults = await Promise.allSettled(promises);
  
  detectorResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      if (result.value) {
        results.push(result.value);
      }
    } else {
      const errorMessage = result.reason instanceof Error 
        ? result.reason.message 
        : typeof result.reason === 'string' 
        ? result.reason 
        : 'Unknown error';
      results.push({
        detectorName: `Detector ${index + 1}`,
        score: 0,
        error: errorMessage,
      });
    }
  });
  
  // Filter out errors for score calculation
  const validResults = results.filter(r => !r.error && r.score >= 0);
  
  if (validResults.length === 0) {
    return {
      results,
      worstCaseScore: 0,
      averageScore: 0,
      bestCaseScore: 0,
      recommendations: ['No valid detector results available'],
    };
  }
  
  const scores = validResults.map(r => r.score);
  const worstCaseScore = Math.max(...scores);
  const bestCaseScore = Math.min(...scores);
  const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (worstCaseScore > 50) {
    recommendations.push(`Worst-case detection score is ${worstCaseScore}% - needs improvement`);
  }
  
  if (worstCaseScore > 30) {
    recommendations.push('Consider applying additional anti-detection passes');
  }
  
  if (worstCaseScore < 20) {
    recommendations.push('Detection scores are within target range (<20%)');
  }
  
  // Check for score variance
  const scoreVariance = Math.max(...scores) - Math.min(...scores);
  if (scoreVariance > 30) {
    recommendations.push(`High variance between detectors (${scoreVariance}%) - optimize for worst-case`);
  }
  
  return {
    results,
    worstCaseScore: Math.round(worstCaseScore),
    averageScore: Math.round(averageScore),
    bestCaseScore: Math.round(bestCaseScore),
    recommendations,
  };
}

/**
 * Gets detection score for a chapter
 * Uses worst-case score for conservative decisions
 */
export async function getChapterDetectionScore(
  chapterContent: string
): Promise<number> {
  const result = await checkMultipleDetectors(chapterContent, {
    useInternalHeuristic: true,
    // Set to true when API keys are configured
    useGPTZero: false,
    useOriginalityAI: false,
    useZeroGPT: false,
  });
  
  return result.worstCaseScore;
}
