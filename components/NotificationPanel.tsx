import React, { useMemo } from 'react';
import { useToast, Toast } from '../contexts/ToastContext';
import { SystemLog } from '../types';

interface NotificationPanelProps {
  activeLogs: SystemLog[];
}

type NotificationItem = 
  | { type: 'toast'; data: Toast }
  | { type: 'log'; data: SystemLog };

const NotificationPanel: React.FC<NotificationPanelProps> = ({ activeLogs }) => {
  const { toastHistory } = useToast();

  // Combine toasts and logs into a single sorted array
  const notifications = useMemo(() => {
    const items: NotificationItem[] = [
      ...toastHistory.map(toast => ({ type: 'toast' as const, data: toast })),
      ...activeLogs.map(log => ({ type: 'log' as const, data: log })),
    ];

    // Sort by timestamp (newest first)
    return items.sort((a, b) => {
      const timestampA = a.data.timestamp || 0;
      const timestampB = b.data.timestamp || 0;
      return timestampB - timestampA;
    });
  }, [toastHistory, activeLogs]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getToastStyles = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-emerald-950/95 border-emerald-500/50 text-emerald-400';
      case 'error':
        return 'bg-red-950/95 border-red-500/50 text-red-400';
      case 'warning':
        return 'bg-amber-950/95 border-amber-500/50 text-amber-400';
      case 'info':
        return 'bg-blue-950/95 border-blue-500/50 text-blue-400';
      default:
        return 'bg-zinc-900/95 border-zinc-500/50 text-zinc-400';
    }
  };

  const getToastIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  const getLogStyles = (type: SystemLog['type']) => {
    switch (type) {
      case 'logic':
        return 'bg-indigo-950/60 border-indigo-500/50 text-indigo-400';
      case 'discovery':
        return 'bg-amber-950/60 border-amber-500/50 text-amber-400';
      case 'update':
        return 'bg-blue-950/60 border-blue-500/50 text-blue-400';
      case 'fate':
        return 'bg-purple-950/60 border-purple-500/50 text-purple-400';
      default:
        return 'bg-zinc-900/95 border-amber-600/50 text-amber-400';
    }
  };

  const getLogLabel = (type: SystemLog['type']) => {
    switch (type) {
      case 'logic':
        return 'Audit';
      case 'discovery':
        return 'Discovery';
      case 'update':
        return 'Update';
      case 'fate':
        return 'Fate';
      default:
        return 'System';
    }
  };

  if (notifications.length === 0) {
    return (
      <div className="fixed right-0 top-0 h-screen w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700 flex flex-col z-40">
        <div className="p-4 border-b border-zinc-700">
          <h2 className="text-lg font-bold text-zinc-200 uppercase tracking-wider">Notifications</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-zinc-500 text-sm">No notifications yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-0 top-0 h-screen w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700 flex flex-col z-40">
      <div className="p-4 border-b border-zinc-700 flex-shrink-0">
        <h2 className="text-lg font-bold text-zinc-200 uppercase tracking-wider">Notifications</h2>
        <p className="text-xs text-zinc-500 mt-1">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {notifications.map((item) => {
          if (item.type === 'toast') {
            const toast = item.data;
            return (
              <div
                key={toast.id}
                className={`p-3 border rounded-xl shadow-lg backdrop-blur-xl ${getToastStyles(toast.type)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-base font-bold flex-shrink-0 mt-0.5">{getToastIcon(toast.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 leading-relaxed break-words">
                      {toast.message}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatTimestamp(toast.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          } else {
            const log = item.data;
            return (
              <div
                key={log.id}
                className={`p-3 border rounded-xl shadow-lg backdrop-blur-xl ${getLogStyles(log.type)}`}
              >
                <div className="flex items-start space-x-2">
                  <span className="text-xs font-bold uppercase tracking-wider flex-shrink-0 mt-0.5">
                    [{getLogLabel(log.type)}]
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-200 leading-relaxed break-words">
                      {log.message}
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      {formatTimestamp(log.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

export default NotificationPanel;
