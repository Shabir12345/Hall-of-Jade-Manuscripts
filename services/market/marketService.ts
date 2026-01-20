/**
 * Market Service
 * 
 * Manages the global market state for economic simulation.
 * Provides price tracking, validation, and prompt formatting
 * to ensure economic consistency across chapters.
 */

import {
  GlobalMarketState,
  MarketItem,
  CurrencyDefinition,
  PriceModifier,
  EconomicCondition,
  PriceHistoryEntry,
  PriceTrend,
  MarketItemCategory,
  ItemRarity,
  CurrencyType,
  EconomicStateSummary,
  PriceConsistencyResult,
  EconomicSceneDetection,
  MarketItemTemplate,
  CurrencyTemplate,
  ProtagonistWealth,
  DEFAULT_CURRENCIES,
  DEFAULT_MARKET_ITEMS,
  ECONOMIC_KEYWORDS,
} from '../../types/market';
import { generateUUID } from '../../utils/uuid';
import { logger } from '../loggingService';

// =============================================================================
// MARKET STATE CREATION
// =============================================================================

/**
 * Create a new empty global market state
 */
export function createEmptyMarketState(novelId: string): GlobalMarketState {
  return {
    id: generateUUID(),
    novelId,
    currencies: [],
    standardItems: [],
    priceModifiers: [],
    economicCondition: 'normal',
    lastUpdatedChapter: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a market state with default currencies and common items
 */
export function createDefaultMarketState(novelId: string): GlobalMarketState {
  const state = createEmptyMarketState(novelId);
  
  // Add default currencies
  state.currencies = DEFAULT_CURRENCIES.map((template, index) => 
    createCurrencyFromTemplate(template, index === 0) // First one is primary
  );
  
  // Add some common items
  const primaryCurrencyId = state.currencies.find(c => c.isPrimary)?.id || state.currencies[0]?.id || '';
  state.standardItems = DEFAULT_MARKET_ITEMS.slice(0, 10).map(template =>
    createMarketItemFromTemplate(template, primaryCurrencyId)
  );
  
  logger.info('Created default market state', 'marketService', {
    novelId,
    currencyCount: state.currencies.length,
    itemCount: state.standardItems.length,
  });
  
  return state;
}

// =============================================================================
// CURRENCY MANAGEMENT
// =============================================================================

/**
 * Create a currency from a template
 */
export function createCurrencyFromTemplate(
  template: CurrencyTemplate,
  isPrimary: boolean = false
): CurrencyDefinition {
  return {
    id: generateUUID(),
    name: template.name,
    type: template.type,
    grade: template.grade,
    symbol: template.symbol,
    description: template.description,
    conversionRate: template.conversionRate,
    isPrimary,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a new custom currency
 */
export function createCurrency(
  name: string,
  type: CurrencyType,
  conversionRate: number,
  options: Partial<CurrencyDefinition> = {}
): CurrencyDefinition {
  return {
    id: generateUUID(),
    name,
    type,
    conversionRate,
    isPrimary: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...options,
  };
}

/**
 * Add a currency to the market state
 */
export function addCurrency(
  state: GlobalMarketState,
  currency: CurrencyDefinition
): GlobalMarketState {
  // If this is primary, unset other primaries
  const currencies = currency.isPrimary
    ? state.currencies.map(c => ({ ...c, isPrimary: false }))
    : [...state.currencies];
  
  return {
    ...state,
    currencies: [...currencies, currency],
    updatedAt: Date.now(),
  };
}

/**
 * Update a currency
 */
export function updateCurrency(
  state: GlobalMarketState,
  currencyId: string,
  updates: Partial<CurrencyDefinition>
): GlobalMarketState {
  let currencies = state.currencies.map(c =>
    c.id === currencyId
      ? { ...c, ...updates, updatedAt: Date.now() }
      : c
  );
  
  // If setting as primary, unset others
  if (updates.isPrimary) {
    currencies = currencies.map(c =>
      c.id !== currencyId ? { ...c, isPrimary: false } : c
    );
  }
  
  return {
    ...state,
    currencies,
    updatedAt: Date.now(),
  };
}

/**
 * Remove a currency
 */
export function removeCurrency(
  state: GlobalMarketState,
  currencyId: string
): GlobalMarketState {
  return {
    ...state,
    currencies: state.currencies.filter(c => c.id !== currencyId),
    updatedAt: Date.now(),
  };
}

/**
 * Get the primary currency
 */
export function getPrimaryCurrency(state: GlobalMarketState): CurrencyDefinition | undefined {
  return state.currencies.find(c => c.isPrimary) || state.currencies[0];
}

// =============================================================================
// MARKET ITEM MANAGEMENT
// =============================================================================

/**
 * Normalize a name for matching
 */
export function normalizeItemName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Create a market item from a template
 */
export function createMarketItemFromTemplate(
  template: MarketItemTemplate,
  currencyId: string
): MarketItem {
  return {
    id: generateUUID(),
    name: template.name,
    canonicalName: normalizeItemName(template.name),
    category: template.category,
    rarity: template.rarity,
    description: template.description,
    basePrice: template.suggestedBasePrice,
    currentPrice: template.suggestedBasePrice,
    currencyId,
    trend: 'stable',
    priceVariance: 10, // 10% default variance
    priceHistory: [],
    tags: template.tags,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Create a new market item
 */
export function createMarketItem(
  name: string,
  category: MarketItemCategory,
  rarity: ItemRarity,
  basePrice: number,
  currencyId: string,
  options: Partial<MarketItem> = {}
): MarketItem {
  return {
    id: generateUUID(),
    name,
    canonicalName: normalizeItemName(name),
    category,
    rarity,
    basePrice,
    currentPrice: basePrice,
    currencyId,
    trend: 'stable',
    priceVariance: 10,
    priceHistory: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...options,
  };
}

/**
 * Add a market item to the state
 */
export function addMarketItem(
  state: GlobalMarketState,
  item: MarketItem
): GlobalMarketState {
  return {
    ...state,
    standardItems: [...state.standardItems, item],
    updatedAt: Date.now(),
  };
}

/**
 * Update a market item
 */
export function updateMarketItem(
  state: GlobalMarketState,
  itemId: string,
  updates: Partial<MarketItem>
): GlobalMarketState {
  return {
    ...state,
    standardItems: state.standardItems.map(item =>
      item.id === itemId
        ? { ...item, ...updates, updatedAt: Date.now() }
        : item
    ),
    updatedAt: Date.now(),
  };
}

/**
 * Remove a market item
 */
export function removeMarketItem(
  state: GlobalMarketState,
  itemId: string
): GlobalMarketState {
  return {
    ...state,
    standardItems: state.standardItems.filter(item => item.id !== itemId),
    updatedAt: Date.now(),
  };
}

/**
 * Find a market item by name (fuzzy match)
 */
export function findMarketItemByName(
  state: GlobalMarketState,
  name: string
): MarketItem | undefined {
  const normalizedName = normalizeItemName(name);
  
  // Exact match first
  let item = state.standardItems.find(i => i.canonicalName === normalizedName);
  if (item) return item;
  
  // Partial match
  item = state.standardItems.find(i => 
    i.canonicalName.includes(normalizedName) || 
    normalizedName.includes(i.canonicalName)
  );
  
  return item;
}

// =============================================================================
// PRICE MANAGEMENT
// =============================================================================

/**
 * Update the price of a market item
 */
export function updateItemPrice(
  state: GlobalMarketState,
  itemId: string,
  newPrice: number,
  chapter: number,
  reason?: string
): GlobalMarketState {
  const item = state.standardItems.find(i => i.id === itemId);
  if (!item) return state;
  
  // Create history entry
  const historyEntry: PriceHistoryEntry = {
    chapter,
    price: newPrice,
    reason,
    recordedAt: Date.now(),
  };
  
  // Determine trend
  const trend = determinePriceTrend(item.currentPrice, newPrice, item.basePrice);
  
  return updateMarketItem(state, itemId, {
    currentPrice: newPrice,
    trend,
    priceHistory: [...item.priceHistory, historyEntry],
    lastReferencedChapter: chapter,
  });
}

/**
 * Determine the price trend based on price changes
 */
function determinePriceTrend(oldPrice: number, newPrice: number, basePrice: number): PriceTrend {
  const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
  const baseDeviation = ((newPrice - basePrice) / basePrice) * 100;
  
  if (Math.abs(changePercent) <= 5) return 'stable';
  if (changePercent > 20 || changePercent < -20) return 'volatile';
  if (changePercent > 5) return 'rising';
  return 'falling';
}

/**
 * Get the effective price of an item (with modifiers applied)
 */
export function getEffectivePrice(
  state: GlobalMarketState,
  itemId: string
): number {
  const item = state.standardItems.find(i => i.id === itemId);
  if (!item) return 0;
  
  let price = item.currentPrice;
  
  // Apply economic condition modifier
  price = applyEconomicConditionModifier(price, state.economicCondition, item.category);
  
  // Apply active price modifiers
  for (const modifier of state.priceModifiers.filter(m => m.isActive)) {
    if (isModifierApplicable(modifier, item)) {
      price = price * (1 + modifier.percentageModifier / 100);
    }
  }
  
  return Math.round(price);
}

/**
 * Apply economic condition modifier to a price
 */
function applyEconomicConditionModifier(
  price: number,
  condition: EconomicCondition,
  category: MarketItemCategory
): number {
  const modifiers: Record<EconomicCondition, number> = {
    normal: 0,
    boom: 15,
    recession: -15,
    war_economy: category === 'weapon' || category === 'armor' ? 30 : -10,
    scarcity: 50,
    abundance: -30,
  };
  
  return price * (1 + modifiers[condition] / 100);
}

/**
 * Check if a price modifier applies to an item
 */
function isModifierApplicable(modifier: PriceModifier, item: MarketItem): boolean {
  // Check specific item IDs
  if (modifier.affectedItemIds.length > 0) {
    return modifier.affectedItemIds.includes(item.id);
  }
  
  // Check categories
  if (modifier.affectedCategories.length > 0) {
    return modifier.affectedCategories.includes(item.category);
  }
  
  // Applies to all if no specific targets
  return true;
}

// =============================================================================
// PRICE MODIFIERS
// =============================================================================

/**
 * Add a price modifier
 */
export function addPriceModifier(
  state: GlobalMarketState,
  modifier: Omit<PriceModifier, 'id' | 'createdAt' | 'updatedAt'>
): GlobalMarketState {
  const newModifier: PriceModifier = {
    ...modifier,
    id: generateUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  return {
    ...state,
    priceModifiers: [...state.priceModifiers, newModifier],
    updatedAt: Date.now(),
  };
}

/**
 * Remove a price modifier
 */
export function removePriceModifier(
  state: GlobalMarketState,
  modifierId: string
): GlobalMarketState {
  return {
    ...state,
    priceModifiers: state.priceModifiers.filter(m => m.id !== modifierId),
    updatedAt: Date.now(),
  };
}

/**
 * Deactivate expired modifiers based on current chapter
 */
export function deactivateExpiredModifiers(
  state: GlobalMarketState,
  currentChapter: number
): GlobalMarketState {
  const hasExpired = state.priceModifiers.some(
    m => m.isActive && m.expiresChapter && m.expiresChapter <= currentChapter
  );
  
  if (!hasExpired) return state;
  
  return {
    ...state,
    priceModifiers: state.priceModifiers.map(m => {
      if (m.isActive && m.expiresChapter && m.expiresChapter <= currentChapter) {
        return { ...m, isActive: false, updatedAt: Date.now() };
      }
      return m;
    }),
    updatedAt: Date.now(),
  };
}

// =============================================================================
// PROTAGONIST WEALTH
// =============================================================================

/**
 * Update protagonist's known wealth
 */
export function updateProtagonistWealth(
  state: GlobalMarketState,
  currencyId: string,
  amount: number,
  chapter: number,
  notes?: string
): GlobalMarketState {
  const currentWealth = state.protagonistWealth || {
    currencies: {},
    lastUpdatedChapter: 0,
  };
  
  return {
    ...state,
    protagonistWealth: {
      currencies: {
        ...currentWealth.currencies,
        [currencyId]: amount,
      },
      lastUpdatedChapter: chapter,
      notes: notes || currentWealth.notes,
    },
    updatedAt: Date.now(),
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a price against expected values
 */
export function validatePrice(
  state: GlobalMarketState,
  itemName: string,
  mentionedPrice: number,
  chapter: number
): PriceConsistencyResult {
  const item = findMarketItemByName(state, itemName);
  
  if (!item) {
    return {
      isConsistent: true, // Can't validate unknown items
      itemName,
      expectedPrice: 0,
      actualPrice: mentionedPrice,
      variance: 0,
      maxAllowedVariance: 0,
      chapter,
      requiresExplanation: false,
      suggestion: `Item "${itemName}" is not in the market database. Consider adding it.`,
    };
  }
  
  const effectivePrice = getEffectivePrice(state, item.id);
  const variance = Math.abs((mentionedPrice - effectivePrice) / effectivePrice) * 100;
  const maxAllowedVariance = item.priceVariance;
  const isConsistent = variance <= maxAllowedVariance;
  
  return {
    isConsistent,
    itemName: item.name,
    expectedPrice: effectivePrice,
    actualPrice: mentionedPrice,
    variance: Math.round(variance * 10) / 10,
    maxAllowedVariance,
    chapter,
    requiresExplanation: !isConsistent,
    suggestion: isConsistent
      ? undefined
      : `Price ${mentionedPrice} deviates ${variance.toFixed(1)}% from expected ${effectivePrice}. This should be explained in-narrative (auction, scarcity, etc.).`,
  };
}

/**
 * Validate multiple prices from chapter content
 */
export function validateChapterPrices(
  state: GlobalMarketState,
  chapterContent: string,
  chapterNumber: number
): PriceConsistencyResult[] {
  const results: PriceConsistencyResult[] = [];
  
  // Simple pattern to find price mentions
  // Pattern: "X spirit stones", "cost X", "price of X", "X gold"
  const pricePatterns = [
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:spirit\s*stones?|ss)/gi,
    /(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:gold|coins?)/gi,
    /(?:cost|price|worth|valued?\s*at)\s*(?:of\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/gi,
  ];
  
  // This is a basic implementation - could be enhanced with NLP
  for (const item of state.standardItems) {
    const itemPattern = new RegExp(
      `${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)`,
      'gi'
    );
    
    let match: RegExpExecArray | null;
    while ((match = itemPattern.exec(chapterContent)) !== null) {
      const price = parseFloat(match[1].replace(/,/g, ''));
      results.push(validatePrice(state, item.name, price, chapterNumber));
    }
  }
  
  return results;
}

// =============================================================================
// ECONOMIC SCENE DETECTION
// =============================================================================

/**
 * Detect if text contains economic/market content
 */
export function detectEconomicScene(text: string): EconomicSceneDetection {
  const lowerText = text.toLowerCase();
  const detectedKeywords: string[] = [];
  
  for (const keyword of ECONOMIC_KEYWORDS) {
    if (lowerText.includes(keyword.toLowerCase())) {
      detectedKeywords.push(keyword);
    }
  }
  
  const hasEconomicContent = detectedKeywords.length > 0;
  
  // Determine context type
  let suggestedContext: EconomicSceneDetection['suggestedContext'] = 'general';
  if (detectedKeywords.some(k => ['auction', 'bid', 'bidding'].includes(k))) {
    suggestedContext = 'auction';
  } else if (detectedKeywords.some(k => ['shop', 'store', 'merchant', 'vendor'].includes(k))) {
    suggestedContext = 'shop';
  } else if (detectedKeywords.some(k => ['trade', 'trading', 'exchange', 'barter'].includes(k))) {
    suggestedContext = 'trade';
  } else if (detectedKeywords.some(k => ['pay', 'paid', 'payment'].includes(k))) {
    suggestedContext = 'payment';
  }
  
  // Calculate confidence based on number of keywords
  const confidence = Math.min(1, detectedKeywords.length / 3);
  
  return {
    hasEconomicContent,
    detectedKeywords,
    suggestedContext,
    confidence,
  };
}

// =============================================================================
// PROMPT FORMATTING
// =============================================================================

/**
 * Format market state for inclusion in prompts
 */
export function formatMarketForPrompt(
  state: GlobalMarketState,
  options: {
    includeAllItems?: boolean;
    maxItems?: number;
    includeWealth?: boolean;
    includeModifiers?: boolean;
  } = {}
): string {
  const {
    includeAllItems = false,
    maxItems = 15,
    includeWealth = true,
    includeModifiers = true,
  } = options;
  
  const sections: string[] = [];
  
  sections.push('=== ECONOMIC CONTEXT (MANDATORY FOR TRANSACTIONS) ===');
  
  // Primary currency
  const primaryCurrency = getPrimaryCurrency(state);
  if (primaryCurrency) {
    sections.push(`Primary Currency: ${primaryCurrency.name}${primaryCurrency.symbol ? ` (${primaryCurrency.symbol})` : ''}`);
  }
  
  // Economic condition
  const conditionDescriptions: Record<EconomicCondition, string> = {
    normal: 'Normal - Standard prices apply',
    boom: 'Economic Boom - Prices inflated 10-20%',
    recession: 'Recession - Prices deflated 10-20%',
    war_economy: 'War Economy - Weapons/armor inflated, luxuries deflated',
    scarcity: 'Scarcity - All prices significantly inflated',
    abundance: 'Abundance - All prices deflated',
  };
  sections.push(`Current Economic Condition: ${conditionDescriptions[state.economicCondition]}`);
  sections.push('');
  
  // Standard prices
  sections.push('STANDARD PRICES (Reference these for any transactions):');
  const items = includeAllItems 
    ? state.standardItems 
    : state.standardItems.slice(0, maxItems);
  
  for (const item of items) {
    const currency = state.currencies.find(c => c.id === item.currencyId);
    const currencyName = currency?.name || 'Spirit Stones';
    const currencySymbol = currency?.symbol || 'SS';
    const effectivePrice = getEffectivePrice(state, item.id);
    const trendIndicator = item.trend === 'rising' ? '↑' : item.trend === 'falling' ? '↓' : '';
    
    sections.push(`- ${item.name}: ${effectivePrice.toLocaleString()} ${currencySymbol} (${item.trend}${trendIndicator})`);
  }
  
  if (state.standardItems.length > maxItems && !includeAllItems) {
    sections.push(`... and ${state.standardItems.length - maxItems} more items`);
  }
  sections.push('');
  
  // Price rules
  sections.push('PRICE RULES:');
  sections.push('- Prices should remain within 10% of listed values unless story justifies change');
  sections.push('- Any significant price change must be explained in-narrative (auction competition, scarcity, special quality, etc.)');
  sections.push('- When introducing new items, maintain relative value consistency with listed items');
  
  // Protagonist wealth
  if (includeWealth && state.protagonistWealth) {
    sections.push('');
    sections.push('PROTAGONIST WEALTH:');
    for (const [currencyId, amount] of Object.entries(state.protagonistWealth.currencies)) {
      const currency = state.currencies.find(c => c.id === currencyId);
      if (currency && amount > 0) {
        sections.push(`- ${currency.name}: ~${amount.toLocaleString()}`);
      }
    }
  }
  
  // Active modifiers
  if (includeModifiers && state.priceModifiers.filter(m => m.isActive).length > 0) {
    sections.push('');
    sections.push('ACTIVE MARKET CONDITIONS:');
    for (const modifier of state.priceModifiers.filter(m => m.isActive)) {
      const sign = modifier.percentageModifier >= 0 ? '+' : '';
      sections.push(`- ${modifier.name}: ${sign}${modifier.percentageModifier}% ${modifier.description || ''}`);
    }
  }
  
  // Market notes
  if (state.marketNotes) {
    sections.push('');
    sections.push(`Market Notes: ${state.marketNotes}`);
  }
  
  sections.push('');
  sections.push('=== END ECONOMIC CONTEXT ===');
  
  return sections.join('\n');
}

/**
 * Create a compact economic summary for Lore Bible
 */
export function createEconomicSummary(state: GlobalMarketState): EconomicStateSummary {
  const primaryCurrency = getPrimaryCurrency(state);
  
  return {
    primaryCurrency: primaryCurrency?.name || 'Spirit Stones',
    standardPrices: state.standardItems.slice(0, 10).map(item => {
      const currency = state.currencies.find(c => c.id === item.currencyId);
      return {
        item: item.name,
        price: getEffectivePrice(state, item.id),
        currency: currency?.name || 'Spirit Stones',
        trend: item.trend,
      };
    }),
    currentCondition: state.economicCondition,
    activeModifiers: state.priceModifiers
      .filter(m => m.isActive)
      .map(m => `${m.name}: ${m.percentageModifier > 0 ? '+' : ''}${m.percentageModifier}%`),
    protagonistWealth: state.protagonistWealth
      ? Object.entries(state.protagonistWealth.currencies)
          .map(([id, amount]) => {
            const currency = state.currencies.find(c => c.id === id);
            return currency ? `${amount.toLocaleString()} ${currency.name}` : null;
          })
          .filter(Boolean)
          .join(', ')
      : undefined,
    marketNotes: state.marketNotes,
  };
}

/**
 * Format economic summary for Lore Bible prompt
 */
export function formatEconomicSummaryForPrompt(summary: EconomicStateSummary): string {
  const lines: string[] = [];
  
  lines.push(`Economic System: ${summary.primaryCurrency}`);
  lines.push(`Condition: ${summary.currentCondition}`);
  
  if (summary.standardPrices.length > 0) {
    lines.push('Key Prices:');
    for (const price of summary.standardPrices.slice(0, 5)) {
      lines.push(`  - ${price.item}: ${price.price.toLocaleString()} (${price.trend})`);
    }
  }
  
  if (summary.protagonistWealth) {
    lines.push(`MC Wealth: ${summary.protagonistWealth}`);
  }
  
  return lines.join('\n');
}

// =============================================================================
// TEMPLATES & QUICK ADD
// =============================================================================

/**
 * Get all available item templates
 */
export function getItemTemplates(): MarketItemTemplate[] {
  return DEFAULT_MARKET_ITEMS;
}

/**
 * Get all available currency templates
 */
export function getCurrencyTemplates(): CurrencyTemplate[] {
  return DEFAULT_CURRENCIES;
}

/**
 * Get items by category
 */
export function getItemsByCategory(
  state: GlobalMarketState,
  category: MarketItemCategory
): MarketItem[] {
  return state.standardItems.filter(item => item.category === category);
}

/**
 * Get items by rarity
 */
export function getItemsByRarity(
  state: GlobalMarketState,
  rarity: ItemRarity
): MarketItem[] {
  return state.standardItems.filter(item => item.rarity === rarity);
}

// =============================================================================
// IMPORT/EXPORT
// =============================================================================

/**
 * Export market state to JSON
 */
export function exportMarketState(state: GlobalMarketState): string {
  return JSON.stringify(state, null, 2);
}

/**
 * Import market state from JSON
 */
export function importMarketState(json: string): GlobalMarketState | null {
  try {
    const parsed = JSON.parse(json);
    
    // Basic validation
    if (!parsed.id || !parsed.novelId || !Array.isArray(parsed.currencies)) {
      logger.warn('Invalid market state JSON', 'marketService');
      return null;
    }
    
    return parsed as GlobalMarketState;
  } catch (error) {
    logger.error('Failed to parse market state JSON', 'marketService', error instanceof Error ? error : undefined);
    return null;
  }
}

/**
 * Merge two market states (useful for importing partial data)
 */
export function mergeMarketStates(
  base: GlobalMarketState,
  incoming: Partial<GlobalMarketState>
): GlobalMarketState {
  const merged: GlobalMarketState = {
    ...base,
    updatedAt: Date.now(),
  };
  
  // Merge currencies (by name to avoid duplicates)
  if (incoming.currencies) {
    const existingNames = new Set(base.currencies.map(c => c.name.toLowerCase()));
    const newCurrencies = incoming.currencies.filter(
      c => !existingNames.has(c.name.toLowerCase())
    );
    merged.currencies = [...base.currencies, ...newCurrencies];
  }
  
  // Merge items (by canonical name to avoid duplicates)
  if (incoming.standardItems) {
    const existingNames = new Set(base.standardItems.map(i => i.canonicalName));
    const newItems = incoming.standardItems.filter(
      i => !existingNames.has(i.canonicalName)
    );
    merged.standardItems = [...base.standardItems, ...newItems];
  }
  
  // Merge modifiers (by name)
  if (incoming.priceModifiers) {
    const existingNames = new Set(base.priceModifiers.map(m => m.name.toLowerCase()));
    const newModifiers = incoming.priceModifiers.filter(
      m => !existingNames.has(m.name.toLowerCase())
    );
    merged.priceModifiers = [...base.priceModifiers, ...newModifiers];
  }
  
  // Override scalar values if provided
  if (incoming.economicCondition) {
    merged.economicCondition = incoming.economicCondition;
  }
  if (incoming.marketNotes) {
    merged.marketNotes = incoming.marketNotes;
  }
  if (incoming.protagonistWealth) {
    merged.protagonistWealth = incoming.protagonistWealth;
  }
  
  return merged;
}

logger.info('Market service initialized', 'marketService');
