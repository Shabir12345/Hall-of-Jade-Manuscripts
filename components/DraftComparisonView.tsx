import React, { useMemo } from 'react';
import { NovelState } from '../types';
import { getDraftManagement, compareDrafts } from '../services/draftManager';

interface DraftComparisonViewProps {
  novelState: NovelState;
}

const DraftComparisonView: React.FC<DraftComparisonViewProps> = ({ novelState }) => {
  const draftManagement = useMemo(() => getDraftManagement(novelState), [novelState]);

  return (
    <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto pt-16 md:pt-20">
      <div className="mb-8 border-b border-zinc-700 pb-6">
        <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">
          Draft Comparison
        </h2>
        <p className="text-sm text-zinc-400 mt-2">Compare draft versions and track quality progression</p>
      </div>

      {draftManagement.drafts.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">No drafts created yet</div>
      ) : (
        <>
          <div className="mb-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <h3 className="text-lg font-bold text-amber-400 mb-6 uppercase">Draft Progression</h3>
            <div className="space-y-4">
              {draftManagement.draftProgression.map((progression) => (
                <div key={progression.draftNumber} className="bg-zinc-800/50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-bold text-amber-400">Draft {progression.draftNumber}</div>
                    <div className="text-lg font-bold text-zinc-300">{progression.qualityScore}/100</div>
                  </div>
                  {progression.improvement !== 0 && (
                    <div className={`text-xs ${progression.improvement > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {progression.improvement > 0 ? '+' : ''}{progression.improvement} points
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {draftManagement.recommendations.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
              <h3 className="text-lg font-bold text-amber-400 mb-4 uppercase">Recommendations</h3>
              <ul className="space-y-2">
                {draftManagement.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-zinc-300 flex items-start">
                    <span className="text-amber-500 mr-2">•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DraftComparisonView;
