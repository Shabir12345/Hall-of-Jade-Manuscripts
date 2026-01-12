import React, { useState } from 'react';
import { HighlightCategory, EditorHighlight } from '../types/editor';
import { getDefaultColorForType } from '../services/highlightService';

interface HighlightToolbarProps {
  selectedText: string;
  selectedRange: { start: number; end: number } | null;
  highlights: EditorHighlight[];
  onHighlight: (category: HighlightCategory, color: string, note?: string) => void;
  onRemoveHighlight?: (highlightId: string) => void;
  className?: string;
}

const HighlightToolbar: React.FC<HighlightToolbarProps> = ({
  selectedText,
  selectedRange,
  highlights,
  onHighlight,
  onRemoveHighlight,
  className = '',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<HighlightCategory>('note');
  const [customColor, setCustomColor] = useState<string>('');
  const [note, setNote] = useState<string>('');

  const categories: Array<{ value: HighlightCategory; label: string; color: string }> = [
    { value: 'issue', label: 'Issue', color: getDefaultColorForType('issue') },
    { value: 'strength', label: 'Strength', color: getDefaultColorForType('strength') },
    { value: 'needs_work', label: 'Needs Work', color: getDefaultColorForType('needs_work') },
    { value: 'note', label: 'Note', color: getDefaultColorForType('note') },
    { value: 'question', label: 'Question', color: getDefaultColorForType('question') },
  ];

  const currentColor = customColor || getDefaultColorForType(selectedCategory);

  const handleHighlight = () => {
    if (selectedRange && selectedText.trim()) {
      onHighlight(selectedCategory, currentColor, note.trim() || undefined);
      setNote('');
      setCustomColor('');
    }
  };

  const handleCategoryChange = (category: HighlightCategory) => {
    setSelectedCategory(category);
    if (!customColor) {
      setCustomColor('');
    }
  };

  const canHighlight = selectedRange !== null && selectedText.trim().length > 0;

  return (
    <div className={`bg-zinc-900/50 border border-zinc-700 rounded-lg p-4 ${className}`}>
      <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wide mb-3">
        Highlight Text
      </h3>

      {!canHighlight && (
        <p className="text-xs text-zinc-500 mb-3">
          Select text in the editor to highlight it.
        </p>
      )}

      {canHighlight && (
        <>
          {/* Selected text preview */}
          <div className="mb-3 p-2 bg-zinc-800/50 border border-zinc-700 rounded text-xs text-zinc-400 italic">
            "{selectedText.substring(0, 100)}
            {selectedText.length > 100 && '...'}"
          </div>

          {/* Category selector */}
          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-2">Category:</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => handleCategoryChange(cat.value)}
                  className={`px-3 py-1.5 text-xs rounded border transition-all font-semibold flex items-center gap-2 ${
                    selectedCategory === cat.value
                      ? 'bg-amber-600/30 text-amber-400 border-amber-600/50'
                      : 'bg-zinc-800/50 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div className="mb-3">
            <label htmlFor="highlight-color-picker" className="block text-xs text-zinc-400 mb-2">
              Color (optional - uses category default):
            </label>
            <div className="flex items-center gap-2">
              <input
                id="highlight-color-picker"
                type="color"
                value={currentColor}
                onChange={(e) => setCustomColor(e.target.value)}
                className="h-8 w-16 rounded border border-zinc-700 cursor-pointer"
                aria-label="Select highlight color"
              />
              <input
                id="highlight-color-text"
                type="text"
                value={customColor || getDefaultColorForType(selectedCategory)}
                onChange={(e) => setCustomColor(e.target.value)}
                placeholder="#hex"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
                aria-label="Enter highlight color as hex code"
                aria-describedby="color-help"
              />
              <span id="color-help" className="sr-only">Enter a hex color code, for example #ff0000 for red</span>
            </div>
          </div>

          {/* Note input */}
          <div className="mb-3">
            <label htmlFor="highlight-note" className="block text-xs text-zinc-400 mb-2">Note (optional):</label>
            <textarea
              id="highlight-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note about this highlight..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded p-2 text-xs text-zinc-200 resize-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
              rows={2}
              aria-label="Add a note about this highlight"
            />
          </div>

          {/* Highlight button */}
          <button
            onClick={handleHighlight}
            className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105"
            aria-label="Apply highlight to selected text"
          >
            Highlight Text
          </button>
        </>
      )}

      {/* Existing highlights */}
      {highlights.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-700">
          <h4 className="text-xs font-semibold text-zinc-400 mb-2">Existing Highlights ({highlights.length}):</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-thin">
            {highlights.map((highlight) => (
              <div
                key={highlight.id}
                className="flex items-center justify-between p-2 bg-zinc-800/30 rounded text-xs"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: highlight.color }}
                  />
                  <span className="text-zinc-400 truncate">
                    {highlight.highlightType}
                    {highlight.note && `: ${highlight.note}`}
                  </span>
                </div>
                {onRemoveHighlight && (
                  <button
                    onClick={() => onRemoveHighlight(highlight.id)}
                    className="text-red-400 hover:text-red-300 transition-colors flex-shrink-0 ml-2"
                    title="Remove highlight"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightToolbar;
