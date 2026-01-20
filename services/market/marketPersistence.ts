/**
 * Market Persistence Service
 * 
 * Handles saving and loading market state to/from Supabase.
 */

import { supabase } from '../supabaseService';
import { logger } from '../loggingService';
import {
  GlobalMarketState,
  MarketItem,
  CurrencyDefinition,
  PriceModifier,
  PriceHistoryEntry,
} from '../../types/market';
import { createEmptyMarketState, createDefaultMarketState } from './marketService';

// =============================================================================
// SAVE OPERATIONS
// =============================================================================

/**
 * Save the complete market state to Supabase
 */
export async function saveMarketState(state: GlobalMarketState): Promise<boolean> {
  try {
    // Upsert main market state
    const { error: stateError } = await supabase
      .from('market_states')
      .upsert({
        id: state.id,
        novel_id: state.novelId,
        economic_condition: state.economicCondition,
        last_updated_chapter: state.lastUpdatedChapter,
        market_notes: state.marketNotes,
        protagonist_wealth: state.protagonistWealth,
        created_at: new Date(state.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (stateError) {
      logger.error('Failed to save market state', 'marketPersistence', stateError);
      return false;
    }

    // Save currencies (batch upsert)
    if (state.currencies.length > 0) {
      const currencyRows = state.currencies.map(c => ({
        id: c.id,
        market_state_id: state.id,
        novel_id: state.novelId,
        name: c.name,
        type: c.type,
        grade: c.grade,
        symbol: c.symbol,
        description: c.description,
        conversion_rate: c.conversionRate,
        is_primary: c.isPrimary,
        introduced_chapter: c.introducedChapter,
        created_at: new Date(c.createdAt).toISOString(),
        updated_at: new Date(c.updatedAt).toISOString(),
      }));

      const { error: currencyError } = await supabase
        .from('market_currencies')
        .upsert(currencyRows, { onConflict: 'id' });

      if (currencyError) {
        logger.error('Failed to save currencies', 'marketPersistence', currencyError);
      }
    }

    // Save items (batch upsert)
    if (state.standardItems.length > 0) {
      const itemRows = state.standardItems.map(i => ({
        id: i.id,
        market_state_id: state.id,
        novel_id: state.novelId,
        name: i.name,
        canonical_name: i.canonicalName,
        category: i.category,
        rarity: i.rarity,
        description: i.description,
        base_price: i.basePrice,
        current_price: i.currentPrice,
        currency_id: i.currencyId,
        trend: i.trend,
        price_variance: i.priceVariance,
        price_history: i.priceHistory,
        first_mentioned_chapter: i.firstMentionedChapter,
        last_referenced_chapter: i.lastReferencedChapter,
        notes: i.notes,
        tags: i.tags,
        created_at: new Date(i.createdAt).toISOString(),
        updated_at: new Date(i.updatedAt).toISOString(),
      }));

      const { error: itemError } = await supabase
        .from('market_items')
        .upsert(itemRows, { onConflict: 'id' });

      if (itemError) {
        logger.error('Failed to save market items', 'marketPersistence', itemError);
      }
    }

    // Save price modifiers (batch upsert)
    if (state.priceModifiers.length > 0) {
      const modifierRows = state.priceModifiers.map(m => ({
        id: m.id,
        market_state_id: state.id,
        novel_id: state.novelId,
        name: m.name,
        description: m.description,
        percentage_modifier: m.percentageModifier,
        affected_categories: m.affectedCategories,
        affected_item_ids: m.affectedItemIds,
        introduced_chapter: m.introducedChapter,
        expires_chapter: m.expiresChapter,
        is_active: m.isActive,
        created_at: new Date(m.createdAt).toISOString(),
        updated_at: new Date(m.updatedAt).toISOString(),
      }));

      const { error: modifierError } = await supabase
        .from('market_price_modifiers')
        .upsert(modifierRows, { onConflict: 'id' });

      if (modifierError) {
        logger.error('Failed to save price modifiers', 'marketPersistence', modifierError);
      }
    }

    logger.info('Market state saved successfully', 'marketPersistence', {
      novelId: state.novelId,
      currencies: state.currencies.length,
      items: state.standardItems.length,
      modifiers: state.priceModifiers.length,
    });

    return true;
  } catch (error) {
    logger.error('Error saving market state', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// =============================================================================
// LOAD OPERATIONS
// =============================================================================

/**
 * Load market state from Supabase
 */
export async function loadMarketState(novelId: string): Promise<GlobalMarketState | null> {
  try {
    // Load main state
    const { data: stateData, error: stateError } = await supabase
      .from('market_states')
      .select('*')
      .eq('novel_id', novelId)
      .maybeSingle();

    if (stateError) {
      logger.warn('Error loading market state', 'marketPersistence', { error: stateError.message });
      return null;
    }

    if (!stateData) {
      logger.debug('No market state found for novel', 'marketPersistence', { novelId });
      return null;
    }

    // Load currencies
    const { data: currencyData } = await supabase
      .from('market_currencies')
      .select('*')
      .eq('market_state_id', stateData.id)
      .order('is_primary', { ascending: false });

    // Load items
    const { data: itemData } = await supabase
      .from('market_items')
      .select('*')
      .eq('market_state_id', stateData.id)
      .order('category', { ascending: true });

    // Load modifiers
    const { data: modifierData } = await supabase
      .from('market_price_modifiers')
      .select('*')
      .eq('market_state_id', stateData.id);

    // Map to TypeScript types
    const state: GlobalMarketState = {
      id: stateData.id,
      novelId: stateData.novel_id,
      currencies: (currencyData || []).map(mapDbToCurrency),
      standardItems: (itemData || []).map(mapDbToMarketItem),
      priceModifiers: (modifierData || []).map(mapDbToPriceModifier),
      economicCondition: stateData.economic_condition || 'normal',
      protagonistWealth: stateData.protagonist_wealth,
      lastUpdatedChapter: stateData.last_updated_chapter || 0,
      marketNotes: stateData.market_notes,
      createdAt: new Date(stateData.created_at).getTime(),
      updatedAt: new Date(stateData.updated_at).getTime(),
    };

    logger.info('Market state loaded', 'marketPersistence', {
      novelId,
      currencies: state.currencies.length,
      items: state.standardItems.length,
    });

    return state;
  } catch (error) {
    logger.error('Error loading market state', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Load or create market state for a novel
 */
export async function loadOrCreateMarketState(
  novelId: string,
  createDefault: boolean = true
): Promise<GlobalMarketState> {
  // Try to load existing
  const existing = await loadMarketState(novelId);
  if (existing) return existing;

  // Create new state
  const newState = createDefault
    ? createDefaultMarketState(novelId)
    : createEmptyMarketState(novelId);

  // Save it
  await saveMarketState(newState);

  return newState;
}

// =============================================================================
// DELETE OPERATIONS
// =============================================================================

/**
 * Delete market state for a novel
 */
export async function deleteMarketState(novelId: string): Promise<boolean> {
  try {
    // Get the market state ID first
    const { data: stateData } = await supabase
      .from('market_states')
      .select('id')
      .eq('novel_id', novelId)
      .maybeSingle();

    if (!stateData) return true; // Nothing to delete

    // Delete in order (foreign key constraints)
    await supabase.from('market_price_modifiers').delete().eq('market_state_id', stateData.id);
    await supabase.from('market_items').delete().eq('market_state_id', stateData.id);
    await supabase.from('market_currencies').delete().eq('market_state_id', stateData.id);
    await supabase.from('market_states').delete().eq('id', stateData.id);

    logger.info('Market state deleted', 'marketPersistence', { novelId });
    return true;
  } catch (error) {
    logger.error('Error deleting market state', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Delete a specific market item
 */
export async function deleteMarketItem(itemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('market_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      logger.error('Failed to delete market item', 'marketPersistence', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error deleting market item', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Delete a specific currency
 */
export async function deleteMarketCurrency(currencyId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('market_currencies')
      .delete()
      .eq('id', currencyId);

    if (error) {
      logger.error('Failed to delete currency', 'marketPersistence', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error deleting currency', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// =============================================================================
// SINGLE ITEM OPERATIONS
// =============================================================================

/**
 * Save a single market item
 */
export async function saveMarketItem(
  marketStateId: string,
  novelId: string,
  item: MarketItem
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('market_items')
      .upsert({
        id: item.id,
        market_state_id: marketStateId,
        novel_id: novelId,
        name: item.name,
        canonical_name: item.canonicalName,
        category: item.category,
        rarity: item.rarity,
        description: item.description,
        base_price: item.basePrice,
        current_price: item.currentPrice,
        currency_id: item.currencyId,
        trend: item.trend,
        price_variance: item.priceVariance,
        price_history: item.priceHistory,
        first_mentioned_chapter: item.firstMentionedChapter,
        last_referenced_chapter: item.lastReferencedChapter,
        notes: item.notes,
        tags: item.tags,
        created_at: new Date(item.createdAt).toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      logger.error('Failed to save market item', 'marketPersistence', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error saving market item', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Save a price history entry
 */
export async function savePriceHistory(
  itemId: string,
  entry: PriceHistoryEntry
): Promise<boolean> {
  try {
    // Get current history
    const { data } = await supabase
      .from('market_items')
      .select('price_history')
      .eq('id', itemId)
      .single();

    const currentHistory = data?.price_history || [];
    const newHistory = [...currentHistory, entry];

    const { error } = await supabase
      .from('market_items')
      .update({
        price_history: newHistory,
        current_price: entry.price,
        last_referenced_chapter: entry.chapter,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId);

    if (error) {
      logger.error('Failed to save price history', 'marketPersistence', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error saving price history', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// =============================================================================
// DATABASE MAPPING FUNCTIONS
// =============================================================================

function mapDbToCurrency(row: any): CurrencyDefinition {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    grade: row.grade,
    symbol: row.symbol,
    description: row.description,
    conversionRate: parseFloat(row.conversion_rate) || 1,
    isPrimary: row.is_primary || false,
    introducedChapter: row.introduced_chapter,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapDbToMarketItem(row: any): MarketItem {
  return {
    id: row.id,
    name: row.name,
    canonicalName: row.canonical_name,
    category: row.category,
    rarity: row.rarity,
    description: row.description,
    basePrice: parseFloat(row.base_price) || 0,
    currentPrice: parseFloat(row.current_price) || 0,
    currencyId: row.currency_id,
    trend: row.trend || 'stable',
    priceVariance: row.price_variance || 10,
    priceHistory: row.price_history || [],
    firstMentionedChapter: row.first_mentioned_chapter,
    lastReferencedChapter: row.last_referenced_chapter,
    notes: row.notes,
    tags: row.tags || [],
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapDbToPriceModifier(row: any): PriceModifier {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    percentageModifier: parseFloat(row.percentage_modifier) || 0,
    affectedCategories: row.affected_categories || [],
    affectedItemIds: row.affected_item_ids || [],
    introducedChapter: row.introduced_chapter,
    expiresChapter: row.expires_chapter,
    isActive: row.is_active !== false,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get market statistics for a novel
 */
export async function getMarketStats(novelId: string): Promise<{
  totalItems: number;
  totalCurrencies: number;
  activeModifiers: number;
  priceUpdatesThisSession: number;
}> {
  try {
    const { data: stateData } = await supabase
      .from('market_states')
      .select('id')
      .eq('novel_id', novelId)
      .maybeSingle();

    if (!stateData) {
      return {
        totalItems: 0,
        totalCurrencies: 0,
        activeModifiers: 0,
        priceUpdatesThisSession: 0,
      };
    }

    const [itemCount, currencyCount, modifierCount] = await Promise.all([
      supabase.from('market_items').select('id', { count: 'exact', head: true }).eq('market_state_id', stateData.id),
      supabase.from('market_currencies').select('id', { count: 'exact', head: true }).eq('market_state_id', stateData.id),
      supabase.from('market_price_modifiers').select('id', { count: 'exact', head: true }).eq('market_state_id', stateData.id).eq('is_active', true),
    ]);

    return {
      totalItems: itemCount.count || 0,
      totalCurrencies: currencyCount.count || 0,
      activeModifiers: modifierCount.count || 0,
      priceUpdatesThisSession: 0, // Would need session tracking
    };
  } catch (error) {
    logger.error('Error getting market stats', 'marketPersistence', error instanceof Error ? error : new Error(String(error)));
    return {
      totalItems: 0,
      totalCurrencies: 0,
      activeModifiers: 0,
      priceUpdatesThisSession: 0,
    };
  }
}

logger.info('Market persistence service initialized', 'marketPersistence');
