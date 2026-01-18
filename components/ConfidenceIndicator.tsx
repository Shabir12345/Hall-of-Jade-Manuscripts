import React from 'react';

interface ConfidenceIndicatorProps {
  confidence: 'high' | 'medium' | 'low';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

/**
 * ConfidenceIndicator - Visual indicator of AI confidence level
 */
const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  showLabel = true,
  size = 'md',
  tooltip,
}) => {
  const getColor = () => {
    switch (confidence) {
      case 'high': return 'text-green-400 bg-green-900/30 border-green-600/50';
      case 'medium': return 'text-yellow-400 bg-yellow-900/30 border-yellow-600/50';
      case 'low': return 'text-orange-400 bg-orange-900/30 border-orange-600/50';
    }
  };

  const getIcon = () => {
    switch (confidence) {
      case 'high': return '✓✓';
      case 'medium': return '✓';
      case 'low': return '?';
    }
  };

  const getDescription = () => {
    switch (confidence) {
      case 'high':
        return 'High confidence: The AI is highly certain about this improvement based on clear patterns and strong analysis.';
      case 'medium':
        return 'Medium confidence: The AI suggests this improvement but recommends review.';
      case 'low':
        return 'Low confidence: This suggestion should be carefully reviewed as the AI is less certain.';
    }
  };

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded border ${getColor()} ${sizeClasses[size]}`}
      title={tooltip || getDescription()}
    >
      <span>{getIcon()}</span>
      {showLabel && (
        <span className="font-medium capitalize">{confidence}</span>
      )}
    </div>
  );
};

/**
 * ConfidenceBar - Visual bar showing confidence level
 */
export const ConfidenceBar: React.FC<{
  confidence: 'high' | 'medium' | 'low';
  label?: string;
}> = ({ confidence, label }) => {
  const getValue = () => {
    switch (confidence) {
      case 'high': return 100;
      case 'medium': return 60;
      case 'low': return 30;
    }
  };

  const getColor = () => {
    switch (confidence) {
      case 'high': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-orange-500';
    }
  };

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span>{label}</span>
          <span className="capitalize">{confidence}</span>
        </div>
      )}
      <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${getValue()}%` }}
        />
      </div>
    </div>
  );
};

/**
 * ConfidenceSummary - Summary of multiple confidence levels
 */
export const ConfidenceSummary: React.FC<{
  items: Array<{ confidence: 'high' | 'medium' | 'low' }>;
  showBreakdown?: boolean;
}> = ({ items, showBreakdown = true }) => {
  const counts = {
    high: items.filter(i => i.confidence === 'high').length,
    medium: items.filter(i => i.confidence === 'medium').length,
    low: items.filter(i => i.confidence === 'low').length,
  };
  
  const total = items.length;
  if (total === 0) return null;
  
  // Calculate overall confidence
  const score = (counts.high * 100 + counts.medium * 60 + counts.low * 30) / total;
  const overall: 'high' | 'medium' | 'low' = 
    score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-zinc-400">Overall Confidence</span>
        <ConfidenceIndicator confidence={overall} size="sm" />
      </div>
      
      {showBreakdown && total > 1 && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-green-900/20 rounded p-2">
            <div className="text-green-400 font-bold">{counts.high}</div>
            <div className="text-zinc-500">High</div>
          </div>
          <div className="bg-yellow-900/20 rounded p-2">
            <div className="text-yellow-400 font-bold">{counts.medium}</div>
            <div className="text-zinc-500">Medium</div>
          </div>
          <div className="bg-orange-900/20 rounded p-2">
            <div className="text-orange-400 font-bold">{counts.low}</div>
            <div className="text-zinc-500">Low</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfidenceIndicator;
