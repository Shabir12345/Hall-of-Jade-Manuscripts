import React, { useState, useEffect, useCallback } from 'react';
import { NovelState } from '../types';
import {
  createDefaultMarketState,
  createMarketItem,
  addMarketItem,
  updateItemPrice,
  updateMarketItem,
  removeMarketItem,
  addPriceModifier,
  updateProtagonistWealth,
  getPrimaryCurrency,
  getEffectivePrice,
  getItemsByCategory,
  detectEconomicScene,
  formatMarketForPrompt,
} from '../services/market';
import {
  saveMarketState,
  loadOrCreateMarketState,
  getMarketStats,
} from '../services/market/marketPersistence';
import type {
  GlobalMarketState,
  MarketItem,
  CurrencyDefinition,
  PriceModifier,
  EconomicCondition,
  MarketItemCategory,
  ItemRarity,
} from '../types/market';
import { DEFAULT_MARKET_ITEMS, DEFAULT_CURRENCIES } from '../types/market';
import { logger } from '../services/loggingService';

interface MarketDashboardProps {
  novelState: NovelState | null;
  onMarketStateChange?: (state: GlobalMarketState) => void;
}

type TabType = 'overview' | 'items' | 'currencies' | 'modifiers' | 'promptPreview';

export const MarketDashboard: React.FC<MarketDashboardProps> = ({ novelState, onMarketStateChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [marketState, setMarketState] = useState<GlobalMarketState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalItems: number;
    totalCurrencies: number;
    activeModifiers: number;
    priceUpdatesThisSession: number;
  } | null>(null);

  // Form states
  const [newItemForm, setNewItemForm] = useState({
    name: '',
    category: 'pill' as MarketItemCategory,
    rarity: 'common' as ItemRarity,
    basePrice: 100,
    description: '',
  });

  const [economicSceneTest, setEconomicSceneTest] = useState('');
  const [economicSceneResult, setEconomicSceneResult] = useState<{
    hasEconomicContent: boolean;
    detectedKeywords: string[];
    suggestedContext: string;
    confidence: number;
  } | null>(null);

  // Load market state when novel changes
  useEffect(() => {
    if (novelState) {
      loadMarketState();
    }
  }, [novelState?.id]);

  const loadMarketState = useCallback(async () => {
    if (!novelState) return;

    setIsLoading(true);
    setError(null);

    try {
      const state = await loadOrCreateMarketState(novelState.id, true);
      setMarketState(state);
      onMarketStateChange?.(state);

      const statsData = await getMarketStats(novelState.id);
      setStats(statsData);

    } catch (err) {
      logger.error('Failed to load market state', 'MarketDashboard', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load market data');
    } finally {
      setIsLoading(false);
    }
  }, [novelState, onMarketStateChange]);

  const handleSave = async () => {
    if (!marketState) return;

    setIsSaving(true);
    setError(null);

    try {
      await saveMarketState(marketState);
      onMarketStateChange?.(marketState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddItem = () => {
    if (!marketState || !newItemForm.name) return;

    const primaryCurrency = getPrimaryCurrency(marketState);
    if (!primaryCurrency) return;

    const newItem = createMarketItem(
      newItemForm.name,
      newItemForm.category,
      newItemForm.rarity,
      newItemForm.basePrice,
      primaryCurrency.id,
      { description: newItemForm.description }
    );

    const updated = addMarketItem(marketState, newItem);
    setMarketState(updated);
    setNewItemForm({ name: '', category: 'pill', rarity: 'common', basePrice: 100, description: '' });
  };

  const handleUpdatePrice = (itemId: string, newPrice: number) => {
    if (!marketState) return;

    const chapterNumber = novelState?.chapters.length || 1;
    const updated = updateItemPrice(marketState, itemId, newPrice, chapterNumber, 'Manual update');
    setMarketState(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!marketState) return;

    const updated = removeMarketItem(marketState, itemId);
    setMarketState(updated);
  };

  const handleEconomicConditionChange = (condition: EconomicCondition) => {
    if (!marketState) return;

    const updated = {
      ...marketState,
      economicCondition: condition,
      updatedAt: Date.now(),
    };
    setMarketState(updated);
  };

  const handleTestEconomicScene = () => {
    const result = detectEconomicScene(economicSceneTest);
    setEconomicSceneResult(result);
  };

  const handleAddDefaultItems = () => {
    if (!marketState) return;

    const primaryCurrency = getPrimaryCurrency(marketState);
    if (!primaryCurrency) return;

    let updated = marketState;
    for (const template of DEFAULT_MARKET_ITEMS) {
      // Skip if item already exists
      if (marketState.standardItems.some(i => i.canonicalName === template.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim())) {
        continue;
      }

      const newItem = createMarketItem(
        template.name,
        template.category,
        template.rarity,
        template.suggestedBasePrice,
        primaryCurrency.id,
        {
          description: template.description,
          tags: template.tags,
        }
      );
      updated = addMarketItem(updated, newItem);
    }

    setMarketState(updated);
  };

  if (!novelState) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>Select a novel to view Market data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Spirit Stone Market - Economic Simulation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track prices and maintain economic consistency
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadMarketState}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !marketState}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          {(['overview', 'items', 'currencies', 'modifiers', 'promptPreview'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'items' && `Items (${marketState?.standardItems.length || 0})`}
              {tab === 'currencies' && 'Currencies'}
              {tab === 'modifiers' && 'Modifiers'}
              {tab === 'promptPreview' && 'Prompt Preview'}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        {activeTab === 'overview' && marketState && (
          <OverviewTab
            marketState={marketState}
            stats={stats}
            onConditionChange={handleEconomicConditionChange}
            economicSceneTest={economicSceneTest}
            setEconomicSceneTest={setEconomicSceneTest}
            economicSceneResult={economicSceneResult}
            onTestScene={handleTestEconomicScene}
          />
        )}
        {activeTab === 'items' && marketState && (
          <ItemsTab
            marketState={marketState}
            newItemForm={newItemForm}
            setNewItemForm={setNewItemForm}
            onAddItem={handleAddItem}
            onUpdatePrice={handleUpdatePrice}
            onRemoveItem={handleRemoveItem}
            onAddDefaults={handleAddDefaultItems}
          />
        )}
        {activeTab === 'currencies' && marketState && (
          <CurrenciesTab marketState={marketState} />
        )}
        {activeTab === 'modifiers' && marketState && (
          <ModifiersTab marketState={marketState} />
        )}
        {activeTab === 'promptPreview' && marketState && (
          <PromptPreviewTab marketState={marketState} />
        )}
      </div>
    </div>
  );
};

// Tab Components

const OverviewTab: React.FC<{
  marketState: GlobalMarketState;
  stats: any;
  onConditionChange: (condition: EconomicCondition) => void;
  economicSceneTest: string;
  setEconomicSceneTest: (val: string) => void;
  economicSceneResult: any;
  onTestScene: () => void;
}> = ({ marketState, stats, onConditionChange, economicSceneTest, setEconomicSceneTest, economicSceneResult, onTestScene }) => {
  const primaryCurrency = getPrimaryCurrency(marketState);
  
  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Items Tracked" value={marketState.standardItems.length} />
        <StatCard label="Currencies" value={marketState.currencies.length} />
        <StatCard label="Active Modifiers" value={marketState.priceModifiers.filter(m => m.isActive).length} />
        <StatCard label="Last Updated Ch." value={marketState.lastUpdatedChapter} />
      </div>

      {/* Economic Condition */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
        <h4 className="font-medium mb-3">Economic Condition</h4>
        <div className="flex flex-wrap gap-2">
          {(['normal', 'boom', 'recession', 'war_economy', 'scarcity', 'abundance'] as EconomicCondition[]).map((condition) => (
            <button
              key={condition}
              onClick={() => onConditionChange(condition)}
              className={`px-3 py-1.5 text-sm rounded ${
                marketState.economicCondition === condition
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {condition.replace('_', ' ')}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {marketState.economicCondition === 'normal' && 'Standard prices apply'}
          {marketState.economicCondition === 'boom' && 'Prices inflated 15%'}
          {marketState.economicCondition === 'recession' && 'Prices deflated 15%'}
          {marketState.economicCondition === 'war_economy' && 'Weapons/armor +30%, luxuries -10%'}
          {marketState.economicCondition === 'scarcity' && 'All prices +50%'}
          {marketState.economicCondition === 'abundance' && 'All prices -30%'}
        </p>
      </div>

      {/* Primary Currency */}
      {primaryCurrency && (
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
          <h4 className="font-medium mb-2">Primary Currency</h4>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{primaryCurrency.symbol || primaryCurrency.name}</span>
            <span className="text-gray-500">{primaryCurrency.name}</span>
          </div>
        </div>
      )}

      {/* Economic Scene Tester */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
        <h4 className="font-medium mb-3">Economic Scene Detector Test</h4>
        <textarea
          value={economicSceneTest}
          onChange={(e) => setEconomicSceneTest(e.target.value)}
          placeholder="Paste chapter text to test economic scene detection..."
          className="w-full h-24 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 text-sm"
        />
        <button
          onClick={onTestScene}
          className="mt-2 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test Detection
        </button>
        {economicSceneResult && (
          <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded text-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${economicSceneResult.hasEconomicContent ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="font-medium">
                {economicSceneResult.hasEconomicContent ? 'Economic content detected' : 'No economic content'}
              </span>
            </div>
            {economicSceneResult.hasEconomicContent && (
              <>
                <div className="mt-2">
                  <span className="text-gray-500">Scene type:</span> {economicSceneResult.suggestedContext}
                </div>
                <div>
                  <span className="text-gray-500">Confidence:</span> {(economicSceneResult.confidence * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Keywords: {economicSceneResult.detectedKeywords.join(', ')}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ItemsTab: React.FC<{
  marketState: GlobalMarketState;
  newItemForm: any;
  setNewItemForm: (form: any) => void;
  onAddItem: () => void;
  onUpdatePrice: (itemId: string, price: number) => void;
  onRemoveItem: (itemId: string) => void;
  onAddDefaults: () => void;
}> = ({ marketState, newItemForm, setNewItemForm, onAddItem, onUpdatePrice, onRemoveItem, onAddDefaults }) => {
  const [selectedCategory, setSelectedCategory] = useState<MarketItemCategory | 'all'>('all');
  
  const filteredItems = selectedCategory === 'all'
    ? marketState.standardItems
    : getItemsByCategory(marketState, selectedCategory);

  return (
    <div className="space-y-4">
      {/* Add Item Form */}
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Add New Item</h4>
          <button
            onClick={onAddDefaults}
            className="text-xs px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300"
          >
            Add All Defaults
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <input
            type="text"
            placeholder="Item name"
            value={newItemForm.name}
            onChange={(e) => setNewItemForm({ ...newItemForm, name: e.target.value })}
            className="px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
          />
          <select
            value={newItemForm.category}
            onChange={(e) => setNewItemForm({ ...newItemForm, category: e.target.value })}
            className="px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
          >
            {['pill', 'weapon', 'armor', 'material', 'talisman', 'artifact', 'technique', 'service', 'other'].map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <select
            value={newItemForm.rarity}
            onChange={(e) => setNewItemForm({ ...newItemForm, rarity: e.target.value })}
            className="px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
          >
            {['common', 'uncommon', 'rare', 'epic', 'legendary'].map((rar) => (
              <option key={rar} value={rar}>{rar}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Base price"
            value={newItemForm.basePrice}
            onChange={(e) => setNewItemForm({ ...newItemForm, basePrice: parseInt(e.target.value) || 0 })}
            className="px-2 py-1.5 border rounded text-sm dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={onAddItem}
            disabled={!newItemForm.name}
            className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600 disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'pill', 'weapon', 'armor', 'material', 'talisman', 'artifact', 'technique', 'service', 'other'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 text-xs rounded ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items List */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No items in this category</p>
        ) : (
          filteredItems.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              marketState={marketState}
              onUpdatePrice={onUpdatePrice}
              onRemove={onRemoveItem}
            />
          ))
        )}
      </div>
    </div>
  );
};

const ItemRow: React.FC<{
  item: MarketItem;
  marketState: GlobalMarketState;
  onUpdatePrice: (itemId: string, price: number) => void;
  onRemove: (itemId: string) => void;
}> = ({ item, marketState, onUpdatePrice, onRemove }) => {
  const [editPrice, setEditPrice] = useState(item.currentPrice);
  const [isEditing, setIsEditing] = useState(false);
  const effectivePrice = getEffectivePrice(marketState, item.id);
  const currency = marketState.currencies.find(c => c.id === item.currencyId);

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <span className={`px-1.5 py-0.5 text-xs rounded ${
            item.rarity === 'legendary' ? 'bg-yellow-100 text-yellow-800' :
            item.rarity === 'epic' ? 'bg-purple-100 text-purple-800' :
            item.rarity === 'rare' ? 'bg-blue-100 text-blue-800' :
            item.rarity === 'uncommon' ? 'bg-green-100 text-green-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {item.rarity}
          </span>
          <span className="text-xs text-gray-400">{item.category}</span>
        </div>
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(parseInt(e.target.value) || 0)}
                className="w-20 px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                onClick={() => {
                  onUpdatePrice(item.id, editPrice);
                  setIsEditing(false);
                }}
                className="text-xs px-2 py-1 bg-green-500 text-white rounded"
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-xs px-2 py-1 bg-gray-300 dark:bg-gray-600 rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <div className="text-right">
                <div className="font-medium">{effectivePrice.toLocaleString()} {currency?.symbol || 'SS'}</div>
                {effectivePrice !== item.basePrice && (
                  <div className="text-xs text-gray-400">Base: {item.basePrice.toLocaleString()}</div>
                )}
              </div>
              <span className={`text-xs ${
                item.trend === 'rising' ? 'text-green-600' :
                item.trend === 'falling' ? 'text-red-600' :
                item.trend === 'volatile' ? 'text-yellow-600' :
                'text-gray-400'
              }`}>
                {item.trend === 'rising' ? '↑' : item.trend === 'falling' ? '↓' : item.trend === 'volatile' ? '↕' : '—'}
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded"
              >
                Edit
              </button>
              <button
                onClick={() => onRemove(item.id)}
                className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </div>
      {item.description && (
        <p className="text-xs text-gray-500 mt-1">{item.description}</p>
      )}
    </div>
  );
};

const CurrenciesTab: React.FC<{ marketState: GlobalMarketState }> = ({ marketState }) => (
  <div className="space-y-4">
    <h4 className="font-medium">Defined Currencies</h4>
    <div className="space-y-2">
      {marketState.currencies.map((currency) => (
        <div key={currency.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold">{currency.symbol || currency.name.charAt(0)}</span>
            <div>
              <div className="font-medium">{currency.name}</div>
              <div className="text-xs text-gray-500">{currency.type} {currency.grade && `(${currency.grade})`}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm">Rate: {currency.conversionRate}x</div>
            {currency.isPrimary && (
              <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded">
                Primary
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
    <p className="text-xs text-gray-500">
      Default currencies based on standard cultivation novel economics.
      Custom currencies can be added via the API.
    </p>
  </div>
);

const ModifiersTab: React.FC<{ marketState: GlobalMarketState }> = ({ marketState }) => (
  <div className="space-y-4">
    <h4 className="font-medium">Price Modifiers</h4>
    {marketState.priceModifiers.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No price modifiers active</p>
    ) : (
      <div className="space-y-2">
        {marketState.priceModifiers.map((modifier) => (
          <div key={modifier.id} className={`p-3 rounded border ${
            modifier.isActive
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{modifier.name}</span>
                {!modifier.isActive && (
                  <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                )}
              </div>
              <span className={`font-mono ${
                modifier.percentageModifier > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {modifier.percentageModifier > 0 ? '+' : ''}{modifier.percentageModifier}%
              </span>
            </div>
            {modifier.description && (
              <p className="text-xs text-gray-500 mt-1">{modifier.description}</p>
            )}
            <div className="text-xs text-gray-400 mt-1">
              Since chapter {modifier.introducedChapter}
              {modifier.expiresChapter && ` until chapter ${modifier.expiresChapter}`}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const PromptPreviewTab: React.FC<{ marketState: GlobalMarketState }> = ({ marketState }) => {
  const promptText = formatMarketForPrompt(marketState, {
    includeAllItems: false,
    maxItems: 15,
    includeWealth: true,
    includeModifiers: true,
  });

  return (
    <div className="space-y-4">
      <h4 className="font-medium">Prompt Preview</h4>
      <p className="text-sm text-gray-500">
        This is the economic context that will be injected into chapter generation prompts
        when economic scenes are detected.
      </p>
      <pre className="p-4 bg-gray-900 text-gray-100 rounded text-xs font-mono overflow-auto max-h-[500px] whitespace-pre-wrap">
        {promptText}
      </pre>
    </div>
  );
};

// Helper Components

const StatCard: React.FC<{ label: string; value: number | string }> = ({ label, value }) => (
  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
  </div>
);

export default MarketDashboard;
