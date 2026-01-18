import React, { useState, memo, useCallback } from 'react';
import { NovelState, WritingGoal } from '../types';
import { calculateWordCounts } from '../services/analyticsService';
import { useToast } from '../contexts/ToastContext';

interface WritingGoalsProps {
  novelState: NovelState;
  onUpdateGoals: (goals: WritingGoal[]) => void;
}

const WritingGoals: React.FC<WritingGoalsProps> = ({ novelState, onUpdateGoals }) => {
  const { showSuccess } = useToast();
  const [editingGoal, setEditingGoal] = useState<WritingGoal | null>(null);
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<string | null>(null);
  const wordCounts = calculateWordCounts(novelState);

  const handleCreateGoal = useCallback(() => {
    const newGoal: WritingGoal = {
      id: crypto.randomUUID(),
      novelId: novelState.id,
      type: 'total',
      target: 50000,
      current: wordCounts.total,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    setEditingGoal(newGoal);
  }, [novelState.id, wordCounts.total]);

  const handleSaveGoal = useCallback((goal: WritingGoal) => {
    const updatedGoals = novelState.writingGoals.some(g => g.id === goal.id)
      ? novelState.writingGoals.map(g => g.id === goal.id ? goal : g)
      : [...novelState.writingGoals, goal];
    onUpdateGoals(updatedGoals);
    setEditingGoal(null);
  }, [novelState.writingGoals, onUpdateGoals]);

  const handleDeleteGoal = useCallback((goalId: string) => {
    setConfirmDeleteGoal(goalId);
  }, []);

  const confirmDeleteGoalAction = useCallback(() => {
    if (confirmDeleteGoal) {
      onUpdateGoals(novelState.writingGoals.filter(g => g.id !== confirmDeleteGoal));
      setConfirmDeleteGoal(null);
      showSuccess('Writing goal deleted');
    }
  }, [novelState.writingGoals, onUpdateGoals, confirmDeleteGoal, showSuccess]);

  return (
    <div className="p-4 md:p-5 lg:p-6 max-w-4xl mx-auto pt-12 md:pt-16">
      <div className="mb-6 border-b border-zinc-700 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl md:text-2xl font-fantasy font-bold text-amber-500 tracking-wider uppercase">Writing Goals</h2>
          <p className="text-sm text-zinc-400 mt-2">Set and track your writing targets</p>
        </div>
        <button
          onClick={handleCreateGoal}
          className="bg-amber-600 hover:bg-amber-500 px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
        >
          + New Goal
        </button>
      </div>

      {novelState.writingGoals.length === 0 ? (
        <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-700 rounded-2xl bg-zinc-900/30">
          <div className="text-4xl mb-3">🎯</div>
          <h3 className="text-lg font-fantasy font-bold text-zinc-300 mb-2">No Goals Yet</h3>
          <p className="text-sm text-zinc-500 mb-6">Create a writing goal to track your progress.</p>
          <button
            onClick={handleCreateGoal}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-amber-900/20 hover:scale-105"
          >
            Create First Goal
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {novelState.writingGoals.map(goal => {
            const current = goal.type === 'total' ? wordCounts.total : goal.current;
            const progress = (current / goal.target) * 100;
            
            return (
              <div key={goal.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-fantasy font-bold text-amber-400 mb-1">
                      {goal.type.charAt(0).toUpperCase() + goal.type.slice(1)} Goal
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Target: {goal.target.toLocaleString()} words
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingGoal(goal)}
                      className="text-xs text-zinc-400 hover:text-amber-500 px-3 py-1.5 rounded-lg hover:bg-amber-500/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-xs text-zinc-400 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-zinc-400">Progress</span>
                    <span className="text-sm font-bold text-amber-400">
                      {current.toLocaleString()} / {goal.target.toLocaleString()} ({Math.round(progress)}%)
                    </span>
                  </div>
                  <progress
                    value={Math.min(progress, 100)}
                    max={100}
                    aria-label="Writing goal progress"
                    className="w-full h-3 rounded-full overflow-hidden bg-zinc-800
                      [&::-webkit-progress-bar]:bg-zinc-800
                      [&::-webkit-progress-value]:bg-gradient-to-r
                      [&::-webkit-progress-value]:from-amber-600
                      [&::-webkit-progress-value]:to-amber-500
                      [&::-webkit-progress-value]:transition-all
                      [&::-webkit-progress-value]:duration-300
                      [&::-moz-progress-bar]:bg-gradient-to-r
                      [&::-moz-progress-bar]:from-amber-600
                      [&::-moz-progress-bar]:to-amber-500
                      [&::-moz-progress-bar]:transition-all
                      [&::-moz-progress-bar]:duration-300"
                  />
                </div>
                
                {goal.deadline && (
                  <p className="text-xs text-zinc-500">
                    Deadline: {new Date(goal.deadline).toLocaleDateString()}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingGoal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-zinc-700">
              <h3 className="text-xl font-fantasy font-bold text-amber-500">Edit Goal</h3>
              <button
                onClick={() => setEditingGoal(null)}
                className="text-zinc-500 hover:text-zinc-300 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-800 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label
                  htmlFor="writing-goal-type"
                  className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2 block"
                >
                  Type
                </label>
                <select
                  id="writing-goal-type"
                  value={editingGoal.type}
                  onChange={(e) => setEditingGoal({ ...editingGoal, type: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="total">Total</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="writing-goal-target"
                  className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-2 block"
                >
                  Target Words
                </label>
                <input
                  id="writing-goal-target"
                  type="number"
                  value={editingGoal.target}
                  onChange={(e) => setEditingGoal({ ...editingGoal, target: parseInt(e.target.value) || 0 })}
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-base text-zinc-200 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
                />
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  onClick={() => setEditingGoal(null)}
                  className="px-6 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveGoal(editingGoal)}
                  className="px-8 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold transition-all duration-200"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteGoal && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex items-center justify-center z-[60] p-4">
          <div className="bg-zinc-900 border border-red-500/50 p-6 rounded-2xl w-full max-w-md">
            <h3 className="text-xl font-fantasy font-bold text-red-400 mb-4">Delete Writing Goal</h3>
            <p className="text-zinc-300 mb-6">Delete this writing goal? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmDeleteGoal(null)}
                className="px-6 py-2.5 text-zinc-400 font-semibold hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteGoalAction}
                className="px-8 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-105"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(WritingGoals);
