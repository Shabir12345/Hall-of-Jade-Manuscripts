
import React, { useState } from 'react';
import { NovelState, Territory } from '../types';
import VoiceInput from './VoiceInput';
import CreativeSpark from './CreativeSpark';

interface WorldMapViewProps {
  state: NovelState;
  onSaveTerritory: (territory: Territory) => void;
  onDeleteTerritory: (id: string) => void;
}

const WorldMapView: React.FC<WorldMapViewProps> = ({ state, onSaveTerritory, onDeleteTerritory }) => {
  const [editingTerritory, setEditingTerritory] = useState<Partial<Territory> | null>(null);
  const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
  const currentTerritories = state.territories.filter(t => t.realmId === state.currentRealmId);

  const handleAddNew = () => {
    setEditingTerritory({
      id: crypto.randomUUID(),
      realmId: state.currentRealmId,
      name: '',
      type: 'Neutral',
      description: ''
    });
  };

  const handleSave = () => {
    if (editingTerritory && editingTerritory.name && editingTerritory.description) {
      onSaveTerritory(editingTerritory as Territory);
      setEditingTerritory(null);
    }
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-6xl mx-auto space-y-8 md:space-y-12 animate-in fade-in duration-300 pt-20 md:pt-24">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-zinc-700 pb-6 md:pb-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase break-words">Cosmic Geography</h2>
          <p className="text-zinc-400 mt-2 text-sm flex flex-wrap items-center gap-2">Currently in: <span className="text-amber-300 font-semibold">{currentRealm?.name}</span></p>
        </div>
        <div className="flex items-center flex-wrap gap-4 md:gap-6 w-full md:w-auto flex-shrink-0">
          <button 
            onClick={handleAddNew}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105 whitespace-nowrap"
            aria-label="Add new territory"
          >
            + Forge Territory
          </button>
          <div className="text-right border-l border-zinc-700 pl-4 md:pl-6 flex-shrink-0">
            <p className="text-xl md:text-2xl font-fantasy font-bold text-zinc-200">{state.realms.length}</p>
            <p className="text-xs text-zinc-500 font-semibold uppercase mt-1">Realms Discovered</p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
        <aside className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider border-l-4 border-amber-600 pl-4">Realms</h3>
          <div className="space-y-3">
            {state.realms.map(realm => (
              <div 
                key={realm.id}
                className={`p-4 rounded-xl border transition-all duration-200 ${realm.status === 'current' ? 'bg-amber-600/15 border-amber-600/50 text-amber-500' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600'}`}
              >
                <p className="font-fantasy text-sm font-semibold">{realm.name}</p>
                <p className="text-xs opacity-70 mt-1 font-semibold">{realm.status.toUpperCase()}</p>
              </div>
            ))}
          </div>
        </aside>

        <section className="lg:col-span-3 space-y-6 md:space-y-8">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider border-l-4 border-amber-600 pl-4">Territories & Domains</h3>
          {currentTerritories.length === 0 ? (
            <div className="py-16 px-8 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
              <div className="text-6xl mb-4">🏔️</div>
              <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Territories Yet</h3>
              <p className="text-sm text-zinc-500 mb-6">Start mapping your world by adding territories to this realm.</p>
              <button
                onClick={handleAddNew}
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
              >
                Add First Territory
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {currentTerritories.map(territory => (
                <div key={territory.id} className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl relative overflow-hidden group hover:border-amber-600/50 transition-all duration-200 hover:shadow-xl hover:shadow-amber-900/5">
                  <div className="absolute top-3 right-3 flex space-x-2 z-10">
                    <button 
                      onClick={() => setEditingTerritory(territory)}
                      className="text-xs text-zinc-400 hover:text-amber-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-all duration-200 focus-visible:outline-amber-600 focus-visible:outline-2 shadow-lg"
                      title="Edit Territory"
                      aria-label={`Edit ${territory.name}`}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => onDeleteTerritory(territory.id)}
                      className="text-xs text-zinc-400 hover:text-red-500 uppercase font-semibold bg-zinc-800/90 backdrop-blur-sm hover:bg-zinc-700 px-3 py-1.5 rounded-lg transition-all duration-200 focus-visible:outline-red-600 focus-visible:outline-2 shadow-lg"
                      title="Delete Territory"
                      aria-label={`Delete ${territory.name}`}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="absolute -bottom-2 -right-2 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none">
                    <span className="text-6xl grayscale">🏔️</span>
                  </div>
                  <span className="text-xs font-bold text-zinc-500 uppercase mb-2 block px-2 py-1 bg-zinc-800/50 rounded-md inline-block">{territory.type}</span>
                  <h4 className="font-fantasy text-lg md:text-xl font-bold text-zinc-200 group-hover:text-amber-500 transition-colors mb-2 pr-28 break-words">{territory.name}</h4>
                  <p className="text-sm md:text-base text-zinc-400 mt-2 font-serif-novel leading-relaxed">{territory.description}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingTerritory && (
        <div 
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] p-4 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setEditingTerritory(null)}
        >
          <div className="bg-zinc-900 border border-zinc-700 p-6 md:p-10 rounded-2xl w-full max-w-xl shadow-2xl animate-in scale-in">
            <div className="flex justify-between items-center mb-6 md:mb-8">
              <h3 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500">Manifest Territory</h3>
              <div className="flex items-center space-x-2">
                <CreativeSpark 
                  type="Territory Description" 
                  currentValue={editingTerritory.description || ""} 
                  state={state} 
                  onIdea={(idea) => setEditingTerritory({...editingTerritory, description: idea})} 
                />
                <VoiceInput onResult={(text) => setEditingTerritory({...editingTerritory, description: editingTerritory.description ? editingTerritory.description + " " + text : text})} />
                <button
                  onClick={() => setEditingTerritory(null)}
                  className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors duration-200"
                  aria-label="Close dialog"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="territory-name">Name</label>
                    <VoiceInput onResult={(text) => setEditingTerritory({...editingTerritory, name: text})} />
                  </div>
                  <input 
                    id="territory-name"
                    placeholder="e.g. Great Tang Empire" 
                    value={editingTerritory.name} 
                    onChange={e => setEditingTerritory({...editingTerritory, name: e.target.value})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                    aria-required="true"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="territory-type">Type</label>
                  <select 
                    id="territory-type"
                    value={editingTerritory.type} 
                    onChange={e => setEditingTerritory({...editingTerritory, type: e.target.value as any})} 
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 appearance-none outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all cursor-pointer"
                    aria-label="Territory Type"
                  >
                    <option>Empire</option>
                    <option>Kingdom</option>
                    <option>Neutral</option>
                    <option>Hidden</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="territory-description">Description</label>
                <textarea 
                  id="territory-description"
                  placeholder="History, features, or legendary origins... (Voice & Spark Input Available)" 
                  value={editingTerritory.description} 
                  onChange={e => setEditingTerritory({...editingTerritory, description: e.target.value})} 
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-40 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
                  aria-required="true"
                />
              </div>
              <div className="flex justify-end space-x-4 pt-4 border-t border-zinc-700">
                <button 
                  onClick={() => setEditingTerritory(null)} 
                  className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!editingTerritory.name || !editingTerritory.description}
                  className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/30 hover:scale-105 disabled:hover:scale-100"
                >
                  Seal Territory
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorldMapView;
