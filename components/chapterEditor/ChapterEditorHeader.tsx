/**
 * Chapter Editor Header Component
 * Header with title, navigation, and action buttons
 * Fully responsive with mobile-first design
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
      {/* Main header - stack vertically on mobile */}
      <div className="flex flex-col gap-2 xs:gap-3 p-2 xs:p-3 sm:p-4 md:p-6 border-b border-zinc-700 bg-zinc-900/50">
        {/* Top row: Back button and title */}
        <div className="flex items-center gap-2 xs:gap-3 sm:gap-4 w-full">
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-zinc-100 p-1.5 xs:p-2 rounded-lg hover:bg-zinc-800 transition-colors duration-200 flex-shrink-0 text-sm xs:text-base"
            aria-label="Close editor"
          >
            ← <span className="hidden xs:inline">Back</span>
          </button>
          <div className="relative flex items-center group flex-1 min-w-0">
            <input 
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="bg-transparent border-none text-sm xs:text-base sm:text-lg md:text-xl font-fantasy font-bold text-amber-500 focus:ring-0 w-full pr-10 xs:pr-12 placeholder-zinc-600 truncate"
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
        
        {/* Action buttons row - horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2 xs:-mx-3 xs:px-3 sm:mx-0 sm:px-0 pb-0.5">
          <button
            onClick={onShowHistory}
            className={`px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
              showHistory || activeTab === 'history'
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="View Revision History"
          >
            <span className="sm:hidden">📜</span>
            <span className="hidden sm:inline">History</span>
          </button>
          <button 
            onClick={onToggleTTS}
            className={`px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
              showTTS
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
            }`}
            aria-label="Read chapter aloud"
          >
            🔊
            <span className="hidden xs:inline">{showTTS ? 'Hide' : 'Read'}</span>
          </button>
          {/* Save button - more prominent */}
          <button 
            onClick={onSave}
            className="bg-amber-600 hover:bg-amber-500 text-white px-3 xs:px-4 sm:px-5 py-1.5 xs:py-2 rounded-lg text-xs xs:text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/20 whitespace-nowrap flex-shrink-0 ml-auto"
            aria-label="Save chapter"
          >
            <span className="xs:hidden">Save</span>
            <span className="hidden xs:inline">Save Chapter</span>
          </button>
        </div>
      </div>

      {/* Text-to-Speech panel */}
      {showTTS && (
        <div className="border-b border-zinc-700 bg-zinc-900/50 p-2 xs:p-3 sm:p-4">
          <TextToSpeech text={content} onClose={onToggleTTS} />
        </div>
      )}
    </>
  );
};
