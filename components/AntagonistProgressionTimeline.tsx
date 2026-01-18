import React, { useState, useEffect } from 'react';
import { Antagonist, AntagonistProgression } from '../types';
import { supabase } from '../services/supabaseService';

interface AntagonistProgressionTimelineProps {
  antagonist: Antagonist;
}

const AntagonistProgressionTimeline: React.FC<AntagonistProgressionTimelineProps> = ({ antagonist }) => {
  const [progressionRecords, setProgressionRecords] = useState<AntagonistProgression[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgression = async () => {
      try {
        const { data, error } = await supabase
          .from('antagonist_progression')
          .select('*')
          .eq('antagonist_id', antagonist.id)
          .order('chapter_number', { ascending: true });

        if (error) {
          console.error('Error loading progression:', error);
          setProgressionRecords([]);
        } else {
          setProgressionRecords((data || []).map(p => ({
            id: p.id,
            antagonistId: p.antagonist_id,
            chapterNumber: p.chapter_number,
            powerLevel: p.power_level || '',
            threatAssessment: p.threat_assessment || '',
            keyEvents: p.key_events || [],
            relationshipChanges: p.relationship_changes || '',
            notes: p.notes || '',
            createdAt: new Date(p.created_at).getTime(),
          })));
        }
      } catch (error) {
        console.error('Error loading progression:', error);
        setProgressionRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadProgression();
  }, [antagonist.id]);

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
        <div className="text-sm text-zinc-400 italic">No progression records yet. Progression will be tracked automatically as the story develops.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-fantasy font-bold text-amber-500 mb-4">Story Progression Timeline</h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-amber-500/30"></div>
        
        <div className="space-y-6">
          {progressionRecords.map((record, index) => (
            <div key={record.id} className="relative pl-12">
              {/* Timeline dot */}
              <div className="absolute left-3 top-2 w-3 h-3 rounded-full bg-amber-500 border-2 border-zinc-900"></div>
              
              <div className="bg-zinc-900/60 border border-zinc-700 rounded-xl p-4 hover:border-amber-500/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-amber-400">
                    Chapter {record.chapterNumber}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(record.createdAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Threat Assessment */}
                {record.threatAssessment && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Threat Level:</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded ${
                      record.threatAssessment === 'extreme' ? 'bg-red-950/60 text-red-300 border border-red-900/60' :
                      record.threatAssessment === 'high' ? 'bg-orange-950/60 text-orange-300 border border-orange-900/60' :
                      record.threatAssessment === 'medium' ? 'bg-yellow-950/60 text-yellow-300 border border-yellow-900/60' :
                      'bg-green-950/60 text-green-300 border border-green-900/60'
                    }`}>
                      {record.threatAssessment}
                    </span>
                  </div>
                )}

                {/* Power Level */}
                {record.powerLevel && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Power Level:</span>
                    <span className="ml-2 text-sm text-zinc-300">{record.powerLevel}</span>
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

                {/* Relationship Changes */}
                {record.relationshipChanges && (
                  <div className="mb-2">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider mb-1 block">Relationship Changes:</span>
                    <div className="text-sm text-zinc-300">{record.relationshipChanges}</div>
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

export default AntagonistProgressionTimeline;
