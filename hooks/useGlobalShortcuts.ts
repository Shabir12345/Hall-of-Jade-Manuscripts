/**
 * Global Keyboard Shortcuts Hook
 * Provides application-wide keyboard shortcuts
 */

import { useEffect, useCallback } from 'react';

export interface GlobalShortcutHandlers {
  onSearch?: () => void;
  onNewChapter?: () => void;
  onSave?: () => void;
  onExport?: () => void;
  onDashboard?: () => void;
  onChapters?: () => void;
  onCharacters?: () => void;
  onWorldBible?: () => void;
  onPlanning?: () => void;
  onHelp?: () => void;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export interface UseGlobalShortcutsOptions {
  enabled?: boolean;
  handlers: GlobalShortcutHandlers;
  ignoreInputs?: boolean;
}

/**
 * Hook for global keyboard shortcuts
 */
export function useGlobalShortcuts({
  enabled = true,
  handlers,
  ignoreInputs = true,
}: UseGlobalShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in input/textarea/contenteditable
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

      // Global shortcuts (Ctrl/Cmd + key)
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            // Cmd/Ctrl+K: Global search
            if (handlers.onSearch) {
              e.preventDefault();
              handlers.onSearch();
            }
            break;
          case 's':
            // Cmd/Ctrl+S: Save
            if (handlers.onSave) {
              e.preventDefault();
              handlers.onSave();
            }
            break;
          case 'e':
            // Cmd/Ctrl+E: Export
            if (handlers.onExport) {
              e.preventDefault();
              handlers.onExport();
            }
            break;
          case 'n':
            // Cmd/Ctrl+N: New chapter
            if (handlers.onNewChapter) {
              e.preventDefault();
              handlers.onNewChapter();
            }
            break;
          case '/':
            // Cmd/Ctrl+/: Help
            if (handlers.onHelp) {
              e.preventDefault();
              handlers.onHelp();
            }
            break;
        }
        return;
      }

      // Single key shortcuts (only when not in input)
      switch (e.key) {
        case '/':
          // /: Search
          if (handlers.onSearch) {
            e.preventDefault();
            handlers.onSearch();
          }
          break;
        case '?':
          // ?: Help
          if (handlers.onHelp) {
            e.preventDefault();
            handlers.onHelp();
          }
          break;
        case 'g':
          // g: Go to dashboard (vim-style)
          if (handlers.onDashboard && !e.shiftKey) {
            e.preventDefault();
            handlers.onDashboard();
          }
          break;
        case 'c':
          // c: Chapters
          if (handlers.onChapters && !e.shiftKey) {
            e.preventDefault();
            handlers.onChapters();
          }
          break;
        case 'p':
          // p: Planning
          if (handlers.onPlanning && !e.shiftKey) {
            e.preventDefault();
            handlers.onPlanning();
          }
          break;
        case 'w':
          // w: World Bible
          if (handlers.onWorldBible && !e.shiftKey) {
            e.preventDefault();
            handlers.onWorldBible();
          }
          break;
        case 'Escape':
          // Escape: Close dialogs/panels
          if (handlers.onClose) {
            e.preventDefault();
            handlers.onClose();
          }
          break;
        case 'ArrowDown':
        case 'j':
          // j or ArrowDown: Next item
          if (handlers.onNext) {
            e.preventDefault();
            handlers.onNext();
          }
          break;
        case 'ArrowUp':
        case 'k':
          // k or ArrowUp: Previous item
          if (handlers.onPrevious) {
            e.preventDefault();
            handlers.onPrevious();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handlers, ignoreInputs]);
}

/**
 * Keyboard shortcuts documentation
 */
export const KEYBOARD_SHORTCUTS = {
  global: [
    { keys: ['Ctrl/Cmd', 'K'], description: 'Open global search' },
    { keys: ['Ctrl/Cmd', 'S'], description: 'Save current work' },
    { keys: ['Ctrl/Cmd', 'E'], description: 'Export novel' },
    { keys: ['Ctrl/Cmd', 'N'], description: 'Generate new chapter' },
    { keys: ['Ctrl/Cmd', '/'], description: 'Show keyboard shortcuts help' },
    { keys: ['/'], description: 'Open search' },
    { keys: ['?'], description: 'Show help' },
    { keys: ['g'], description: 'Go to dashboard' },
    { keys: ['c'], description: 'Go to chapters' },
    { keys: ['p'], description: 'Go to planning' },
    { keys: ['w'], description: 'Go to world bible' },
    { keys: ['Esc'], description: 'Close dialogs/panels' },
  ],
  navigation: [
    { keys: ['j', 'ArrowDown'], description: 'Next item' },
    { keys: ['k', 'ArrowUp'], description: 'Previous item' },
  ],
  editor: [
    { keys: ['a'], description: 'Approve suggestion' },
    { keys: ['r'], description: 'Reject suggestion' },
    { keys: ['Space'], description: 'Play/pause text-to-speech' },
    { keys: ['Esc'], description: 'Stop text-to-speech' },
  ],
};
