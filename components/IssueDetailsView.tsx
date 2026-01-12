import React from 'react';
import { EditorIssue, EditorFix } from '../types/editor';
import { getIssueTypeIcon, getIssueTypeColor, getIssueContext } from '../utils/reportUtils';
import { Chapter, NovelState } from '../types';

interface IssueDetailsViewProps {
  issue: EditorIssue;
  fixes: EditorFix[];
  chapter?: Chapter;
  novelState?: NovelState;
  onViewChapter?: (chapterId: string) => void;
  onCopyText?: (text: string) => void;
  relatedIssues?: EditorIssue[];
}

const IssueDetailsView: React.FC<IssueDetailsViewProps> = ({
  issue,
  fixes,
  chapter,
  novelState,
  onViewChapter,
  onCopyText,
  relatedIssues = [],
}) => {
  const fix = fixes.find(f => f.issueId === issue.id);
  const contextText = chapter ? getIssueContext(issue, chapter.content, 300) : issue.context || '';

  const handleCopyText = (text: string) => {
    if (onCopyText) {
      onCopyText(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getIssueTypeIcon(issue.type)}</span>
          <div>
            <h3 className="text-lg font-semibold text-zinc-200">{issue.type.replace('_', ' ').toUpperCase()}</h3>
            <p className="text-xs text-zinc-400">Chapter {issue.chapterNumber} • {issue.location}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded text-xs font-semibold border ${
            issue.severity === 'major'
              ? 'bg-red-500/20 text-red-400 border-red-500/50'
              : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
          }`}>
            {issue.severity.toUpperCase()}
          </span>
          <span className={`px-3 py-1 rounded text-xs font-semibold border ${getIssueTypeColor(issue.type)}`}>
            {issue.type}
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <h4 className="text-sm font-semibold text-zinc-300 mb-2">Description</h4>
        <p className="text-sm text-zinc-400 leading-relaxed">{issue.description}</p>
      </div>

      {/* Suggestion */}
      {issue.suggestion && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">Suggestion</h4>
          <p className="text-sm text-zinc-400 leading-relaxed">{issue.suggestion}</p>
        </div>
      )}

      {/* Original Text */}
      {issue.originalText && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-zinc-300">Original Text</h4>
            <button
              onClick={() => handleCopyText(issue.originalText!)}
              className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            >
              Copy
            </button>
          </div>
          <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{issue.originalText}</p>
          </div>
        </div>
      )}

      {/* Context */}
      {contextText && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">Context</h4>
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3">
            <p className="text-sm text-zinc-400 leading-relaxed">{contextText}</p>
          </div>
        </div>
      )}

      {/* Fix Status */}
      {fix && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">Fix Status</h4>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded text-xs font-semibold ${
              fix.status === 'applied'
                ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                : fix.status === 'approved'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                : fix.status === 'rejected'
                ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
            }`}>
              {fix.status.toUpperCase()}
            </span>
            {fix.reason && (
              <p className="text-xs text-zinc-400">{fix.reason}</p>
            )}
          </div>
          {fix.fixedText && (
            <div className="mt-2">
              <h5 className="text-xs font-semibold text-zinc-400 mb-1">Fixed Text:</h5>
              <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-3">
                <p className="text-sm text-zinc-300 font-mono whitespace-pre-wrap">{fix.fixedText}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Related Issues */}
      {relatedIssues.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-zinc-300 mb-2">Related Issues ({relatedIssues.length})</h4>
          <div className="space-y-2">
            {relatedIssues.slice(0, 5).map(relatedIssue => (
              <div
                key={relatedIssue.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{getIssueTypeIcon(relatedIssue.type)}</span>
                  <span className="text-xs text-zinc-400">{relatedIssue.type}</span>
                  <span className="text-xs text-zinc-500">Ch {relatedIssue.chapterNumber}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    relatedIssue.severity === 'major'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {relatedIssue.severity}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">{relatedIssue.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-zinc-700">
        {chapter && onViewChapter && (
          <button
            onClick={() => onViewChapter(chapter.id)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            View Chapter
          </button>
        )}
        {issue.originalText && (
          <button
            onClick={() => handleCopyText(issue.originalText!)}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors"
          >
            Copy Text
          </button>
        )}
      </div>
    </div>
  );
};

export default IssueDetailsView;
