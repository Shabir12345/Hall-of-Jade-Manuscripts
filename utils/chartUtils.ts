/**
 * Chart utilities for analytics
 * Simple data formatting for chart visualizations
 */

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

/**
 * Calculate percentage for value out of total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Format data for bar chart
 */
export function formatBarChartData(data: Record<string, number>): ChartDataPoint[] {
  return Object.entries(data)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Format data for pie chart (percentage distribution)
 */
export function formatPieChartData(data: Record<string, number>): ChartDataPoint[] {
  const total = Object.values(data).reduce((sum, val) => sum + val, 0);
  return Object.entries(data)
    .map(([label, value]) => ({
      label,
      value,
      percentage: calculatePercentage(value, total),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Generate color palette
 */
export function generateColorPalette(count: number): string[] {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
  ];
  
  const palette: string[] = [];
  for (let i = 0; i < count; i++) {
    palette.push(colors[i % colors.length]);
  }
  return palette;
}

/**
 * Calculate trend (improvement/regression)
 */
export function calculateTrend(current: number, previous: number): {
  direction: 'up' | 'down' | 'stable';
  change: number;
  percentage: number;
} {
  const change = current - previous;
  const percentage = previous === 0 ? 0 : calculatePercentage(Math.abs(change), previous);
  
  if (change > 0) return { direction: 'up', change, percentage };
  if (change < 0) return { direction: 'down', change: Math.abs(change), percentage };
  return { direction: 'stable', change: 0, percentage: 0 };
}

/**
 * Generate sparkline data (simple line chart points)
 */
export function generateSparklineData(values: number[], width: number = 100, height: number = 20): string {
  if (values.length === 0) return '';
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });
  
  return points.join(' ');
}

/**
 * Calculate average
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
}

/**
 * Calculate median
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}
