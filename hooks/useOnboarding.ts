/**
 * Onboarding Hook
 * Manages onboarding state and tour progress
 */

import { useState, useEffect, useCallback } from 'react';

export interface OnboardingStep {
  id: string;
  target: string; // CSS selector or element ID
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface OnboardingTour {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
}

const ONBOARDING_STORAGE_KEY = 'hall-of-jade-onboarding-completed';
const ONBOARDING_TOUR_STORAGE_KEY = 'hall-of-jade-tour-';

export function useOnboarding() {
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  });

  const [activeTour, setActiveTour] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);

  const markOnboardingComplete = useCallback(() => {
    setIsOnboardingComplete(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    }
  }, []);

  const markTourComplete = useCallback((tourId: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${ONBOARDING_TOUR_STORAGE_KEY}${tourId}`, 'true');
    }
  }, []);

  const isTourComplete = useCallback((tourId: string): boolean => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(`${ONBOARDING_TOUR_STORAGE_KEY}${tourId}`) === 'true';
  }, []);

  const startTour = useCallback((tourId: string) => {
    setActiveTour(tourId);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const endTour = useCallback((tourId: string) => {
    setActiveTour(null);
    setCurrentStep(0);
    markTourComplete(tourId);
  }, [markTourComplete]);

  const resetOnboarding = useCallback(() => {
    setIsOnboardingComplete(false);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
      // Clear all tour completions
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(ONBOARDING_TOUR_STORAGE_KEY)) {
          localStorage.removeItem(key);
        }
      });
    }
  }, []);

  return {
    isOnboardingComplete,
    activeTour,
    currentStep,
    markOnboardingComplete,
    markTourComplete,
    isTourComplete,
    startTour,
    nextStep,
    previousStep,
    endTour,
    resetOnboarding,
  };
}
