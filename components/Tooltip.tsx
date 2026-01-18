/**
 * Tooltip Component
 * Provides contextual help and feature descriptions
 */

import React, { useState, useRef, useEffect } from 'react';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  content: string | React.ReactNode;
  position?: TooltipPosition;
  delay?: number;
  children: React.ReactElement;
  className?: string;
  disabled?: boolean;
  maxWidth?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  position = 'top',
  delay = 300,
  children,
  className = '',
  disabled = false,
  maxWidth = '300px',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current;
      const trigger = triggerRef.current;
      const rect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = rect.top - tooltipRect.height - 8;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + 8;
          left = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.left - tooltipRect.width - 8;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipRect.height / 2;
          left = rect.right + 8;
          break;
      }

      // Keep tooltip within viewport
      const padding = 8;
      if (left < padding) left = padding;
      if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
      }
      if (top < padding) top = padding;
      if (top + tooltipRect.height > window.innerHeight - padding) {
        top = window.innerHeight - tooltipRect.height - padding;
      }

      setTooltipStyle({ top: `${top}px`, left: `${left}px` });
    }
  }, [isVisible, position]);

  const handleMouseEnter = () => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (disabled) {
    return children;
  }

  return (
    <div
      ref={triggerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none"
          style={tooltipStyle}
        >
          <div
            className="bg-zinc-800 text-zinc-200 text-xs rounded-lg px-3 py-2 shadow-xl border border-zinc-700"
            style={{ maxWidth }}
          >
            {typeof content === 'string' ? (
              <p className="whitespace-normal break-words">{content}</p>
            ) : (
              content
            )}
            {/* Arrow */}
            <div
              className={`absolute w-2 h-2 bg-zinc-800 border-zinc-700 ${
                position === 'top'
                  ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r rotate-45'
                  : position === 'bottom'
                  ? 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l rotate-45'
                  : position === 'left'
                  ? 'right-[-4px] top-1/2 -translate-y-1/2 border-t border-r rotate-45'
                  : 'left-[-4px] top-1/2 -translate-y-1/2 border-b border-l rotate-45'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Help Icon Component
 * Small question mark icon with tooltip
 */
interface HelpIconProps {
  content: string | React.ReactNode;
  className?: string;
}

export const HelpIcon: React.FC<HelpIconProps> = ({ content, className = '' }) => {
  return (
    <Tooltip content={content} position="top" delay={200}>
      <span
        className={`inline-flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-300 cursor-help text-[10px] font-bold ${className}`}
        aria-label="Help"
      >
        ?
      </span>
    </Tooltip>
  );
};
