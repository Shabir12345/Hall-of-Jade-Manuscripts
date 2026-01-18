/**
 * Chapter Editor Header Component
 * Header with title, navigation, and action buttons
 */

import React from 'react';
import VoiceInput from '../VoiceInput';
import TextToSpeech from '../TextToSpeech';

interface ChapterEditorHeaderProps {
  title: string;
  content: string;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onSave: () => void;
  onShowHistory: () => void;
  showTTS: boolean;
  onToggleTTS: () => void;
  showHistory: boolean;
  activeTab: string;
}

export const ChapterEditorHeader: React.FC<ChapterEditorHeaderProps> = ({
  title,
  onTitleChange,
  onClose,
  onSave,
  onShowHistory,
  showTTS,
  onToggleTTS,
  showHistory,
  activeTab,
}) => {
  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b border-zinc-700 bg-zinc-900/50 gap-4">
        <div className="flex items-center space-x-4 flex-1 min-w-0 w-full sm:w-auto">
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-100 p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 flex-shrink-0"
            aria-label="Close editor"
          >
            ← Back
          </button>
          <div className="relative flex items-center group flex-1 min-w-0">
            <input 
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="bg-transparent border-none text-lg md:text-xl font-fantasy font-bold text-amber-500 focus:ring-0 w-full pr-12 placeholder-zinc-600 break-words"
              placeholder="Chapter Title..."
              aria-label="Chapter title"
            />
            <VoiceInput 
              onResult={(text) => onTitleChange(text)} 
              className="absolute right-0 flex-shrink-0"
              title="Voice Input: Speak to set chapter title"
            />
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={onShowHistory}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              showHistory || activeTab === 'history'
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="View Revision History"
          >
            History
          </button>
          <button 
            onClick={onToggleTTS}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
              showTTS
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="Read chapter aloud"
          >
            {showTTS ? '🔊 Hide Reader' : '🔊 Read Chapter'}
          </button>
          <button 
            onClick={onSave}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/20 whitespace-nowrap"
            aria-label="Save chapter"
          >
            Save Chapter
          </button>
        </div>
      </div>

      {showTTS && (
        <div className="border-b border-zinc-700 bg-zinc-900/50 p-4">
          <TextToSpeech text={content} onClose={onToggleTTS} />
        </div>
      )}
    </>
  );
};
