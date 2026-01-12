# Items and Techniques System - Quick Reference Guide

## Database Status ✅

The database migration has been successfully applied and verified:
- All 4 new tables created and operational
- All indexes, constraints, and triggers properly configured
- Test insert successful (Jade Slip example)
- Ready for production use

## Core Features

### 1. Smart Deduplication
- **Fuzzy Matching**: Automatically recognizes "Jade Slip", "jade slip", "Jade-Slip" as the same item
- **Threshold**: 85% similarity for matching
- **Canonical Names**: Normalized names for consistent matching

### 2. Type-Based Categorization

**Items:**
- **Treasure**: Magical artifacts, powerful items (e.g., "Jade Slip", "Sword of Heaven")
- **Equipment**: Tools, weapons, armor (e.g., "Iron Sword", "Storage Ring")
- **Consumable**: Food, pills, talismans, one-time use (e.g., "Healing Pill", "Spirit Fruit")
- **Essential**: Basic necessities (e.g., "dried meat", "water skin", "torch")

**Techniques:**
- **Category** (importance):
  - **Core**: Fundamental cultivation methods, signature moves
  - **Important**: Significant abilities, key skills
  - **Standard**: Common techniques, widely used
  - **Basic**: Entry-level skills
- **Type** (function):
  - **Cultivation**: Methods for advancing cultivation realm
  - **Combat**: Battle techniques, attacks, defenses
  - **Support**: Healing, buffs, utility abilities
  - **Secret**: Hidden techniques, forbidden arts
  - **Other**: Miscellaneous techniques

### 3. Archive System
- **Automatic Detection**: Suggests archiving after 10+ chapters without reference
- **Manual Archive**: Click 📦 button on items/techniques in character view
- **Restore**: Click ↻ button on archived items/techniques
- **Status Tracking**: active, archived, lost, destroyed, forgotten, mastered

### 4. Rich Metadata
- **Powers/Functions**: Array of abilities (can grow across chapters)
- **History**: Chapter-by-chapter evolution log
- **First/Last Referenced**: Tracks chapter appearance
- **Description**: Detailed item/technique descriptions

## Usage Examples

### In Chapter Processing
Items and techniques are automatically extracted from chapters:
```typescript
// Automatically happens after chapter generation
// - Extracts items/techniques from chapter text
// - Matches against existing items/techniques
// - Creates new or updates existing
// - Links to characters
```

### Manual Operations
```typescript
import { findOrCreateItem, findOrCreateTechnique } from './services/itemTechniqueService';
import { getCharacterItems, searchItemsByName } from './utils/itemTechniqueHelpers';

// Find or create an item
const { item, wasCreated } = findOrCreateItem(
  'Jade Slip',
  existingItems,
  novelId,
  'Treasure',
  chapterNumber,
  'A mystical jade artifact',
  ['Stores cultivation techniques', 'Enhances comprehension']
);

// Get character's items
const characterItems = getCharacterItems(character, novelItems, 'active');

// Search items
const results = searchItemsByName(novelItems, 'jade');
```

## Helper Functions

### `utils/itemTechniqueHelpers.ts`
- `getCharacterItems()` - Get items by character and status
- `getCharacterTechniques()` - Get techniques by character and status
- `getItemsByCategory()` - Filter items by category
- `getTechniquesByCategory()` - Filter techniques by category/type
- `getItemOwners()` - Find all characters who possess an item
- `getTechniqueMasters()` - Find all characters who master a technique
- `getItemsInChapterRange()` - Find items referenced in chapter range
- `searchItemsByName()` - Fuzzy search for items
- `getItemsNeedingArchive()` - Find items ready for archiving

### `utils/itemTechniqueValidation.ts`
- `validateItemName()` - Validate item name format
- `validateTechniqueName()` - Validate technique name format
- `validateItemCategory()` - Validate item category
- `validateTechniqueCategory()` - Validate technique category
- `validateTechniqueType()` - Validate technique type
- `validateChapterNumber()` - Validate chapter number
- `validatePowersOrFunctions()` - Validate powers/functions array
- `validateDescription()` - Validate description

### `utils/itemTechniqueStats.ts`
- `getItemTechniqueStats()` - Get comprehensive statistics

## UI Features

### Character View
- Items grouped by category (Treasure, Equipment, Consumable, Essential)
- Techniques grouped by category (Core, Important, Standard, Basic)
- Hover tooltips with full details (powers, functions, history)
- Archive/restore buttons (📦 and ↻)
- Collapsible archived sections

### Archive Detection
- Runs automatically after each chapter
- Suggests archiving items/techniques not referenced in 10+ chapters
- Logs suggestions as system logs

## API Functions

### `services/itemTechniqueService.ts`
- `findOrCreateItem()` - Find existing item or create new
- `findOrCreateTechnique()` - Find existing technique or create new
- `updateItemLastReferenced()` - Update item's last referenced chapter
- `updateTechniqueLastReferenced()` - Update technique's last referenced chapter

### `services/archiveService.ts`
- `detectArchiveCandidates()` - Find items/techniques ready for archiving
- `archivePossession()` - Archive character's item possession
- `archiveMastery()` - Archive character's technique mastery
- `restorePossession()` - Restore archived item possession
- `restoreMastery()` - Restore archived technique mastery
- `markPossessionLost()` - Mark item as lost
- `markPossessionDestroyed()` - Mark item as destroyed
- `markMasteryForgotten()` - Mark technique as forgotten
- `markMasteryMastered()` - Mark technique as mastered

## Best Practices

1. **Let AI Extract**: The system automatically extracts items/techniques from chapters
2. **Manual Review**: Review extracted items/techniques after each chapter
3. **Archive Regularly**: Archive items/techniques when story arcs complete
4. **Use Categories**: Proper categorization improves organization
5. **Add Details**: Add powers/functions and descriptions for important items/techniques

## Database Queries

### Get all items for a novel
```sql
SELECT * FROM novel_items WHERE novel_id = '...' ORDER BY name;
```

### Get active possessions for a character
```sql
SELECT ci.*, ni.name, ni.category, ni.powers
FROM character_item_possessions ci
JOIN novel_items ni ON ci.item_id = ni.id
WHERE ci.character_id = '...' AND ci.status = 'active';
```

### Find items needing archiving
```sql
SELECT * FROM novel_items
WHERE novel_id = '...'
  AND last_referenced_chapter IS NOT NULL
  AND last_referenced_chapter < (SELECT MAX(number) FROM chapters WHERE novel_id = novel_items.novel_id) - 10;
```

### Search items by name (fuzzy)
```sql
SELECT * FROM novel_items
WHERE novel_id = '...'
  AND (name ILIKE '%jade%' OR canonical_name LIKE '%jade%');
```

## Troubleshooting

### Items Not Appearing
- Check that database migration was successful
- Verify `novelItems` and `novelTechniques` are initialized in novel state
- Check browser console for errors

### Duplicate Items
- The fuzzy matching system should prevent duplicates
- If duplicates occur, manually merge them
- Check that `canonical_name` is being generated correctly

### Archive Not Working
- Verify archive detection runs after chapter processing
- Check that `lastReferencedChapter` is being updated
- Review archive detection logs

## Performance Notes

- Indexes marked as "unused" initially (normal for new tables)
- They'll be used once queries start running
- Composite indexes optimized for common filter patterns
- Full-text search indexes ready for future search features
