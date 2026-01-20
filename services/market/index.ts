/**
 * Market Module Index
 * 
 * Exports all market-related services for economic simulation.
 */

// Core Market Service
export {
  createEmptyMarketState,
  createDefaultMarketState,
  createCurrencyFromTemplate,
  createCurrency,
  addCurrency,
  updateCurrency,
  removeCurrency,
  getPrimaryCurrency,
  normalizeItemName,
  createMarketItemFromTemplate,
  createMarketItem,
  addMarketItem,
  updateMarketItem,
  removeMarketItem,
  findMarketItemByName,
  updateItemPrice,
  getEffectivePrice,
  addPriceModifier,
  removePriceModifier,
  deactivateExpiredModifiers,
  updateProtagonistWealth,
  validatePrice,
  validateChapterPrices,
  detectEconomicScene,
  formatMarketForPrompt,
  createEconomicSummary,
  formatEconomicSummaryForPrompt,
  getItemTemplates,
  getCurrencyTemplates,
  getItemsByCategory,
  getItemsByRarity,
  exportMarketState,
  importMarketState,
  mergeMarketStates,
} from './marketService';

// Context Generation
export {
  generateMarketContext,
  generateMinimalEconomicHint,
  extractPriceMentions,
  validateGeneratedPrices,
  generatePriceCorrections,
  type MarketContextResult,
} from './marketContextGenerator';

// Persistence
export {
  saveMarketState,
  loadMarketState,
  loadOrCreateMarketState,
  deleteMarketState,
  deleteMarketItem,
  deleteMarketCurrency,
  saveMarketItem,
  savePriceHistory,
  getMarketStats,
} from './marketPersistence';

// Re-export types
export type {
  GlobalMarketState,
  MarketItem,
  CurrencyDefinition,
  PriceModifier,
  PriceHistoryEntry,
  CurrencyType,
  CurrencyGrade,
  ItemRarity,
  MarketItemCategory,
  PriceTrend,
  EconomicCondition,
  ProtagonistWealth,
  EconomicStateSummary,
  PriceConsistencyResult,
  EconomicSceneDetection,
  MarketItemTemplate,
  CurrencyTemplate,
} from '../../types/market';
