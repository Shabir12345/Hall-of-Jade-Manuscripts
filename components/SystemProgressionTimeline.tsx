import React, { useState, useEffect } from 'react';
import { CharacterSystem, SystemProgression } from '../types';
import { supabase } from '../services/supabaseService';
import { fetchSystemProgressionRecords } from '../services/systemProgressionTracker';

interface SystemProgressionTimelineProps {
  system: CharacterSystem;
}

const SystemProgressionTimeline: React.FC<SystemProgressionTimelineProps> = ({ system }) => {
  const [progressionRecords, setProgressionRecords] = useState<SystemProgression[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgression = async () => {
      try {
        const records = await fetchSystemProgressionRecords(system.id);
        setProgressionRecords(records);
      } catch (error) {
        console.error('Error loading progression:', error);
        setProgressionRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadProgression();
  }, [system.id]);

  if (loading) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl">
        <div className="text-sm text-zinc-400">Loading progression timeline...</div>
      </div>
    );
  }

  if (progressionRecords.length === 0) {
    return (
      <div className="p-4 bg-zinc-900/60 border border-zinc-700 rounded-xl">
        <h3 className="text-lg font-fantasy font-bold text-purple-500 mb-2">System Evolution Timeline</h3>
        <div className="text-sm text-zinc-400 italic">No progression records yet. Progression will be tracked automatically as the system evolves.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-fantasy font-bold text-purple-500 mb-4">System Evolution Timeline</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-purple-500/30"></div>
        
        <div className="space-y-6">
          {progressionRecords.map((record, index) => (
            <div key={record.id} className="relative pl-12">
              {/* Timeline dot */}
              <div className="absolute left-3 top-2 w-3 h-3 rounded-full bg-purple-500 border-2 border-zinc-900"></div>
              
              <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4 hover:border-purple-500/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-purple-400">
                    Chapter {record.chapterNumber}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Level Changes */}
                {record.levelChanges && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Level Changes:</span>
                    <div className="ml-2 mt-1 text-sm text-purple-300">{record.levelChanges}</div>
                  </div>
                )}

                {/* Features Added */}
                {record.featuresAdded && record.featuresAdded.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Features Added:</span>
                    <ul className="list-disc list-inside space-y-1">
                      {record.featuresAdded.map((feature, idx) => (
                        <li key={idx} className="text-sm text-emerald-300">
                          <span className="text-emerald-400">+</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Features Upgraded */}
                {record.featuresUpgraded && record.featuresUpgraded.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Features Upgraded:</span>
                    <ul className="list-disc list-inside space-y-1">
                      {record.featuresUpgraded.map((feature, idx) => (
                        <li key={idx} className="text-sm text-blue-300">
                          <span className="text-blue-400">↑</span> {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Key Events */}
                {record.keyEvents && record.keyEvents.length > 0 && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Key Events:</span>
                    <ul className="list-disc list-inside space-y-1">
                      {record.keyEvents.map((event, idx) => (
                        <li key={idx} className="text-sm text-zinc-300">{event}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {record.notes && (
                  <div className="mt-2 pt-2 border-t border-zinc-700">
                    <div className="text-xs text-zinc-500 italic">{record.notes}</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SystemProgressionTimeline;
