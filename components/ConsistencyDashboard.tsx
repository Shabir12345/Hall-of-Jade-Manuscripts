/**
 * Consistency Dashboard
 * 
 * Shows current consistency score, active validation warnings,
 * power level progression timeline, relationship network visualization,
 * and recent state changes.
 */

import React, { useMemo } from 'react';
import { NovelState } from '../types';
import { checkConsistency } from '../services/consistencyChecker';
import { getKnowledgeGraphService } from '../services/knowledgeGraphService';
import { getEntityStateTracker } from '../services/entityStateTracker';

interface ConsistencyDashboardProps {
  novel: NovelState;
}

export const ConsistencyDashboard: React.FC<ConsistencyDashboardProps> = ({ novel }) => {
  // Initialize services
  const graphService = getKnowledgeGraphService();
  const stateTracker = getEntityStateTracker();

  // Initialize graph if needed
  if (!graphService.getGraph()) {
    graphService.initializeGraph(novel);
  }

  // Get consistency report
  const consistencyReport = useMemo(() => {
    return checkConsistency(novel);
  }, [novel]);

  // Get state tracker summary
  const stateSummary = useMemo(() => {
    return stateTracker.getSummary();
  }, [novel]);

  // Get power progressions
  const powerProgressions = useMemo(() => {
    const progressions: Array<{
      characterId: string;
      characterName: string;
      currentLevel: string;
      progression: Array<{ chapterNumber: number; powerLevel: string; progressionType: string }>;
    }> = [];

    novel.characterCodex.forEach(char => {
      const prog = graphService.getPowerProgression(char.id);
      if (prog && prog.progression.length > 0) {
        progressions.push({
          characterId: char.id,
          characterName: char.name,
          currentLevel: prog.currentLevel,
          progression: prog.progression.map(p => ({
            chapterNumber: p.chapterNumber,
            powerLevel: p.powerLevel,
            progressionType: p.progressionType,
          })),
        });
      }
    });

    return progressions;
  }, [novel]);

  // Get recent state changes
  const recentChanges = useMemo(() => {
    if (novel.chapters.length === 0) return [];
    
    const lastChapter = novel.chapters[novel.chapters.length - 1];
    return stateTracker.getChapterChanges(lastChapter.id, lastChapter.number);
  }, [novel]);

  const scoreColor = consistencyReport.summary.overallScore >= 90
    ? 'text-green-600'
    : consistencyReport.summary.overallScore >= 75
    ? 'text-yellow-600'
    : consistencyReport.summary.overallScore >= 60
    ? 'text-orange-600'
    : 'text-red-600';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Consistency Dashboard</h2>
        <div className={`text-3xl font-bold ${scoreColor}`}>
          {consistencyReport.summary.overallScore}/100
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Overall Score</div>
          <div className={`text-2xl font-bold ${scoreColor}`}>
            {consistencyReport.summary.overallScore}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Critical Issues</div>
          <div className="text-2xl font-bold text-red-600">
            {consistencyReport.summary.critical}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Warnings</div>
          <div className="text-2xl font-bold text-yellow-600">
            {consistencyReport.summary.warnings}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Tracked Entities</div>
          <div className="text-2xl font-bold text-blue-600">
            {stateSummary.totalEntities}
          </div>
        </div>
      </div>

      {/* Issues List */}
      {consistencyReport.issues.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Active Issues</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {consistencyReport.issues.map((issue, index) => (
              <div
                key={index}
                className={`p-3 rounded border-l-4 ${
                  issue.severity === 'critical'
                    ? 'border-red-500 bg-red-50'
                    : issue.severity === 'warning'
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{issue.message}</div>
                    <div className="text-sm text-gray-600 mt-1">{issue.suggestion}</div>
                    {issue.characterName && (
                      <div className="text-xs text-gray-500 mt-1">
                        Character: {issue.characterName}
                        {issue.chapterNumber && ` | Chapter: ${issue.chapterNumber}`}
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      issue.severity === 'critical'
                        ? 'bg-red-100 text-red-800'
                        : issue.severity === 'warning'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {issue.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power Level Progression Timeline */}
      {powerProgressions.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Power Level Progression</h3>
          <div className="space-y-4">
            {powerProgressions.map(prog => (
              <div key={prog.characterId} className="border-l-2 border-blue-500 pl-4">
                <div className="font-medium">{prog.characterName}</div>
                <div className="text-sm text-gray-600">Current: {prog.currentLevel}</div>
                <div className="mt-2 text-xs text-gray-500">
                  {prog.progression.slice(-5).map((p, i) => (
                    <span key={i}>
                      Ch {p.chapterNumber}: {p.powerLevel}
                      {i < prog.progression.length - 1 && ' → '}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent State Changes */}
      {recentChanges.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Recent State Changes</h3>
          <div className="space-y-2 text-sm">
            {recentChanges.slice(0, 10).map((change, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{change.entityType}</span>
                  {change.entityName && <span className="text-gray-600">: {change.entityName}</span>}
                </div>
                <div className="text-gray-500">
                  Ch {change.chapterNumber} | {change.changes.length} change(s)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {consistencyReport.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
          <h3 className="text-lg font-semibold mb-3 text-blue-900">Recommendations</h3>
          <ul className="space-y-2">
            {consistencyReport.recommendations.map((rec, index) => (
              <li key={index} className="text-blue-800 flex items-start">
                <span className="mr-2">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
