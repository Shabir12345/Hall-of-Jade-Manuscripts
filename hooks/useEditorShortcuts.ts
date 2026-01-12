import React, { useEffect, useCallback, RefObject } from 'react';

export interface EditorShortcutHandlers {
  onNext?: () => void;
  onPrevious?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onExport?: () => void;
  onCopy?: () => void;
  onSearch?: () => void;
  onClose?: () => void;
  onJumpTop?: () => void;
  onJumpBottom?: () => void;
  onHelp?: () => void;
}

export interface UseEditorShortcutsOptions {
  enabled?: boolean;
  handlers: EditorShortcutHandlers;
  ignoreInputs?: boolean;
}

/**
 * Hook for editor keyboard shortcuts
 * Provides consistent keyboard navigation across editor components
 */
export function useEditorShortcuts({
  enabled = true,
  handlers,
  ignoreInputs = true,
}: UseEditorShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input/textarea
      if (ignoreInputs) {
        const target = e.target as HTMLElement;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.isContentEditable
        ) {
          return;
        }
      }

      // Handle shortcuts
      switch (e.key) {
        case 'ArrowDown':
        case 'j':
        case 'J':
          if (handlers.onNext) {
            e.preventDefault();
            handlers.onNext();
          }
          break;

        case 'ArrowUp':
        case 'k':
        case 'K':
          if (handlers.onPrevious) {
            e.preventDefault();
            handlers.onPrevious();
          }
          break;

        case 'a':
        case 'A':
          if (handlers.onApprove && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            handlers.onApprove();
          }
          break;

        case 'r':
        case 'R':
          if (handlers.onReject && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            handlers.onReject();
          }
          break;

        case 'e':
        case 'E':
          if (handlers.onExport && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handlers.onExport();
          }
          break;

        case 'c':
        case 'C':
          if (handlers.onCopy && (e.ctrlKey || e.metaKey)) {
            // Let default copy behavior work
            return;
          }
          if (handlers.onCopy && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handlers.onCopy();
          }
          break;

        case '/':
          if (handlers.onSearch) {
            e.preventDefault();
            handlers.onSearch();
          }
          break;

        case 'Escape':
          if (handlers.onClose) {
            e.preventDefault();
            handlers.onClose();
          }
          break;

        case 'g':
        case 'G':
          if (e.shiftKey && handlers.onJumpBottom) {
            e.preventDefault();
            handlers.onJumpBottom();
          } else if (!e.shiftKey && handlers.onJumpTop) {
            // Double 'g' for top - needs special handling
            // This is a simplified version
            return;
          }
          break;

        case '?':
          if (handlers.onHelp) {
            e.preventDefault();
            handlers.onHelp();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handlers, ignoreInputs]);
}

/**
 * Hook for handling double 'g' (jump to top)
 * This is a common vim-style shortcut that requires timing
 */
export function useDoubleGShortcut(
  enabled: boolean,
  onJumpTop: () => void,
  timeout: number = 300
) {
  const lastGTime = React.useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        const now = Date.now();
        if (now - lastGTime.current < timeout) {
          e.preventDefault();
          onJumpTop();
          lastGTime.current = 0;
        } else {
          lastGTime.current = now;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onJumpTop, timeout]);
}

