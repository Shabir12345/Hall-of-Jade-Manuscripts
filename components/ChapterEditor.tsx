
import React, { useState, memo, useCallback, useMemo, useRef, useEffect } from 'react';
import { Chapter, NovelState, Scene, EntitySuggestion, Revision, AntagonistChapterAppearance } from '../types';
import VoiceInput from './VoiceInput';
import { editChapter } from '../services/aiService';
import SceneEditor from './SceneEditor';
import ReferenceAutocomplete from './ReferenceAutocomplete';
import TextToSpeech from './TextToSpeech';
import RevisionHistory from './RevisionHistory';
import { useToast } from '../contexts/ToastContext';
import { useLoading } from '../contexts/LoadingContext';
import { getAntagonistsForChapter, addAntagonistToChapter, removeAntagonistFromChapter } from '../services/antagonistService';
import { RelatedEntities } from './RelatedEntities';
// Professional Editor Features
import { EditingMode, EditorComment, EditorSuggestion, EditorHighlight, StyleCheck, HighlightCategory } from '../types/editor';
import { getComments, createComment, updateComment, deleteComment, resolveComment, unresolveComment } from '../services/commentService';
import { getSuggestions, acceptSuggestion, rejectSuggestion } from '../services/suggestionService';
import { getHighlights, createHighlight, deleteHighlight, getDefaultColorForType } from '../services/highlightService';
import { getStyleChecks, checkChapter } from '../services/styleCheckerService';
import TrackChangesView from './TrackChangesView';
import CommentPanel from './CommentPanel';
import HighlightToolbar from './HighlightToolbar';
import StyleCheckPanel from './StyleCheckPanel';
import ComparisonView from './ComparisonView';

interface ChapterEditorProps {
  chapter: Chapter;
  novelState?: NovelState;
  onSave: (updatedChapter: Chapter) => void;
  onClose: () => void;
  onNavigateChapter?: (chapterId: string) => void;
}

