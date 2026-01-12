# Automation & Trust Improvements

This document outlines the comprehensive automation and trust-building features added to the Hall of Jade Manuscripts application.

## Overview

The app now has significantly enhanced automation capabilities that increase trust through:
- **Automatic connections** between entities
- **Trust scores** and confidence ratings
- **Gap detection** before generation
- **Preview system** for extractions
- **Proactive validation** and suggestions

## New Services

### 1. Auto-Connection Service (`services/autoConnectionService.ts`)

Automatically connects and links entities across the novel:

#### Features:
- **Character-to-Scene Linking**: Automatically detects which characters appear in which scenes based on text content
- **Character-to-Arc Association**: Links characters to arcs based on chapter appearances
- **Item/Technique-to-Arc Association**: Associates items and techniques discovered during an arc with that arc
- **Relationship Detection**: Automatically detects potential relationships when characters appear together multiple times
- **Antagonist-to-Arc Linking**: Links antagonists to active arcs when they appear

#### Confidence Scoring:
Each connection gets a confidence score (0-1):
- **0.8+ (High)**: Automatically applied
- **0.6-0.8 (Medium)**: Suggested for review
- **< 0.6 (Low)**: Requires manual review

### 2. Trust Service (`services/trustService.ts`)

Builds trust through previews, confidence scores, and validation:

#### Features:
- **Extraction Preview**: Shows what will be extracted before applying changes
- **Confidence Scores**: Each extraction gets a confidence rating
- **Trust Score Calculation**: Overall trust score (0-100) for the entire extraction
- **Actionable Feedback**: Clear warnings and suggestions for each extraction
- **Auto-Apply Recommendations**: Identifies extractions that can be safely auto-applied

#### Trust Score Components:
- **Extraction Quality** (35%): Average confidence of all extractions
- **Connection Quality** (25%): Quality of auto-connections
- **Data Completeness** (25%): Missing required fields and warnings
- **Consistency Score** (15%): Inconsistencies and errors

#### Trust Levels:
- **90-100**: Excellent - All extractions have high confidence, can be safely automated
- **75-89**: Good - Most extractions are reliable, review low-confidence items
- **60-74**: Moderate - Some extractions need review, check warnings
- **< 60**: Low - Many extractions need manual review

### 3. Gap Detection Service (`services/gapDetectionService.ts`)

Proactively detects gaps and missing connections before generation:

#### Detected Gaps:
- **Missing Protagonist**: No protagonist marked
- **Orphaned Characters**: Characters with no relationships
- **Orphaned Items/Techniques**: Items/techniques without character ownership
- **Missing Relationships**: Characters appearing together without defined relationships
- **Characters Without Arc Association**: Characters in arc chapters not associated with arc
- **Antagonists Without Arc**: Active antagonists not associated with active arc
- **Incomplete World Entries**: World entries with minimal content
- **Orphaned Scenes**: Scenes without character mentions

#### Severity Levels:
- **Critical**: Must be addressed before generation
- **Warning**: Should be reviewed to improve coherence
- **Info**: Helpful suggestions for better organization

## Integration Points

### Pre-Generation Analysis
Before generating a new chapter:
1. Gap analysis runs to detect missing connections
2. Suggestions are provided to improve story structure
3. Critical issues are flagged before generation

### Post-Extraction Analysis
After chapter extraction:
1. Extraction preview is generated with confidence scores
2. Auto-connections are analyzed and high-confidence ones are applied
3. Trust score is calculated and logged
4. Warnings and suggestions are provided

### Enhanced Scene Creation
Scenes are now automatically created with:
- Better content analysis and paragraph splitting
- Automatic character detection and linking
- Character appearance logging per scene
- Improved scene boundaries detection

## Trust-Building Features

### 1. Transparency
- All extractions are previewed before applying
- Confidence scores are shown for each action
- Clear explanations of why connections are made

### 2. Control
- High-confidence actions (0.8+) are automatically applied
- Medium-confidence (0.6-0.8) are suggested
- Low-confidence (< 0.6) require manual review

### 3. Feedback
- Trust scores provide overall quality assessment
- Specific warnings identify issues
- Actionable suggestions guide improvements

### 4. Validation
- Pre-generation validation catches issues early
- Post-extraction validation ensures quality
- Consistency checks maintain story coherence

## Usage Examples

### Example 1: Auto-Connection
When a chapter is generated:
- Characters mentioned in scenes are automatically linked
- Items discovered during an active arc are associated with that arc
- Characters appearing together multiple times get relationship suggestions

### Example 2: Trust Score
After extraction:
```
✅ High trust score: 85/100 - All extractions are reliable
✨ Auto-connected 5 entity(ies) with high confidence
  • Character → Scene (character-scene)
  • Item → Arc (item-arc)
  • Technique → Arc (technique-arc)
```

### Example 3: Gap Detection
Before generation:
```
⚠️ Critical issues detected:
  - No protagonist is marked. Every novel needs a protagonist.
  - No active antagonists. Consider introducing opposition.

✨ 3 connection(s) can be automatically made:
  - Characters "Alex" and "Max" appear together in 3 chapters but have no defined relationship
```

## Benefits

1. **Increased Trust**: Users can see what will happen before it happens
2. **Reduced Manual Work**: High-confidence connections are automatic
3. **Better Organization**: Proactive gap detection maintains story coherence
4. **Quality Assurance**: Validation ensures data integrity
5. **Transparency**: Confidence scores explain automation decisions

## Future Enhancements

Potential improvements for even better automation:
- **Undo/Redo System**: Ability to undo automated connections
- **Learning System**: Remember user corrections to improve confidence scores
- **Batch Operations**: Apply multiple high-confidence actions at once
- **Custom Rules**: User-defined rules for auto-connections
- **Visual Connection Graph**: See entity relationships visually
