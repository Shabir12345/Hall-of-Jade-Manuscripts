/**
 * Onboarding Tour Definitions
 * Pre-defined tours for different user journeys
 */

import type { OnboardingTour } from '../hooks/useOnboarding';

export const MAIN_ONBOARDING_TOUR: OnboardingTour = {
  id: 'main-onboarding',
  name: 'Welcome Tour',
  description: 'Get started with Hall of Jade Manuscripts',
  steps: [
    {
      id: 'welcome',
      target: 'body',
      title: 'Welcome to Hall of Jade Manuscripts',
      content: 'This is your AI-powered writing companion for crafting epic Xianxia, Xuanhuan, and System novels. Let\'s take a quick tour of the key features.',
      position: 'center',
    },
    {
      id: 'sidebar',
      target: '[role="navigation"]',
      title: 'Navigation Sidebar',
      content: 'Use the sidebar to navigate between different views: Dashboard, Chapters, Characters, World Building, and more. The Advanced Analysis section contains powerful tools for story analysis.',
      position: 'right',
    },
    {
      id: 'dashboard',
      target: '[data-tour="dashboard"]',
      title: 'Dashboard',
      content: 'The dashboard shows your novel overview, statistics, and quick actions. Generate new chapters, view your progress, and see automation activities here.',
      position: 'bottom',
    },
    {
      id: 'chapters',
      target: '[data-tour="chapters-view"]',
      title: 'Chapters View',
      content: 'View and manage all your chapters. You can export, delete, or open chapters for editing. Use bulk operations to manage multiple chapters at once.',
      position: 'bottom',
    },
    {
      id: 'keyboard-shortcuts',
      target: '[data-tour="main-content"]',
      title: 'Keyboard Shortcuts',
      content: 'Press Ctrl/Cmd+K to search, Ctrl/Cmd+S to save, and use single keys for quick navigation. Press ? or Ctrl/Cmd+? to see all shortcuts.',
      position: 'center',
    },
  ],
};

export const DASHBOARD_TOUR: OnboardingTour = {
  id: 'dashboard-tour',
  name: 'Dashboard Tour',
  description: 'Learn about dashboard features',
  steps: [
    {
      id: 'generate-chapter',
      target: '[data-tour="generate-chapter"]',
      title: 'Generate Chapters',
      content: 'Use the chapter generation panel to create new chapters with AI. Add custom instructions to guide the AI\'s writing style and focus.',
      position: 'bottom',
    },
    {
      id: 'trust-score',
      target: '[data-tour="trust-score"]',
      title: 'Trust Score',
      content: 'The trust score measures the reliability of extracted story data. Higher scores indicate better extraction quality and consistency.',
      position: 'top',
    },
    {
      id: 'auto-connections',
      target: '[data-tour="auto-connections"]',
      title: 'Auto-Connections',
      content: 'The AI automatically detects relationships between characters, scenes, items, and techniques from your chapters.',
      position: 'top',
    },
  ],
};

export const EDITOR_TOUR: OnboardingTour = {
  id: 'editor-tour',
  name: 'Chapter Editor Tour',
  description: 'Learn about the chapter editor',
  steps: [
    {
      id: 'editor-content',
      target: '[data-tour="editor-content"]',
      title: 'Content Editor',
      content: 'Write and edit your chapter content here. Use @ to reference characters, places, and world entries. The editor supports voice input and autocomplete.',
      position: 'bottom',
    },
    {
      id: 'ai-editor',
      target: '[data-tour="ai-editor"]',
      title: 'AI Editor',
      content: 'Use the AI editor panel to refine your prose. Add instructions like "make this more dramatic" or "add more detail about the cultivation breakthrough".',
      position: 'left',
    },
    {
      id: 'professional-editor',
      target: '[data-tour="professional-editor"]',
      title: 'Professional Editor',
      content: 'Access advanced editing features: comments, suggestions, highlights, style checks, and version comparison. Perfect for collaborative editing.',
      position: 'bottom',
    },
  ],
};

export const PLANNING_TOUR: OnboardingTour = {
  id: 'planning-tour',
  name: 'Planning Tour',
  description: 'Learn about arc planning',
  steps: [
    {
      id: 'grand-saga',
      target: '[data-tour="grand-saga"]',
      title: 'Grand Saga',
      content: 'Define your novel\'s overarching story. This helps the AI understand the overall narrative direction when generating chapters.',
      position: 'top',
    },
    {
      id: 'plot-arcs',
      target: '[data-tour="plot-arcs"]',
      title: 'Plot Arcs',
      content: 'Plan and track individual story arcs. Each arc can have a checklist, target chapters, and status. The editor automatically reviews arcs when completed.',
      position: 'top',
    },
  ],
};

export const ALL_TOURS: OnboardingTour[] = [
  MAIN_ONBOARDING_TOUR,
  DASHBOARD_TOUR,
  EDITOR_TOUR,
  PLANNING_TOUR,
];

export function getTourById(tourId: string): OnboardingTour | undefined {
  return ALL_TOURS.find(tour => tour.id === tourId);
}
