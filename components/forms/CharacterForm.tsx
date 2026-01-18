import React, { useCallback, useState, useMemo } from 'react';
import type { Character, NovelState, Relationship } from '../../types';
import { Modal } from '../Modal';
import VoiceInput from '../VoiceInput';
import CreativeSpark from '../CreativeSpark';
import { CHARACTER_TEMPLATES, type CharacterTemplate, applyCharacterTemplate } from '../../utils/templates';

interface CharacterFormProps {
  character: Character;
  novelState: NovelState;
  onSave: (character: Character) => void;
  onCancel: () => void;
  onUpdateCharacter: (character: Character) => void;
}

export const CharacterForm: React.FC<CharacterFormProps> = ({
  character,
  novelState,
  onSave,
  onCancel,
  onUpdateCharacter,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<CharacterTemplate | null>(null);

  const handleSave = useCallback(() => {
    onSave(character);
  }, [character, onSave]);

  const handleTemplateSelect = useCallback((template: CharacterTemplate) => {
    const templateData = applyCharacterTemplate(template);
    onUpdateCharacter({ ...character, ...templateData });
    setSelectedTemplate(template);
    setShowTemplates(false);
  }, [character, onUpdateCharacter]);

  const updateRelationship = useCallback((idx: number, updater: (rel: Relationship) => Relationship) => {
    const newRels = [...character.relationships];
    newRels[idx] = updater(newRels[idx]);
    onUpdateCharacter({ ...character, relationships: newRels });
  }, [character, onUpdateCharacter]);

  const addRelationship = useCallback(() => {
    onUpdateCharacter({
      ...character,
      relationships: [...character.relationships, { characterId: '', type: 'Ally', history: '', impact: '' }]
    });
  }, [character, onUpdateCharacter]);

  const removeRelationship = useCallback((idx: number) => {
    onUpdateCharacter({
      ...character,
      relationships: character.relationships.filter((_, i) => i !== idx)
    });
  }, [character, onUpdateCharacter]);

  const addSkill = useCallback((skill: string) => {
    onUpdateCharacter({
      ...character,
      skills: [...character.skills, skill]
    });
  }, [character, onUpdateCharacter]);

  const removeSkill = useCallback((idx: number) => {
    onUpdateCharacter({
      ...character,
      skills: character.skills.filter((_, i) => i !== idx)
    });
  }, [character, onUpdateCharacter]);

  const addItem = useCallback((item: string) => {
    onUpdateCharacter({
      ...character,
      items: [...character.items, item]
    });
  }, [character, onUpdateCharacter]);

  const removeItem = useCallback((idx: number) => {
    onUpdateCharacter({
      ...character,
      items: character.items.filter((_, i) => i !== idx)
    });
  }, [character, onUpdateCharacter]);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Character Manifestation"
      maxWidth="3xl"
      headerActions={
        <>
          <CreativeSpark 
            type="Character Backstory" 
            currentValue={character.notes} 
            state={novelState} 
            onIdea={(idea) => onUpdateCharacter({ ...character, notes: idea })} 
          />
          <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, notes: character.notes ? character.notes + " " + text : text })} />
        </>
      }
    >
      {/* Template Selection */}
      {!character.name && (
        <div className="mb-6 p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Character Templates</label>
            <button
              type="button"
              onClick={() => setShowTemplates(!showTemplates)}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >
              {showTemplates ? 'Hide' : 'Show'} Templates
            </button>
          </div>
          {showTemplates && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto scrollbar-thin">
              {CHARACTER_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-amber-500 bg-amber-950/20'
                      : 'border-zinc-700 bg-zinc-950 hover:border-zinc-600'
                  }`}
                >
                  <div className="font-semibold text-zinc-200 text-sm">{template.name}</div>
                  <div className="text-xs text-zinc-400 mt-1">{template.description}</div>
                  <div className="text-xs text-zinc-500 mt-1">Type: {template.archetype}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Basic Info Section */}
        <div className="col-span-2">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-700">Basic Info</h3>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-name">Name</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, name: text })} />
          </div>
          <input 
            id="char-name"
            placeholder="Name" 
            value={character.name} 
            onChange={e => onUpdateCharacter({ ...character, name: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-age">Age</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, age: text })} />
          </div>
          <input 
            id="char-age"
            placeholder="Age" 
            value={character.age || ''} 
            onChange={e => onUpdateCharacter({ ...character, age: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-personality">Personality</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, personality: text })} />
          </div>
          <input 
            id="char-personality"
            placeholder="Personality traits..." 
            value={character.personality || ''} 
            onChange={e => onUpdateCharacter({ ...character, personality: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-realm">Realm</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, currentCultivation: text })} />
          </div>
          <input 
            id="char-realm"
            placeholder="Realm" 
            value={character.currentCultivation} 
            onChange={e => onUpdateCharacter({ ...character, currentCultivation: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-status">Status</label>
          <select
            id="char-status"
            value={character.status}
            onChange={e => onUpdateCharacter({ ...character, status: e.target.value as 'Alive' | 'Deceased' | 'Unknown' })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          >
            <option value="Alive">Alive</option>
            <option value="Deceased">Deceased</option>
            <option value="Unknown">Unknown</option>
          </select>
        </div>

        <div className="col-span-2 pt-2">
          <label className="flex items-center justify-between gap-4 bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3">
            <span className="text-sm font-semibold text-zinc-300">
              Protagonist (main character)
              <span className="block text-[11px] text-zinc-500 font-normal mt-1">
                You can mark multiple characters as protagonists.
              </span>
            </span>
            <input
              type="checkbox"
              checked={!!character.isProtagonist}
              onChange={(e) => onUpdateCharacter({ ...character, isProtagonist: e.target.checked })}
              className="h-5 w-5 accent-amber-500"
              aria-label="Mark as protagonist"
            />
          </label>
        </div>
        
        {/* Character Depth Section */}
        <div className="col-span-2 pt-6 border-t border-zinc-700 mt-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-700">Character Depth</h3>
        </div>
        
        <div className="col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-appearance">Appearance</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, appearance: text })} />
          </div>
          <textarea 
            id="char-appearance"
            placeholder="Physical description, distinctive features..." 
            value={character.appearance || ''} 
            onChange={e => onUpdateCharacter({ ...character, appearance: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-24 resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
          />
        </div>
        
        <div className="col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-background">Background</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, background: text })} />
          </div>
          <textarea 
            id="char-background"
            placeholder="Origin story, past experiences, upbringing..." 
            value={character.background || ''} 
            onChange={e => onUpdateCharacter({ ...character, background: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-24 resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
          />
        </div>
        
        <div className="col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-goals">Goals</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, goals: text })} />
          </div>
          <textarea 
            id="char-goals"
            placeholder="Motivations, desires, what they seek to achieve..." 
            value={character.goals || ''} 
            onChange={e => onUpdateCharacter({ ...character, goals: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-24 resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
          />
        </div>
        
        <div className="col-span-2 space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-flaws">Flaws</label>
            <VoiceInput onResult={(text) => onUpdateCharacter({ ...character, flaws: text })} />
          </div>
          <textarea 
            id="char-flaws"
            placeholder="Weaknesses, vulnerabilities, character flaws..." 
            value={character.flaws || ''} 
            onChange={e => onUpdateCharacter({ ...character, flaws: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-24 resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
          />
        </div>

        <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-700">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Techniques</label>
              <CreativeSpark 
                type="Spiritual Technique or Spell" 
                currentValue="" 
                state={novelState} 
                onIdea={(idea) => addSkill(idea.split('\n')[0].replace('Name: ', ''))} 
                label="Forge Skill"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {character.skills.map((s, i) => (
                <div key={i} className="flex items-center bg-emerald-950/40 border border-emerald-900/40 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-emerald-400 font-semibold">{s}</span>
                  <button 
                    onClick={() => removeSkill(i)} 
                    className="ml-2 text-emerald-700 hover:text-emerald-400 transition-colors"
                    aria-label={`Remove ${s}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {character.skills.length === 0 && (
                <p className="text-xs text-zinc-500 italic">No techniques added yet</p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Treasures</label>
              <CreativeSpark 
                type="Magical Item or Treasure" 
                currentValue="" 
                state={novelState} 
                onIdea={(idea) => addItem(idea.split('\n')[0].replace('Name: ', ''))} 
                label="Forge Item"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {character.items.map((it, i) => (
                <div key={i} className="flex items-center bg-amber-950/40 border border-amber-900/40 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-amber-400 font-semibold">{it}</span>
                  <button 
                    onClick={() => removeItem(i)} 
                    className="ml-2 text-amber-700 hover:text-amber-400 transition-colors"
                    aria-label={`Remove ${it}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              {character.items.length === 0 && (
                <p className="text-xs text-zinc-500 italic">No treasures added yet</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Relationships Section */}
        <div className="col-span-2 space-y-4 pt-6 border-t border-zinc-700 mt-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-700 flex justify-between items-center">
            <span>Karma Links</span>
            <button 
              onClick={addRelationship}
              className="text-xs bg-zinc-800 px-4 py-1.5 rounded-full text-amber-500 hover:bg-amber-600 hover:text-white transition-all duration-200 font-semibold"
              aria-label="Add karma link"
            >
              + Add Karma
            </button>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
            {character.relationships.length > 0 ? character.relationships.map((rel, idx) => (
              <div key={idx} className="bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-700 space-y-4 relative group/rel shadow-lg">
                <button 
                  onClick={() => removeRelationship(idx)}
                  className="absolute top-3 right-3 text-zinc-600 hover:text-red-500 transition-colors duration-200 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10"
                  aria-label="Remove relationship"
                >
                  ×
                </button>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-char-${idx}`}>Connect to Being</label>
                    <select 
                      id={`rel-char-${idx}`}
                      className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm w-full outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all"
                      value={rel.characterId}
                      onChange={(e) => updateRelationship(idx, (r) => ({ ...r, characterId: e.target.value }))}
                      aria-label="Connect to Being"
                    >
                      <option value="">Select Being...</option>
                      {novelState.characterCodex.filter(c => c.id !== character.id).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-type-${idx}`}>Connection Type</label>
                    <input 
                      id={`rel-type-${idx}`}
                      placeholder="e.g. Master, Rival, Family..." 
                      className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm w-full outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 text-amber-400 font-semibold transition-all"
                      value={rel.type}
                      onChange={(e) => updateRelationship(idx, (r) => ({ ...r, type: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-history-${idx}`}>History of Fate</label>
                      <VoiceInput onResult={(text) => updateRelationship(idx, (r) => ({ ...r, history: text }))} />
                    </div>
                    <textarea 
                      id={`rel-history-${idx}`}
                      placeholder="Describe how their lives collided..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 h-20 resize-none outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 transition-all leading-relaxed"
                      value={rel.history}
                      onChange={(e) => updateRelationship(idx, (r) => ({ ...r, history: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs text-zinc-400 uppercase font-semibold tracking-wide" htmlFor={`rel-impact-${idx}`}>Impact on Dao</label>
                      <VoiceInput onResult={(text) => updateRelationship(idx, (r) => ({ ...r, impact: text }))} />
                    </div>
                    <textarea 
                      id={`rel-impact-${idx}`}
                      placeholder="How this link changes their path..."
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-300 h-20 resize-none outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 italic transition-all leading-relaxed"
                      value={rel.impact}
                      onChange={(e) => updateRelationship(idx, (r) => ({ ...r, impact: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            )) : (
              <div className="py-12 text-center bg-zinc-950/50 border border-dashed border-zinc-700 rounded-2xl">
                <p className="text-sm text-zinc-500 italic">No threads of fate yet connect this being to the world.</p>
              </div>
            )}
          </div>
        </div>

        {/* Notes Section */}
        <div className="col-span-2 pt-6 border-t border-zinc-700 mt-4">
          <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4 pb-2 border-b border-zinc-700">Fate Summary</h3>
        </div>
        
        <div className="col-span-2 space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="char-notes">Notes</label>
          <textarea 
            id="char-notes"
            placeholder="The legend of this being..." 
            value={character.notes} 
            onChange={e => onUpdateCharacter({ ...character, notes: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-40 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
          />
        </div>
        <div className="flex justify-end col-span-2 space-x-4 pt-6 border-t border-zinc-700 mt-4">
          <button 
            onClick={onCancel} 
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/30"
          >
            Seal Fate
          </button>
        </div>
      </div>
    </Modal>
  );
};
