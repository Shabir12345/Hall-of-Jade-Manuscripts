/**
 * Market Context Generator
 * 
 * Generates context blocks for market/economic scenes to inject
 * into chapter generation prompts, ensuring price consistency.
 */

import {
  GlobalMarketState,
  MarketItem,
  EconomicSceneDetection,
  PriceConsistencyResult,
  MarketItemCategory,
} from '../../types/market';
import { Chapter, NovelState } from '../../types';
import { logger } from '../loggingService';
import {
  formatMarketForPrompt,
  detectEconomicScene,
  getEffectivePrice,
  getPrimaryCurrency,
  validateChapterPrices,
  findMarketItemByName,
} from './marketService';

/**
 * Context generation result
 */
export interface MarketContextResult {
  /** Whether to include economic context in the prompt */
  shouldInclude: boolean;
  /** The formatted context block */
  contextBlock: string;
  /** Detected economic scene type */
  sceneType: EconomicSceneDetection['suggestedContext'] | null;
  /** Items likely to be relevant */
  relevantItems: MarketItem[];
  /** Price validation warnings from previous content */
  priceWarnings: PriceConsistencyResult[];
}

/**
 * Generate market context for chapter generation
 */
export function generateMarketContext(
  state: NovelState,
  options: {
    userInstructions?: string;
    previousContent?: string;
    chapterOutline?: string;
    forceInclude?: boolean;
  } = {}
): MarketContextResult {
  const { userInstructions, previousContent, chapterOutline, forceInclude } = options;

  // Check if we have market state
  const marketState = state.globalMarketState;
  if (!marketState || marketState.currencies.length === 0) {
    return {
      shouldInclude: false,
      contextBlock: '',
      sceneType: null,
      relevantItems: [],
      priceWarnings: [],
    };
  }

  // Detect if this is an economic scene
  const combinedText = [
    userInstructions || '',
    chapterOutline || '',
    previousContent?.slice(-2000) || '',
  ].join(' ');

  const detection = detectEconomicScene(combinedText);

  // Determine if we should include context
  const shouldInclude = forceInclude || detection.hasEconomicContent;

  if (!shouldInclude) {
    return {
      shouldInclude: false,
      contextBlock: '',
      sceneType: null,
      relevantItems: [],
      priceWarnings: [],
    };
  }

  // Find relevant items based on detected keywords and scene type
  const relevantItems = findRelevantItems(marketState, combinedText, detection.suggestedContext);

  // Check for price inconsistencies in previous content
  const priceWarnings = previousContent
    ? validateChapterPrices(marketState, previousContent, state.chapters.length)
        .filter(r => !r.isConsistent)
    : [];

  // Generate the context block
  const contextBlock = buildMarketContextBlock(marketState, {
    sceneType: detection.suggestedContext,
    relevantItems,
    priceWarnings,
    includeWealth: shouldIncludeWealth(userInstructions || ''),
  });

  logger.debug('Generated market context for chapter', 'marketContextGenerator', {
    novelId: state.id,
    sceneType: detection.suggestedContext,
    relevantItemCount: relevantItems.length,
    warningCount: priceWarnings.length,
  });

  return {
    shouldInclude: true,
    contextBlock,
    sceneType: detection.suggestedContext,
    relevantItems,
    priceWarnings,
  };
}

/**
 * Find items relevant to the current scene
 */
function findRelevantItems(
  marketState: GlobalMarketState,
  text: string,
  sceneType: EconomicSceneDetection['suggestedContext']
): MarketItem[] {
  const textLower = text.toLowerCase();
  const relevantItems: MarketItem[] = [];
  const addedIds = new Set<string>();

  // First, find items mentioned by name
  for (const item of marketState.standardItems) {
    if (textLower.includes(item.canonicalName) || 
        textLower.includes(item.name.toLowerCase())) {
      if (!addedIds.has(item.id)) {
        relevantItems.push(item);
        addedIds.add(item.id);
      }
    }
  }

  // Add items by category based on scene type
  const categoryPriority: Record<EconomicSceneDetection['suggestedContext'], MarketItemCategory[]> = {
    shop: ['pill', 'material', 'weapon', 'talisman'],
    auction: ['artifact', 'technique', 'weapon', 'material'],
    trade: ['material', 'pill', 'weapon'],
    payment: ['service'],
    general: [],
  };

  const priorityCategories = categoryPriority[sceneType];
  for (const category of priorityCategories) {
    const categoryItems = marketState.standardItems
      .filter(item => item.category === category && !addedIds.has(item.id))
      .slice(0, 3);
    
    for (const item of categoryItems) {
      relevantItems.push(item);
      addedIds.add(item.id);
    }
  }

  // Look for keyword matches in descriptions/tags
  const keywordMatches = [
    'cultivation', 'pill', 'elixir', 'sword', 'weapon', 'armor',
    'talisman', 'herb', 'material', 'spirit', 'technique',
  ];

  for (const keyword of keywordMatches) {
    if (textLower.includes(keyword)) {
      const matchingItems = marketState.standardItems.filter(
        item => 
          !addedIds.has(item.id) && 
          (item.tags?.some(t => t.includes(keyword)) || 
           item.description?.toLowerCase().includes(keyword))
      ).slice(0, 2);
      
      for (const item of matchingItems) {
        relevantItems.push(item);
        addedIds.add(item.id);
      }
    }
  }

  // Limit to reasonable number
  return relevantItems.slice(0, 15);
}

