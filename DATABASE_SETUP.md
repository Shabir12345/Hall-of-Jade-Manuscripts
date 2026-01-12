# Database Setup Guide

## Overview
Your "Hall of Jade Manuscripts" app is now fully integrated with Supabase! All data is stored in a professional PostgreSQL database instead of localStorage.

## Database Schema

### Main Tables

1. **novels** - Main table storing novel metadata
   - `id` (UUID, Primary Key)
   - `title` (TEXT)
   - `genre` (TEXT)
   - `grand_saga` (TEXT)
   - `current_realm_id` (UUID, Foreign Key to realms)
   - `created_at`, `updated_at` (Timestamps)

2. **realms** - Different realms/worlds in each novel
   - `id` (UUID, Primary Key)
   - `novel_id` (UUID, Foreign Key to novels)
   - `name`, `description` (TEXT)
   - `status` (current/archived/future)

3. **territories** - Geographic locations within realms
   - `id` (UUID, Primary Key)
   - `realm_id` (UUID, Foreign Key to realms)
   - `name`, `description` (TEXT)
   - `type` (Empire/Kingdom/Neutral/Hidden)
   - `created_at`, `updated_at` (Timestamps)

4. **world_entries** - World building knowledge base
   - `id` (UUID, Primary Key)
   - `realm_id` (UUID, Foreign Key to realms)
   - `category` (Geography/Sects/PowerLevels/Laws/Systems/Techniques/Other)
   - `title`, `content` (TEXT)
   - `created_at`, `updated_at` (Timestamps)

5. **characters** - Character information
   - `id` (UUID, Primary Key)
   - `novel_id` (UUID, Foreign Key to novels)
   - `name`, `age`, `personality`, `current_cultivation`, `notes` (TEXT)
   - `portrait_url` (TEXT, nullable)
   - `status` (Alive/Deceased/Unknown)
   - `created_at`, `updated_at` (Timestamps)

6. **character_skills** - Many-to-many relationship for character skills
   - `id` (UUID, Primary Key)
   - `character_id` (UUID, Foreign Key to characters)
   - `skill` (TEXT)

7. **character_items** - Many-to-many relationship for character items
   - `id` (UUID, Primary Key)
   - `character_id` (UUID, Foreign Key to characters)
   - `item` (TEXT)

8. **relationships** - Character relationships (Karma Links)
   - `id` (UUID, Primary Key)
   - `character_id` (UUID, Foreign Key to characters)
   - `target_character_id` (UUID, Foreign Key to characters)
   - `type`, `history`, `impact` (TEXT)

9. **chapters** - Novel chapters
   - `id` (UUID, Primary Key)
   - `novel_id` (UUID, Foreign Key to novels)
   - `number` (INTEGER, unique per novel)
   - `title`, `content`, `summary` (TEXT)
   - `logic_audit` (JSONB - stores the logic audit data)

10. **arcs** - Plot arcs
    - `id` (UUID, Primary Key)
    - `novel_id` (UUID, Foreign Key to novels)
    - `title`, `description` (TEXT)
    - `status` (active/completed)
    - `created_at`, `updated_at` (Timestamps)

11. **system_logs** - System event logs
    - `id` (UUID, Primary Key)
    - `novel_id` (UUID, Foreign Key to novels)
    - `message` (TEXT)
    - `type` (discovery/update/fate/logic)
    - `timestamp` (Timestamp)

12. **scenes** - Individual scenes within chapters
    - `id` (UUID, Primary Key)
    - `chapter_id` (UUID, Foreign Key to chapters)
    - `number` (INTEGER, unique per chapter)
    - `title`, `content`, `summary` (TEXT)
    - `word_count` (INTEGER)
    - `created_at`, `updated_at` (Timestamps)

13. **revisions** - Version history for content
    - `id` (UUID, Primary Key)
    - `entity_type` (chapter/scene/character/world)
    - `entity_id` (UUID)
    - `content` (JSONB)
    - `metadata` (JSONB)
    - `created_at` (Timestamp)

14. **tags** - Tags for organizing content
    - `id` (UUID, Primary Key)
    - `novel_id` (UUID, Foreign Key to novels)
    - `name` (TEXT, unique per novel)
    - `color` (TEXT, nullable)
    - `category` (plot/character/world/theme, nullable)
    - `created_at` (Timestamp)

