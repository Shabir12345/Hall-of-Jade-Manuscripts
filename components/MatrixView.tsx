import React, { memo, useMemo, useState, useEffect } from 'react';
import { NovelState, Chapter, Character, Antagonist } from '../types';
import { textContainsCharacterName } from '../utils/characterNameMatching';
import { getAntagonistsForChapter } from '../services/antagonistService';
import { useNavigation } from '../contexts/NavigationContext';

interface MatrixViewProps {
  novelState: NovelState;
}

const MatrixView: React.FC<MatrixViewProps> = ({ novelState }) => {
  const { navigate } = useNavigation();
  const [chapterAntagonists, setChapterAntagonists] = useState<Map<string, Antagonist[]>>(new Map());

  // Load antagonists for all chapters
  useEffect(() => {
    const loadAntagonists = async () => {
      const map = new Map<string, Antagonist[]>();
      for (const chapter of novelState.chapters) {
        try {
          const appearances = await getAntagonistsForChapter(chapter.id);
          const antagonists = appearances
            .map(app => novelState.antagonists?.find(a => a.id === app.antagonistId))
            .filter((a): a is Antagonist => a !== undefined);
          if (antagonists.length > 0) {
            map.set(chapter.id, antagonists);
          }
        } catch (error) {
          console.error(`Error loading antagonists for chapter ${chapter.id}:`, error);
        }
      }
      setChapterAntagonists(map);
    };
    if (novelState.chapters.length > 0) {
      loadAntagonists();
    }
  }, [novelState.chapters, novelState.antagonists]);

  const matrixData = useMemo(() => {
    // Defensive checks for novelState structure
    if (!novelState) {
      return { characters: [], chapters: [], presence: [] };
    }
    
    const characters = Array.isArray(novelState.characterCodex) ? novelState.characterCodex : [];
    const chapters = Array.isArray(novelState.chapters) ? novelState.chapters : [];
    
    // Helper function to check if character appears in chapter
    // Uses smart name matching that handles both proper names and descriptive names
    const characterAppearsInChapter = (char: Character, chapter: Chapter): boolean => {
      // Validate inputs
      if (!char || !char.name || !chapter) {
        return false;
      }
      
      try {
        // Check chapter content
        if (chapter.content && typeof chapter.content === 'string' && textContainsCharacterName(chapter.content, char.name)) {
          return true;
        }
        
        // Check chapter summary
        if (chapter.summary && typeof chapter.summary === 'string' && textContainsCharacterName(chapter.summary, char.name)) {
          return true;
        }
        
        // Check all scenes in the chapter
        if (chapter.scenes && Array.isArray(chapter.scenes) && chapter.scenes.length > 0) {
          for (const scene of chapter.scenes) {
            if (!scene) continue;
            
            // Check scene content
            if (scene.content && typeof scene.content === 'string' && textContainsCharacterName(scene.content, char.name)) {
              return true;
            }
            // Check scene summary
            if (scene.summary && typeof scene.summary === 'string' && textContainsCharacterName(scene.summary, char.name)) {
              return true;
            }
          }
        }
      } catch (error) {
        console.warn(`Error checking character presence for ${char.name} in chapter ${chapter.number}:`, error);
        return false;
      }
      
      return false;
    };
    
    // Create a matrix showing character presence in chapters
    return {
      characters,
      chapters,
      presence: characters.map(char => 
        chapters.map(chapter => characterAppearsInChapter(char, chapter))
      )
    };
  }, [novelState]);

  return (
    <div className="p-4 md:p-5 lg:p-6 max-w-6xl mx-auto pt-12 md:pt-16">
      <div className="mb-6 border-b border-zinc-700 pb-4">
        <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Character-Plot Matrix</h2>
        <p className="text-sm text-zinc-400 mt-2">Visualize character presence across chapters</p>
      </div>

      {matrixData.characters.length === 0 || matrixData.chapters.length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">No Data Available</h3>
          <p className="text-sm text-zinc-500">Add characters and chapters to see the matrix.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-zinc-900 border border-zinc-700 p-3 text-left text-xs font-bold text-zinc-400 uppercase z-10">
                    Character
                  </th>
                  {matrixData.chapters.map(chapter => (
                    <th
                      key={chapter.id}
                      onClick={() => navigate({ type: 'chapter', chapterId: chapter.id })}
                      className="bg-zinc-900 border border-zinc-700 p-2 text-center text-xs font-bold text-zinc-400 min-w-[80px] cursor-pointer hover:text-amber-400 transition-colors"
                      title={`Chapter ${chapter.number}: ${chapter.title}`}
                    >
                      Ch {chapter.number}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixData.characters.map((char, charIdx) => (
                  <tr key={char.id}>
                    <td 
                      className="sticky left-0 bg-zinc-900 border border-zinc-700 p-3 text-sm font-fantasy font-bold text-amber-400 z-10 cursor-pointer hover:text-amber-300 transition-colors"
                      onClick={() => navigate({ type: 'character', characterId: char.id })}
                      title={`View ${char.name}`}
                    >
                      {char.name}
                    </td>
                    {matrixData.presence[charIdx].map((present, chapIdx) => (
                      <td
                        key={chapIdx}
                        className={`border border-zinc-700 p-2 text-center ${
                          present
                            ? 'bg-emerald-600/20 hover:bg-emerald-600/30'
                            : 'bg-zinc-800/50 hover:bg-zinc-800'
                        } transition-colors duration-200`}
                      >
                        {present ? (
                          <span className="text-emerald-400 text-lg">●</span>
                        ) : (
                          <span className="text-zinc-600">○</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Antagonist Matrix */}
      {novelState.antagonists && novelState.antagonists.length > 0 && (
        <div className="mt-12">
          <div className="mb-8 border-b border-zinc-700 pb-6">
            <h2 className="text-2xl md:text-3xl font-fantasy font-bold text-red-500 tracking-wider uppercase">Antagonist-Plot Matrix</h2>
            <p className="text-sm text-zinc-400 mt-2">Visualize antagonist presence across chapters</p>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-zinc-900 border border-zinc-700 p-3 text-left text-xs font-bold text-zinc-400 uppercase z-10">
                      Antagonist
                    </th>
                    {matrixData.chapters.map(chapter => (
                      <th
                        key={chapter.id}
                        onClick={() => navigate({ type: 'chapter', chapterId: chapter.id })}
                        className="bg-zinc-900 border border-zinc-700 p-2 text-center text-xs font-bold text-zinc-400 min-w-[80px] cursor-pointer hover:text-amber-400 transition-colors"
                        title={`Chapter ${chapter.number}: ${chapter.title}`}
                      >
                        Ch {chapter.number}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {novelState.antagonists.map(ant => (
                    <tr key={ant.id}>
                      <td 
                        className="sticky left-0 bg-zinc-900 border border-zinc-700 p-3 text-sm font-fantasy font-bold text-red-400 z-10 cursor-pointer hover:text-red-300 transition-colors"
                        onClick={() => navigate({ type: 'antagonist', antagonistId: ant.id })}
                        title={`View ${ant.name}`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{ant.name}</span>
                          <span className={`px-1.5 py-0.5 text-xs rounded ${
                            ant.status === 'active' ? 'bg-red-500/20 text-red-400' :
                            ant.status === 'hinted' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-zinc-700/50 text-zinc-400'
                          }`}>
                            {ant.status}
                          </span>
                        </div>
                      </td>
                      {matrixData.chapters.map(chapter => {
                        const antagonists = chapterAntagonists.get(chapter.id) || [];
                        const present = antagonists.some(a => a.id === ant.id);
                        return (
                          <td
                            key={chapter.id}
                            onClick={() => navigate({ type: 'chapter', chapterId: chapter.id })}
                            className={`border border-zinc-700 p-2 text-center cursor-pointer ${
                              present
                                ? 'bg-red-600/20 hover:bg-red-600/30'
                                : 'bg-zinc-800/50 hover:bg-zinc-800'
                            } transition-colors duration-200`}
                            title={`Chapter ${chapter.number}: ${chapter.title}`}
                          >
                            {present ? '👹' : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(MatrixView);
