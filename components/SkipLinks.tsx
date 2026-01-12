import React from 'react';

/**
 * Skip Links Component
 * Provides keyboard navigation shortcuts for accessibility
 * Allows users to skip to main content areas
 */
const SkipLinks: React.FC = () => {
  return (
    <div className="skip-links">
      <a 
        href="#main-content" 
        className="skip-link"
        aria-label="Skip to main content"
      >
        Skip to main content
      </a>
      <a 
        href="#sidebar" 
        className="skip-link"
        aria-label="Skip to navigation sidebar"
      >
        Skip to navigation
      </a>
    </div>
  );
};

export default SkipLinks;
