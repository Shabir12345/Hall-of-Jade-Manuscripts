import React, { useCallback, useState } from 'react';
import type { Arc, NovelState, ArcChecklistItem } from '../../types';
import { Modal } from '../Modal';
import VoiceInput from '../VoiceInput';
import CreativeSpark from '../CreativeSpark';
import { createDefaultArcChecklist } from '../../utils/entityFactories';
import { ARC_TEMPLATES, applyArcTemplate, type ArcTemplate } from '../../utils/templates';

const DEFAULT_ARC_TARGET_CHAPTERS = 10;

interface ArcFormProps {
  arc: Arc;
  novelState: NovelState;
  onSave: (arc: Arc) => Promise<void>;
  onCancel: () => void;
  onUpdateArc: (arc: Arc) => void;
}

export const ArcForm: React.FC<ArcFormProps> = ({
  arc,
  novelState,
  onSave,
  onCancel,
  onUpdateArc,
}) => {
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ArcTemplate | null>(null);

  const handleSave = useCallback(async () => {
    await onSave(arc);
  }, [arc, onSave]);

  const handleTemplateSelect = useCallback((template: ArcTemplate) => {
    const startChapter = arc.startChapter || novelState.chapters.length + 1;
    const templateData = applyArcTemplate(template, startChapter);
    onUpdateArc({ ...arc, ...templateData } as Arc);
    setSelectedTemplate(template);
    setShowTemplates(false);
  }, [arc, novelState.chapters.length, onUpdateArc]);

  const updateChecklistItem = useCallback((itemId: string, checked: boolean) => {
    const current = (arc.checklist && arc.checklist.length > 0)
      ? arc.checklist
      : createDefaultArcChecklist();
    const next = current.map((ci) => {
      if (ci.id !== itemId) return ci;
      return {
        ...ci,
        completed: checked,
        completedAt: checked ? (ci.completedAt || Date.now()) : undefined,
        sourceChapterNumber: checked ? (ci.sourceChapterNumber || novelState.chapters.length) : undefined,
      };
    });
    onUpdateArc({ ...arc, checklist: next });
  }, [arc, novelState.chapters.length, onUpdateArc]);

  const resetChecklist = useCallback(() => {
    onUpdateArc({ ...arc, checklist: createDefaultArcChecklist() });
  }, [arc, onUpdateArc]);

  const checklist = (arc.checklist && arc.checklist.length > 0 ? arc.checklist : createDefaultArcChecklist());

  return (
    <Modal
      isOpen={true}
      onClose={onCancel}
      title="Refine Plot Arc"
      maxWidth="xl"
      headerActions={
        <>
          <CreativeSpark 
            type="Plot Arc expansion" 
            currentValue={arc.description} 
            state={novelState} 
            onIdea={(idea) => onUpdateArc({ ...arc, description: idea })} 
          />
          <VoiceInput onResult={(text) => onUpdateArc({ ...arc, description: text })} />
        </>
      }
    >
      <div className="space-y-6">
        {/* Template Selection */}
        {!arc.title && (
          <div className="mb-4 p-4 bg-zinc-900/50 border border-zinc-700 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Arc Templates</label>
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
                {ARC_TEMPLATES.map(template => (
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
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-title">Arc Title</label>
            <VoiceInput onResult={(text) => onUpdateArc({ ...arc, title: text })} />
          </div>
          <input 
            id="arc-title"
            value={arc.title} 
            onChange={e => onUpdateArc({ ...arc, title: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            aria-label="Arc Title"
            placeholder="Enter arc title..."
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-status">Arc Status</label>
          <select
            id="arc-status"
            value={arc.status}
            onChange={(e) => onUpdateArc({ ...arc, status: e.target.value as 'active' | 'completed' })}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all cursor-pointer"
            aria-label="Arc Status"
          >
            <option value="active">Active (current focus)</option>
            <option value="completed">Completed</option>
          </select>
          <p className="text-[11px] text-zinc-500">
            Only one arc can be Active. Setting this to Active will automatically complete all others.
          </p>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-target">
            Target Chapters
          </label>
          <input
            id="arc-target"
            type="number"
            min={1}
            value={arc.targetChapters ?? DEFAULT_ARC_TARGET_CHAPTERS}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value || '', 10);
              onUpdateArc({
                ...arc,
                targetChapters: Number.isFinite(n) && n > 0 ? n : DEFAULT_ARC_TARGET_CHAPTERS,
              });
            }}
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
            aria-label="Target chapters for this arc"
          />
          <p className="text-[11px] text-zinc-500">
            Used to calculate the arc chapters progress bar.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">
              Arc Elements Checklist
            </label>
            <button
              type="button"
              onClick={resetChecklist}
              className="text-[11px] uppercase font-semibold tracking-widest px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200 hover:border-amber-500/40 transition-all"
              aria-label="Reset arc checklist"
              title="Reset checklist to defaults"
            >
              Reset
            </button>
          </div>
          <div className="space-y-2">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-xl border border-zinc-700/70 bg-zinc-950/30 hover:bg-zinc-950/40 transition-all"
              >
                <input
                  type="checkbox"
                  checked={!!item.completed}
                  onChange={(e) => updateChecklistItem(item.id, e.target.checked)}
                  className="mt-1 h-4 w-4 accent-amber-500"
                  aria-label={`Mark complete: ${item.label}`}
                />
                <div className="flex-1">
                  <div className="text-sm text-zinc-200 font-semibold leading-snug">
                    {item.label}
                  </div>
                  {item.completed && (
                    <div className="text-[11px] text-zinc-500 mt-1">
                      {typeof item.sourceChapterNumber === 'number' ? `Updated by Chapter ${item.sourceChapterNumber}` : 'Completed'}
                    </div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-zinc-400 uppercase tracking-wide" htmlFor="arc-description">Arc Vision</label>
          <textarea 
            id="arc-description"
            value={arc.description} 
            onChange={e => onUpdateArc({ ...arc, description: e.target.value })} 
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-48 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
            aria-label="Arc Vision"
            placeholder="Describe the arc vision..."
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
            Seal Fate
          </button>
        </div>
      </div>
    </Modal>
  );
};
