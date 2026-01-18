import React, { useCallback, useState, useMemo } from 'react';
import type { WorldEntry, NovelState } from '../../types';
import { Modal } from '../Modal';
import VoiceInput from '../VoiceInput';
import CreativeSpark from '../CreativeSpark';
import { getWorldCategory } from '../../utils/typeGuards';
import { validateWorldEntryInput } from '../../utils/validation';
import { WORLD_ENTRY_TEMPLATES, type WorldEntryTemplate, applyWorldEntryTemplate } from '../../utils/templates';

interface WorldEntryFormProps {
  entry: WorldEntry;
  novelState: NovelState;
  onSave: (entry: WorldEntry) => void;
  onCancel: () => void;
  onUpdateEntry: (entry: WorldEntry) => void;
  showWarning: (message: string) => void;
}

export const WorldEntryForm: React.FC<WorldEntryFormProps> = ({
  entry,
  novelState,
  onSave,
  onCancel,
  onUpdateEntry,
  showWarning,
}) => {
  const handleSave = useCallback(() => {
    const validation = validateWorldEntryInput(entry);
    if (!validation.valid) {
      showWarning(validation.error || 'Please provide both a title and content for this world entry.');
      return;
    }
    onSave(entry);
  }, [entry, onSave, showWarning]);

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Forge Knowledge"
      maxWidth="xl"
      headerActions={
        <>
          {(entry.category === 'PowerLevels' || entry.category === 'Systems') && (
            <CreativeSpark 
              type={`${entry.category} Architect Expansion`} 
              currentValue={entry.content} 
              state={novelState} 
              onIdea={(idea) => onUpdateEntry({ ...entry, content: idea })} 
              label="AI Help"
              className="bg-indigo-600 text-white border-indigo-500 hover:bg-indigo-500"
            />
          )}
          <CreativeSpark 
            type={entry.category} 
            currentValue={entry.content} 
            state={novelState} 
            onIdea={(idea) => onUpdateEntry(prev => ({ ...prev, content: idea }))} 
          />
        </>
      }
    >
      <div className="space-y-6">
        {/* Template Selection */}
        {availableTemplates.length > 0 && !entry.title && (
          <div className="mb-4 p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Templates</label>
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
                {availableTemplates.map(template => (
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
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-category">Category</label>
          <select 
            id="world-category"
            value={entry.category} 
            onChange={e => onUpdateEntry({ ...entry, category: getWorldCategory(e.target.value) })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all appearance-none cursor-pointer"
            aria-label="World Entry Category"
          >
            <option>Geography</option>
            <option>Sects</option>
            <option>PowerLevels</option>
            <option>Systems</option>
            <option>Techniques</option>
            <option>Laws</option>
            <option>Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-title">Title</label>
            <VoiceInput onResult={(text) => onUpdateEntry(prev => ({ ...prev, title: text }))} />
          </div>
          <input 
            id="world-title"
            placeholder="Title" 
            value={entry.title} 
            onChange={e => onUpdateEntry({ ...entry, title: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            aria-required="true"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="world-content">Content</label>
            <VoiceInput onResult={(text) => onUpdateEntry({ ...entry, content: entry.content ? entry.content + " " + text : text })} />
          </div>
          <textarea 
            id="world-content"
            placeholder="Content..." 
            value={entry.content} 
            onChange={e => onUpdateEntry({ ...entry, content: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-64 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
            aria-required="true"
          />
        </div>
        <div className="flex justify-end space-x-4 pt-4 border-t border-zinc-700">
          <button 
            onClick={onCancel} 
            className="px-6 py-2.5 text-zinc-400 font-semibold text-sm uppercase hover:text-zinc-200 transition-colors duration-200 focus-visible:outline-amber-600 focus-visible:outline-2"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold shadow-lg shadow-amber-900/30 transition-all duration-200 hover:scale-105"
          >
            Seal
          </button>
        </div>
      </div>
    </Modal>
  );
};
