/**
 * Living World Module
 * 
 * The Living World system prevents the world from being "frozen" while
 * the MC is away. It simulates world events during:
 * - Chapter intervals (every 50 chapters by default)
 * - Seclusion periods
 * - Time skips
 * 
 * Exports:
 * - Global Event Generator: Core simulation engine
 * - World State Simulator: State management and persistence
 * - Event Injector: Integration with chapter generation
 * - Pinecone Integration: Vector DB for smarter entity queries
 */

// Global Event Generator
export {
  runWorldSimulation,
  shouldRunSimulation,
  buildWorldStateSnapshot,
  detectSeclusion,
  detectTimeSkip,
} from './globalEventGenerator';

// World State Simulator
export {
  getLivingWorldStatus,
  saveLivingWorldStatus,
  getWorldEvents,
  saveWorldEvents,
  addWorldEvents,
  markEventsDiscovered,
  markEventsIntegrated,
  getUndiscoveredEvents,
  getEventsToDiscover,
  generateEventStateUpdates,
  generateEventStoryHooks,
  calculateTensionDelta,
  getLivingWorldSummary,
  clearWorldEvents,
  exportWorldEvents,
  importWorldEvents,
} from './worldStateSimulator';

// Event Injector
export {
  buildEventInjectionContext,
  injectLivingWorldContext,
  processChapterForDiscoveries,
  generateWorldChangeNotification,
  getPendingStoryHooks,
  hasLivingWorldContent,
  getPendingEventsSummary,
} from './eventInjector';

// Pinecone Integration
export {
  isLivingWorldPineconeReady,
  queryRelatedEntities,
  getSimulationCandidates,
  storeWorldEvents,
  queryRelatedWorldEvents,
  findAffectedEntities,
  getEntitiesForEventType,
} from './pineconeIntegration';

// Event Cascade System
export {
  checkForCascades,
  processPendingCascades,
  getPendingCascades,
  savePendingCascades,
  addPendingCascades,
  cleanupProcessedCascades,
  getCascadeStats,
} from './eventCascade';

export type { PendingCascade } from './eventCascade';
