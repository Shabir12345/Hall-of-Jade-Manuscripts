import React, { useState, useRef, useCallback } from 'react';
import { NovelState } from '../types';
import { NovelDiff, exportDiffAsJSON, importDiffFromJSON, generateNovelDiff } from '../services/changeTracker';

interface ImprovementExportImportProps {
  novelState: NovelState;
  originalState?: NovelState;
  improvedState?: NovelState;
  onImportDiff?: (diff: NovelDiff) => void;
  onApplyDiff?: (diff: NovelDiff) => void;
}

/**
 * ImprovementExportImport - Export and import improvement diffs
 */
const ImprovementExportImport: React.FC<ImprovementExportImportProps> = ({
  novelState,
  originalState,
  improvedState,
  onImportDiff,
  onApplyDiff,
}) => {
  const [importedDiff, setImportedDiff] = useState<NovelDiff | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate current diff if we have both states
  const currentDiff = React.useMemo(() => {
    if (originalState && improvedState) {
      return generateNovelDiff(originalState, improvedState, 'export');
    }
    return null;
  }, [originalState, improvedState]);

  // Export diff to JSON file
  const handleExport = useCallback(() => {
    if (!currentDiff) {
      setError('No changes to export. Make improvements first.');
      return;
    }

    try {
      const json = exportDiffAsJSON(currentDiff);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${novelState.title.replace(/\s+/g, '_')}_improvements_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setSuccess('Improvements exported successfully!');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError('Failed to export improvements.');
      console.error('Export error:', e);
    }
  }, [currentDiff, novelState.title]);

  // Import diff from JSON file
  const handleImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = e.target?.result as string;
        const diff = importDiffFromJSON(json);
        
        if (!diff) {
          setError('Invalid improvement file format.');
          return;
        }
        
        // Validate the diff is for this novel or compatible
        if (diff.novelId !== novelState.id) {
          setError(`This improvement file is for a different novel (${diff.novelTitle}). Proceed with caution.`);
        }
        
        setImportedDiff(diff);
        onImportDiff?.(diff);
        setSuccess('Improvements imported successfully!');
        setError(null);
      } catch (e) {
        setError('Failed to parse improvement file.');
        console.error('Import error:', e);
      }
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [novelState.id, onImportDiff]);

  // Apply imported diff
  const handleApply = useCallback(() => {
    if (!importedDiff) {
      setError('No imported improvements to apply.');
      return;
    }
    
    onApplyDiff?.(importedDiff);
    setSuccess('Improvements applied! Review the changes.');
    setImportedDiff(null);
  }, [importedDiff, onApplyDiff]);

  return (
    <div className="space-y-6">
      {/* Status messages */}
      {error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-lg">
          <div className="flex items-center gap-2 text-red-400">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-900/20 border border-green-700 rounded-lg">
          <div className="flex items-center gap-2 text-green-400">
            <span>✓</span>
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Export Section */}
        <div className="bg-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📤</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Export Improvements</h3>
              <p className="text-sm text-zinc-400">Save your changes as a file</p>
            </div>
          </div>
          
          {currentDiff ? (
            <div className="space-y-4">
              {/* Export preview */}
              <div className="bg-zinc-700/50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-400">Chapters Changed</span>
                    <p className="text-white font-semibold">{currentDiff.summary.chaptersChanged}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Net Words</span>
                    <p className={`font-semibold ${
                      currentDiff.summary.netWordChange > 0 ? 'text-green-400' : 
                      currentDiff.summary.netWordChange < 0 ? 'text-red-400' : 'text-white'
                    }`}>
                      {currentDiff.summary.netWordChange > 0 ? '+' : ''}
                      {currentDiff.summary.netWordChange}
                    </p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={handleExport}
                className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
              >
                Export as JSON
              </button>
            </div>
          ) : (
            <div className="text-center py-6 text-zinc-500">
              <p>No improvements to export.</p>
              <p className="text-sm mt-1">Make some changes first.</p>
            </div>
          )}
        </div>

        {/* Import Section */}
        <div className="bg-zinc-800 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📥</span>
            <div>
              <h3 className="text-lg font-semibold text-white">Import Improvements</h3>
              <p className="text-sm text-zinc-400">Load changes from a file</p>
            </div>
          </div>
          
          <div className="space-y-4">
            {/* File input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
              id="import-diff-input"
            />
            
            <label
              htmlFor="import-diff-input"
              className="block w-full p-6 border-2 border-dashed border-zinc-600 rounded-lg text-center cursor-pointer hover:border-amber-500/50 hover:bg-zinc-700/30 transition-colors"
            >
              <span className="text-3xl block mb-2">📄</span>
              <span className="text-zinc-400">Click to select a .json file</span>
              <span className="text-xs text-zinc-500 block mt-1">or drag and drop</span>
            </label>
            
            {/* Imported diff preview */}
            {importedDiff && (
              <div className="bg-zinc-700/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">
                  Imported: {importedDiff.novelTitle}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-zinc-400">Category</span>
                    <p className="text-white capitalize">{importedDiff.category}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Changes</span>
                    <p className="text-white">{importedDiff.summary.chaptersChanged} chapters</p>
                  </div>
                </div>
                
                {onApplyDiff && (
                  <button
                    onClick={handleApply}
                    className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    Apply Imported Changes
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info section */}
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
        <h4 className="text-sm font-semibold text-amber-400 mb-2">About Export/Import</h4>
        <ul className="text-sm text-zinc-400 space-y-1">
          <li>• Export saves your improvements as a JSON file that can be shared</li>
          <li>• Import allows you to load improvements from another session or collaborator</li>
          <li>• Imported improvements can be previewed before applying</li>
          <li>• Files are compatible with novels that have the same structure</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Quick export button for use in toolbars
 */
export const QuickExportButton: React.FC<{
  originalState: NovelState;
  improvedState: NovelState;
}> = ({ originalState, improvedState }) => {
  const handleExport = () => {
    const diff = generateNovelDiff(originalState, improvedState, 'quick-export');
    const json = exportDiffAsJSON(diff);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `improvements_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm transition-colors flex items-center gap-1.5"
      title="Export improvements as JSON"
    >
      <span>📤</span>
      <span>Export</span>
    </button>
  );
};

export default ImprovementExportImport;
