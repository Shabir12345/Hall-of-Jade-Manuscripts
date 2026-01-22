# Narrative Forensics System (Akasha Recall)

A professional-grade system for excavating forgotten plot threads and weaving them back into the narrative as if they were planned from Day 1.

## Overview

The Narrative Forensics System uses a **Two-Pass Forensic Logic** to discover and recover forgotten narrative elements:

1. **Pass 1: Discovery** - The Archeologist Agent scans chapter content for "Narrative Seeds" (loose ends)
2. **Pass 2: Trace-Forward** - Vector search checks if these seeds appear in subsequent chapters

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOOM EXCAVATOR UI                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Scan Zone   │  │Evidence Wall │  │   Web of Fate View   │  │
│  │  (Range)     │  │ (Polaroids)  │  │    (Timeline)        │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXCAVATION SERVICE                           │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │  Archeologist Agent  │───▶│    Trace-Forward Engine     │   │
│  │  (Gemini Flash)      │    │    (Pinecone Vector DB)     │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DIRECTOR INTEGRATION                           │
│  ┌──────────────────────┐    ┌─────────────────────────────┐   │
│  │  Recovery Directives │───▶│    Priority Multiplier      │   │
│  │  (Reintroduction)    │    │    (Force into chapters)    │   │
│  └──────────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Types (`types/narrativeForensics.ts`)

- **NarrativeSeed** - A discovered plot element that may have been forgotten
- **NarrativeSeedType** - Categories: `unanswered_question`, `unused_item`, `missing_npc`, `broken_promise`, `unresolved_conflict`, `forgotten_technique`, `abandoned_location`, `dangling_mystery`, `chekhov_gun`
- **RecoveredThread** - A seed that has been approved and converted to a story thread
- **NarrativeDebtBreakdown** - Calculated debt score: D = Σ(Hook × Weight)

### 2. Archeologist Agent (`services/narrativeForensics/archeologist.ts`)

The AI agent that scans chapter content for narrative seeds:

```typescript
const result = await runArcheologistAgent(chapter, novelState, existingSeeds);
// Returns: { seeds: NarrativeSeed[], reasoning: string[], warnings: string[] }
```

**What it looks for:**
- Unanswered questions in dialogue
- Items introduced but never used (Chekhov's Gun)
- Named NPCs who disappeared
- Promises made but not fulfilled
- Conflicts started but not concluded
- Techniques mentioned but never used again
- Locations set up but never revisited
- Mysteries hinted at but not explored

### 3. Excavation Service (`services/narrativeForensics/excavationService.ts`)

Orchestrates the two-pass forensic logic:

```typescript
const result = await runExcavation(novelState, {
  novelId: novelState.id,
  startChapter: 1,
  endChapter: 10,
}, config, onProgress);
```

**Features:**
- Batch processing with progress callbacks
- Vector search integration for trace-forward
- Neglect score calculation
- Narrative debt computation

### 4. Director Integration (`services/narrativeForensics/directorIntegration.ts`)

Integrates recovered threads with the Director Agent:

```typescript
const payload = createRecoveryDirectives(recoveredThreads, novelState);
const promptText = formatRecoveryDirectivesForPrompt(payload);
```

**Priority Handling:**
- Approved threads get `priority_multiplier = 2.0`
- Critical threads (50+ chapters forgotten) get `3.0x`
- Forces threads into next 3 chapters for reintroduction

### 5. UI Component (`components/LoomExcavator.tsx`)

Professional "Archeology Dashboard" with:

- **Scan Zone** - Select chapter range for excavation
- **Evidence Wall** - Polaroid-style cards with original quotes
- **Web of Fate View** - Visual timeline showing the "gap"

### 6. React Hook (`hooks/useNarrativeForensics.ts`)

```typescript
const { state, actions, computed } = useNarrativeForensics(novelState, onThreadRecovered);

// Actions
await actions.runScan(1, 10);
await actions.approveSeed(seed);
actions.rejectSeed(seed);

// Computed
computed.activeSeeds;
computed.staleSeeds;
computed.criticalSeeds;
computed.recommendations;
computed.hasHighDebt;
```

## Database Schema

Run the migration in `DATABASE_MIGRATION_NARRATIVE_FORENSICS.sql`:

```sql
-- New fields on story_threads table
ALTER TABLE story_threads 
ADD COLUMN is_recovered BOOLEAN DEFAULT FALSE,
ADD COLUMN historical_evidence JSONB,
ADD COLUMN neglect_score INTEGER DEFAULT 0,
ADD COLUMN priority_multiplier DECIMAL(3,2) DEFAULT 1.0;

-- New tables
CREATE TABLE narrative_seeds (...);
CREATE TABLE excavation_scans (...);
CREATE TABLE recovered_thread_history (...);
```

## Narrative Debt Formula

```
D = Σ(Hook_unresolved × Weight × NeglectMultiplier)

Where:
- Weight varies by seed type (broken_promise = 2.5, chekhov_gun = 1.8, etc.)
- NeglectMultiplier = 1 + (neglectScore / 50)
```

**Thresholds:**
- Warning: 10 chapters without mention
- Stale: 20 chapters
- Critical: 50 chapters
- Forgotten: 100 chapters

## Usage

### Basic Scan

```typescript
import { LoomExcavator } from './components/LoomExcavator';

<LoomExcavator
  novelState={novelState}
  onSeedApproved={(seed, threadId) => {
    // Add thread to novel state
  }}
  onSeedRejected={(seed) => {
    // Log rejection
  }}
  onScanComplete={(result) => {
    console.log(`Found ${result.seeds.length} seeds`);
    console.log(`Narrative Debt: ${result.narrativeDebt.weightedDebtScore}`);
  }}
/>
```

### Auto-Trigger Check

```typescript
import { shouldTriggerAutoRecall } from './services/narrativeForensics';

const { shouldTrigger, reason, urgency } = shouldTriggerAutoRecall(
  novelState,
  currentDebtBreakdown
);

if (shouldTrigger) {
  console.log(`Auto-recall recommended: ${reason}`);
}
```

### Director Integration

```typescript
import { 
  createRecoveryDirectives, 
  formatRecoveryDirectivesForPrompt 
} from './services/narrativeForensics';

const payload = createRecoveryDirectives(recoveredThreads, novelState);
const promptAddition = formatRecoveryDirectivesForPrompt(payload);

// Add to chapter generation prompt
const fullPrompt = basePrompt + '\n\n' + promptAddition;
```

## View Type

Added `'narrative-forensics'` to `ViewType` in `types.ts`.

## Files Created

| File | Purpose |
|------|---------|
| `types/narrativeForensics.ts` | Type definitions |
| `services/narrativeForensics/archeologist.ts` | AI agent for seed discovery |
| `services/narrativeForensics/excavationService.ts` | Two-pass forensic logic |
| `services/narrativeForensics/directorIntegration.ts` | Director Agent integration |
| `services/narrativeForensics/index.ts` | Module exports |
| `components/LoomExcavator.tsx` | UI component |
| `hooks/useNarrativeForensics.ts` | React hook |
| `DATABASE_MIGRATION_NARRATIVE_FORENSICS.sql` | Database schema |

## Integration Points

1. **Chapter Generation** - Add recovered thread directives to prompt
2. **Director Agent** - Priority multiplier for recovered threads
3. **Story Threads View** - Display recovered threads with special styling
4. **Dashboard** - Show narrative debt score and recommendations