const ChapterEditor: React.FC<ChapterEditorProps> = ({ chapter, novelState, onSave, onClose, onNavigateChapter }) => {
  const { showSuccess, showError } = useToast();
  const { startLoading, stopLoading, updateMessage } = useLoading();
  
  // Calculate previous and next chapters early to avoid initialization issues
  const { previousChapter, nextChapter } = useMemo(() => {
    if (!novelState || !novelState.chapters || novelState.chapters.length === 0) {
      return { previousChapter: null, nextChapter: null };
    }
    
    const sortedChapters = [...novelState.chapters].sort((a, b) => a.number - b.number);
    const currentIndex = sortedChapters.findIndex(c => c.id === chapter.id);
    
    if (currentIndex === -1) {
      return { previousChapter: null, nextChapter: null };
    }
    
    return {
      previousChapter: currentIndex > 0 ? sortedChapters[currentIndex - 1] : null,
      nextChapter: currentIndex < sortedChapters.length - 1 ? sortedChapters[currentIndex + 1] : null,
    };
  }, [novelState, chapter.id]);
  
  const [content, setContent] = useState(chapter.content);
  const [title, setTitle] = useState(chapter.title);
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [showTTS, setShowTTS] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [scenes, setScenes] = useState<Scene[]>(chapter.scenes || []);
  const [confirmDeleteScene, setConfirmDeleteScene] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chapterAntagonists, setChapterAntagonists] = useState<AntagonistChapterAppearance[]>([]);
  const [isLoadingAntagonists, setIsLoadingAntagonists] = useState(false);

  // Professional Editor State
  const [editingMode, setEditingMode] = useState<EditingMode>('normal');
  const [comments, setComments] = useState<EditorComment[]>([]);
  const [suggestions, setSuggestions] = useState<EditorSuggestion[]>([]);
  const [highlights, setHighlights] = useState<EditorHighlight[]>([]);
  const [styleChecks, setStyleChecks] = useState<StyleCheck[]>([]);
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showStyleChecks, setShowStyleChecks] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [originalContent, setOriginalContent] = useState(chapter.content);
  const [isLoadingEditorData, setIsLoadingEditorData] = useState(false);

  // Reference autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [autocompleteTarget, setAutocompleteTarget] = useState<'content' | 'instruction'>('content');
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const instructionTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAiEdit = useCallback(async () => {
    if (!instruction) return;
    if (!novelState) {
      console.warn('Novel state not provided, cannot use enhanced editing');
      return;
    }
    setIsAiEditing(true);
    startLoading('AI is refining your prose...', false);
    try {
      updateMessage('Analyzing chapter content...');
      const result = await editChapter(content, instruction, novelState, chapter);
      if (result) {
        updateMessage('Applying changes...');
        setContent(result);
        showSuccess('Chapter refined successfully!');
      }
    } catch (e) {
      console.error(e);
      showError('AI rewrite failed. Please try again.');
    } finally {
      setIsAiEditing(false);
      setInstruction('');
      stopLoading();
    }
  }, [content, instruction, novelState, chapter, showError, showSuccess, startLoading, stopLoading, updateMessage]);

  const handleToggleTTS = useCallback(() => {
    setShowTTS(!showTTS);
  }, [showTTS]);

  const handleSave = useCallback(() => {
    onSave({ ...chapter, content, title, scenes });
  }, [chapter, content, title, scenes, onSave]);

  const handleSaveScene = useCallback((updatedScene: Scene) => {
    const updatedScenes = scenes.some(s => s.id === updatedScene.id)
      ? scenes.map(s => s.id === updatedScene.id ? updatedScene : s)
      : [...scenes, updatedScene].sort((a, b) => a.number - b.number);
    setScenes(updatedScenes);
    setEditingScene(null);
  }, [scenes]);

  const handleCreateScene = useCallback(() => {
    const newScene: Scene = {
      id: crypto.randomUUID(),
      chapterId: chapter.id,
      number: scenes.length + 1,
      title: '',
      content: '',
      summary: '',
      wordCount: 0,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setEditingScene(newScene);
  }, [chapter.id, scenes.length]);

  const handleDeleteScene = useCallback((sceneId: string) => {
    setConfirmDeleteScene(sceneId);
  }, []);

  const confirmDeleteSceneAction = useCallback(() => {
    if (confirmDeleteScene) {
      const updatedScenes = scenes.filter(s => s.id !== confirmDeleteScene)
        .map((s, idx) => ({ ...s, number: idx + 1 }));
      setScenes(updatedScenes);
      setConfirmDeleteScene(null);
      showSuccess('Scene deleted');
    }
  }, [scenes, confirmDeleteScene, showSuccess]);

  const handleRestoreRevision = useCallback((revision: Revision) => {
    if (revision.entityType === 'chapter') {
      const restoredChapter = revision.content as Chapter;
      setContent(restoredChapter.content);
      setTitle(restoredChapter.title);
      // We don't necessarily want to overwrite scenes unless they are part of the revision
      // But the chapter revision includes scenes.
      if (restoredChapter.scenes) {
        setScenes(restoredChapter.scenes);
      }
      showSuccess('Chapter restored to previous version');
      setShowHistory(false);
    }
  }, [showSuccess]);

  const wordCount = useMemo(
    () => content.split(/\s+/).filter(x => x).length,
    [content]
  );

  // Handle @ reference autocomplete
  const handleTextChange = useCallback((
    value: string,
    target: 'content' | 'instruction',
    textarea: HTMLTextAreaElement
  ) => {
    if (target === 'content') {
      setContent(value);
    } else {
      setInstruction(value);
    }

    // Check for @ character
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      // Check if there's a space or newline after @ (which would end the reference)
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      if (!textAfterAt.match(/[\s\n]/)) {
        // Extract query after @
        const query = textAfterAt;
        setAutocompleteQuery(query);
        setAutocompleteTarget(target);
        
        // Calculate position for autocomplete
        const textareaRect = textarea.getBoundingClientRect();
        const scrollTop = textarea.scrollTop;
        
        // Create a temporary element to measure text position
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.visibility = 'hidden';
        tempDiv.style.whiteSpace = 'pre-wrap';
        tempDiv.style.font = window.getComputedStyle(textarea).font;
        tempDiv.style.width = window.getComputedStyle(textarea).width;
        tempDiv.style.padding = window.getComputedStyle(textarea).padding;
        tempDiv.textContent = textBeforeCursor;
        document.body.appendChild(tempDiv);
        
        const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
        const lines = textBeforeCursor.split('\n');
        const currentLine = lines.length - 1;
        const lineText = lines[currentLine] || '';
        
        // Approximate position
        const top = textareaRect.top + (currentLine * lineHeight) + lineHeight + scrollTop;
        const left = textareaRect.left + (lineText.length * 8); // Rough estimate
        
        document.body.removeChild(tempDiv);
        
        setAutocompletePosition({ top: Math.min(top, window.innerHeight - 300), left });
        setShowAutocomplete(true);
        return;
      }
    }
    
    // Hide autocomplete if @ is not found or reference is complete
    setShowAutocomplete(false);
  }, []);

  const handleAutocompleteSelect = useCallback((suggestion: EntitySuggestion) => {
    const textarea = autocompleteTarget === 'content' 
      ? contentTextareaRef.current 
      : instructionTextareaRef.current;
    
    if (!textarea) return;

    const currentValue = autocompleteTarget === 'content' ? content : instruction;
    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = currentValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const newValue = 
        currentValue.substring(0, lastAtIndex) + 
        `@${suggestion.name}` + 
        currentValue.substring(cursorPos);
      
      if (autocompleteTarget === 'content') {
        setContent(newValue);
      } else {
        setInstruction(newValue);
      }
      
      setShowAutocomplete(false);
      
      // Set cursor position after the inserted reference
      setTimeout(() => {
        const newCursorPos = lastAtIndex + suggestion.name.length + 1;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  }, [autocompleteTarget, content, instruction]);

  // Close autocomplete when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showAutocomplete) {
        const target = e.target as HTMLElement;
        if (!target.closest('.reference-autocomplete-container') && 
            target !== contentTextareaRef.current && 
            target !== instructionTextareaRef.current) {
          setShowAutocomplete(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAutocomplete]);

  // Sync state when chapter prop changes (e.g., when navigating between chapters)
  useEffect(() => {
    setContent(chapter.content);
    setTitle(chapter.title);
    setScenes(chapter.scenes || []);
    setOriginalContent(chapter.content);
    setInstruction(''); // Clear AI instruction when switching chapters
    setShowAutocomplete(false); // Close autocomplete when switching chapters
    setShowTTS(false); // Close TTS when switching chapters
    setSelectedText(''); // Clear selection
    setSelectedRange(null); // Clear selection range
    
    // Scroll to top when chapter changes
    if (contentTextareaRef.current) {
      contentTextareaRef.current.scrollTop = 0;
    }
    // Also scroll the main container
    const mainContainer = document.querySelector('.flex-1.relative.overflow-y-auto');
    if (mainContainer) {
      mainContainer.scrollTop = 0;
    }
  }, [chapter.id, chapter.content, chapter.title, chapter.scenes]);

  // Load antagonists for this chapter
  useEffect(() => {
    if (chapter.id) {
      setIsLoadingAntagonists(true);
      getAntagonistsForChapter(chapter.id)
        .then(setChapterAntagonists)
        .catch(error => {
          console.error('Error loading chapter antagonists:', error);
          setChapterAntagonists([]);
        })
        .finally(() => setIsLoadingAntagonists(false));
    }
  }, [chapter.id]);

  // Load professional editor data when chapter changes
  useEffect(() => {
    const loadEditorData = async () => {
      if (!chapter.id) return;
      setIsLoadingEditorData(true);
      try {
        const [commentsData, suggestionsData, highlightsData, checksData] = await Promise.all([
          getComments(chapter.id).catch(() => []),
          getSuggestions(chapter.id).catch(() => []),
          getHighlights(chapter.id).catch(() => []),
          getStyleChecks(chapter.id).catch(() => []),
        ]);
        setComments(commentsData);
        setSuggestions(suggestionsData);
        setHighlights(highlightsData);
        setStyleChecks(checksData);
      } catch (error) {
        console.error('Error loading editor data:', error);
      } finally {
        setIsLoadingEditorData(false);
      }
    };

    loadEditorData();
  }, [chapter.id]);

  // Professional Editor Handlers
  const handleTextSelection = useCallback(() => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selected = content.substring(start, end);
      setSelectedText(selected);
      setSelectedRange({ start, end });
    } else {
      setSelectedText('');
      setSelectedRange(null);
    }
  }, [content]);

  const handleAddComment = useCallback(async () => {
    if (!selectedRange || !selectedText.trim()) {
      showError('Please select text to comment on');
      return;
    }
    const commentText = prompt('Enter your comment:');
    if (!commentText || !commentText.trim()) return;
    
    try {
      const newComment = await createComment({
        chapterId: chapter.id,
        entityType: 'chapter',
        entityId: chapter.id,
        textRange: selectedRange,
        selectedText: selectedText.substring(0, 200),
        comment: commentText.trim(),
        author: 'user',
      });
      setComments(prev => [...prev, newComment]);
      setSelectedText('');
      setSelectedRange(null);
      showSuccess('Comment added');
    } catch (error: any) {
      showError(error.message || 'Failed to add comment');
    }
  }, [chapter.id, selectedRange, selectedText, showError, showSuccess]);

  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await acceptSuggestion(suggestionId);
      const updated = await getSuggestions(chapter.id);
      setSuggestions(updated);
      showSuccess('Suggestion accepted');
    } catch (error: any) {
      showError(error.message || 'Failed to accept suggestion');
    }
  }, [chapter.id, showError, showSuccess]);

  const handleRejectSuggestion = useCallback(async (suggestionId: string) => {
    try {
      await rejectSuggestion(suggestionId);
      const updated = await getSuggestions(chapter.id);
      setSuggestions(updated);
      showSuccess('Suggestion rejected');
    } catch (error: any) {
      showError(error.message || 'Failed to reject suggestion');
    }
  }, [chapter.id, showError, showSuccess]);

  const handleHighlight = useCallback(async (category: HighlightCategory, color: string, note?: string) => {
    if (!selectedRange) return;
    
    try {
      const newHighlight = await createHighlight({
        chapterId: chapter.id,
        textRange: selectedRange,
        highlightType: category,
        color,
        note,
      });
      setHighlights(prev => [...prev, newHighlight]);
      setSelectedText('');
      setSelectedRange(null);
      showSuccess('Text highlighted');
    } catch (error: any) {
      showError(error.message || 'Failed to create highlight');
    }
  }, [chapter.id, selectedRange, showError, showSuccess]);

  const handleRunStyleCheck = useCallback(async () => {
    startLoading('Running style checks...', false);
    try {
      const checks = await checkChapter(chapter, novelState);
      setStyleChecks(checks);
      setShowStyleChecks(true);
      showSuccess(`Found ${checks.length} style issue${checks.length !== 1 ? 's' : ''}`);
    } catch (error: any) {
      showError(error.message || 'Failed to run style checks');
    } finally {
      stopLoading();
    }
  }, [chapter, novelState, showError, showSuccess, startLoading, stopLoading]);

  const handleNavigateChapter = useCallback((chapterId: string) => {
    if (!onNavigateChapter) return;
    
    // Check if there are unsaved changes
    const hasUnsavedChanges = 
      content !== chapter.content || 
      title !== chapter.title || 
      JSON.stringify(scenes) !== JSON.stringify(chapter.scenes || []);
    
    if (hasUnsavedChanges) {
      // Auto-save before navigating
      onSave({ ...chapter, content, title, scenes });
    }
    
    // Navigate to the new chapter
    onNavigateChapter(chapterId);
  }, [onNavigateChapter, chapter, content, title, scenes, onSave]);

  // Keyboard shortcuts for navigation (Ctrl/Cmd + Left/Right Arrow)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input/textarea (unless Ctrl/Cmd is pressed)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      
      if (isInput && !(e.ctrlKey || e.metaKey)) {
        return; // Don't interfere with normal typing
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowLeft' && previousChapter) {
        e.preventDefault();
        handleNavigateChapter(previousChapter.id);
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'ArrowRight' && nextChapter) {
        e.preventDefault();
        handleNavigateChapter(nextChapter.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previousChapter, nextChapter, handleNavigateChapter]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
              onChange={(e) => setTitle(e.target.value)}
              className="bg-transparent border-none text-lg md:text-xl font-fantasy font-bold text-amber-500 focus:ring-0 w-full pr-12 placeholder-zinc-600 break-words"
              placeholder="Chapter Title..."
              aria-label="Chapter title"
            />
            <VoiceInput 
              onResult={(text) => setTitle(text)} 
              className="absolute right-0 flex-shrink-0"
              title="Voice Input: Speak to set chapter title"
            />
          </div>
        </div>
        <div className="flex items-center flex-wrap gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
          <button
            onClick={() => setShowHistory(true)}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap"
            aria-label="View Revision History"
          >
            History
          </button>
          <button 
            onClick={handleToggleTTS}
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
            onClick={handleSave}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105 shadow-lg shadow-amber-900/20 whitespace-nowrap"
            aria-label="Save chapter"
          >
            Save Chapter
          </button>
        </div>
      </div>

      {showTTS && (
        <div className="border-b border-zinc-700 bg-zinc-900/50 p-4">
          <TextToSpeech text={content} onClose={() => setShowTTS(false)} />
        </div>
      )}

      {/* Professional Editor Toolbar */}
      <div className="px-4 md:px-6 py-2 border-b border-zinc-700 bg-zinc-900/40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Edit Mode:</span>
            {(['normal', 'suggest', 'track'] as EditingMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setEditingMode(mode)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  editingMode === mode
                    ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {mode === 'normal' ? 'Normal' : mode === 'suggest' ? 'Suggest' : 'Track Changes'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowComments(!showComments)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showComments
                  ? 'bg-blue-600/30 text-blue-400 border border-blue-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Comments ({comments.length})
            </button>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showSuggestions
                  ? 'bg-green-600/30 text-green-400 border border-green-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Suggestions ({suggestions.filter(s => s.status === 'pending').length})
            </button>
            <button
              onClick={() => setShowHighlights(!showHighlights)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showHighlights
                  ? 'bg-yellow-600/30 text-yellow-400 border border-yellow-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Highlights ({highlights.length})
            </button>
            <button
              onClick={handleRunStyleCheck}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                styleChecks.length > 0
                  ? 'bg-orange-600/30 text-orange-400 border border-orange-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Style Check ({styleChecks.length})
            </button>
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                showComparison
                  ? 'bg-purple-600/30 text-purple-400 border border-purple-600/50'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
              }`}
            >
              Compare
            </button>
          </div>
        </div>
      </div>

      {/* Navigation buttons at top */}
      {(previousChapter || nextChapter) && (
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-zinc-700 bg-zinc-900/30 backdrop-blur-sm">
          <button
            onClick={() => previousChapter && handleNavigateChapter(previousChapter.id)}
            disabled={!previousChapter}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
              previousChapter
                ? 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 hover:shadow-amber-900/20 border border-zinc-700 hover:border-amber-500/50'
                : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800'
            }`}
            aria-label={previousChapter ? `Go to previous chapter: ${previousChapter.title}` : 'No previous chapter'}
            title={previousChapter ? `Previous: Chapter ${previousChapter.number} - ${previousChapter.title}` : 'No previous chapter'}
          >
            <span className="text-lg">←</span>
            <span>Previous</span>
            {previousChapter && (
              <span className="text-xs text-zinc-400 font-normal">Ch. {previousChapter.number}</span>
            )}
          </button>
          <div className="flex items-center gap-2 text-xs text-zinc-500 px-4">
            <span className="font-semibold">Chapter {chapter.number}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">{novelState?.chapters.length || 0} total</span>
          </div>
          <button
            onClick={() => nextChapter && handleNavigateChapter(nextChapter.id)}
            disabled={!nextChapter}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
              nextChapter
                ? 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 hover:shadow-amber-900/20 border border-zinc-700 hover:border-amber-500/50'
                : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800'
            }`}
            aria-label={nextChapter ? `Go to next chapter: ${nextChapter.title}` : 'No next chapter'}
            title={nextChapter ? `Next: Chapter ${nextChapter.number} - ${nextChapter.title}` : 'No next chapter'}
          >
            {nextChapter && (
              <span className="text-xs text-zinc-400 font-normal">Ch. {nextChapter.number}</span>
            )}
            <span>Next</span>
            <span className="text-lg">→</span>
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className="flex-1 relative overflow-y-auto p-6 md:p-8 lg:p-12 scrollbar-thin">
          <div className="absolute top-4 right-4 z-10">
            <VoiceInput 
              onResult={(text) => setContent(prev => prev + "\n" + text)}
              className="shadow-xl bg-zinc-900/95 backdrop-blur-sm border border-zinc-700"
            />
          </div>
          <textarea
            ref={contentTextareaRef}
            value={content}
            onChange={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              handleTextChange(e.target.value, 'content', textarea);
              // Track selection for highlighting/comments
              setTimeout(() => handleTextSelection(), 0);
            }}
            onSelect={handleTextSelection}
            onKeyDown={(e) => {
              if (showAutocomplete && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                e.preventDefault();
                // Let autocomplete handle these keys
                return;
              }
            }}
            className="w-full h-full bg-transparent border-none focus:ring-0 text-zinc-300 font-serif-novel text-base md:text-lg lg:text-xl leading-relaxed resize-none placeholder-zinc-600 pr-16"
            placeholder="The story begins here... Use @ to reference characters, places, and world entries."
            aria-label="Chapter content"
          />
          {showAutocomplete && autocompleteTarget === 'content' && novelState && (
            <div className="reference-autocomplete-container">
              <ReferenceAutocomplete
                query={autocompleteQuery}
                state={novelState}
                position={autocompletePosition}
                onSelect={handleAutocompleteSelect}
                onClose={() => setShowAutocomplete(false)}
              />
            </div>
          )}
          
          {/* Navigation buttons at bottom */}
          {(previousChapter || nextChapter) && (
            <div className="flex items-center justify-between px-4 md:px-6 py-4 mt-4 border-t border-zinc-700 bg-zinc-900/30 backdrop-blur-sm">
              <button
                onClick={() => previousChapter && handleNavigateChapter(previousChapter.id)}
                disabled={!previousChapter}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
                  previousChapter
                    ? 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 hover:shadow-amber-900/20 border border-zinc-700 hover:border-amber-500/50'
                    : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800'
                }`}
                aria-label={previousChapter ? `Go to previous chapter: ${previousChapter.title}` : 'No previous chapter'}
                title={previousChapter ? `Previous: Chapter ${previousChapter.number} - ${previousChapter.title}` : 'No previous chapter'}
              >
                <span className="text-lg">←</span>
                <span>Previous Chapter</span>
                {previousChapter && (
                  <span className="text-xs text-zinc-400 font-normal">({previousChapter.number})</span>
                )}
              </button>
              <button
                onClick={() => nextChapter && handleNavigateChapter(nextChapter.id)}
                disabled={!nextChapter}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
                  nextChapter
                    ? 'bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 hover:text-amber-400 hover:shadow-amber-900/20 border border-zinc-700 hover:border-amber-500/50'
                    : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed border border-zinc-800'
                }`}
                aria-label={nextChapter ? `Go to next chapter: ${nextChapter.title}` : 'No next chapter'}
                title={nextChapter ? `Next: Chapter ${nextChapter.number} - ${nextChapter.title}` : 'No next chapter'}
              >
                <span>Next Chapter</span>
                {nextChapter && (
                  <span className="text-xs text-zinc-400 font-normal">({nextChapter.number})</span>
                )}
                <span className="text-lg">→</span>
              </button>
            </div>
          )}
        </div>

        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-700 bg-zinc-900/40 p-4 md:p-6 space-y-6 overflow-y-auto scrollbar-thin">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">Scenes</h3>
              <button
                onClick={handleCreateScene}
                className="text-xs bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 px-3 py-1.5 rounded-lg border border-amber-600/30 hover:border-amber-600/50 transition-all duration-200 font-semibold"
                aria-label="Create new scene"
              >
                + Scene
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {scenes.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">No scenes yet. Create one to organize your chapter.</p>
              ) : (
                scenes.map((scene) => (
                  <div
                    key={scene.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 hover:border-amber-500/50 transition-all duration-200 group"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-bold text-zinc-500">Scene {scene.number}</span>
                          {scene.title && (
                            <span className="text-xs text-amber-400 font-semibold truncate">{scene.title}</span>
                          )}
                        </div>
                        {scene.summary && (
                          <p className="text-xs text-zinc-400 line-clamp-2 italic">{scene.summary}</p>
                        )}
                        <p className="text-xs text-zinc-500 mt-1">{scene.wordCount} words</p>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        <button
                          onClick={() => setEditingScene(scene)}
                          className="text-xs text-zinc-400 hover:text-amber-500 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors"
                          aria-label={`Edit scene ${scene.number}`}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.id)}
                          className="text-xs text-zinc-400 hover:text-red-500 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                          aria-label={`Delete scene ${scene.number}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Antagonists Section */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">Antagonists</h3>
              <button
                onClick={() => {
                  if (!novelState) return;
                  setIsLoadingAntagonists(true);
                  getAntagonistsForChapter(chapter.id)
                    .then(setChapterAntagonists)
                    .catch(error => {
                      console.error('Error refreshing antagonists:', error);
                    })
                    .finally(() => setIsLoadingAntagonists(false));
                }}
                className="text-xs text-zinc-400 hover:text-zinc-300 px-2 py-1 rounded transition-colors"
                title="Refresh antagonists"
              >
                {isLoadingAntagonists ? '...' : '↻'}
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {chapterAntagonists.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">No antagonists tracked in this chapter.</p>
              ) : (
                chapterAntagonists.map(appearance => {
                  const antagonist = novelState?.antagonists?.find(a => a.id === appearance.antagonistId);
                  if (!antagonist) return null;
                  return (
                    <div
                      key={appearance.id}
                      className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 hover:border-amber-500/50 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-zinc-200">{antagonist.name}</span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              appearance.presenceType === 'direct' ? 'bg-red-500/20 text-red-400' :
                              appearance.presenceType === 'mentioned' ? 'bg-orange-500/20 text-orange-400' :
                              appearance.presenceType === 'hinted' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-blue-500/20 text-blue-400'
                            }`}>
                              {appearance.presenceType}
                            </span>
                            <span className={`px-1.5 py-0.5 text-xs rounded ${
                              appearance.significance === 'major' ? 'bg-red-600/30 text-red-300' :
                              appearance.significance === 'minor' ? 'bg-zinc-600/30 text-zinc-300' :
                              'bg-yellow-600/30 text-yellow-300'
                            }`}>
                              {appearance.significance}
                            </span>
                          </div>
                          {appearance.notes && (
                            <p className="text-xs text-zinc-400 italic line-clamp-2">{appearance.notes}</p>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await removeAntagonistFromChapter(appearance.antagonistId, chapter.id);
                              const updated = await getAntagonistsForChapter(chapter.id);
                              setChapterAntagonists(updated);
                              showSuccess('Antagonist removed from chapter');
                            } catch (error: any) {
                              showError(error.message || 'Failed to remove antagonist');
                            }
                          }}
                          className="ml-2 text-zinc-500 hover:text-red-400 transition-colors text-xs"
                          title="Remove from chapter"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {/* Add Antagonist Dropdown */}
            {novelState?.antagonists && novelState.antagonists.length > 0 && (
              <div className="mt-3">
                <select
                  value=""
                  aria-label="Add antagonist to chapter"
                  title="Select an antagonist to add to this chapter"
                  onChange={async (e) => {
                    const antagonistId = e.target.value;
                    if (!antagonistId) return;
                    const antagonist = novelState.antagonists?.find(a => a.id === antagonistId);
                    if (!antagonist) return;
                    
                    // Check if already added
                    if (chapterAntagonists.some(a => a.antagonistId === antagonistId)) {
                      showError('Antagonist already added to this chapter');
                      return;
                    }
                    
                    try {
                      await addAntagonistToChapter(
                        antagonistId,
                        chapter.id,
                        'mentioned',
                        'minor',
                        ''
                      );
                      const updated = await getAntagonistsForChapter(chapter.id);
                      setChapterAntagonists(updated);
                      showSuccess('Antagonist added to chapter');
                      e.target.value = '';
                    } catch (error: any) {
                      showError(error.message || 'Failed to add antagonist');
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
                >
                  <option value="">+ Add Antagonist</option>
                  {novelState.antagonists
                    .filter(a => !chapterAntagonists.some(ca => ca.antagonistId === a.id))
                    .map(ant => (
                      <option key={ant.id} value={ant.id}>
                        {ant.name} ({ant.type})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wide">AI Editor Agent</h3>
              <VoiceInput onResult={(text) => setInstruction(prev => prev ? prev + " " + text : text)} />
            </div>
            <div className="relative">
              <textarea
                ref={instructionTextareaRef}
                value={instruction}
                onChange={(e) => {
                  const textarea = e.target as HTMLTextAreaElement;
                  handleTextChange(e.target.value, 'instruction', textarea);
                }}
                onKeyDown={(e) => {
                  if (showAutocomplete && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape')) {
                    e.preventDefault();
                    // Let autocomplete handle these keys
                    return;
                  }
                }}
                placeholder="E.g., 'Make @CharacterName's face-slapping more satisfying'... Use @ to reference entities."
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 h-24 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all leading-relaxed"
                aria-label="AI editing instructions"
              />
              {showAutocomplete && autocompleteTarget === 'instruction' && novelState && (
                <div className="reference-autocomplete-container">
                  <ReferenceAutocomplete
                    query={autocompleteQuery}
                    state={novelState}
                    position={autocompletePosition}
                    onSelect={handleAutocompleteSelect}
                    onClose={() => setShowAutocomplete(false)}
                  />
                </div>
              )}
            </div>
            <button
              disabled={isAiEditing}
              onClick={handleAiEdit}
              className={`w-full mt-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                isAiEditing 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-zinc-100 text-zinc-950 hover:bg-white hover:scale-105'
              }`}
              aria-label={isAiEditing ? 'AI is editing...' : 'Rewrite with AI'}
            >
              {isAiEditing ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-3 w-3 border-2 border-zinc-950/30 border-t-zinc-950 mr-2"></span>
                  Refining Prose...
                </span>
              ) : (
                'Rewrite with AI'
              )}
            </button>
          </div>

          {/* Professional Editor Panels */}
          {showComments && (
            <div className="mt-6">
              <CommentPanel
                comments={comments}
                onAddComment={handleAddComment}
                onEditComment={async (id, text) => {
                  try {
                    const updated = await updateComment(id, { comment: text });
                    setComments(prev => prev.map(c => c.id === id ? updated : c));
                    showSuccess('Comment updated');
                  } catch (error: any) {
                    showError(error.message || 'Failed to update comment');
                  }
                }}
                onDeleteComment={async (id) => {
                  try {
                    await deleteComment(id);
                    setComments(prev => prev.filter(c => c.id !== id));
                    showSuccess('Comment deleted');
                  } catch (error: any) {
                    showError(error.message || 'Failed to delete comment');
                  }
                }}
                onResolveComment={async (id) => {
                  try {
                    const updated = await resolveComment(id);
                    setComments(prev => prev.map(c => c.id === id ? updated : c));
                  } catch (error: any) {
                    showError(error.message || 'Failed to resolve comment');
                  }
                }}
                onUnresolveComment={async (id) => {
                  try {
                    const updated = await unresolveComment(id);
                    setComments(prev => prev.map(c => c.id === id ? updated : c));
                  } catch (error: any) {
                    showError(error.message || 'Failed to unresolve comment');
                  }
                }}
                onJumpToComment={(comment) => {
                  if (contentTextareaRef.current) {
                    const textarea = contentTextareaRef.current;
                    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
                    const textBefore = content.substring(0, comment.textRange.start);
                    const lines = textBefore.split('\n').length;
                    textarea.scrollTop = (lines - 1) * lineHeight;
                    textarea.setSelectionRange(comment.textRange.start, comment.textRange.end);
                    textarea.focus();
                  }
                }}
              />
            </div>
          )}

          {showSuggestions && (
            <div className="mt-6">
              <TrackChangesView
                suggestions={suggestions}
                onAccept={handleAcceptSuggestion}
                onReject={handleRejectSuggestion}
              />
            </div>
          )}

          {showHighlights && selectedRange && (
            <div className="mt-6">
              <HighlightToolbar
                selectedText={selectedText}
                selectedRange={selectedRange}
                highlights={highlights}
                onHighlight={handleHighlight}
                onRemoveHighlight={async (id) => {
                  try {
                    await deleteHighlight(id);
                    setHighlights(prev => prev.filter(h => h.id !== id));
                    showSuccess('Highlight removed');
                  } catch (error: any) {
                    showError(error.message || 'Failed to remove highlight');
                  }
                }}
              />
            </div>
          )}

          {showStyleChecks && styleChecks.length > 0 && (
            <div className="mt-6">
              <StyleCheckPanel
                checks={styleChecks}
                onJumpToIssue={(check) => {
                  if (contentTextareaRef.current) {
                    const textarea = contentTextareaRef.current;
                    textarea.setSelectionRange(check.location.start, check.location.end);
                    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    textarea.focus();
                  }
                }}
              />
            </div>
          )}

          <div className="p-4 bg-amber-600/10 border border-amber-600/20 rounded-lg">
            <h4 className="text-xs text-amber-500 font-bold uppercase mb-2">Writer Tip</h4>
            <p className="text-sm text-zinc-400 leading-relaxed italic">
              "The climax of a cultivation arc must feel like a mountain falling into the sea. Don't rush the breakthrough."
            </p>
          </div>

          <div className="text-xs text-zinc-500 font-semibold">
            Character count: {content.length.toLocaleString()} | Est. Words: {content.split(/\s+/).filter(x => x).length.toLocaleString()}
          </div>
          {novelState && (
            <RelatedEntities
              novelState={novelState}
              entityType="chapter"
              entityId={chapter.id}
              maxItems={8}
            />
          )}
        </div>
      </div>

      {editingScene && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50">
          <SceneEditor
            scene={editingScene}
            novelState={novelState}
            onSave={handleSaveScene}
            onClose={() => setEditingScene(null)}
          />
        </div>
      )}

      {confirmDeleteScene && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-red-500/50 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-xl font-fantasy font-bold text-red-400 mb-4">Delete Scene</h3>
            <p className="text-zinc-300 mb-6">Delete this scene? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmDeleteScene(null)}
                className="px-6 py-2.5 text-zinc-400 font-semibold hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSceneAction}
                className="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <RevisionHistory
          entityType="chapter"
          entityId={chapter.id}
          onRestore={handleRestoreRevision}
          onClose={() => setShowHistory(false)}
        />
      )}

      {showComparison && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-300">Compare Versions</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <ComparisonView
                originalText={originalContent}
                editedText={content}
                suggestions={suggestions}
                onAccept={handleAcceptSuggestion}
                onReject={handleRejectSuggestion}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ChapterEditor);
