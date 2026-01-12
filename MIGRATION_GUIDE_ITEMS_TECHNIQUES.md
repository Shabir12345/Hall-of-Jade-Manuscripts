# Items and Techniques System Migration Guide

This guide explains how to migrate your existing novel data from the old simple string-based items/skills system to the new comprehensive items and techniques system.

## Overview

The new system provides:
- **Smart Deduplication**: Automatically recognizes when the same item/technique appears across chapters
- **Rich Metadata**: Stores detailed information, powers, functions, and history
- **Type-Based Categorization**: Organizes items as Treasure, Equipment, Consumable, Essential
- **Archive System**: Tracks completed/unused items with automatic suggestions
- **Character Linking**: Links characters to canonical items/techniques with status tracking

## Migration Steps

### Step 1: Database Migration

1. **Backup your database** before proceeding!

2. Run the SQL migration script in your Supabase SQL Editor:
   ```sql
   -- Run: DATABASE_MIGRATION_ITEMS_TECHNIQUES.sql
   ```

   This creates the new tables:
   - `novel_items` - Canonical item registry per novel
   - `novel_techniques` - Canonical technique registry per novel
   - `character_item_possessions` - Character-item relationships with status
   - `character_technique_mastery` - Character-technique relationships with status

3. Verify the migration succeeded by checking that the new tables exist.

### Step 2: Application Code Update

The application code has already been updated. The new system:
- Maintains backward compatibility with old `skills` and `items` string arrays
- Automatically processes new items/techniques from chapter extractions
- Displays both old and new formats in the UI during transition

### Step 3: Data Migration (Optional)

If you want to migrate existing data from old format to new format, you can:

1. **Automatic Migration on Load**: The system will automatically create canonical items/techniques when old data is encountered.

2. **Manual Migration Script**: Use the migration script at `scripts/migrateItemsTechniques.ts`:
   ```typescript
   import { migrateNovelData } from './scripts/migrateItemsTechniques';
   
   // Migrate a single novel
   const migratedNovel = migrateNovelData(originalNovel);
   
   // Or migrate all novels
   const migratedNovels = novels.map(novel => migrateNovelData(novel));
   ```

### Step 4: Verify Migration

1. **Check Character Views**: Open the Characters view and verify items/techniques display correctly
2. **Test Chapter Generation**: Generate a new chapter and verify items/techniques are extracted properly
3. **Verify Deduplication**: Reference the same item in multiple chapters and verify it's recognized as the same item

## Backward Compatibility

The system maintains backward compatibility:
- Old `skills` and `items` string arrays are still supported
- Existing data will continue to work
- The UI displays both old and new formats
- Old format is automatically migrated when encountered

## Category Definitions

### Item Categories
- **Treasure**: Magical artifacts, powerful items (e.g., "Jade Slip", "Sword of Heaven")
- **Equipment**: Tools, weapons, armor (e.g., "Iron Sword", "Storage Ring")
- **Consumable**: Food, pills, talismans, one-time use (e.g., "Healing Pill", "Spirit Fruit")
- **Essential**: Basic necessities (e.g., "dried meat", "water skin", "torch")

### Technique Categories
- **Core**: Fundamental cultivation methods, signature moves (e.g., "Nine Heavens Divine Art")
- **Important**: Significant abilities, key skills (e.g., "Wind Sword Art", "Spirit Sense")
- **Standard**: Common techniques, widely used (e.g., "Basic Sword Art")
- **Basic**: Entry-level skills (e.g., "Qi Circulation", "Meditation")

### Technique Types
- **Cultivation**: Methods for advancing cultivation realm
- **Combat**: Battle techniques, attacks, defenses
- **Support**: Healing, buffs, utility abilities
- **Secret**: Hidden techniques, forbidden arts
- **Other**: Miscellaneous techniques

## Archive System

The archive system automatically suggests archiving items/techniques that haven't been referenced in 10+ chapters. You can:
- Manually archive items/techniques when story arcs complete
- Restore archived items/techniques if needed
- Set items as "lost" or "destroyed" when appropriate
- Set techniques as "forgotten" or "mastered"

## Troubleshooting

### Items/Techniques Not Appearing
- Check that the database migration was successful
- Verify that `novelItems` and `novelTechniques` are initialized in your novel state
- Check browser console for any errors

### Duplicate Items
- The fuzzy matching system should prevent duplicates
- If duplicates occur, manually merge them through the UI
- Check that `canonical_name` is being generated correctly

### Category Misclassification
- Categories are inferred from item/technique names during migration
- You can manually edit categories in the database or through the UI
- The AI extraction system learns from your manual categorizations

## Next Steps

After migration:
1. Review and correct any misclassified items/techniques
2. Add detailed descriptions, powers, and functions to important items
3. Use the archive system to keep your codex organized
4. The system will automatically improve deduplication as you use it
