import { useEffect, useRef } from 'react';

/**
 * Hook to trap focus within a modal/dialog
 * Ensures keyboard navigation stays within the modal
 */
export function useFocusTrap(isOpen: boolean) {
  const containerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Focus should return to trigger element
        // This is handled by the component using the hook
      }
    };

    // Focus first element when modal opens
    firstElement?.focus();

    container.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return containerRef;
}