/**
 * Check if we should include protagonist wealth
 */
function shouldIncludeWealth(userInstructions: string): boolean {
  const wealthKeywords = [
    'buy', 'purchase', 'afford', 'spend', 'pay', 'cost',
    'wealth', 'rich', 'poor', 'money', 'spirit stone',
  ];
  
  const instructionsLower = userInstructions.toLowerCase();
  return wealthKeywords.some(kw => instructionsLower.includes(kw));
}

/**
 * Build the complete market context block for prompt injection
 */
function buildMarketContextBlock(
  marketState: GlobalMarketState,
  options: {
    sceneType: EconomicSceneDetection['suggestedContext'];
    relevantItems: MarketItem[];
    priceWarnings: PriceConsistencyResult[];
    includeWealth: boolean;
  }
): string {
  const sections: string[] = [];
  const primaryCurrency = getPrimaryCurrency(marketState);
  
  sections.push('\n[ECONOMIC CONTEXT - MANDATORY FOR TRANSACTIONS]');
  sections.push('');

  // Scene-specific guidance
  const sceneGuidance: Record<EconomicSceneDetection['suggestedContext'], string> = {
    shop: 'This scene involves shopping/purchasing. Prices should match the reference list below.',
    auction: 'This is an auction scene. Prices may exceed listed values, but starting bids should be near them. Competition can raise prices.',
    trade: 'This scene involves trading/bartering. Use relative values to maintain consistency.',
    payment: 'This scene involves payment/transactions. Use the established currency system.',
    general: 'Economic elements detected. Maintain price consistency with established values.',
  };
  
  sections.push(sceneGuidance[options.sceneType]);
  sections.push('');

  // Primary currency
  if (primaryCurrency) {
    sections.push(`Currency: ${primaryCurrency.name}${primaryCurrency.symbol ? ` (${primaryCurrency.symbol})` : ''}`);
    
    // Add conversion rates if multiple currencies
    if (marketState.currencies.length > 1) {
      sections.push('Currency Conversions:');
      for (const currency of marketState.currencies) {
        if (currency.id !== primaryCurrency.id) {
          const rate = currency.conversionRate / primaryCurrency.conversionRate;
          sections.push(`  - 1 ${currency.name} = ${rate} ${primaryCurrency.name}`);
        }
      }
    }
    sections.push('');
  }

  // Economic condition
  if (marketState.economicCondition !== 'normal') {
    const conditionDescriptions: Record<string, string> = {
      boom: '⬆️ Economic Boom: Prices are 15% higher than normal',
      recession: '⬇️ Recession: Prices are 15% lower than normal',
      war_economy: '⚔️ War Economy: Weapons/armor inflated, luxuries deflated',
      scarcity: '🔴 Scarcity: All prices significantly inflated',
      abundance: '🟢 Abundance: All prices deflated',
    };
    sections.push(`Current Condition: ${conditionDescriptions[marketState.economicCondition]}`);
    sections.push('');
  }

  // Relevant items with prices
  if (options.relevantItems.length > 0) {
    sections.push('REFERENCE PRICES (These should guide any transactions):');
    
    // Group by category for readability
    const byCategory = new Map<MarketItemCategory, MarketItem[]>();
    for (const item of options.relevantItems) {
      const existing = byCategory.get(item.category) || [];
      existing.push(item);
      byCategory.set(item.category, existing);
    }

    byCategory.forEach((items, category) => {
      sections.push(`  ${category.toUpperCase()}:`);
      for (const item of items) {
        const effectivePrice = getEffectivePrice(marketState, item.id);
        const currency = marketState.currencies.find(c => c.id === item.currencyId);
        const symbol = currency?.symbol || primaryCurrency?.symbol || 'SS';
        const trendIcon = item.trend === 'rising' ? '↑' : item.trend === 'falling' ? '↓' : '';
        
        sections.push(`    - ${item.name}: ${effectivePrice.toLocaleString()} ${symbol} ${trendIcon}`);
      }
    });
    sections.push('');
  }

  // Price warnings from previous content
  if (options.priceWarnings.length > 0) {
    sections.push('⚠️ PRICE CONSISTENCY ALERTS:');
    for (const warning of options.priceWarnings) {
      sections.push(`  - ${warning.itemName}: Was ${warning.actualPrice}, should be ~${warning.expectedPrice}`);
      if (warning.suggestion) {
        sections.push(`    → ${warning.suggestion}`);
      }
    }
    sections.push('');
  }

  // Protagonist wealth (if relevant)
  if (options.includeWealth && marketState.protagonistWealth) {
    sections.push('PROTAGONIST WEALTH:');
    for (const [currencyId, amount] of Object.entries(marketState.protagonistWealth.currencies)) {
      const currency = marketState.currencies.find(c => c.id === currencyId);
      if (currency && amount > 0) {
        sections.push(`  - ${currency.name}: ~${amount.toLocaleString()}`);
      }
    }
    sections.push('');
  }

  // Rules reminder
  sections.push('ECONOMIC RULES:');
  sections.push('1. Prices must stay within ±10% of reference unless story justifies deviation');
  sections.push('2. Any price change must be explained in-narrative (quality, rarity, negotiation, etc.)');
  sections.push('3. New items should have prices consistent with similar items');
  sections.push('4. Consider economic condition when describing wealth/poverty');
  sections.push('');
  sections.push('[END ECONOMIC CONTEXT]');
  sections.push('');

  return sections.join('\n');
}

