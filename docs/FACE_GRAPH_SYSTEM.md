# Face Graph System

## Overview

The Face Graph is a social network memory system specifically designed for Cultivation novels. It tracks "Face" (social standing) and karma in a way that prevents "Generic NPC Syndrome" - where every character becomes part of a web of blood feuds, favors, and social obligations.

## Key Concepts

### Face (社会面子)
Social standing/reputation in the cultivation world. Characters have Face scores across categories:
- **Martial**: Combat reputation
- **Scholarly**: Knowledge/wisdom reputation
- **Political**: Influence/power reputation
- **Moral**: Good/evil reputation
- **Mysterious**: Unknown/feared reputation
- **Wealth**: Material reputation

Face tiers: Nobody → Known → Renowned → Famous → Legendary → Mythical

### Karma (因果)
The weight of actions (good/bad) that accumulate over time. When the MC kills a Young Master, that karma is tracked and affects how connected NPCs will react.

### Ripple Effects
When a karmic action occurs, it "ripples" through the social network:
- Killing a disciple affects the master
- The master's sect members also become hostile
- Even the sect leader hundreds of chapters later will remember

### Blood Feuds
Multigenerational vendettas between clans, sects, or individuals. These track:
- Intensity (0-100)
- All members on each side
- Escalation history
- Resolution conditions

### Debts
Favors owed that must be repaid. Life-saving debts, treasure gifts, etc.

## Installation

### 1. Run Database Migration

Open your Supabase SQL Editor and run:

```sql
-- Copy the entire contents of DATABASE_MIGRATION_FACE_GRAPH.sql
```

This creates 10 tables:
- `face_profiles` - Character Face/reputation data
- `face_titles` - Titles and epithets earned
- `face_accomplishments` - Major reputation-boosting events
- `face_shames` - Major reputation losses
- `karma_events` - Individual karmic actions
- `social_links` - Relationship network
- `karma_ripples` - Ripple effects from actions
- `blood_feuds` - Multigenerational vendettas
- `face_debts` - Favors owed
- `face_graph_config` - Per-novel configuration

### 2. Import Services

The Face Graph services are located in `services/faceGraph/`:

```typescript
import {
  // Main service functions
  createFaceProfile,
  recordKarmaEvent,
  upsertSocialLink,
  createBloodFeud,
  createFaceDebt,
  
  // Karma calculation
  calculateKarmaWeight,
  
  // Ripple analysis
  analyzeRippleEffects,
  queryConnectionToWronged,
  analyzeActionConsequences,
  
  // Context for chapter generation
  generateFaceGraphContext,
  
  // Social network queries
  findMostInfluentialCharacters,
  findShortestPath,
  detectSocialClusters,
  findAllEnemies,
  findAllAllies,
} from './services/faceGraph';
```

## Usage Examples

### Recording a Karma Event

When the MC kills a Young Master:

```typescript
import { recordKarmaEvent } from './services/faceGraph';

const event = await recordKarmaEvent(
  novelId,
  mcId,           // actor
  'Wei Wuxian',   // actor name
  youngMasterId,  // target
  'Zhang Wei',    // target name
  'kill',         // action type
  50,             // chapter number
  chapterId,
  'Killed Zhang Wei after he tried to steal the Heavenly Flame',
  {
    severity: 'major',
    wasWitnessed: true,
    witnessIds: ['witness1', 'witness2'],
  }
);
```

### Querying NPC Connections to Wronged Characters

Before an NPC appears in a chapter, check their connection to MC's victims:

```typescript
import { queryConnectionToWronged } from './services/faceGraph';

const connectionQuery = await queryConnectionToWronged(novelId, npcId, mcId);

console.log(connectionQuery);
// {
//   npcId: '...',
//   npcName: 'Sect Leader Zhang',
//   directConnections: [{
//     wrongedCharacterId: '...',
//     wrongedCharacterName: 'Zhang Wei',
//     connectionType: 'child',
//     karmaSeverity: 'major',
//     ...
//   }],
//   calculatedThreatLevel: 'extreme',
//   threatReasons: ['Directly connected to 1 wronged character'],
//   potentialStoryHooks: ['Sect Leader Zhang may seek revenge for death of child']
// }
```

### Getting Chapter Context

When generating a chapter, get the Face Graph context:

