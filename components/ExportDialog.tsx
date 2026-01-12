import React, { memo, useCallback } from 'react';
import { NovelState } from '../types';
import { exportNovel } from '../services/exportService';
import { useToast } from '../contexts/ToastContext';

interface ExportDialogProps {
  novel: NovelState;
  onClose: () => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ novel, onClose }) => {
  const { showError, showSuccess } = useToast();
  
  const handleExport = useCallback(async (format: 'markdown' | 'text') => {
    try {
      await exportNovel(novel, format);
      showSuccess('Novel exported successfully');
      onClose();
    } catch (error) {
      console.error('Error exporting novel:', error);
      showError('Failed to export novel. Please try again.');
    }
  }, [novel, onClose, showError, showSuccess]);

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
        <div className="flex justify-between items-center p-6 border-b border-zinc-700">
          <h2 className="text-2xl font-fantasy font-bold text-amber-500">Export Novel</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-400 mb-6">
            Choose a format to export your novel:
          </p>

          <button
            onClick={() => handleExport('markdown')}
            className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-amber-500/50 rounded-xl p-4 text-left transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-amber-400 mb-1">Markdown (.md)</div>
                <div className="text-sm text-zinc-400">Export as Markdown format</div>
              </div>
              <span className="text-2xl">📝</span>
            </div>
          </button>

          <button
            onClick={() => handleExport('text')}
            className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-amber-500/50 rounded-xl p-4 text-left transition-all duration-200 group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-bold text-amber-400 mb-1">Plain Text (.txt)</div>
                <div className="text-sm text-zinc-400">Export as plain text format</div>
              </div>
              <span className="text-2xl">📄</span>
            </div>
          </button>

          <div className="pt-4 border-t border-zinc-700">
            <p className="text-xs text-zinc-500 italic">
              Note: PDF, DOCX, and EPUB export will be available in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(ExportDialog);