/**
 * Generate a minimal economic hint for non-economic scenes
 * that might casually mention money
 */
export function generateMinimalEconomicHint(state: NovelState): string {
  const marketState = state.globalMarketState;
  if (!marketState || marketState.currencies.length === 0) {
    return '';
  }

  const primaryCurrency = getPrimaryCurrency(marketState);
  if (!primaryCurrency) return '';

  return `[Note: Primary currency is "${primaryCurrency.name}"${primaryCurrency.symbol ? ` (${primaryCurrency.symbol})` : ''}. Maintain economic consistency if money is mentioned.]`;
}

/**
 * Extract price mentions from generated chapter for validation
 */
export function extractPriceMentions(
  chapterContent: string,
  marketState: GlobalMarketState
): Array<{
  itemName: string;
  mentionedPrice: number;
  context: string;
  position: number;
}> {
  const mentions: Array<{
    itemName: string;
    mentionedPrice: number;
    context: string;
    position: number;
  }> = [];

  // Build patterns for each currency
  const currencyPatterns = marketState.currencies.map(c => {
    const escapedName = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSymbol = c.symbol?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') || '';
    return `(?:${escapedName}|${escapedSymbol})`;
  }).join('|');

  // Pattern: number followed by currency
  const pricePattern = new RegExp(
    `(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?)\\s*(?:${currencyPatterns})`,
    'gi'
  );

  // Look for item names near prices
  let match;
  while ((match = pricePattern.exec(chapterContent)) !== null) {
    const pricePosition = match.index;
    const price = parseFloat(match[1].replace(/,/g, ''));
    
    // Get surrounding context (200 chars before)
    const contextStart = Math.max(0, pricePosition - 200);
    const context = chapterContent.slice(contextStart, pricePosition + match[0].length);
    
    // Try to find a matching item name in the context
    for (const item of marketState.standardItems) {
      if (context.toLowerCase().includes(item.canonicalName) ||
          context.toLowerCase().includes(item.name.toLowerCase())) {
        mentions.push({
          itemName: item.name,
          mentionedPrice: price,
          context: context.slice(-100),
          position: pricePosition,
        });
        break;
      }
    }
  }

  return mentions;
}

/**
 * Post-generation price validation
 */
export function validateGeneratedPrices(
  chapterContent: string,
  chapterNumber: number,
  marketState: GlobalMarketState
): {
  isValid: boolean;
  errors: PriceConsistencyResult[];
  warnings: PriceConsistencyResult[];
} {
  const results = validateChapterPrices(marketState, chapterContent, chapterNumber);
  
  const errors = results.filter(r => !r.isConsistent && r.variance > 50);
  const warnings = results.filter(r => !r.isConsistent && r.variance <= 50);
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generate suggested corrections for price inconsistencies
 */
export function generatePriceCorrections(
  errors: PriceConsistencyResult[]
): string {
  if (errors.length === 0) return '';

  const corrections: string[] = [
    '--- SUGGESTED PRICE CORRECTIONS ---',
  ];

  for (const error of errors) {
    corrections.push(`${error.itemName}:`);
    corrections.push(`  Current: ${error.actualPrice}`);
    corrections.push(`  Should be: ~${error.expectedPrice}`);
    corrections.push(`  Variance: ${error.variance}%`);
    if (error.suggestion) {
      corrections.push(`  Suggestion: ${error.suggestion}`);
    }
    corrections.push('');
  }

  return corrections.join('\n');
}

logger.info('Market context generator initialized', 'marketContextGenerator');
