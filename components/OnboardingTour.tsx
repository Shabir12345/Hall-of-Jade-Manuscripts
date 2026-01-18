/**
 * Onboarding Tour Component
 * Displays a guided tour with step-by-step highlights
 */

import React, { useEffect, useRef, useState } from 'react';
import type { OnboardingStep, OnboardingTour } from '../hooks/useOnboarding';

interface OnboardingTourProps {
  tour: OnboardingTour;
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  tour,
  currentStep,
  onNext,
  onPrevious,
  onClose,
  onComplete,
}) => {
  const [highlightStyle, setHighlightStyle] = useState<React.CSSProperties>({});
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = tour.steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tour.steps.length - 1;

  useEffect(() => {
    if (!step) {
      onComplete();
      return;
    }

    const updatePosition = () => {
      const targetElement = document.querySelector(step.target);
      if (!targetElement || !overlayRef.current || !tooltipRef.current) {
        return;
      }

      const rect = targetElement.getBoundingClientRect();
      const overlayRect = overlayRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Create highlight overlay
      const highlightStyle: React.CSSProperties = {
        position: 'fixed',
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        zIndex: 9998,
        pointerEvents: 'none',
        border: '3px solid #f59e0b',
        borderRadius: '8px',
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)',
      };

      // Position tooltip
      const position = step.position || 'bottom';
      let tooltipTop = 0;
      let tooltipLeft = 0;

      switch (position) {
        case 'top':
          tooltipTop = rect.top - tooltipRect.height - 16;
          tooltipLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          tooltipTop = rect.bottom + 16;
          tooltipLeft = rect.left + rect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          tooltipTop = rect.top + rect.height / 2 - tooltipRect.height / 2;
          tooltipLeft = rect.left - tooltipRect.width - 16;
          break;
        case 'right':
          tooltipTop = rect.top + rect.height / 2 - tooltipRect.height / 2;
          tooltipLeft = rect.right + 16;
          break;
        case 'center':
          tooltipTop = window.innerHeight / 2 - tooltipRect.height / 2;
          tooltipLeft = window.innerWidth / 2 - tooltipRect.width / 2;
          break;
      }

      // Keep tooltip in viewport
      const padding = 16;
      if (tooltipLeft < padding) tooltipLeft = padding;
      if (tooltipLeft + tooltipRect.width > window.innerWidth - padding) {
        tooltipLeft = window.innerWidth - tooltipRect.width - padding;
      }
      if (tooltipTop < padding) tooltipTop = padding;
      if (tooltipTop + tooltipRect.height > window.innerHeight - padding) {
        tooltipTop = window.innerHeight - tooltipRect.height - padding;
      }

      setHighlightStyle(highlightStyle);
      setTooltipStyle({
        position: 'fixed',
        top: `${tooltipTop}px`,
        left: `${tooltipLeft}px`,
        zIndex: 9999,
      });

      // Scroll target into view
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [step, onComplete]);

  if (!step) {
    return null;
  }

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9997]"
        onClick={(e) => {
          // Only close on overlay click, not on tooltip click
          if (e.target === overlayRef.current) {
            onClose();
          }
        }}
      />

      {/* Highlight */}
      <div style={highlightStyle} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="bg-zinc-900 border-2 border-amber-500 rounded-xl shadow-2xl max-w-md w-[90vw] sm:w-[400px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-fantasy font-bold text-amber-400 mb-1">
                {step.title}
              </h3>
              <p className="text-xs text-zinc-400">
                Step {currentStep + 1} of {tour.steps.length}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors ml-4"
              aria-label="Close tour"
            >
              ×
            </button>
          </div>

          <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
            {step.content}
          </p>

          {step.action && (
            <button
              onClick={step.action.onClick}
              className="w-full mb-4 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold text-sm transition-all"
            >
              {step.action.label}
            </button>
          )}

          <div className="flex items-center justify-between gap-3 pt-4 border-t border-zinc-700">
            <button
              onClick={onPrevious}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                isFirstStep
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
              }`}
            >
              ← Previous
            </button>

            <div className="flex gap-1">
              {tour.steps.map((_, idx) => (
                <div
                  key={idx}
                  className={`w-2 h-2 rounded-full transition-all ${
                    idx === currentStep
                      ? 'bg-amber-500 w-6'
                      : idx < currentStep
                      ? 'bg-amber-500/50'
                      : 'bg-zinc-700'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={isLastStep ? onComplete : onNext}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition-all"
            >
              {isLastStep ? 'Complete' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
