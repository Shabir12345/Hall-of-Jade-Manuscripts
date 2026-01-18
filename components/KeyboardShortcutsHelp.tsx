/**
 * Keyboard Shortcuts Help Dialog
 * Displays available keyboard shortcuts
 */

import React, { memo } from 'react';
import { KEYBOARD_SHORTCUTS } from '../hooks/useGlobalShortcuts';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsHelpComponent: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const renderKey = (key: string) => {
    if (key === 'Ctrl/Cmd') {
      return (
        <span className="inline-flex items-center gap-1">
          <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
            {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
          </kbd>
        </span>
      );
    }
    return (
      <kbd className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs font-mono">
        {key}
      </kbd>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-amber-600/30 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700/50 bg-zinc-900/50">
          <div>
            <h2 className="text-2xl font-fantasy font-bold text-amber-400">Keyboard Shortcuts</h2>
            <p className="text-sm text-zinc-400 mt-1">Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">?</kbd> or <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">Ctrl/Cmd + /</kbd> to open this help</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800"
            aria-label="Close shortcuts help"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
          {/* Global Shortcuts */}
          <section>
            <h3 className="text-lg font-bold text-amber-500 mb-3 uppercase tracking-wide">Global Shortcuts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {KEYBOARD_SHORTCUTS.global.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-700/50 rounded-lg">
                  <span className="text-sm text-zinc-300">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIdx) => (
                      <React.Fragment key={keyIdx}>
                        {keyIdx > 0 && <span className="text-zinc-600 mx-1">+</span>}
                        {renderKey(key)}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Navigation Shortcuts */}
          <section>
            <h3 className="text-lg font-bold text-amber-500 mb-3 uppercase tracking-wide">Navigation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {KEYBOARD_SHORTCUTS.navigation.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-700/50 rounded-lg">
                  <span className="text-sm text-zinc-300">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIdx) => (
                      <React.Fragment key={keyIdx}>
                        {keyIdx > 0 && <span className="text-zinc-600 mx-1">or</span>}
                        {renderKey(key)}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Editor Shortcuts */}
          <section>
            <h3 className="text-lg font-bold text-amber-500 mb-3 uppercase tracking-wide">Editor Shortcuts</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {KEYBOARD_SHORTCUTS.editor.map((shortcut, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-700/50 rounded-lg">
                  <span className="text-sm text-zinc-300">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, keyIdx) => (
                      <React.Fragment key={keyIdx}>
                        {keyIdx > 0 && <span className="text-zinc-600 mx-1">or</span>}
                        {renderKey(key)}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Tips */}
          <section className="mt-6 p-4 bg-amber-950/20 border border-amber-600/30 rounded-lg">
            <h4 className="text-sm font-bold text-amber-400 mb-2">💡 Tips</h4>
            <ul className="text-xs text-zinc-400 space-y-1 list-disc list-inside">
              <li>Shortcuts are disabled when typing in input fields</li>
              <li>Use <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">Esc</kbd> to close dialogs and panels</li>
              <li>Vim-style navigation (j/k) works in lists and editors</li>
              <li>Press <kbd className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded text-xs">?</kbd> anytime to see this help</li>
            </ul>
          </section>
        </div>
        <div className="p-6 border-t border-zinc-700/50 bg-zinc-900/30">
          <button
            onClick={onClose}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-[1.02]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const KeyboardShortcutsHelp = memo(KeyboardShortcutsHelpComponent);
export default KeyboardShortcutsHelp;
