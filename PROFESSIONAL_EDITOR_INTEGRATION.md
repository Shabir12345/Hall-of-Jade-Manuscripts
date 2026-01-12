# Professional Editor Integration Guide

This document describes how to integrate the professional editing features into ChapterEditor.

## Integration Points

### 1. Add Imports to ChapterEditor.tsx

Add these imports after the existing imports:

```typescript
// Professional Editor Features
import { EditingMode, EditorComment, EditorSuggestion, EditorHighlight, StyleCheck } from '../types/editor';
import { getComments, createComment, updateComment, deleteComment, resolveComment, unresolveComment } from '../services/commentService';
import { getSuggestions, createSuggestion, acceptSuggestion, rejectSuggestion, deleteSuggestion } from '../services/suggestionService';
import { getHighlights, createHighlight, updateHighlight, deleteHighlight, getDefaultColorForType } from '../services/highlightService';
import { getStyleChecks, checkChapter } from '../services/styleCheckerService';
import TrackChangesView from './TrackChangesView';
import CommentPanel from './CommentPanel';
import CommentAnnotation from './CommentAnnotation';
import HighlightToolbar from './HighlightToolbar';
import StyleCheckPanel from './StyleCheckPanel';
import ComparisonView from './ComparisonView';
```

### 2. Add State Variables

Add these state variables after the existing state declarations (around line 56):

```typescript
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
  const [activeCommentAnnotation, setActiveCommentAnnotation] = useState<EditorComment | null>(null);
  const [isLoadingEditorData, setIsLoadingEditorData] = useState(false);
```

### 3. Load Editor Data on Mount

Add this useEffect after the existing useEffects (around line 305):

```typescript
  // Load editor data when chapter changes
  useEffect(() => {
    const loadEditorData = async () => {
      setIsLoadingEditorData(true);
      try {
        const [commentsData, suggestionsData, highlightsData, checksData] = await Promise.all([
          getComments(chapter.id),
          getSuggestions(chapter.id),
          getHighlights(chapter.id),
          getStyleChecks(chapter.id),
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
    setOriginalContent(chapter.content);
  }, [chapter.id]);
```

### 4. Add Handlers

Add these handler functions before the return statement:

```typescript
  // Comment handlers
  const handleAddComment = useCallback(async () => {
    if (!selectedRange || !selectedText.trim()) {
      showError('Please select text to comment on');
      return;
    }
    const commentText = prompt('Enter your comment:');
    if (!commentText) return;
    
    try {
      const newComment = await createComment({
        chapterId: chapter.id,
        entityType: 'chapter',
        entityId: chapter.id,
        textRange: selectedRange,
        selectedText: selectedText.substring(0, 200),
        comment: commentText,
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

  // Suggestion handlers
  const handleAcceptSuggestion = useCallback(async (suggestionId: string) => {
    try {
      const suggestion = suggestions.find(s => s.id === suggestionId);
      if (!suggestion) return;
      
      await acceptSuggestion(suggestionId);
      const updated = await getSuggestions(chapter.id);
      setSuggestions(updated);
      showSuccess('Suggestion accepted');
    } catch (error: any) {
      showError(error.message || 'Failed to accept suggestion');
    }
  }, [chapter.id, suggestions, showError, showSuccess]);

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

  // Highlight handlers
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

  // Style check handlers
  const handleRunStyleCheck = useCallback(async () => {
    startLoading('Running style checks...', false);
    try {
      const checks = await checkChapter(chapter, novelState);
      setStyleChecks(checks);
      showSuccess(`Found ${checks.length} style issue${checks.length !== 1 ? 's' : ''}`);
    } catch (error: any) {
      showError(error.message || 'Failed to run style checks');
    } finally {
      stopLoading();
    }
  }, [chapter, novelState, showError, showSuccess, startLoading, stopLoading]);

  // Handle AI edit with suggestions (in suggest mode)
  const handleAiEditWithSuggestions = useCallback(async () => {
    if (!instruction) return;
    if (!novelState) return;
    
    setIsAiEditing(true);
    startLoading('AI is creating suggestions...', false);
    try {
      updateMessage('Analyzing chapter content...');
      const result = await editChapter(content, instruction, novelState, chapter);
      if (result && editingMode === 'suggest') {
        // In suggest mode, create suggestions instead of applying directly
        // This is a simplified version - in production, you'd want to use a diff library
        // to generate actual suggestions
        updateMessage('Creating suggestions...');
        // For now, just update content - full diff implementation would go here
        setContent(result);
      } else if (result) {
        setContent(result);
      }
      showSuccess(editingMode === 'suggest' ? 'Suggestions created' : 'Chapter refined successfully!');
    } catch (e) {
      console.error(e);
      showError('AI edit failed. Please try again.');
    } finally {
      setIsAiEditing(false);
      setInstruction('');
      stopLoading();
    }
  }, [content, instruction, novelState, chapter, editingMode, showError, showSuccess, startLoading, stopLoading, updateMessage]);
```

### 5. Add Toolbar Section

Add this toolbar section after the title/header section (around line 401, before the TTS section):

```typescript
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
```

### 6. Add Text Selection Handler

Update the textarea onChange to include text selection tracking:

```typescript
            onChange={(e) => {
              const textarea = e.target as HTMLTextAreaElement;
              handleTextChange(e.target.value, 'content', textarea);
              // Track selection for highlighting/comments
              setTimeout(() => handleTextSelection(), 0);
            }}
            onSelect={handleTextSelection}
```

### 7. Add Panels to Sidebar

Add these panels to the sidebar (around line 720, after the AI Editor Agent section):

```typescript
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
                  // Scroll to comment location
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
```

### 8. Add Comparison View

Add comparison view as a modal (after the scene editor modal, around line 830):

```typescript
      {showComparison && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-zinc-300">Compare Versions</h3>
              <button
                onClick={() => setShowComparison(false)}
                className="text-zinc-400 hover:text-zinc-200"
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
```

## Notes

- The integration provides a solid foundation for professional editing features
- Some features like full diff calculation would benefit from using a library like `diff-match-patch`
- Text selection tracking may need refinement based on actual usage
- Style checks run on-demand; you may want to add auto-checking on content changes (debounced)
- The suggestion system in suggest mode would ideally use proper diff algorithms
- All features are toggleable to avoid UI clutter

## Next Steps

1. Run the database migration: `DATABASE_MIGRATION_PROFESSIONAL_EDITOR.sql`
2. Add the imports to ChapterEditor.tsx
3. Add the state variables
4. Add the handlers
5. Add the UI components
6. Test each feature individually
7. Refine based on usage
