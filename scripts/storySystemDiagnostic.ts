/**
 * Story System Diagnostic Script
 * 
 * Checks the current state of story threads and character codex
 * Run this to diagnose issues with the narrative tracking system
 */

import { NovelState } from '../types';

export function runStorySystemDiagnostic(state: NovelState) {
  console.log('=== STORY SYSTEM DIAGNOSTIC ===');
  console.log(`Novel: ${state.title}`);
  console.log(`Chapters: ${state.chapters.length}`);
  console.log();

  // Character Codex Analysis
  console.log('📚 CHARACTER CODEX:');
  console.log(`Total characters: ${state.characterCodex.length}`);
  
  if (state.characterCodex.length === 0) {
    console.log('❌ NO CHARACTERS FOUND - Critical Issue');
  } else {
    state.characterCodex.forEach((char, index) => {
      console.log(`${index + 1}. ${char.name} (${char.isProtagonist ? 'PROTAGONIST' : 'Supporting'})`);
      console.log(`   Cultivation: ${char.currentCultivation || 'Unknown'}`);
      console.log(`   Status: ${char.status || 'Unknown'}`);
      console.log(`   Relationships: ${char.relationships?.length || 0}`);
    });
    
    if (state.characterCodex.length === 1) {
      console.log('⚠️ Only protagonist found - missing supporting characters');
    }
  }
  console.log();

  // Story Threads Analysis
  console.log('🧵 STORY THREADS:');
  console.log(`Total threads: ${state.storyThreads?.length || 0}`);
  
  if (!state.storyThreads || state.storyThreads.length === 0) {
    console.log('❌ NO STORY THREADS - Critical Issue');
    console.log('This explains why thread density is 0');
  } else {
    state.storyThreads.forEach((thread, index) => {
      console.log(`${index + 1}. ${thread.title}`);
      console.log(`   Type: ${thread.type}`);
      console.log(`   Status: ${thread.status}`);
      console.log(`   Priority: ${thread.priority}`);
      console.log(`   Introduced: Chapter ${thread.introducedChapter}`);
      console.log(`   Last Updated: Chapter ${thread.lastUpdatedChapter}`);
    });
  }
  console.log();

  // Recent Chapter Content Analysis
  console.log('📖 RECENT CHAPTERS:');
  const recentChapters = state.chapters.slice(-3);
  recentChapters.forEach(chapter => {
    console.log(`Chapter ${chapter.number}: ${chapter.title}`);
    console.log(`   Content length: ${chapter.content?.length || 0} chars`);
    console.log(`   Summary length: ${chapter.summary?.length || 0} chars`);
    
    // Quick character name detection
    const content = (chapter.content || chapter.summary || '').toLowerCase();
    const potentialNames = [];
    
    // Look for capitalized words that might be names
    const words = (chapter.content || chapter.summary || '').match(/\b[A-Z][a-z]+\b/g) || [];
    const uniqueWords = [...new Set(words)];
    
    // Filter out common words
    const filteredNames = uniqueWords.filter(word => 
      !['The', 'And', 'But', 'For', 'Not', 'You', 'All', 'Any', 'Can', 'Will', 'Just', 'Now', 'When', 'Then', 'Than', 'That', 'This', 'With', 'Have', 'From', 'They', 'Were', 'Been', 'Their', 'Your', 'Would', 'There', 'Could', 'Should', 'Would', 'Like', 'Time', 'Look', 'Way', 'More', 'What', 'Know', 'Back', 'Think', 'Even', 'Only', 'Good', 'New', 'Some', 'Take', 'Come', 'Well', 'Where', 'Much', 'Those', 'People', 'Great', 'Other', 'Such', 'Being', 'Does', 'Work', 'Life', 'Still', 'After', 'Hand', 'Never', 'Here', 'Thing', 'Another', 'Place', 'World', 'School', 'House', 'Page', 'Case', 'Point', 'Company', 'Number', 'Group', 'Problem', 'Fact', 'Week', 'Right', 'Study', 'Night', 'Part', 'Turn', 'Place', 'End', 'While', 'Again', 'Few', 'Little', 'High', 'Too', 'Year', 'State', 'Early', 'Course', 'Systems', 'Area', 'Water', 'Light', 'Power', 'Big', 'Gate', 'Way', 'Long', 'Far', 'Mind', 'Side', 'Head', 'Hand', 'Room', 'Body', 'Heart', 'Life', 'Name', 'Eye', 'Face', 'Voice', 'Back', 'Call', 'Hour', 'Night', 'Day', 'Door', 'Form', 'Class', 'Room', 'Book', 'Work', 'Time', 'Part', 'Kind', 'Case', 'Problem', 'Right', 'Question', 'School', 'Country', 'State', 'Group', 'Family', 'City', 'Area', 'Hand', 'World', 'Life', 'Part', 'Place', 'Week', 'Company', 'System', 'Program', 'Question', 'Work', 'Government', 'Number', 'Night', 'Point', 'Home', 'Water', 'Room', 'Mother', 'Area', 'Money', 'Story', 'Fact', 'Month', 'Lot', 'Right', 'Study', 'Book', 'Eye', 'Job', 'Word', 'Business', 'Issue', 'Group', 'Problem', 'Hand', 'Service', 'Friend', 'Father', 'Power', 'Hour', 'Game', 'Line', 'End', 'Member', 'Law', 'Car', 'City', 'Community', 'Name'].includes(word)
    );
    
    if (filteredNames.length > 0) {
      console.log(`   Potential character names: ${filteredNames.slice(0, 5).join(', ')}`);
    }
  });
  console.log();

  // Recommendations
  console.log('💡 RECOMMENDATIONS:');
  
  if (state.characterCodex.length <= 1) {
    console.log('1. Run character extraction on recent chapters to find missing characters');
  }
  
  if (!state.storyThreads || state.storyThreads.length === 0) {
    console.log('2. Initialize story threads using the storyThreadInitializer service');
    console.log('3. Check extraction prompts - they may be missing thread detection');
  }
  
  if (state.chapters.length > 10 && (state.characterCodex.length <= 1 || (!state.storyThreads || state.storyThreads.length === 0))) {
    console.log('4. Critical: For a novel with ' + state.chapters.length + ' chapters, you should have multiple characters and story threads');
    console.log('5. Consider running a backfill extraction on earlier chapters');
  }
  
  console.log();
  console.log('=== DIAGNOSTIC COMPLETE ===');
}

// Export for use in the app
export default runStorySystemDiagnostic;