```typescript
import { generateFaceGraphContext } from './services/faceGraph';

const context = await generateFaceGraphContext(
  novelState,
  ['npc1', 'npc2', 'mc'],  // characters in this chapter
  currentChapterNumber,
  mcId
);

// context.formattedContext contains the full AI-ready context block
// Include this in your chapter generation prompt
```

### Analyzing Consequences Before Action

Before the MC takes a major action:

```typescript
import { analyzeActionConsequences } from './services/faceGraph';

const consequences = await analyzeActionConsequences(
  novelId,
  mcId,
  targetId,
  'kill',      // proposed action
  'severe'     // severity
);

console.log(consequences.narrativeSummary);
// "kill of severe severity against Zhang Wei, will affect 5 directly 
//  connected characters, creating 3 potential future threats, and 
//  likely triggering 1 blood feud(s)."
```

## Integration with Chapter Generation

Add the Face Graph context to your prompt building:

```typescript
// In your prompt builder
const faceGraphContext = await generateFaceGraphContext(
  novelState,
  charactersInChapter,
  chapterNumber,
  protagonistId
);

const prompt = `
${existingContext}

${faceGraphContext.formattedContext}

Generate chapter ${chapterNumber}...
`;
```

The context includes:
- **Unresolved Karma**: NPCs who have grudges against the MC
- **Active Blood Feuds**: Ongoing vendettas affecting present characters
- **Unpaid Debts**: Favors that could be called in
- **Pending Ripples**: Consequences that might manifest
- **NPC Threat Assessment**: How dangerous present NPCs are

## Karma Action Types

| Action | Base Karma | Polarity |
|--------|-----------|----------|
| kill | 80 | negative |
| exterminate_clan | 100 | negative |
| destroy_sect | 95 | negative |
| cripple_cultivation | 85 | negative |
| betray | 70 | negative |
| enslave | 75 | negative |
| curse | 60 | negative |
| humiliate | 50 | negative |
| steal | 40 | negative |
| abandon | 55 | negative |
| defeat | 30 | negative |
| offend | 15 | negative |
| save | 60 | positive |
| restore_cultivation | 70 | positive |
| liberate | 55 | positive |
| bless | 50 | positive |
| protect | 45 | positive |
| elevate_status | 45 | positive |
| honor | 40 | positive |
| gift | 35 | positive |
| spare | 30 | positive |
| avenge | 50 | neutral |

## Configuration

Each novel can have its own Face Graph configuration:

```typescript
import { saveFaceGraphConfig } from './services/faceGraph';

await saveFaceGraphConfig(novelId, {
  enabled: true,
  autoCalculateRipples: true,
  maxRippleDegrees: 3,           // How far ripples travel
  rippleKarmaThreshold: 30,      // Min karma to trigger ripples
  karmaDecayPerChapter: 0.99,    // 1% decay per chapter
  autoExtractKarma: true,        // Auto-extract from chapter content
  protectedCharacterIds: [mcId], // Characters protected from negative effects
});
```

## Social Network Queries

### Find Most Influential Characters

```typescript
const influential = await findMostInfluentialCharacters(novelId, 10);
// Returns characters sorted by influence score
```

### Find Shortest Path Between Characters

```typescript
const path = await findShortestPath(novelId, char1Id, char2Id);
// Returns: { found: true, path: [...], pathLength: 3 }
```

### Detect Social Clusters

```typescript
const clusters = await detectSocialClusters(novelId);
// Returns groups of closely connected characters
```

### Find All Enemies/Allies

```typescript
const enemies = await findAllEnemies(novelId, characterId);
const allies = await findAllAllies(novelId, characterId);
```

## Best Practices

1. **Record karma events as they happen** - Don't wait until later
2. **Check NPC connections before major scenes** - Use `queryConnectionToWronged`
3. **Include Face Graph context in prompts** - Let AI know about grudges
4. **Use consequence analysis for plot planning** - See ripple effects before committing
5. **Protect key characters** - Add protagonist to `protectedCharacterIds`

## Files

- `types/faceGraph.ts` - All type definitions
- `services/faceGraph/index.ts` - Module exports
- `services/faceGraph/faceGraphService.ts` - Main CRUD operations
- `services/faceGraph/karmaCalculator.ts` - Karma weight calculations
- `services/faceGraph/rippleAnalyzer.ts` - Ripple effect analysis
- `services/faceGraph/faceGraphContext.ts` - Context generation
- `services/faceGraph/socialNetworkQueries.ts` - Graph queries
- `DATABASE_MIGRATION_FACE_GRAPH.sql` - Database migration
