# Recurring Issue Patterns System

## Overview

The Recurring Issue Patterns System is an intelligent feedback loop that tracks issues found during chapter editing/analysis, detects recurring patterns, and automatically updates prompts to prevent these issues in future chapter generation.

## Features

### 1. Automatic Pattern Detection
- Tracks issues during chapter editing/analysis
- Groups issues by type + location combinations
- Detects recurring patterns when threshold is exceeded (default: 5 occurrences)
- Stores patterns globally (all novels benefit from shared patterns)

### 2. Intelligent Prompt Enhancement
- Automatically injects pattern-based constraints into chapter generation prompts
- Automatically injects pattern-based constraints into edit prompts
- Stores constraint text in database for persistence
- Prioritizes pattern constraints (placed at beginning of constraints array)

### 3. Auto-Resolution
- Automatically resolves patterns that haven't been seen for 30+ days
- Checks for pattern resolution during clean chapter analysis
- Prevents false positives from short-term clean periods

### 4. Pattern Management
- Pattern caching for performance (5-minute TTL)
- Pattern validation before processing
- Comprehensive error handling (non-blocking)
- Pattern statistics for monitoring and analytics

## Architecture

### Data Flow
```
Chapter Editing → Issue Detection → Pattern Analysis → Prompt Update → Future Generation
                                        ↓
                              Clean Chapters → Auto-Resolution
```

### Database Schema

#### `recurring_issue_patterns`
- Stores recurring issue patterns
- Tracks occurrence count, threshold, and status
- Stores prompt constraints for each pattern
- Unique constraint on (issue_type, location)

#### `pattern_occurrences`
- Stores individual occurrences for detailed tracking
- Links to chapters, reports, and novels
- Automatically updates pattern statistics via database trigger

## Key Components

### 1. Pattern Detection Service (`services/patternDetectionService.ts`)
- `detectRecurringPatterns()` - Main detection logic
- `getActivePatterns()` - Fetches active patterns (with caching)
- `checkPatternResolution()` - Checks if patterns should be resolved
- `autoResolveStalePatterns()` - Auto-resolves patterns not seen in 30+ days
- `getPatternStatistics()` - Returns pattern statistics for monitoring
- `markPatternResolved()` - Manually mark pattern as resolved
- `reactivatePattern()` - Reactivate a resolved pattern

### 2. Prompt Enhancement Service (`services/promptEnhancementService.ts`)
- `buildIssuePreventionConstraints()` - Converts patterns to prompt constraints
- `addPatternConstraintsToPrompt()` - Injects constraints into prompts
- `getConstraintTextForPattern()` - Gets constraint text for a pattern
- Maps all issue types to specific prevention instructions

### 3. Supabase Service (`services/supabaseService.ts`)
- `saveRecurringPattern()` - Saves/updates patterns
- `savePatternOccurrence()` - Saves individual occurrences
- `getActiveRecurringPatterns()` - Fetches active patterns
- `getAllRecurringPatterns()` - Fetches all patterns
- `getOrCreatePattern()` - Gets or creates pattern by type+location
- `updatePatternStatus()` - Updates pattern status
- `incrementPatternCount()` - Manual count increment (fallback)

### 4. Integration Points
- **Chapter Generation** (`services/promptEngine/writers/chapterPromptWriter.ts`)
  - Fetches active patterns before building prompt
  - Injects pattern constraints into chapter generation prompts
  
- **Chapter Editing** (`services/promptEngine/writers/editPromptWriter.ts`)
  - Fetches active patterns before building edit prompt
  - Injects pattern constraints into edit prompts
  
- **Editor Service** (`services/editorService.ts`)
  - Triggers pattern detection after analysis completes
  - Checks for pattern resolution during clean analysis
  - Logs pattern statistics periodically

## Issue Types Supported

All editor issue types are supported with specific prevention constraints:

1. **transition** - Chapter transition/flow issues
2. **gap** - Narrative gaps
3. **continuity** - Story continuity issues
4. **time_skip** - Unexplained time skips
5. **character_consistency** - Character consistency issues
6. **plot_hole** - Plot holes
7. **grammar** - Grammar issues
8. **style** - Style inconsistencies
9. **formatting** - Formatting issues
10. **paragraph_structure** - Paragraph structure issues
11. **sentence_structure** - Sentence structure issues