15. **entity_tags** - Many-to-many relationship between entities and tags
    - `id` (UUID, Primary Key)
    - `entity_type` (chapter/scene/character/world)
    - `entity_id` (UUID)
    - `tag_id` (UUID, Foreign Key to tags)
    - `created_at` (Timestamp)

16. **writing_goals** - Writing goals and progress tracking
    - `id` (UUID, Primary Key)
    - `novel_id` (UUID, Foreign Key to novels)
    - `type` (daily/weekly/total)
    - `target` (INTEGER)
    - `current` (INTEGER)
    - `deadline` (Timestamp, nullable)
    - `created_at`, `updated_at` (Timestamps)

## Features

### Automatic Saving
- Changes are automatically saved to Supabase 2 seconds after you stop editing
- A "Saving..." indicator appears in the bottom-right corner during saves
- New novels are saved immediately

### Data Loading
- All novels are loaded from Supabase when the app starts
- A loading screen appears during initial data fetch

### Database Features
- **Cascading Deletes**: Deleting a novel automatically deletes all related data
- **Automatic Timestamps**: `updated_at` fields are automatically updated
- **Indexes**: Optimized indexes for fast queries
- **Row Level Security**: Currently set to allow all operations (you can restrict later)

## Configuration

Supabase credentials are stored in `config/supabase.ts`. In production, you should:
1. Move these to environment variables
2. Use `.env` file (and add it to `.gitignore`)
3. Consider implementing user authentication for multi-user support

## Security Notes

Currently, the database allows public read/write access. For production:
1. Implement Supabase Authentication
2. Add user_id columns to tables
3. Update RLS policies to restrict access by user
4. Use service role key for server-side operations only

## Database Management

### Viewing Your Data
You can view and manage your data through:
- Supabase Dashboard: https://supabase.com/dashboard
- Your project URL: https://wvxhittdnmvnobwonrex.supabase.co

### Running Migrations
Migrations are applied through the Supabase MCP server. The following migrations have been created:

**Initial Setup:**
1. `create_novels_table` - Initial schema creation
2. `setup_rls_policies` - Row Level Security setup
3. `fix_function_security` - Security fix for update function

**Professional Enhancements:**
4. `add_missing_updated_at_columns` - Added `updated_at` to `world_entries` and `territories`
5. `create_automatic_timestamp_triggers` - Created `update_updated_at_column()` function and triggers for all tables
6. `add_cascading_deletes` - Updated all foreign keys to use `ON DELETE CASCADE`
7. `add_performance_indexes` - Added GIN and composite indexes for optimized queries
8. `add_data_validation_constraints` - Added check constraints for data validation

### Backup Recommendations
- Supabase automatically backs up your database
- Consider exporting data periodically for additional safety
- Use Supabase's point-in-time recovery for production

## Troubleshooting

### If data doesn't load:
1. Check browser console for errors
2. Verify Supabase connection in `config/supabase.ts`
3. Check Supabase dashboard for connection issues

### If saves fail:
1. Check network connection
2. Verify RLS policies allow your operations
3. Check browser console for detailed error messages

## Database Functions & Triggers

### Automatic Timestamp Updates
The `update_updated_at_column()` function automatically updates the `updated_at` timestamp whenever a row is modified. Triggers are installed on:
- `novels`
- `chapters`
- `characters`
- `arcs`
- `world_entries`
- `territories`

### Data Validation
The database enforces data integrity at the schema level:
- **Chapter numbers** must be positive integers
- **Required text fields** (titles, names, content) cannot be empty
- **Enum fields** are restricted to valid values
- **Foreign keys** ensure referential integrity with cascading deletes

## Service Layer Enhancements

The `supabaseService.ts` has been enhanced with:
- **Pre-save validation**: Validates data before attempting to save
- **Better error handling**: Provides detailed error messages for constraint violations
- **Data sanitization**: Trims whitespace from text fields before saving
- **Comprehensive error logging**: Logs detailed error information for debugging

## Next Steps

1. **Add User Authentication**: Implement Supabase Auth for multi-user support
2. **Add Full-Text Search**: Implement PostgreSQL full-text search for chapters and world entries
3. **Add Real-time**: Use Supabase Realtime for collaborative editing
4. **Add Storage**: Use Supabase Storage for character portraits and images
5. **Add Backups**: Set up automated backup strategy
6. **Performance Monitoring**: Monitor query performance and optimize based on usage patterns
