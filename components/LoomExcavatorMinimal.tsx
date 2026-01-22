/**
 * Minimal Loom Excavator Component
 * 
 * A simplified version for testing without the full narrative forensics services.
 */

import React, { useState } from 'react';
import { NovelState } from '../types';

interface LoomExcavatorMinimalProps {
  novelState: NovelState;
}

const LoomExcavatorMinimal: React.FC<LoomExcavatorMinimalProps> = ({ novelState }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [startChapter, setStartChapter] = useState(1);
  const [endChapter, setEndChapter] = useState(Math.min(10, novelState.chapters.length || 1));

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      alert('Scan complete! (Services not yet integrated)');
    }, 2000);
  };

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-5xl mx-auto pt-20 md:pt-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 md:mb-12 border-b border-zinc-700 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
            Akasha Recall
          </h1>
          <p className="text-gray-400 mt-2">Narrative Forensic Scan - Excavate Forgotten Threads</p>
        </div>
      </div>

      {/* Scan Zone */}
      <div className="bg-zinc-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Scan Zone</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">Start Chapter</label>
            <input
              type="number"
              min={1}
              max={endChapter}
              value={startChapter}
              onChange={(e) => setStartChapter(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              disabled={isScanning}
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm text-gray-400 mb-2">End Chapter</label>
            <input
              type="number"
              min={startChapter}
              max={novelState.chapters.length}
              value={endChapter}
              onChange={(e) => setEndChapter(Math.min(novelState.chapters.length, parseInt(e.target.value) || startChapter))}
              className="w-full px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-lg text-white"
              disabled={isScanning}
            />
          </div>
        </div>
        <button
          onClick={handleScan}
          disabled={isScanning}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-600 text-white font-semibold rounded-lg transition-colors"
        >
          {isScanning ? 'Scanning...' : 'Begin Excavation'}
        </button>
      </div>

      {/* Status */}
      <div className="bg-zinc-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">System Status</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Novel:</span>
            <span className="text-white">{novelState.title}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Total Chapters:</span>
            <span className="text-white">{novelState.chapters.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Story Threads:</span>
            <span className="text-white">{novelState.storyThreads?.length || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Status:</span>
            <span className="text-green-400">Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoomExcavatorMinimal;