## Configuration

### Constants
- `DEFAULT_THRESHOLD = 5` - Default threshold for considering a pattern recurring
- `AUTO_RESOLUTION_THRESHOLD_DAYS = 30` - Auto-resolve patterns not seen in 30 days
- `CLEAN_CHAPTERS_FOR_RESOLUTION = 10` - Consecutive clean chapters for resolution
- `CACHE_TTL_MS = 5 * 60 * 1000` - Cache TTL (5 minutes)

## Usage Examples

### Pattern Detection
```typescript
import { detectRecurringPatterns } from './services/patternDetectionService';

const result = await detectRecurringPatterns(issues, novelId, reportId);
console.log(`Found ${result.detectedPatterns.length} new patterns`);
console.log(`Updated ${result.updatedPatterns.length} existing patterns`);
```

### Get Active Patterns
```typescript
import { getActivePatterns } from './services/patternDetectionService';

const activePatterns = await getActivePatterns();
console.log(`Active patterns: ${activePatterns.length}`);
```

### Pattern Statistics
```typescript
import { getPatternStatistics } from './services/patternDetectionService';

const stats = await getPatternStatistics();
console.log(`Total: ${stats.totalPatterns}, Active: ${stats.activePatterns}`);
console.log(`Most common: ${stats.mostCommonType} at ${stats.mostCommonLocation}`);
```

### Auto-Resolution
```typescript
import { autoResolveStalePatterns } from './services/patternDetectionService';

const resolvedCount = await autoResolveStalePatterns();
console.log(`Resolved ${resolvedCount} stale patterns`);
```

## Monitoring

The system logs important events:
- New patterns detected (when threshold exceeded)
- Pattern updates
- Pattern resolutions
- Pattern statistics (periodically)
- Cache operations

Look for logs prefixed with `[Pattern Detection]` and `[Prompt Enhancement]`.

## Best Practices

1. **Threshold Adjustment**: Consider adjusting `DEFAULT_THRESHOLD` based on your needs
   - Lower threshold (3-4) = More sensitive, faster pattern detection
   - Higher threshold (6-8) = More conservative, fewer false positives

2. **Auto-Resolution**: The system auto-resolves patterns after 30 days of no occurrences
   - Manual resolution can be done using `markPatternResolved()`
   - Patterns are automatically reactivated if they reoccur

3. **Cache Management**: The system uses caching for performance
   - Cache is automatically cleared on pattern updates
   - Use `clearActivePatternsCache()` if manual cache clearing is needed
   - Cache TTL is 5 minutes (configurable)

4. **Error Handling**: All pattern operations are non-blocking
   - Errors don't prevent chapter generation/editing
   - Errors are logged for debugging
   - Graceful fallbacks are provided

## Database Migration

The migration file `DATABASE_MIGRATION_RECURRING_ISSUES.sql` has been applied. This creates:
- `recurring_issue_patterns` table
- `pattern_occurrences` table
- Database triggers for automatic statistics updates
- Indexes for performance

## Future Enhancements

Potential improvements:
- Pattern weight/priority based on recency
- Novel-specific patterns (in addition to global)
- Pattern merging/deduplication logic
- Pattern dashboard UI component
- Pattern trends and analytics visualization
- Manual pattern management UI
- Pattern export/import functionality

## Troubleshooting

### Patterns not being detected
- Check that issues are being found during editor analysis
- Verify database connection and migration applied
- Check console logs for pattern detection errors

### Constraints not appearing in prompts
- Verify active patterns exceed threshold
- Check that `getActivePatterns()` is being called
- Review pattern constraint generation logic

### Patterns not resolving
- Check auto-resolution threshold (30 days)
- Verify pattern `lastSeenAt` timestamp
- Review `checkPatternResolution()` logic

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Review pattern statistics using `getPatternStatistics()`
3. Verify database tables and triggers are properly set up
4. Check that all service integrations are correct
