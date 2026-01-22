import React, { useState, useEffect } from 'react';
import {
    Book,
    Database,
    History,
    ChevronDown,
    ChevronUp,
    Sparkles
} from 'lucide-react';
import { NovelState, StoryThread } from '../types';
import { EnrichedThread, enrichThreadWithMemory } from '../services/narrativeIntegrationService';
import { ArcMemorySummary } from '../services/memory/arcMemoryService';

interface MemoryContextPanelProps {
    thread: StoryThread;
    novelState: NovelState;
}

export const MemoryContextPanel: React.FC<MemoryContextPanelProps> = ({ thread, novelState }) => {
    const [enriched, setEnriched] = useState<EnrichedThread | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({
        arcs: true,
        vector: false,
    });

    useEffect(() => {
        const loadContext = async () => {
            setLoading(true);
            try {
                const result = await enrichThreadWithMemory(thread, novelState);
                setEnriched(result);
            } catch (error) {
                console.error('Failed to load thread memory context:', error);
            } finally {
                setLoading(false);
            }
        };

        loadContext();
    }, [thread.id, novelState.id]);

    if (loading) {
        return (
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                    <div className="h-3 bg-gray-700 rounded w-full"></div>
                    <div className="h-3 bg-gray-700 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-700 rounded w-4/6"></div>
                </div>
            </div>
        );
    }

    const memoryContext = enriched?.memoryContext;

    return (
        <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2 px-1 text-amber-400">
                <History className="w-5 h-5" />
                <h3 className="font-bold text-lg">Narrative Memory Context</h3>
            </div>

            {/* Arc Memories Segment */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <button
                    onClick={() => setExpanded(prev => ({ ...prev, arcs: !prev.arcs }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Book className="w-4 h-4 text-blue-400" />
                        <span className="font-semibold text-gray-200">Related Arc Memories</span>
                        <span className="text-xs px-2 py-0.5 bg-blue-900/30 text-blue-400 rounded-full border border-blue-800/50">
                            {memoryContext?.arcMemories.length || 0} Arcs
                        </span>
                    </div>
                    {expanded.arcs ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {expanded.arcs && (
                    <div className="p-4 pt-0 space-y-3">
                        {memoryContext?.arcMemories.length === 0 ? (
                            <p className="text-sm text-gray-500 italic p-2">No overlapping arc memories found for this thread.</p>
                        ) : (
                            memoryContext?.arcMemories.map((arc: ArcMemorySummary) => (
                                <div key={arc.arcId} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50 hover:border-blue-500/30 transition-colors group">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium text-gray-100 group-hover:text-blue-400 transition-colors">{arc.arcTitle}</h4>
                                        <span className="text-xs text-gray-500">Ch. {arc.startChapter}-{arc.endChapter || 'present'}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-3 leading-relaxed">
                                        {arc.summary}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Semantic Search Segment */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <button
                    onClick={() => setExpanded(prev => ({ ...prev, vector: !prev.vector }))}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-700/50 transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <Database className="w-4 h-4 text-purple-400" />
                        <span className="font-semibold text-gray-200">Semantic Evidence (Akasha)</span>
                        <span className="text-xs px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded-full border border-purple-800/50">
                            {memoryContext?.vectorSearchResults.length || 0} Matches
                        </span>
                    </div>
                    {expanded.vector ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </button>

                {expanded.vector && (
                    <div className="p-4 pt-0 space-y-3">
                        {memoryContext?.vectorSearchResults.length === 0 ? (
                            <p className="text-sm text-gray-500 italic p-2">No semantic matches found in the vector database.</p>
                        ) : (
                            memoryContext?.vectorSearchResults.slice(0, 5).map((result, idx) => (
                                <div key={idx} className="p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Sparkles className="w-3 h-3 text-purple-400" />
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">{result.type || 'Plot Element'}</span>
                                    </div>
                                    <h4 className="text-sm font-medium text-gray-200 mb-1">{result.name || result.title}</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed italic border-l-2 border-purple-500/30 pl-2">
                                        "{result.content || result.description}"
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
