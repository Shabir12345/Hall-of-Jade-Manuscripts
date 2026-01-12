/**
 * Skeleton Components
 * Reusable skeleton loading placeholders for better UX
 */

import React from 'react';

interface SkeletonBaseProps {
  className?: string;
  animate?: boolean;
}

/**
 * Base skeleton component with shimmer animation
 */
interface SkeletonBaseWithChildrenProps extends SkeletonBaseProps {
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const SkeletonBase: React.FC<SkeletonBaseWithChildrenProps> = ({ 
  className = '', 
  animate = true,
  children,
  style
}) => (
  <div 
    className={`bg-zinc-800/50 rounded ${animate ? 'animate-pulse' : ''} ${className}`}
    style={style}
    aria-hidden="true"
  >
    {children}
  </div>
);

/**
 * Text skeleton - for lines of text
 */
export interface SkeletonTextProps extends SkeletonBaseProps {
  lines?: number;
  width?: string;
  height?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({ 
  lines = 1, 
  width = '100%',
  height = '1rem',
  className = '',
  animate = true
}) => (
  <div className={`space-y-2 ${className}`} aria-hidden="true">
    {Array.from({ length: lines }).map((_, i) => (
      <SkeletonBase
        key={i}
        className={i === lines - 1 ? '' : ''}
        animate={animate}
        style={{ width: i === lines - 1 ? width : '100%', height }}
      />
    ))}
  </div>
);

/**
 * Title skeleton - for headings
 */
export interface SkeletonTitleProps extends SkeletonBaseProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const SkeletonTitle: React.FC<SkeletonTitleProps> = ({ 
  size = 'md',
  className = '',
  animate = true
}) => {
  const heights = {
    sm: 'h-4',
    md: 'h-6',
    lg: 'h-8',
    xl: 'h-10'
  };
  
  return (
    <SkeletonBase 
      className={`${heights[size]} w-3/4 ${className}`}
      animate={animate}
    />
  );
};

/**
 * Avatar skeleton - for profile pictures
 */
export interface SkeletonAvatarProps extends SkeletonBaseProps {
  size?: 'sm' | 'md' | 'lg';
  shape?: 'circle' | 'square';
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({ 
  size = 'md',
  shape = 'circle',
  className = '',
  animate = true
}) => {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-16 h-16',
    lg: 'w-32 h-32'
  };
  
  return (
    <SkeletonBase
      className={`${sizes[size]} ${shape === 'circle' ? 'rounded-full' : 'rounded'} ${className}`}
      animate={animate}
    />
  );
};

/**
 * Card skeleton - for card layouts
 */
export interface SkeletonCardProps extends SkeletonBaseProps {
  showAvatar?: boolean;
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({ 
  showAvatar = false,
  lines = 3,
  className = '',
  animate = true
}) => (
  <div className={`bg-zinc-900 border border-zinc-700 rounded-xl p-6 ${className}`} aria-hidden="true">
    <div className="flex gap-4 mb-4">
      {showAvatar && <SkeletonAvatar size="md" animate={animate} />}
      <div className="flex-1 space-y-2">
        <SkeletonTitle size="md" animate={animate} />
        <SkeletonText lines={1} width="60%" height="0.875rem" animate={animate} />
      </div>
    </div>
    <SkeletonText lines={lines} animate={animate} />
  </div>
);

/**
 * Button skeleton - for buttons
 */
export interface SkeletonButtonProps extends SkeletonBaseProps {
  size?: 'sm' | 'md' | 'lg';
  width?: string;
}

export const SkeletonButton: React.FC<SkeletonButtonProps> = ({ 
  size = 'md',
  width = '8rem',
  className = '',
  animate = true
}) => {
  const heights = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12'
  };
  
  return (
    <SkeletonBase
      className={`${heights[size]} rounded-lg ${className}`}
      style={{ width }}
      animate={animate}
    />
  );
};

/**
 * Table skeleton - for table layouts
 */
export interface SkeletonTableProps extends SkeletonBaseProps {
  rows?: number;
  cols?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({ 
  rows = 5,
  cols = 4,
  className = '',
  animate = true
}) => (
  <div className={`bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden ${className}`} aria-hidden="true">
    <div className="p-4 border-b border-zinc-700">
      <SkeletonText lines={1} height="1.25rem" animate={animate} />
    </div>
    <div className="divide-y divide-zinc-700">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonText key={j} lines={1} height="1rem" animate={animate} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * List skeleton - for list layouts
 */
export interface SkeletonListProps extends SkeletonBaseProps {
  items?: number;
  showAvatar?: boolean;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({ 
  items = 5,
  showAvatar = false,
  className = '',
  animate = true
}) => (
  <div className={`space-y-4 ${className}`} aria-hidden="true">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="flex gap-4 items-start">
        {showAvatar && <SkeletonAvatar size="md" animate={animate} />}
        <div className="flex-1 space-y-2">
          <SkeletonText lines={1} width="70%" height="1rem" animate={animate} />
          <SkeletonText lines={2} height="0.875rem" animate={animate} />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Dashboard skeleton - for dashboard views
 */
export interface SkeletonDashboardProps extends SkeletonBaseProps {
  showStats?: boolean;
  showCards?: number;
}

export const SkeletonDashboard: React.FC<SkeletonDashboardProps> = ({ 
  showStats = true,
  showCards = 3,
  className = '',
  animate = true
}) => (
  <div className={`space-y-8 ${className}`} aria-hidden="true">
    {/* Header */}
    <div className="space-y-4 pb-6 border-b border-zinc-700">
      <SkeletonTitle size="xl" animate={animate} />
      <div className="flex gap-4">
        <SkeletonButton size="sm" width="6rem" animate={animate} />
        <SkeletonButton size="sm" width="4rem" animate={animate} />
        <SkeletonButton size="sm" width="5rem" animate={animate} />
      </div>
    </div>
    
    {/* Stats */}
    {showStats && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: showCards }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
            <SkeletonText lines={1} width="60%" height="0.875rem" animate={animate} className="mb-2" />
            <SkeletonTitle size="lg" animate={animate} />
          </div>
        ))}
      </div>
    )}
    
    {/* Cards */}
    <div className="space-y-4">
      {Array.from({ length: showCards }).map((_, i) => (
        <SkeletonCard key={i} showAvatar={false} lines={3} animate={animate} />
      ))}
    </div>
  </div>
);
