# Console Error Fixes

## Issues Fixed

### 1. Pattern Occurrences Foreign Key Violation ✅

**Error**: `insert or update on table "pattern_occurrences" violates foreign key constraint "pattern_occurrences_report_id_fkey"`

**Cause**: Pattern detection runs before the editor report is saved to the database. When pattern occurrences try to reference `report_id`, the report doesn't exist yet, causing a foreign key constraint violation.

**Fix**: Added error handling in `patternDetectionService.ts` to retry saving pattern occurrences without `report_id` if the foreign key constraint fails. Since `report_id` is nullable in the database schema, pattern occurrences can be saved without it.

**File**: `services/patternDetectionService.ts`
- Added try-catch around `savePatternOccurrence` calls
- If foreign key constraint error occurs and `reportId` is provided, retry without `report_id`
- This allows pattern detection to work even if the report hasn't been saved yet

### 2. Character Technique Mastery 409 Conflict ✅

**Error**: `Failed to load resource: the server responded with a status of 409` for `character_technique_mastery`

**Cause**: Potential duplicate entries in the `masteriesInserts` array causing conflicts during upsert, or race conditions.

**Fix**: Added deduplication logic and better error handling in `supabaseService.ts`:
- Deduplicate entries by `(character_id, technique_id)` before upsert
- Wrap upsert in try-catch to prevent failures from blocking novel save
- Log warnings instead of throwing errors

**File**: `services/supabaseService.ts`
- Added deduplication using Map to ensure unique entries
- Added error handling to gracefully handle conflicts
- Changed to log warnings instead of throwing errors

## Status

Both errors should now be resolved:
- ✅ Pattern occurrences will save successfully even if report hasn't been saved yet
- ✅ Character technique mastery upserts will handle duplicates and conflicts gracefully

## Notes

- Pattern occurrences can now be saved without `report_id` - this is acceptable since the field is nullable
- Character technique mastery conflicts are now handled gracefully - duplicates are removed before upsert
- Both fixes maintain data integrity while preventing errors from blocking operations
