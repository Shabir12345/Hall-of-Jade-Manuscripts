import React, { useMemo, useState } from 'react';
import { NovelState } from '../types';
import { ImprovementRequest, ImprovementExecutionResult } from '../types/improvement';
import NovelImprovementDialog from './NovelImprovementDialog';
import { analyzeLiteraryDevices } from '../services/literaryDeviceAnalyzer';

interface DeviceDashboardProps {
  novelState: NovelState;
}

const DeviceDashboard: React.FC<DeviceDashboardProps> = ({ novelState }) => {
  const deviceAnalysis = useMemo(() => analyzeLiteraryDevices(novelState), [novelState]);

  const getScoreColor = (score: number) => 
    score >= 80 ? 'text-emerald-400' : score >= 70 ? 'text-amber-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      {/* Improvement Button */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={handleImproveNovel}
          className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-2"
        >
          <span>⚡</span>
          <span>Improve Novel</span>
        </button>
      </div>

      {/* Improvement Dialog */}
      {improvementRequest && (
        <NovelImprovementDialog
          isOpen={improvementDialogOpen}
          novelState={novelState}
          request={improvementRequest}
          onClose={() => setImprovementDialogOpen(false)}
          onComplete={handleImprovementComplete}
        />
      )}
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Literary Devices Dashboard
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Literary device usage, effectiveness, and synergy analysis</p>
      </div>

      <div className="mb-8 bg-gradient-to-br from-zinc-900 to-zinc-800 border-2 border-amber-500 rounded-xl p-8 text-center">
        <div className={`text-5xl font-fantasy font-bold mb-2 ${getScoreColor(deviceAnalysis.overallDeviceScore)}`}>
          {deviceAnalysis.overallDeviceScore}/100
        </div>
        <div className="text-lg text-zinc-400 font-semibold uppercase tracking-wide">Overall Device Score</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Object.entries(deviceAnalysis.deviceFrequency).slice(0, 12).map(([deviceType, count]) => (
          <div key={deviceType} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <div className="text-sm font-bold text-amber-400 mb-2 capitalize">{deviceType.replace(/_/g, ' ')}</div>
            <div className="text-3xl font-bold text-zinc-300 mb-1">{count}</div>
            <div className="text-xs text-zinc-500">Occurrences</div>
          </div>
        ))}
      </div>

      {deviceAnalysis.effectiveDevices.length > 0 && (
        <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Most Effective Devices</h3>
          <div className="space-y-3">
            {deviceAnalysis.effectiveDevices.slice(0, 5).map((device) => (
              <div key={device.id} className="bg-emerald-900/20 border border-emerald-700/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-bold text-emerald-400 capitalize">{device.deviceType.replace(/_/g, ' ')}</div>
                  <div className="text-lg font-bold text-emerald-400">{device.effectivenessScore}/100</div>
                </div>
                <div className="text-xs text-zinc-400">Ch {device.chapterNumber}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {deviceAnalysis.recommendations.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Recommendations</h3>
          <ul className="space-y-2">
            {deviceAnalysis.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-zinc-300 flex items-start">
                <span className="text-amber-500 mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default DeviceDashboard;
