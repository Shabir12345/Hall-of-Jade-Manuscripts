/**
 * Market Panel Component
 * 
 * Manages the economic simulation (Spirit Stone Market) for tracking
 * item prices and currencies across chapters.
 */

import React, { useState, useMemo, memo } from 'react';
import type { 
  GlobalMarketState, 
  MarketItem, 
  CurrencyDefinition,
  MarketItemCategory,
  ItemRarity,
  EconomicCondition,
  PriceTrend,
} from '../types/market';
import {
  createMarketItem,
  createCurrency,
  normalizeItemName,
  getItemTemplates,
  getCurrencyTemplates,
  getPrimaryCurrency,
  getEffectivePrice,
} from '../services/market/marketService';
import { generateUUID } from '../utils/uuid';

// =============================================================================
// TYPES
// =============================================================================

interface MarketPanelProps {
  marketState: GlobalMarketState | undefined;
  onUpdateMarketState: (state: GlobalMarketState) => void;
  currentChapter: number;
}

type TabType = 'items' | 'currencies' | 'settings';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Currency badge showing conversion rate
 */
const CurrencyBadge: React.FC<{ currency: CurrencyDefinition; isPrimary?: boolean }> = ({ currency, isPrimary }) => (
  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${
    isPrimary ? 'bg-amber-600/20 text-amber-400 border border-amber-600/30' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
  }`}>
    {currency.symbol && <span className="font-mono font-bold">{currency.symbol}</span>}
    <span>{currency.name}</span>
    {isPrimary && <span className="text-[10px] text-amber-500">(Primary)</span>}
  </div>
);

/**
 * Price trend indicator
 */
const TrendIndicator: React.FC<{ trend: PriceTrend }> = ({ trend }) => {
  const config = {
    stable: { icon: '→', color: 'text-zinc-400', label: 'Stable' },
    rising: { icon: '↑', color: 'text-green-400', label: 'Rising' },
    falling: { icon: '↓', color: 'text-red-400', label: 'Falling' },
    volatile: { icon: '↕', color: 'text-yellow-400', label: 'Volatile' },
  };
  const { icon, color, label } = config[trend];
  return (
    <span className={`${color} text-xs font-medium`} title={label}>
      {icon}
    </span>
  );
};

/**
 * Rarity badge
 */
const RarityBadge: React.FC<{ rarity: ItemRarity }> = ({ rarity }) => {
  const colors: Record<ItemRarity, string> = {
    common: 'bg-zinc-700 text-zinc-300',
    uncommon: 'bg-green-900/50 text-green-400',
    rare: 'bg-blue-900/50 text-blue-400',
    epic: 'bg-purple-900/50 text-purple-400',
    legendary: 'bg-amber-900/50 text-amber-400',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[rarity]} capitalize`}>
      {rarity}
    </span>
  );
};

/**
 * Category icon
 */
const CategoryIcon: React.FC<{ category: MarketItemCategory }> = ({ category }) => {
  const icons: Record<MarketItemCategory, string> = {
    pill: '💊',
    weapon: '⚔️',
    armor: '🛡️',
    material: '🌿',
    talisman: '📜',
    artifact: '💎',
    technique: '📖',
    service: '🔧',
    other: '📦',
  };
  return <span className="text-sm">{icons[category]}</span>;
};

// =============================================================================
// ITEM FORM MODAL
// =============================================================================

interface ItemFormModalProps {
  item?: MarketItem;
  currencies: CurrencyDefinition[];
  onSave: (item: MarketItem) => void;
  onClose: () => void;
  currentChapter: number;
}

