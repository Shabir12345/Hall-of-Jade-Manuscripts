/**
 * Market & Economy Types
 * 
 * Defines the economic simulation system for tracking item prices,
 * currencies, and market conditions across chapters to prevent
 * economic inconsistencies in the narrative.
 */

// =============================================================================
// CURRENCY TYPES
// =============================================================================

/**
 * Standard currency types in cultivation novels
 */
export type CurrencyType = 
  | 'spirit_stone'        // Most common cultivation currency
  | 'gold'                // Mortal currency
  | 'contribution_points' // Sect-based currency
  | 'custom';             // User-defined currency

/**
 * Currency grade/tier (affects purchasing power)
 */
export type CurrencyGrade = 'low' | 'mid' | 'high' | 'supreme';

/**
 * Definition of a currency in the world
 */
export interface CurrencyDefinition {
  id: string;
  name: string;
  type: CurrencyType;
  grade?: CurrencyGrade;
  /** Symbol or abbreviation (e.g., "SS" for Spirit Stones) */
  symbol?: string;
  /** Description of the currency */
  description?: string;
  /** Conversion rate to base currency (spirit stones = 1) */
  conversionRate: number;
  /** Is this the primary currency used in the story */
  isPrimary: boolean;
  /** When this currency was introduced */
  introducedChapter?: number;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// ITEM TYPES
// =============================================================================

/**
 * Item rarity levels (affects base price multipliers)
 */
export type ItemRarity = 
  | 'common'      // 1x multiplier
  | 'uncommon'    // 2x multiplier
  | 'rare'        // 5x multiplier
  | 'epic'        // 10x multiplier
  | 'legendary';  // 50x+ multiplier

/**
 * Market item categories
 */
export type MarketItemCategory = 
  | 'pill'        // Cultivation pills, elixirs
  | 'weapon'      // Swords, sabers, etc.
  | 'armor'       // Defensive equipment
  | 'material'    // Crafting materials, herbs
  | 'talisman'    // Talismans, formations
  | 'artifact'    // Treasures, special items
  | 'technique'   // Skill manuals (if tradeable)
  | 'service'     // Services like formations, appraisals
  | 'other';

/**
 * Price trend indicator
 */
export type PriceTrend = 'stable' | 'rising' | 'falling' | 'volatile';

/**
 * A single entry in price history
 */
export interface PriceHistoryEntry {
  /** Chapter where this price was referenced/set */
  chapter: number;
  /** The price at this point */
  price: number;
  /** Reason for price change (if any) */
  reason?: string;
  /** Timestamp when recorded */
  recordedAt: number;
}

/**
 * A tracked market item with pricing information
 */
export interface MarketItem {
  id: string;
  /** Display name */
  name: string;
  /** Normalized name for matching (lowercase, no special chars) */
  canonicalName: string;
  /** Item category */
  category: MarketItemCategory;
  /** Rarity level */
  rarity: ItemRarity;
  /** Description of the item */
  description?: string;
  /** Base price (the "standard" price) */
  basePrice: number;
  /** Current effective price */
  currentPrice: number;
  /** Currency used for this item */
  currencyId: string;
  /** Price trend */
  trend: PriceTrend;
  /** Acceptable price variance percentage (default 10%) */
  priceVariance: number;
  /** Price history for tracking changes */
  priceHistory: PriceHistoryEntry[];
  /** Chapter where this item was first mentioned */
  firstMentionedChapter?: number;
  /** Chapter where price was last referenced */
  lastReferencedChapter?: number;
  /** Additional notes */
  notes?: string;
  /** Tags for filtering/categorization */
  tags?: string[];
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// MARKET STATE TYPES
// =============================================================================

/**
 * Global economic condition affecting all prices
 */
export type EconomicCondition = 
  | 'normal'       // Standard prices apply
  | 'boom'         // Prices inflated 10-20%
  | 'recession'    // Prices deflated 10-20%
  | 'war_economy'  // Essential items inflated, luxury deflated
  | 'scarcity'     // All prices significantly inflated
  | 'abundance';   // All prices deflated

/**
 * A price modifier that affects specific categories or items
 */
export interface PriceModifier {
  id: string;
  /** Name of the modifier */
  name: string;
  /** Description of what caused this modifier */
  description?: string;
  /** Percentage modifier (-50 to +200 typical) */
  percentageModifier: number;
  /** Categories affected (empty = all) */
  affectedCategories: MarketItemCategory[];
  /** Specific item IDs affected (empty = all in categories) */
  affectedItemIds: string[];
  /** Chapter when this modifier was introduced */
  introducedChapter: number;
  /** Chapter when this modifier ends (null = permanent) */
  expiresChapter?: number;
  /** Is this modifier currently active */
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Protagonist's known wealth for context
 */
export interface ProtagonistWealth {
  /** Currency amounts by currency ID */
  currencies: Record<string, number>;
  /** Chapter when last updated */
  lastUpdatedChapter: number;
  /** Notes about wealth sources */
  notes?: string;
}

/**
 * The complete global market state for a novel
 */
export interface GlobalMarketState {
  /** Unique identifier */
  id: string;
  /** Associated novel ID */
  novelId: string;
  /** All defined currencies */
  currencies: CurrencyDefinition[];
  /** All tracked market items with prices */
  standardItems: MarketItem[];
  /** Active price modifiers */
  priceModifiers: PriceModifier[];
  /** Current global economic condition */
  economicCondition: EconomicCondition;
  /** Protagonist's known wealth */
  protagonistWealth?: ProtagonistWealth;
  /** Chapter when market state was last updated */
  lastUpdatedChapter: number;
  /** General notes about the economy */
  marketNotes?: string;
  createdAt: number;
  updatedAt: number;
}

// =============================================================================
// ECONOMIC STATE FOR LORE BIBLE
// =============================================================================

/**
 * Simplified economic state for inclusion in Lore Bible prompts
 */
export interface EconomicStateSummary {
  /** Primary currency name */
  primaryCurrency: string;
  /** Standard item prices for quick reference */
  standardPrices: Array<{
    item: string;
    price: number;
    currency: string;
    trend: PriceTrend;
  }>;
  /** Current economic condition */
  currentCondition: EconomicCondition;
  /** Active modifiers summary */
  activeModifiers?: string[];
  /** Protagonist wealth summary */
  protagonistWealth?: string;
  /** Any special market notes */
  marketNotes?: string;
}

// =============================================================================
// VALIDATION & DETECTION TYPES
// =============================================================================

/**
 * Result of price consistency validation
 */
export interface PriceConsistencyResult {
  isConsistent: boolean;
  itemName: string;
  expectedPrice: number;
  actualPrice: number;
  variance: number;
  maxAllowedVariance: number;
  chapter: number;
  requiresExplanation: boolean;
  suggestion?: string;
}

/**
 * Economic scene detection result
 */
export interface EconomicSceneDetection {
  hasEconomicContent: boolean;
  detectedKeywords: string[];
  suggestedContext: 'shop' | 'auction' | 'trade' | 'payment' | 'general';
  confidence: number;
}

// =============================================================================
// TEMPLATE TYPES
// =============================================================================

/**
 * Pre-defined item template for quick addition
 */
export interface MarketItemTemplate {
  name: string;
  category: MarketItemCategory;
  rarity: ItemRarity;
  suggestedBasePrice: number;
  description?: string;
  tags?: string[];
}

/**
 * Pre-defined currency template
 */
export interface CurrencyTemplate {
  name: string;
  type: CurrencyType;
  grade?: CurrencyGrade;
  symbol?: string;
  conversionRate: number;
  description?: string;
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

/**
 * Default currencies for cultivation novels
 */
export const DEFAULT_CURRENCIES: CurrencyTemplate[] = [
  {
    name: 'Spirit Stone',
    type: 'spirit_stone',
    grade: 'low',
    symbol: 'SS',
    conversionRate: 1,
    description: 'The standard currency of the cultivation world'
  },
  {
    name: 'Mid-Grade Spirit Stone',
    type: 'spirit_stone',
    grade: 'mid',
    symbol: 'MSS',
    conversionRate: 100,
    description: 'Worth 100 low-grade spirit stones'
  },
  {
    name: 'High-Grade Spirit Stone',
    type: 'spirit_stone',
    grade: 'high',
    symbol: 'HSS',
    conversionRate: 10000,
    description: 'Worth 100 mid-grade or 10,000 low-grade spirit stones'
  },
  {
    name: 'Gold Tael',
    type: 'gold',
    symbol: 'GT',
    conversionRate: 0.01,
    description: 'Mortal currency, 100 gold = 1 spirit stone'
  },
  {
    name: 'Contribution Points',
    type: 'contribution_points',
    symbol: 'CP',
    conversionRate: 1,
    description: 'Sect contribution points, value varies by sect'
  }
];

/**
 * Common cultivation items with suggested prices
 */
export const DEFAULT_MARKET_ITEMS: MarketItemTemplate[] = [
  // Pills
  {
    name: 'Qi Gathering Pill',
    category: 'pill',
    rarity: 'common',
    suggestedBasePrice: 50,
    description: 'Basic pill for Qi Condensation cultivators',
    tags: ['cultivation', 'qi-condensation']
  },
  {
    name: 'Foundation Establishment Pill',
    category: 'pill',
    rarity: 'uncommon',
    suggestedBasePrice: 1000,
    description: 'Essential for breaking through to Foundation Establishment',
    tags: ['cultivation', 'breakthrough', 'foundation']
  },
  {
    name: 'Spirit Cleansing Pill',
    category: 'pill',
    rarity: 'uncommon',
    suggestedBasePrice: 500,
    description: 'Removes impurities from the body',
    tags: ['cultivation', 'cleansing']
  },
  {
    name: 'Healing Pill',
    category: 'pill',
    rarity: 'common',
    suggestedBasePrice: 100,
    description: 'Heals minor injuries',
    tags: ['healing', 'combat']
  },
  {
    name: 'Core Formation Pill',
    category: 'pill',
    rarity: 'rare',
    suggestedBasePrice: 10000,
    description: 'Aids in forming a Golden Core',
    tags: ['cultivation', 'breakthrough', 'core-formation']
  },
  // Weapons
  {
    name: 'Low-Grade Spirit Sword',
    category: 'weapon',
    rarity: 'common',
    suggestedBasePrice: 500,
    description: 'Basic sword for Qi Condensation cultivators',
    tags: ['weapon', 'sword', 'low-grade']
  },
  {
    name: 'Mid-Grade Spirit Sword',
    category: 'weapon',
    rarity: 'uncommon',
    suggestedBasePrice: 5000,
    description: 'Quality sword for Foundation cultivators',
    tags: ['weapon', 'sword', 'mid-grade']
  },
  {
    name: 'High-Grade Spirit Sword',
    category: 'weapon',
    rarity: 'rare',
    suggestedBasePrice: 50000,
    description: 'Excellent sword for Core Formation cultivators',
    tags: ['weapon', 'sword', 'high-grade']
  },
  // Materials
  {
    name: 'Spirit Herb',
    category: 'material',
    rarity: 'common',
    suggestedBasePrice: 10,
    description: 'Common herb with spiritual energy',
    tags: ['material', 'herb', 'alchemy']
  },
  {
    name: 'Century Spirit Herb',
    category: 'material',
    rarity: 'uncommon',
    suggestedBasePrice: 200,
    description: 'Herb that has absorbed spiritual energy for 100 years',
    tags: ['material', 'herb', 'alchemy', 'aged']
  },
  {
    name: 'Millennium Spirit Herb',
    category: 'material',
    rarity: 'rare',
    suggestedBasePrice: 5000,
    description: 'Rare herb that has absorbed spiritual energy for 1000 years',
    tags: ['material', 'herb', 'alchemy', 'aged']
  },
  {
    name: 'Beast Core (Low)',
    category: 'material',
    rarity: 'common',
    suggestedBasePrice: 50,
    description: 'Core from a low-level spirit beast',
    tags: ['material', 'beast', 'core']
  },
  {
    name: 'Beast Core (Mid)',
    category: 'material',
    rarity: 'uncommon',
    suggestedBasePrice: 500,
    description: 'Core from a mid-level spirit beast',
    tags: ['material', 'beast', 'core']
  },
  // Talismans
  {
    name: 'Escape Talisman',
    category: 'talisman',
    rarity: 'uncommon',
    suggestedBasePrice: 300,
    description: 'Allows instant escape from danger',
    tags: ['talisman', 'escape', 'survival']
  },
  {
    name: 'Defensive Talisman',
    category: 'talisman',
    rarity: 'common',
    suggestedBasePrice: 100,
    description: 'Provides temporary protection',
    tags: ['talisman', 'defense', 'combat']
  },
  // Techniques (if tradeable in your world)
  {
    name: 'Basic Cultivation Manual',
    category: 'technique',
    rarity: 'common',
    suggestedBasePrice: 100,
    description: 'Basic cultivation technique for mortals',
    tags: ['technique', 'cultivation', 'manual']
  },
  {
    name: 'Yellow-Grade Technique',
    category: 'technique',
    rarity: 'uncommon',
    suggestedBasePrice: 1000,
    description: 'Low-tier cultivation or combat technique',
    tags: ['technique', 'yellow-grade']
  },
  {
    name: 'Profound-Grade Technique',
    category: 'technique',
    rarity: 'rare',
    suggestedBasePrice: 10000,
    description: 'Mid-tier technique sought by Foundation cultivators',
    tags: ['technique', 'profound-grade']
  }
];

/**
 * Keywords that indicate economic/market scenes
 */
export const ECONOMIC_KEYWORDS = [
  // Shopping/Trading
  'shop', 'store', 'merchant', 'vendor', 'trader', 'shopkeeper',
  'buy', 'buying', 'purchase', 'purchased', 'sell', 'selling', 'sold',
  'trade', 'trading', 'exchange', 'exchanged', 'barter',
  // Pricing
  'price', 'priced', 'pricing', 'cost', 'costs', 'costing',
  'expensive', 'cheap', 'afford', 'affordable', 'worth',
  'spirit stone', 'spirit stones', 'gold', 'contribution point',
  // Auctions
  'auction', 'bid', 'bidding', 'bidder', 'highest bid',
  // Transactions
  'pay', 'paid', 'payment', 'coin', 'coins', 'money', 'wealth',
  'transaction', 'deal', 'bargain', 'negotiate', 'negotiation',
  // Locations
  'market', 'marketplace', 'bazaar', 'pavilion', 'hall',
  'auction house', 'trading post', 'treasury'
];
