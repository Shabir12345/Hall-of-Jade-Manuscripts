
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
import EditorialReviewPanel from './EditorialReviewPanel';
import { Tooltip, HelpIcon } from './Tooltip';
import { useEditorialReview } from '../hooks/useEditorialReview';
import { ChapterEditorHeader } from './chapterEditor/ChapterEditorHeader';
import { ChapterEditorTabs, ChapterEditorTab } from './chapterEditor/ChapterEditorTabs';
import { ChapterNavigation } from './chapterEditor/ChapterNavigation';
import { ChapterScenesEditor } from './chapterEditor/ChapterScenesEditor';
import { ChapterAntagonistsEditor } from './chapterEditor/ChapterAntagonistsEditor';
import PromptDialog from './PromptDialog';

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
  const [activeTab, setActiveTab] = useState<ChapterEditorTab>('content');

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
  const [showQualityReview, setShowQualityReview] = useState(false);
  const [originalContent, setOriginalContent] = useState(chapter.content);
  const [isLoadingEditorData, setIsLoadingEditorData] = useState(false);

  // Editorial Review Hook
  const { review: editorialReview, isLoading: isReviewLoading, runReview: runEditorialReview } = useEditorialReview(
    chapter,
    novelState,
    { autoReviewOnMount: false }
  );

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
      // Safely log error to prevent "Cannot convert object to primitive value" errors
      try {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error('AI rewrite error:', errorMessage);
      } catch {
        console.error('AI rewrite error (details unavailable)');
      }
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
          // Safely log error
          try {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error loading chapter antagonists:', errorMessage);
          } catch {
            console.error('Error loading chapter antagonists (details unavailable)');
          }
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
        // Safely log error
        try {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('Error loading editor data:', errorMessage);
        } catch {
          console.error('Error loading editor data (details unavailable)');
        }
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

  const [showCommentPrompt, setShowCommentPrompt] = useState(false);

  const handleAddComment = useCallback(() => {
    if (!selectedRange || !selectedText.trim()) {
      showError('Please select text to comment on');
      return;
    }
    setShowCommentPrompt(true);
  }, [selectedRange, selectedText, showError]);

  const confirmAddComment = useCallback(async (commentText: string) => {
    setShowCommentPrompt(false);
    if (!commentText || !commentText.trim() || !selectedRange) return;
    
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

  const professionalEditorBadgeCount = useMemo(() => {
    return [comments.length, suggestions.filter(s => s.status === 'pending').length, highlights.length, styleChecks.length].filter(n => n > 0).length;
  }, [comments.length, suggestions, highlights.length, styleChecks.length]);

  return (
    <>
    <div className="flex flex-col h-full bg-zinc-950 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <ChapterEditorHeader
        title={title}
        content={content}
        onTitleChange={setTitle}
        onClose={onClose}
        onSave={handleSave}
        onShowHistory={() => {
          setShowHistory(true);
          setActiveTab('history');
        }}
        showTTS={showTTS}
        onToggleTTS={handleToggleTTS}
        showHistory={showHistory}
        activeTab={activeTab}
      />

      <ChapterEditorTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scenesCount={scenes.length}
        antagonistsCount={chapterAntagonists.length}
        professionalEditorBadgeCount={professionalEditorBadgeCount}
      />

      {(previousChapter || nextChapter) && (
        <ChapterNavigation
          previousChapter={previousChapter}
          nextChapter={nextChapter}
          currentChapterNumber={chapter.number}
          totalChapters={novelState?.chapters.length || 0}
          onNavigate={handleNavigateChapter}
          variant="top"
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content Tab */}
        {activeTab === 'content' && (
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
                data-tour="editor-content"
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
                <div className="mt-4">
                  <ChapterNavigation
                    previousChapter={previousChapter}
                    nextChapter={nextChapter}
                    currentChapterNumber={chapter.number}
                    totalChapters={novelState?.chapters.length || 0}
                    onNavigate={handleNavigateChapter}
                    variant="bottom"
                  />
                </div>
              )}
            </div>

            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-700 bg-zinc-900/40 p-4 md:p-6 space-y-6 overflow-y-auto scrollbar-thin">
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
        )}

        {/* Scenes Tab */}
        {activeTab === 'scenes' && (
          <ChapterScenesEditor
            scenes={scenes}
            onCreateScene={handleCreateScene}
            onEditScene={setEditingScene}
            onDeleteScene={handleDeleteScene}
          />
        )}

        {/* Antagonists Tab */}
        {activeTab === 'antagonists' && (
          <ChapterAntagonistsEditor
            chapterId={chapter.id}
            novelState={novelState}
            antagonists={chapterAntagonists}
            isLoading={isLoadingAntagonists}
            onRefresh={async () => {
              if (!novelState) return;
              setIsLoadingAntagonists(true);
              try {
                const updated = await getAntagonistsForChapter(chapter.id);
                setChapterAntagonists(updated);
              } catch (error) {
                // Safely log error
                try {
                  const errorMessage = error instanceof Error ? error.message : String(error);
                  console.error('Error refreshing antagonists:', errorMessage);
                } catch {
                  console.error('Error refreshing antagonists (details unavailable)');
                }
              } finally {
                setIsLoadingAntagonists(false);
              }
            }}
            onAntagonistsChange={setChapterAntagonists}
            onSuccess={showSuccess}
            onError={showError}
          />
        )}

        {/* Professional Editor Tab */}
        {activeTab === 'professional' && (
          <div className="flex-1 flex flex-col overflow-hidden" data-tour="professional-editor">
            {/* Professional Editor Toolbar */}
            <div className="px-4 md:px-6 py-3 border-b border-zinc-700 bg-zinc-900/40">
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
                  <Tooltip content="Add comments to specific parts of your chapter. Select text and add notes for review." position="bottom" delay={200}>
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
                  </Tooltip>
                  <Tooltip content="Review AI-generated suggestions for improvements. Accept or reject each suggestion individually." position="bottom" delay={200}>
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
                  </Tooltip>
                  <Tooltip content="Highlight text with different categories (plot, character, world-building, etc.) for organization." position="bottom" delay={200}>
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
                  </Tooltip>
                  <Tooltip content="Check for style issues, grammar, consistency, and writing quality. Click to run analysis." position="bottom" delay={200}>
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
                  </Tooltip>
                  <Tooltip content="Compare original version with current version to see all changes side-by-side." position="bottom" delay={200}>
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
                  </Tooltip>
                  <Tooltip content="Run comprehensive quality review including narrative craft, originality, voice consistency, and editorial quality checks." position="bottom" delay={200}>
                    <button
                      onClick={() => {
                        setShowQualityReview(!showQualityReview);
                        if (!showQualityReview && !editorialReview) {
                          runEditorialReview();
                        }
                      }}
                      className={`px-3 py-1 text-xs rounded transition-colors ${
                        showQualityReview
                          ? 'bg-amber-600/30 text-amber-400 border border-amber-600/50'
                          : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                      }`}
                    >
                      Quality Review {editorialReview && `(${editorialReview.signals.length})`}
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin">
              <div className="max-w-4xl mx-auto space-y-6">
                {showComments && (
                  <div>
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
                        setActiveTab('content');
                        setTimeout(() => {
                          if (contentTextareaRef.current) {
                            const textarea = contentTextareaRef.current;
                            const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 20;
                            const textBefore = content.substring(0, comment.textRange.start);
                            const lines = textBefore.split('\n').length;
                            textarea.scrollTop = (lines - 1) * lineHeight;
                            textarea.setSelectionRange(comment.textRange.start, comment.textRange.end);
                            textarea.focus();
                          }
                        }, 100);
                      }}
                    />
                  </div>
                )}

                {showSuggestions && (
                  <div>
                    <TrackChangesView
                      suggestions={suggestions}
                      onAccept={handleAcceptSuggestion}
                      onReject={handleRejectSuggestion}
                    />
                  </div>
                )}

                {showHighlights && selectedRange && (
                  <div>
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
                  <div>
                    <StyleCheckPanel
                      checks={styleChecks}
                      onJumpToIssue={(check) => {
                        setActiveTab('content');
                        setTimeout(() => {
                          if (contentTextareaRef.current) {
                            const textarea = contentTextareaRef.current;
                            textarea.setSelectionRange(check.location.start, check.location.end);
                            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            textarea.focus();
                          }
                        }, 100);
                      }}
                    />
                  </div>
                )}

                {showQualityReview && (
                  <div>
                    <EditorialReviewPanel
                      review={editorialReview}
                      isLoading={isReviewLoading}
                      onRecheck={() => runEditorialReview()}
                      onJumpToLocation={(signal) => {
                        if (signal.location && contentTextareaRef.current) {
                          const textarea = contentTextareaRef.current;
                          textarea.setSelectionRange(signal.location.start, signal.location.end);
                          textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          textarea.focus();
                        }
                      }}
                      onDismissSignal={(signalId) => {
                        // Signal dismissed - could store in state if needed
                        console.log('Signal dismissed:', signalId);
                      }}
                    />
                  </div>
                )}

                {!showComments && !showSuggestions && !showHighlights && !showStyleChecks && !showQualityReview && (
                  <div className="py-12 text-center bg-zinc-900/50 border border-dashed border-zinc-700 rounded-2xl">
                    <p className="text-sm text-zinc-500 italic">Select a feature from the toolbar above to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* History Tab - Opens modal */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 md:p-8 scrollbar-thin flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="text-4xl mb-3">📜</div>
              <h3 className="text-xl font-fantasy font-bold text-zinc-300 mb-2">Revision History</h3>
              <p className="text-sm text-zinc-500 mb-6">Click the History button in the header to view revision history.</p>
              <button
                onClick={() => setShowHistory(true)}
                className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-105"
              >
                Open History
              </button>
            </div>
          </div>
        )}
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
          onRestore={(revision) => {
            handleRestoreRevision(revision);
            setShowHistory(false);
            setActiveTab('content');
          }}
          onClose={() => {
            setShowHistory(false);
            setActiveTab('content');
          }}
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

    <PromptDialog
      isOpen={showCommentPrompt}
      title="Add Comment"
      message="Enter your comment:"
      placeholder="Comment text..."
      confirmText="Add Comment"
      onConfirm={confirmAddComment}
      onCancel={() => setShowCommentPrompt(false)}
      variant="info"
    />
    </>
  );
};

export default memo(ChapterEditor);
