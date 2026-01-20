import React, { useMemo, useState } from 'react';
import { useToast, Toast } from '../contexts/ToastContext';
import { SystemLog } from '../types';

interface NotificationPanelProps {
  activeLogs: SystemLog[];
  isOpen?: boolean;
  isDesktopOpen?: boolean;
  isDesktopMinimized?: boolean;
  onClose?: () => void;
  onDesktopToggle?: () => void;
  onDesktopMinimize?: () => void;
}

type NotificationItem = 
  | { type: 'toast'; data: Toast }
  | { type: 'log'; data: SystemLog };

type FilterType = 'all' | 'toast' | 'log' | 'success' | 'error' | 'warning' | 'info' | 'logic' | 'discovery' | 'update' | 'fate';

const NotificationPanel: React.FC<NotificationPanelProps> = ({ activeLogs, isOpen = true, isDesktopOpen = true, isDesktopMinimized = false, onClose, onDesktopToggle, onDesktopMinimize }) => {
  const { toastHistory } = useToast();
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupByType, setGroupByType] = useState(false);
  const [groupByTime, setGroupByTime] = useState(false);

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

  // Filter and search notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications;

    // Apply type filter
    if (filter !== 'all') {
      if (filter === 'toast') {
        filtered = filtered.filter(item => item.type === 'toast');
      } else if (filter === 'log') {
        filtered = filtered.filter(item => item.type === 'log');
      } else if (['success', 'error', 'warning', 'info'].includes(filter)) {
        filtered = filtered.filter(item => 
          item.type === 'toast' && item.data.type === filter
        );
      } else if (['logic', 'discovery', 'update', 'fate'].includes(filter)) {
        filtered = filtered.filter(item => 
          item.type === 'log' && item.data.type === filter
        );
      }
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const message = item.data.message || '';
        return message.toLowerCase().includes(query);
      });
    }

    return filtered;
  }, [notifications, filter, searchQuery]);

  // Group notifications if enabled
  const groupedNotifications = useMemo(() => {
    if (!groupByType) {
      return { ungrouped: filteredNotifications };
    }

    const groups: Record<string, NotificationItem[]> = {
      toasts: [],
      logs: [],
    };

    filteredNotifications.forEach(item => {
      if (item.type === 'toast') {
        groups.toasts.push(item);
      } else {
        const logType = item.data.type || 'other';
        if (!groups[logType]) {
          groups[logType] = [];
        }
        groups[logType].push(item);
      }
    });

    return groups;
  }, [filteredNotifications, groupByType]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  // Group notifications by timestamp (today, yesterday, this week, older)
  const groupByTimestamp = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups: Record<string, NotificationItem[]> = {
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': [],
    };

    filteredNotifications.forEach(item => {
      const timestamp = item.data.timestamp || 0;
      const date = new Date(timestamp);
      
      if (date >= today) {
        groups['Today'].push(item);
      } else if (date >= yesterday) {
        groups['Yesterday'].push(item);
      } else if (date >= thisWeek) {
        groups['This Week'].push(item);
      } else {
        groups['Older'].push(item);
      }
    });

    return groups;
  }, [filteredNotifications]);

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

  const getFilterCount = (filterType: FilterType): number => {
    if (filterType === 'all') return notifications.length;
    if (filterType === 'toast') return notifications.filter(item => item.type === 'toast').length;
    if (filterType === 'log') return notifications.filter(item => item.type === 'log').length;
    if (['success', 'error', 'warning', 'info'].includes(filterType)) {
      return notifications.filter(item => item.type === 'toast' && item.data.type === filterType).length;
    }
    if (['logic', 'discovery', 'update', 'fate'].includes(filterType)) {
      return notifications.filter(item => item.type === 'log' && item.data.type === filterType).length;
    }
    return 0;
  };

  const renderNotification = (item: NotificationItem) => {
    if (item.type === 'toast') {
      const toast = item.data;
      const isTrustScore = toast.message.toLowerCase().includes('trust score');
      return (
        <div
          key={toast.id}
          className={`p-3 border rounded-xl shadow-lg backdrop-blur-xl ${getToastStyles(toast.type)} ${isTrustScore ? 'border-2 border-emerald-500/50' : ''}`}
        >
          <div className="flex items-start space-x-2">
            <span className="text-base font-bold flex-shrink-0 mt-0.5">{getToastIcon(toast.type)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-200 leading-relaxed break-words">
                {toast.message}
              </p>
              {toast.details && (
                <p className="text-xs text-zinc-400 mt-1 opacity-80">
                  {toast.details}
                </p>
              )}
              {isTrustScore && (
                <p className="text-xs text-emerald-400 mt-1 font-semibold">Click to view trust dashboard</p>
              )}
              {toast.action && (
                <button
                  onClick={toast.action.onClick}
                  className={`mt-2 text-xs px-3 py-1.5 rounded border transition-all font-semibold ${
                    toast.type === 'error'
                      ? 'bg-red-600/20 hover:bg-red-600/30 border-red-500/30 text-red-400'
                      : toast.type === 'warning'
                      ? 'bg-amber-600/20 hover:bg-amber-600/30 border-amber-500/30 text-amber-400'
                      : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/30 text-blue-400'
                  }`}
                >
                  {toast.action.label}
                </button>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                {formatTimestamp(toast.timestamp)}
              </p>
            </div>
          </div>
        </div>
      );
    } else {
      const log = item.data;
      const isAutomation = log.message.toLowerCase().includes('auto-connected') || 
                          log.message.toLowerCase().includes('trust score') ||
                          log.message.toLowerCase().includes('consistency check') ||
                          log.message.toLowerCase().includes('gap');
      const isTrustScore = log.message.toLowerCase().includes('trust score');
      
      return (
        <div
          key={log.id}
          className={`p-3 border rounded-xl shadow-lg backdrop-blur-xl ${getLogStyles(log.type)} ${isAutomation ? 'border-l-4' : ''} ${isTrustScore ? 'border-l-emerald-500' : isAutomation ? 'border-l-amber-500' : ''}`}
        >
          <div className="flex items-start space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider flex-shrink-0 mt-0.5">
              [{getLogLabel(log.type)}]
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-200 leading-relaxed break-words">
                {log.message}
              </p>
              {isTrustScore && (
                <p className="text-xs text-emerald-400 mt-1 font-semibold">Trust score details available</p>
              )}
              {isAutomation && !isTrustScore && (
                <p className="text-xs text-amber-400 mt-1">Automation activity</p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                {formatTimestamp(log.timestamp)}
              </p>
            </div>
          </div>
        </div>
      );
    }
  };

  // Desktop minimized view - thin vertical bar on right edge
  if (isDesktopMinimized && isDesktopOpen) {
    return (
      <div className="hidden md:flex fixed right-0 top-0 h-screen w-12 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700/50 z-40 flex-col items-center justify-start pt-4 shadow-2xl">
        <button
          onClick={onDesktopMinimize}
          className="w-10 h-10 flex items-center justify-center rounded-lg bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 hover:border-amber-600/50 text-zinc-400 hover:text-amber-500 transition-all duration-200 mb-4 group"
          aria-label="Expand notifications panel"
          title="Expand notifications panel"
        >
          <span className="text-lg group-hover:scale-110 transition-transform">🔔</span>
        </button>
        {notifications.length > 0 && (
          <div className="mt-2 w-8 h-8 flex items-center justify-center rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-400 text-xs font-bold">
            {notifications.length > 99 ? '99+' : notifications.length}
          </div>
        )}
      </div>
    );
  }

  // Mobile view - show when isOpen is true on mobile
  // Professional mobile slide-in panel with full-height design
  if (isOpen && !isDesktopOpen) {
    return (
      <>
        {/* Mobile backdrop with smooth fade */}
        <div
          className="md:hidden fixed inset-0 bg-black/90 backdrop-blur-md z-40 animate-in fade-in duration-200"
          onClick={onClose}
          aria-hidden="true"
        />
        {/* Mobile panel - slides in from right with safe area support */}
        <div 
          className="fixed right-0 top-0 h-full h-dvh w-[85vw] max-w-sm bg-zinc-900 border-l border-zinc-700/50 flex flex-col z-50 transform transition-transform duration-300 ease-out translate-x-0 md:hidden shadow-2xl"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Header with professional styling */}
          <div className="px-4 py-3 border-b border-zinc-800 flex-shrink-0 bg-zinc-900/95 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔔</span>
                <h2 className="text-base font-bold text-zinc-100 uppercase tracking-wide">Notifications</h2>
                {notifications.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-600/30 border border-amber-500/40 text-amber-400 text-xs font-bold min-w-[1.25rem] text-center">
                    {notifications.length > 99 ? '99+' : notifications.length}
                  </span>
                )}
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-zinc-400 hover:text-zinc-200 w-10 h-10 flex items-center justify-center rounded-xl hover:bg-zinc-800 transition-all active:scale-95"
                  aria-label="Close notifications"
                >
                  <span className="text-xl">×</span>
                </button>
              )}
            </div>
            
            {/* Mobile filter pills - horizontal scroll */}
            <div className="flex items-center gap-1.5 mt-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
              {[
                { id: 'all' as FilterType, label: 'All', icon: '📋' },
                { id: 'success' as FilterType, label: 'Success', icon: '✓' },
                { id: 'error' as FilterType, label: 'Errors', icon: '✕' },
                { id: 'warning' as FilterType, label: 'Warnings', icon: '⚠' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95 ${
                    filter === f.id
                      ? 'bg-amber-600/30 text-amber-400 border border-amber-500/40'
                      : 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
                  }`}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                  <span className="opacity-60">({getFilterCount(f.id)})</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Notification list with pull-to-refresh style */}
          <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth">
            <div className="p-3 space-y-2">
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 opacity-40">🔕</div>
                  <p className="text-zinc-400 text-sm font-medium">No notifications</p>
                  <p className="text-zinc-600 text-xs mt-1">You're all caught up!</p>
                </div>
              ) : (
                filteredNotifications.map((item) => renderNotification(item))
              )}
            </div>
          </div>
          
          {/* Bottom safe area padding */}
          <div className="h-safe-bottom flex-shrink-0" />
        </div>
      </>
    );
  }

  // Desktop closed view - return null (panel is hidden)
  if (!isDesktopOpen) {
    return null;
  }

  // Desktop maximized view - empty state
  if (notifications.length === 0) {
    return (
      <div className="hidden md:flex fixed right-0 top-0 h-screen w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700 flex flex-col z-40 shadow-2xl transform transition-all duration-300 ease-in-out">
        <div className="p-4 border-b border-zinc-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-200 uppercase tracking-wider">Notifications</h2>
            <div className="flex items-center gap-2">
              {onDesktopMinimize && (
                <button
                  onClick={onDesktopMinimize}
                  className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Minimize notifications panel"
                  title="Minimize panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {onDesktopToggle && (
                <button
                  onClick={onDesktopToggle}
                  className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Close notifications panel"
                  title="Close panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-4xl mb-3 opacity-50">🔔</div>
            <p className="text-zinc-500 text-sm font-medium">No notifications yet</p>
            <p className="text-zinc-600 text-xs mt-1">You'll see updates here when they arrive</p>
          </div>
        </div>
      </div>
    );
  }

  // Desktop maximized view with notifications
  if (isDesktopOpen && !isDesktopMinimized) {
    return (
      <div className="hidden md:flex fixed right-0 top-0 h-screen w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-700 flex flex-col z-40 shadow-2xl transform transition-all duration-300 ease-in-out">
        <div className="p-4 border-b border-zinc-700 flex-shrink-0 bg-zinc-900/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-zinc-200 uppercase tracking-wider">Notifications</h2>
              {notifications.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-600/20 border border-amber-600/30 text-amber-400 text-xs font-bold">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {onDesktopMinimize && (
                <button
                  onClick={onDesktopMinimize}
                  className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Minimize notifications panel"
                  title="Minimize panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {onDesktopToggle && (
                <button
                  onClick={onDesktopToggle}
                  className="text-zinc-400 hover:text-zinc-200 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
                  aria-label="Close notifications panel"
                  title="Close panel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupByTime(!groupByTime)}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                groupByTime ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
              title={groupByTime ? 'Ungroup by time' : 'Group by time'}
            >
              {groupByTime ? 'Ungroup Time' : 'Group Time'}
            </button>
            <button
              onClick={() => setGroupByType(!groupByType)}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                groupByType ? 'bg-amber-600/20 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
              title={groupByType ? 'Ungroup by type' : 'Group by type'}
            >
              {groupByType ? 'Ungroup Type' : 'Group Type'}
            </button>
          </div>
        </div>

        {/* Search and Filters Section */}
        <div className="px-4 pb-3 border-b border-zinc-700/50 flex-shrink-0">
          {/* Search */}
          <div className="mb-3">
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none transition-all"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2 py-1 rounded border transition-all ${
              filter === 'all'
                ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            All ({getFilterCount('all')})
          </button>
          <button
            onClick={() => setFilter('toast')}
            className={`text-xs px-2 py-1 rounded border transition-all ${
              filter === 'toast'
                ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            Toasts ({getFilterCount('toast')})
          </button>
          <button
            onClick={() => setFilter('log')}
            className={`text-xs px-2 py-1 rounded border transition-all ${
              filter === 'log'
                ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
            }`}
          >
            Logs ({getFilterCount('log')})
          </button>
        </div>

        {/* Type-specific filters */}
        {filter === 'toast' || filter === 'all' ? (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setFilter('success')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'success'
                  ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              ✓ ({getFilterCount('success')})
            </button>
            <button
              onClick={() => setFilter('error')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'error'
                  ? 'bg-red-600/20 text-red-400 border-red-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              ✕ ({getFilterCount('error')})
            </button>
            <button
              onClick={() => setFilter('warning')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'warning'
                  ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              ⚠ ({getFilterCount('warning')})
            </button>
            <button
              onClick={() => setFilter('info')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'info'
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              ℹ ({getFilterCount('info')})
            </button>
          </div>
        ) : null}

        {filter === 'log' || filter === 'all' ? (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setFilter('logic')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'logic'
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              Audit ({getFilterCount('logic')})
            </button>
            <button
              onClick={() => setFilter('discovery')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'discovery'
                  ? 'bg-amber-600/20 text-amber-400 border-amber-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              Discovery ({getFilterCount('discovery')})
            </button>
            <button
              onClick={() => setFilter('update')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'update'
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              Update ({getFilterCount('update')})
            </button>
            <button
              onClick={() => setFilter('fate')}
              className={`text-xs px-2 py-1 rounded border transition-all ${
                filter === 'fate'
                  ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600'
              }`}
            >
              Fate ({getFilterCount('fate')})
            </button>
          </div>
        ) : null}

          <p className="text-xs text-zinc-500 mt-2">
            {filteredNotifications.length} of {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500 text-sm">No notifications match your filters</p>
          </div>
        ) : groupByTime ? (
          Object.entries(groupByTimestamp).map(([timeGroup, items]) => {
            if (items.length === 0) return null;
            return (
              <div key={timeGroup} className="mb-4">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 px-1 border-b border-zinc-700 pb-1">
                  {timeGroup} ({items.length})
                </div>
                <div className="space-y-2">
                  {items.map((item) => renderNotification(item))}
                </div>
              </div>
            );
          })
        ) : groupByType ? (
          Object.entries(groupedNotifications).map(([groupName, items]) => (
            <div key={groupName} className="mb-4">
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2 px-1 border-b border-zinc-700 pb-1">
                {groupName === 'ungrouped' ? 'All' : groupName === 'toasts' ? 'Toasts' : getLogLabel(groupName as SystemLog['type'])} ({items.length})
              </div>
              <div className="space-y-2">
                {items.map((item) => renderNotification(item))}
              </div>
            </div>
          ))
        ) : (
          filteredNotifications.map((item) => renderNotification(item))
        )}
        </div>
      </div>
    );
  }

  // Should never reach here, but return null as fallback
  return null;
};

export default NotificationPanel;
