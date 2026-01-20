/**
 * Face Graph Module
 * 
 * The Face Graph is a social network memory system that tracks "Face" (social standing)
 * and karma in Cultivation novels. It creates a web of blood feuds, favors, and social
 * obligations that persist across thousands of chapters.
 * 
 * Exports:
 * - Face Profile Management: Create and manage character reputation
 * - Karma Events: Record and track karmic interactions
 * - Social Links: Manage relationship network
 * - Blood Feuds: Track vendettas and grudges
 * - Debts: Track favors owed
 * - Ripple Effects: Calculate how actions affect connected characters
 * - Context Generation: Generate context for chapter generation
 * - Auto-Extraction: Automatically extract karma from chapters
 */

// Face Profile Management
export {
  createFaceProfile,
  getFaceProfile,
  getAllFaceProfiles,
  updateFaceProfile,
  addFace,
} from './faceGraphService';

// Karma Event Management
export {
  recordKarmaEvent,
  getKarmaEventsForCharacter,
  getKarmaBetweenCharacters,
  settleKarmaEvent,
} from './faceGraphService';

// Social Link Management
export {
  upsertSocialLink,
  getSocialLinksForCharacter,
  getAllSocialLinks,
} from './faceGraphService';

// Blood Feud Management
export {
  createBloodFeud,
  getActiveBloodFeuds,
  escalateBloodFeud,
  resolveBloodFeud,
} from './faceGraphService';

// Face Debt Management
export {
  createFaceDebt,
  getUnpaidDebts,
  repayDebt,
} from './faceGraphService';

// Karma Ripples
export {
  getPendingRipples,
  manifestRipple,
} from './faceGraphService';

// Configuration
export {
  getFaceGraphConfig,
  saveFaceGraphConfig,
} from './faceGraphService';

// Context Generation
export {
  generateFaceGraphContext,
  getCharacterFaceGraphSummary,
  generateConfrontationContext,
} from './faceGraphContext';

// Ripple Analysis
export {
  analyzeRippleEffects,
  queryConnectionToWronged,
  applyRippleDecay,
} from './rippleAnalyzer';

// Karma Calculation
export {
  calculateKarmaWeight,
  calculateFaceChange,
  shouldTriggerBloodFeud,
  shouldCreateDebt,
  calculateSentimentChange,
} from './karmaCalculator';

// Karma Extraction
export {
  extractKarmaFromChapter,
  extractAndProcessKarma,
  batchExtractKarma,
  processExtractedKarma,
  initializeSocialLinksFromRelationships,
} from './karmaExtractor';

// Social Network Queries
export {
  findMostInfluentialCharacters,
  findShortestPath,
  detectSocialClusters,
  findAllEnemies,
  findAllAllies,
  getNetworkStatistics,
} from './socialNetworkQueries';

// Data Persistence
export {
  fetchFaceGraphData,
  fetchKarmaBetweenCharacters,
  fetchCharacterConnections,
  fetchUnresolvedKarmaForCharacters,
  fetchActiveThreats,
  fetchFaceGraphStats,
} from './faceGraphPersistence';

// Re-export types
export type {
  KarmaEvent,
  KarmaActionType,
  KarmaPolarity,
  KarmaSeverity,
  KarmaWeightModifier,
  FaceProfile,
  FaceTitle,
  FaceAccomplishment,
  FaceShame,
  FaceTier,
  FaceCategory,
  SocialLink,
  SocialLinkType,
  LinkStrength,
  LinkSentiment,
  KarmaRipple,
  BloodFeud,
  FaceDebt,
  FaceGraphContext,
  FaceGraphConfig,
  ConnectionToWrongedQuery,
  ActionConsequencesQuery,
} from '../../types/faceGraph';
