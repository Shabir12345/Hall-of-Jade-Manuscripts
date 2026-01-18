import React, { useState } from 'react';
import { Territory, NovelState } from '../../types';
import VoiceInput from '../VoiceInput';
import CreativeSpark from '../CreativeSpark';
import { Modal } from '../Modal';

interface TerritoryFormProps {
  initialData?: Partial<Territory> | null;
  novelState: NovelState;
  onSubmit: (territory: Territory) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const TerritoryForm: React.FC<TerritoryFormProps> = ({
  initialData,
  novelState,
  onSubmit,
  onCancel,
  isOpen,
}) => {
  const [formData, setFormData] = useState<Partial<Territory>>(
    initialData || {
      id: crypto.randomUUID(),
      realmId: novelState.currentRealmId,
      name: '',
      type: 'Neutral',
      description: '',
    }
  );

  const handleSubmit = () => {
    if (formData.name && formData.description) {
      onSubmit(formData as Territory);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Manifest Territory"
      maxWidth="xl"
      headerActions={
        <>
          <CreativeSpark
            type="Territory Description"
            currentValue={formData.description || ''}
            state={novelState}
            onIdea={(idea) => setFormData({ ...formData, description: idea })}
          />
          <VoiceInput
            onResult={(text) =>
              setFormData({
                ...formData,
                description: formData.description
                  ? formData.description + ' ' + text
                  : text,
              })
            }
          />
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label
                className="text-sm font-semibold text-zinc-400 uppercase tracking-wide"
                htmlFor="territory-name"
              >
                Name
              </label>
              <VoiceInput
                onResult={(text) => setFormData({ ...formData, name: text })}
              />
            </div>
            <input
              id="territory-name"
              placeholder="e.g. Great Tang Empire"
              value={formData.name || ''}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
              aria-required="true"
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-semibold text-zinc-400 uppercase tracking-wide"
              htmlFor="territory-type"
            >
              Type
            </label>
            <select
              id="territory-type"
              value={formData.type || 'Neutral'}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value as any })
              }
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
          <label
            className="text-sm font-semibold text-zinc-400 uppercase tracking-wide"
            htmlFor="territory-description"
          >
            Description
          </label>
          <textarea
            id="territory-description"
            placeholder="History, features, or legendary origins... (Voice & Spark Input Available)"
            value={formData.description || ''}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-base text-zinc-200 h-40 font-serif-novel resize-none focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all leading-relaxed"
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
            onClick={handleSubmit}
            disabled={!formData.name || !formData.description}
            className="px-8 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/30 hover:scale-105 disabled:hover:scale-100"
          >
            Seal Territory
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TerritoryForm;