const ItemFormModal: React.FC<ItemFormModalProps> = ({ item, currencies, onSave, onClose, currentChapter }) => {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState<MarketItemCategory>(item?.category || 'pill');
  const [rarity, setRarity] = useState<ItemRarity>(item?.rarity || 'common');
  const [basePrice, setBasePrice] = useState(item?.basePrice?.toString() || '100');
  const [currencyId, setCurrencyId] = useState(item?.currencyId || currencies[0]?.id || '');
  const [description, setDescription] = useState(item?.description || '');
  const [priceVariance, setPriceVariance] = useState(item?.priceVariance?.toString() || '10');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseInt(basePrice) || 100;
    
    const newItem: MarketItem = item
      ? {
          ...item,
          name,
          canonicalName: normalizeItemName(name),
          category,
          rarity,
          basePrice: price,
          currentPrice: item.currentPrice !== item.basePrice ? item.currentPrice : price,
          currencyId,
          description,
          priceVariance: parseInt(priceVariance) || 10,
          updatedAt: Date.now(),
        }
      : createMarketItem(name, category, rarity, price, currencyId, {
          description,
          priceVariance: parseInt(priceVariance) || 10,
          firstMentionedChapter: currentChapter,
        });
    
    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-amber-500 mb-4">
          {item ? 'Edit Market Item' : 'Add Market Item'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Item Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              placeholder="e.g., Foundation Establishment Pill"
              required
            />
          </div>

          {/* Category & Rarity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MarketItemCategory)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                title="Item category"
              >
                <option value="pill">Pill</option>
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
                <option value="material">Material</option>
                <option value="talisman">Talisman</option>
                <option value="artifact">Artifact</option>
                <option value="technique">Technique</option>
                <option value="service">Service</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Rarity</label>
              <select
                value={rarity}
                onChange={e => setRarity(e.target.value as ItemRarity)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                title="Item rarity"
              >
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>
          </div>

          {/* Price & Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Base Price *</label>
              <input
                type="number"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                min="1"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Currency</label>
              <select
                value={currencyId}
                onChange={e => setCurrencyId(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.symbol ? `${c.symbol} - ` : ''}{c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Price Variance */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Allowed Price Variance (%) 
              <span className="text-zinc-500 ml-1">- How much price can deviate without explanation</span>
            </label>
            <input
              type="number"
              value={priceVariance}
              onChange={e => setPriceVariance(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              min="0"
              max="100"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none resize-none"
              rows={2}
              placeholder="Brief description of the item..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-500 transition-colors"
            >
              {item ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// CURRENCY FORM MODAL
// =============================================================================

interface CurrencyFormModalProps {
  currency?: CurrencyDefinition;
  onSave: (currency: CurrencyDefinition) => void;
  onClose: () => void;
}

const CurrencyFormModal: React.FC<CurrencyFormModalProps> = ({ currency, onSave, onClose }) => {
  const [name, setName] = useState(currency?.name || '');
  const [symbol, setSymbol] = useState(currency?.symbol || '');
  const [conversionRate, setConversionRate] = useState(currency?.conversionRate?.toString() || '1');
  const [description, setDescription] = useState(currency?.description || '');
  const [isPrimary, setIsPrimary] = useState(currency?.isPrimary || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newCurrency: CurrencyDefinition = currency
      ? {
          ...currency,
          name,
          symbol: symbol || undefined,
          conversionRate: parseFloat(conversionRate) || 1,
          description: description || undefined,
          isPrimary,
          updatedAt: Date.now(),
        }
      : createCurrency(name, 'custom', parseFloat(conversionRate) || 1, {
          symbol: symbol || undefined,
          description: description || undefined,
          isPrimary,
        });
    
    onSave(newCurrency);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-amber-500 mb-4">
          {currency ? 'Edit Currency' : 'Add Currency'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name & Symbol */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Currency Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
                placeholder="e.g., Spirit Stone"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Symbol</label>
              <input
                type="text"
                value={symbol}
                onChange={e => setSymbol(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none font-mono"
                placeholder="SS"
                maxLength={5}
              />
            </div>
          </div>

          {/* Conversion Rate */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">
              Conversion Rate
              <span className="text-zinc-500 ml-1">- Relative to primary currency (1 = equal value)</span>
            </label>
            <input
              type="number"
              value={conversionRate}
              onChange={e => setConversionRate(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none"
              min="0.001"
              step="0.001"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none resize-none"
              rows={2}
              placeholder="Brief description..."
            />
          </div>

          {/* Primary */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrimary}
              onChange={e => setIsPrimary(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
            />
            <span className="text-sm text-zinc-300">Set as primary currency</span>
          </label>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-500 transition-colors"
            >
              {currency ? 'Save Changes' : 'Add Currency'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================================================
// TEMPLATE SELECTOR
// =============================================================================

interface TemplateSelectorProps {
  onSelectItems: (items: MarketItem[]) => void;
  onSelectCurrencies: (currencies: CurrencyDefinition[]) => void;
  existingItemNames: Set<string>;
  existingCurrencyNames: Set<string>;
  primaryCurrencyId: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  onSelectItems,
  onSelectCurrencies,
  existingItemNames,
  existingCurrencyNames,
  primaryCurrencyId,
}) => {
  const itemTemplates = getItemTemplates();
  const currencyTemplates = getCurrencyTemplates();

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedCurrencies, setSelectedCurrencies] = useState<Set<string>>(new Set());

  const availableItems = itemTemplates.filter(t => !existingItemNames.has(normalizeItemName(t.name)));
  const availableCurrencies = currencyTemplates.filter(t => !existingCurrencyNames.has(t.name.toLowerCase()));

  const handleAddItems = () => {
    const items = itemTemplates
      .filter(t => selectedItems.has(t.name))
      .map(t => createMarketItem(t.name, t.category, t.rarity, t.suggestedBasePrice, primaryCurrencyId, {
        description: t.description,
        tags: t.tags,
      }));
    onSelectItems(items);
    setSelectedItems(new Set());
  };

  const handleAddCurrencies = () => {
    const currencies = currencyTemplates
      .filter(t => selectedCurrencies.has(t.name))
      .map((t, i) => createCurrency(t.name, t.type, t.conversionRate, {
        symbol: t.symbol,
        description: t.description,
        grade: t.grade,
        isPrimary: i === 0 && selectedCurrencies.size === currencyTemplates.length,
      }));
    onSelectCurrencies(currencies);
    setSelectedCurrencies(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Currency Templates */}
      {availableCurrencies.length > 0 && (
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">Quick Add Currencies</span>
            <button
              onClick={handleAddCurrencies}
              disabled={selectedCurrencies.size === 0}
              className="text-xs text-amber-500 hover:text-amber-400 disabled:text-zinc-600 disabled:cursor-not-allowed"
            >
              Add Selected ({selectedCurrencies.size})
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableCurrencies.map(t => (
              <button
                key={t.name}
                onClick={() => {
                  const newSet = new Set(selectedCurrencies);
                  if (newSet.has(t.name)) {
                    newSet.delete(t.name);
                  } else {
                    newSet.add(t.name);
                  }
                  setSelectedCurrencies(newSet);
                }}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedCurrencies.has(t.name)
                    ? 'bg-amber-600/20 border-amber-600/50 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                {t.symbol ? `${t.symbol} ` : ''}{t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Item Templates */}
      {availableItems.length > 0 && (
        <div className="bg-zinc-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400 font-medium">Quick Add Common Items</span>
            <button
              onClick={handleAddItems}
              disabled={selectedItems.size === 0}
              className="text-xs text-amber-500 hover:text-amber-400 disabled:text-zinc-600 disabled:cursor-not-allowed"
            >
              Add Selected ({selectedItems.size})
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableItems.slice(0, 12).map(t => (
              <button
                key={t.name}
                onClick={() => {
                  const newSet = new Set(selectedItems);
                  if (newSet.has(t.name)) {
                    newSet.delete(t.name);
                  } else {
                    newSet.add(t.name);
                  }
                  setSelectedItems(newSet);
                }}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  selectedItems.has(t.name)
                    ? 'bg-amber-600/20 border-amber-600/50 text-amber-400'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
                title={`${t.suggestedBasePrice} SS - ${t.description || ''}`}
              >
                <CategoryIcon category={t.category} /> {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

const MarketPanelComponent: React.FC<MarketPanelProps> = ({
  marketState,
  onUpdateMarketState,
  currentChapter,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('items');
  const [editingItem, setEditingItem] = useState<MarketItem | null>(null);
  const [editingCurrency, setEditingCurrency] = useState<CurrencyDefinition | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);
  const [filterCategory, setFilterCategory] = useState<MarketItemCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized values
  const existingItemNames = useMemo(() => 
    new Set(marketState?.standardItems.map(i => i.canonicalName) || []),
    [marketState?.standardItems]
  );

  const existingCurrencyNames = useMemo(() =>
    new Set(marketState?.currencies.map(c => c.name.toLowerCase()) || []),
    [marketState?.currencies]
  );

  const primaryCurrency = useMemo(() =>
    marketState ? getPrimaryCurrency(marketState) : undefined,
    [marketState]
  );

  const filteredItems = useMemo(() => {
    if (!marketState) return [];
    let items = marketState.standardItems;
    
    if (filterCategory !== 'all') {
      items = items.filter(i => i.category === filterCategory);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(i => 
        i.name.toLowerCase().includes(query) ||
        i.description?.toLowerCase().includes(query)
      );
    }
    
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }, [marketState, filterCategory, searchQuery]);

  // Handlers
  const handleSaveItem = (item: MarketItem) => {
    if (!marketState) return;
    
    const existingIndex = marketState.standardItems.findIndex(i => i.id === item.id);
    const newItems = existingIndex >= 0
      ? marketState.standardItems.map(i => i.id === item.id ? item : i)
      : [...marketState.standardItems, item];
    
    onUpdateMarketState({
      ...marketState,
      standardItems: newItems,
      lastUpdatedChapter: currentChapter,
      updatedAt: Date.now(),
    });
    
    setEditingItem(null);
    setIsAddingItem(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (!marketState) return;
    
    onUpdateMarketState({
      ...marketState,
      standardItems: marketState.standardItems.filter(i => i.id !== itemId),
      updatedAt: Date.now(),
    });
  };

  const handleSaveCurrency = (currency: CurrencyDefinition) => {
    if (!marketState) return;
    
    let currencies = marketState.currencies;
    const existingIndex = currencies.findIndex(c => c.id === currency.id);
    
    if (existingIndex >= 0) {
      currencies = currencies.map(c => c.id === currency.id ? currency : c);
    } else {
      currencies = [...currencies, currency];
    }
    
    // Handle primary flag
    if (currency.isPrimary) {
      currencies = currencies.map(c => ({
        ...c,
        isPrimary: c.id === currency.id,
      }));
    }
    
    onUpdateMarketState({
      ...marketState,
      currencies,
      updatedAt: Date.now(),
    });
    
    setEditingCurrency(null);
    setIsAddingCurrency(false);
  };

  const handleDeleteCurrency = (currencyId: string) => {
    if (!marketState) return;
    
    onUpdateMarketState({
      ...marketState,
      currencies: marketState.currencies.filter(c => c.id !== currencyId),
      updatedAt: Date.now(),
    });
  };

  const handleAddTemplateItems = (items: MarketItem[]) => {
    if (!marketState) return;
    
    onUpdateMarketState({
      ...marketState,
      standardItems: [...marketState.standardItems, ...items],
      lastUpdatedChapter: currentChapter,
      updatedAt: Date.now(),
    });
  };

  const handleAddTemplateCurrencies = (currencies: CurrencyDefinition[]) => {
    if (!marketState) return;
    
    // If this is the first currency and none are primary, make the first one primary
    const existingHasPrimary = marketState.currencies.some(c => c.isPrimary);
    const newCurrencies = !existingHasPrimary && currencies.length > 0
      ? currencies.map((c, i) => ({ ...c, isPrimary: i === 0 }))
      : currencies;
    
    onUpdateMarketState({
      ...marketState,
      currencies: [...marketState.currencies, ...newCurrencies],
      updatedAt: Date.now(),
    });
  };

  const handleUpdateEconomicCondition = (condition: EconomicCondition) => {
    if (!marketState) return;
    
    onUpdateMarketState({
      ...marketState,
      economicCondition: condition,
      updatedAt: Date.now(),
    });
  };

  const handleUpdateMarketNotes = (notes: string) => {
    if (!marketState) return;
    
    onUpdateMarketState({
      ...marketState,
      marketNotes: notes,
      updatedAt: Date.now(),
    });
  };

  // Empty state
  if (!marketState) {
    return (
      <div className="py-8 px-4 text-center border-2 border-dashed border-zinc-700 rounded-xl bg-zinc-900/30">
        <div className="text-3xl mb-3">💰</div>
        <h3 className="text-base font-bold text-zinc-300 mb-2">No Market Data</h3>
        <p className="text-xs text-zinc-500 mb-4">
          Market state will be initialized when you open the Economy section in World Bible.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with tabs */}
      <div className="flex items-center justify-between border-b border-zinc-700 pb-3">
        <div className="flex gap-1">
          {(['items', 'currencies', 'settings'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                activeTab === tab
                  ? 'bg-amber-600/20 text-amber-400'
                  : 'text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {tab === 'items' && `Items (${marketState.standardItems.length})`}
              {tab === 'currencies' && `Currencies (${marketState.currencies.length})`}
              {tab === 'settings' && 'Settings'}
            </button>
          ))}
        </div>
        
        {activeTab === 'items' && (
          <button
            onClick={() => setIsAddingItem(true)}
            className="text-xs text-amber-500 hover:text-amber-400 font-medium"
          >
            + Add Item
          </button>
        )}
        {activeTab === 'currencies' && (
          <button
            onClick={() => setIsAddingCurrency(true)}
            className="text-xs text-amber-500 hover:text-amber-400 font-medium"
          >
            + Add Currency
          </button>
        )}
      </div>

      {/* Quick Add Templates */}
      {(activeTab === 'items' || activeTab === 'currencies') && (
        <TemplateSelector
          onSelectItems={handleAddTemplateItems}
          onSelectCurrencies={handleAddTemplateCurrencies}
          existingItemNames={existingItemNames}
          existingCurrencyNames={existingCurrencyNames}
          primaryCurrencyId={primaryCurrency?.id || ''}
        />
      )}

      {/* Items Tab */}
      {activeTab === 'items' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search items..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
            />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value as MarketItemCategory | 'all')}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="pill">Pills</option>
              <option value="weapon">Weapons</option>
              <option value="armor">Armor</option>
              <option value="material">Materials</option>
              <option value="talisman">Talismans</option>
              <option value="artifact">Artifacts</option>
              <option value="technique">Techniques</option>
              <option value="service">Services</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Items List */}
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-zinc-500 text-xs">
              {marketState.standardItems.length === 0
                ? 'No items yet. Add items manually or use the quick-add templates above.'
                : 'No items match your search.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {filteredItems.map(item => {
                const currency = marketState.currencies.find(c => c.id === item.currencyId);
                const effectivePrice = getEffectivePrice(marketState, item.id);
                
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-2.5 hover:border-zinc-600 transition-colors group"
                  >
                    <CategoryIcon category={item.category} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-200 font-medium truncate">{item.name}</span>
                        <RarityBadge rarity={item.rarity} />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-mono">
                          {effectivePrice.toLocaleString()} {currency?.symbol || currency?.name || 'SS'}
                        </span>
                        <TrendIndicator trend={item.trend} />
                        {item.description && (
                          <span className="truncate max-w-[150px]" title={item.description}>
                            - {item.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="text-[10px] text-zinc-400 hover:text-amber-500 px-2 py-1 rounded bg-zinc-700/50 hover:bg-zinc-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-[10px] text-zinc-400 hover:text-red-500 px-2 py-1 rounded bg-zinc-700/50 hover:bg-zinc-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Currencies Tab */}
      {activeTab === 'currencies' && (
        <div className="space-y-2">
          {marketState.currencies.length === 0 ? (
            <div className="py-6 text-center text-zinc-500 text-xs">
              No currencies defined. Add currencies manually or use the quick-add templates above.
            </div>
          ) : (
            marketState.currencies.map(currency => (
              <div
                key={currency.id}
                className="flex items-center gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 hover:border-zinc-600 transition-colors group"
              >
                <CurrencyBadge currency={currency} isPrimary={currency.isPrimary} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-500">
                    Conversion: {currency.conversionRate}x
                    {currency.description && ` - ${currency.description}`}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingCurrency(currency)}
                    className="text-[10px] text-zinc-400 hover:text-amber-500 px-2 py-1 rounded bg-zinc-700/50 hover:bg-zinc-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCurrency(currency.id)}
                    className="text-[10px] text-zinc-400 hover:text-red-500 px-2 py-1 rounded bg-zinc-700/50 hover:bg-zinc-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          {/* Economic Condition */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Global Economic Condition</label>
            <div className="grid grid-cols-2 gap-2">
              {(['normal', 'boom', 'recession', 'war_economy', 'scarcity', 'abundance'] as EconomicCondition[]).map(condition => (
                <button
                  key={condition}
                  onClick={() => handleUpdateEconomicCondition(condition)}
                  className={`text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                    marketState.economicCondition === condition
                      ? 'bg-amber-600/20 border-amber-600/50 text-amber-400'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-medium capitalize">{condition.replace('_', ' ')}</div>
                  <div className="text-[10px] text-zinc-500">
                    {condition === 'normal' && 'Standard prices'}
                    {condition === 'boom' && '+10-20% all prices'}
                    {condition === 'recession' && '-10-20% all prices'}
                    {condition === 'war_economy' && '+30% weapons/armor, -10% luxury'}
                    {condition === 'scarcity' && '+50% all prices'}
                    {condition === 'abundance' && '-30% all prices'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Market Notes */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">
              Market Notes
              <span className="text-zinc-500 ml-1">- Special conditions or rules for the AI to follow</span>
            </label>
            <textarea
              value={marketState.marketNotes || ''}
              onChange={e => handleUpdateMarketNotes(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-amber-500 focus:outline-none resize-none"
              rows={3}
              placeholder="e.g., 'The southern regions have higher pill prices due to herb scarcity...'"
            />
          </div>

          {/* Stats */}
          <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400">
            <div className="grid grid-cols-2 gap-2">
              <div>Total Items: <span className="text-zinc-200">{marketState.standardItems.length}</span></div>
              <div>Currencies: <span className="text-zinc-200">{marketState.currencies.length}</span></div>
              <div>Last Updated: <span className="text-zinc-200">Chapter {marketState.lastUpdatedChapter}</span></div>
              <div>Condition: <span className="text-zinc-200 capitalize">{marketState.economicCondition}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {(isAddingItem || editingItem) && (
        <ItemFormModal
          item={editingItem || undefined}
          currencies={marketState.currencies}
          onSave={handleSaveItem}
          onClose={() => {
            setIsAddingItem(false);
            setEditingItem(null);
          }}
          currentChapter={currentChapter}
        />
      )}

      {(isAddingCurrency || editingCurrency) && (
        <CurrencyFormModal
          currency={editingCurrency || undefined}
          onSave={handleSaveCurrency}
          onClose={() => {
            setIsAddingCurrency(false);
            setEditingCurrency(null);
          }}
        />
      )}
    </div>
  );
};

export const MarketPanel = memo(MarketPanelComponent);
