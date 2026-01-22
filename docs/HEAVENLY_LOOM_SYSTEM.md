# The Heavenly Loom — Narrative Control System

A "God-Tier" narrative engine for managing story threads at scale (2,000+ chapters).

## Overview

The Heavenly Loom solves five hard problems in long-form fiction:

1. **Memory at Scale** — Threads are indexed by signature and tracked with physics
2. **Intent Recognition** — Clerk Agent parses narrative meaning, not just keywords
3. **Drift Prevention** — Payoff debt accumulates when threads are neglected
4. **Payoff Timing** — Physics model determines when threads enter "blooming" window
5. **Authorial Illusion** — Director outputs constraints, Writer maintains voice

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        HEAVENLY LOOM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   THREAD     │    │    CLERK     │    │   DIRECTOR   │       │
│  │   REGISTRY   │◄───│    AGENT     │◄───│    AGENT     │       │
│  │  (Supabase)  │    │  (Auditor)   │    │ (Scheduler)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                   │                   │                │
│         ▼                   ▼                   ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              THREAD PHYSICS ENGINE                    │       │
│  │  • Mass (karma_weight)  • Velocity (progression)      │       │
│  │  • Entropy (chaos)      • Gravity (pull to resolve)   │       │
│  │  • Payoff Debt          • Urgency Score               │       │
│  └──────────────────────────────────────────────────────┘       │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                  LOOM DASHBOARD                       │       │
│  │  • Health Panel    • Timeline    • Interventions      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Thread Physics Model

Every thread is treated as a physical object with:

| Property | Range | Description |
|----------|-------|-------------|
| `karma_weight` | 1-100 | Mass/importance. Higher = more gravitational pull |
| `velocity` | -10 to +10 | Progression rate. Negative = regressing |
| `entropy` | 0-100 | Chaos level. High = contradictions/vagueness |
| `payoff_debt` | 0+ | Accumulated reader expectation |

### Urgency Formula

```
Urgency = (distance × karma_weight) + payoff_debt + entropy
```

Where `distance` = current_chapter - last_mentioned_chapter

### Thread Categories

| Category | Description | Resolution Window |
|----------|-------------|-------------------|
| **SOVEREIGN** | Story-defining threads (main plot, MC journey) | 50-200 chapters |
| **MAJOR** | Arc-level threads (villain, major conflict) | 15-50 chapters |
| **MINOR** | Chapter-level flavor (side quests, minor NPCs) | 3-15 chapters |
| **SEED** | Mentioned, no obligation yet | 1-10 chapters |

### Thread Lifecycle

```
SEED → OPEN → ACTIVE → BLOOMING → CLOSED
                 ↓
              STALLED → ABANDONED (if unrecoverable)
```

| Status | Description |
|--------|-------------|
| `SEED` | Just mentioned, protected from early resolution |
| `OPEN` | Narrative obligation exists, tracking begins |
| `ACTIVE` | Regularly progressing, shaping scenes |
| `BLOOMING` | Payoff window open, prefer resolution |
| `STALLED` | Not addressed for N chapters, urgency increases |
| `CLOSED` | Resolved on-screen, archived |
| `ABANDONED` | Logically unresolved (intentional or not) |

## The Clerk Agent (Narrative Auditor)

After each chapter, the Clerk:

1. Parses the chapter for **narrative intent**, not just keywords
2. Compares against thread signatures
3. Decides if events **CREATE**, **PROGRESS**, **STALL**, or **RESOLVE** threads

### Clerk Rules

- **No threads for flavor** — Only create threads when there's a promise to readers
- **No resolution without criteria** — If `resolution_criteria` exists, it must be met
- **Distinguish real progress from fake**:
  - `INFO` = Just mentioned (increases payoff debt)
  - `ESCALATION` = Stakes raised materially (resets urgency)
  - `RESOLUTION` = Thread completed

### Clerk Output

```json
{
  "thread_updates": [
    {
      "signature": "REVENGE_SUN_FAMILY",
      "action": "UPDATE",
      "progress_type": "ESCALATION",
      "summary_delta": "MC discovered Sun Patriarch's hidden weakness",
      "participants": ["Chen Wei", "Sun Patriarch"],
      "urgency_score": 8,
      "logic_reasoning": "This materially advances the revenge thread..."
    }
  ],
  "consistency_warnings": ["Sun Family location contradicts Chapter 12"]
}
```

## The Director Agent (Narrative Scheduler)

Before each chapter, the Director:

1. Fetches threads with highest urgency
2. Computes which threads MUST be touched
3. Outputs **constraints only** (no prose)

### Director Rules

- Select 2-3 primary threads based on physics
- Determine required action for each: PROGRESS, ESCALATE, RESOLVE, FORESHADOW, TOUCH
- Block premature resolutions (check payoff horizon)
- Balance the chapter (don't stack all climaxes)

### Director Output

```
### CHAPTER DIRECTIVE

**Primary Goal:** Build tension for the auction arc climax

**Thread Anchors:**
1. **REV_SUN_FAMILY** — Required Action: ESCALATE
   - Sun Patriarch must make a move that threatens MC's plans
2. **MYS_ANCIENT_FORMATION** — Required Action: FORESHADOW
   - Subtle hint about the formation's true purpose

**Forbidden Outcomes:**
- Do NOT resolve the Sun Family revenge yet
- Do NOT reveal the Ancient Formation's secret

**Continuity Guardrails:**
- Required Tone: tense, foreboding
- Pacing: high intensity
- Target: ~3500 words
```

## Loom Dashboard

The visual command center for narrative control:

### Health Panel
- Thread cards with **pulse colors** (green/yellow/orange/red/gold)
- **Crack effects** for high entropy (visual distortion)
- **Gold glow** for blooming threads (payoff window open)

### Timeline View
- Vertical chapter timeline with animated thread lines
- Shows introduction, blooming, and resolution points
- Current chapter marker

### Physics View
- Detailed physics for each thread
- Mass, velocity, entropy, distance, gravity, urgency

### Interventions
- **Force Director Attention** — Ensure thread is addressed next chapter
- **Boost Karma Weight** — Increase thread importance
- **Mark Intentional Abandonment** — Remove from urgency tracking

## Database Schema

### New Columns on `story_threads`

```sql
ALTER TABLE story_threads 
ADD COLUMN signature TEXT UNIQUE,
ADD COLUMN category TEXT CHECK (category IN ('SOVEREIGN', 'MAJOR', 'MINOR', 'SEED')),
ADD COLUMN loom_status TEXT CHECK (loom_status IN ('SEED', 'OPEN', 'ACTIVE', 'BLOOMING', 'STALLED', 'CLOSED', 'ABANDONED')),
ADD COLUMN karma_weight INTEGER DEFAULT 50,
ADD COLUMN velocity INTEGER DEFAULT 0,
ADD COLUMN payoff_debt INTEGER DEFAULT 0,
ADD COLUMN entropy INTEGER DEFAULT 0,
ADD COLUMN first_chapter INTEGER,
ADD COLUMN last_mentioned_chapter INTEGER,
ADD COLUMN participants TEXT[],
ADD COLUMN resolution_criteria TEXT,
ADD COLUMN urgency_score INTEGER DEFAULT 0;
```

### New Tables

- `thread_mentions` — Every interaction with a thread
- `director_constraints` — Constraints issued by Director
- `clerk_audit_log` — Audit trail of Clerk analysis
- `loom_config` — Per-novel Loom configuration

## Usage

### Initialize Loom

```typescript
import { useLoomManagement } from '../hooks/useLoomManagement';

const {
  loomThreads,
  overallHealth,
  initializeLoom,
  runClerkAudit,
  generateDirective,
  forceAttention,
} = useLoomManagement(novelState);

// Convert existing threads
initializeLoom(novelState);
```

### After Chapter Generation

```typescript
// Run Clerk audit
const audit = await runClerkAudit(chapter, novelState);

// Audit results are automatically applied to threads
console.log(`${audit.threadsProgressed} threads progressed`);
console.log(`Warnings: ${audit.consistencyWarnings}`);
```

### Before Chapter Generation

```typescript
// Generate Director directive
const directive = await generateDirective(novelState, userIntent);

// Get formatted prompt for Writer
const prompt = getDirectivePrompt();
// Append this to the Writer's system prompt
```

### Manual Interventions

```typescript
// Force a thread to be addressed
forceAttention(threadId);

// Boost thread importance
boostKarma(threadId, 20);

// Mark as intentionally abandoned
markAbandoned(threadId, "Subsumed into larger conflict");
```

## Failure Modes

The Loom helps prevent:

| Failure | Detection | Prevention |
|---------|-----------|------------|
| **Thread Explosion** | Too many SEED threads created | Limit per chapter, require justification |
| **Fake Progress** | INFO mentions pile up without ESCALATION | Payoff debt accumulates |
| **Premature Resolution** | Thread resolved before blooming | Forbidden outcome constraints |
| **Forgotten Threads** | High distance, low velocity | Stall detection, urgency boost |

## Files

### Services
- `services/loom/threadPhysicsEngine.ts` — Core physics calculations
- `services/loom/loomClerkService.ts` — Narrative auditing
- `services/loom/loomDirectorService.ts` — Constraint generation

### Types
- `types/loom.ts` — All Loom type definitions

### Components
- `components/loom/LoomDashboard.tsx` — Main dashboard
- `components/loom/ThreadHealthPanel.tsx` — Thread health visualization
- `components/loom/LoomTimeline.tsx` — Chapter timeline
- `components/loom/ThreadPhysicsCard.tsx` — Physics display
- `components/loom/InterventionControls.tsx` — Manual controls
- `components/loom/PayoffDebtMeter.tsx` — Debt visualization

### Hooks
- `hooks/useLoomManagement.ts` — State management hook

### Database
- `DATABASE_MIGRATION_HEAVENLY_LOOM.sql` — Migration script

## Configuration

```typescript
const DEFAULT_LOOM_CONFIG = {
  enabled: true,
  maxNewThreadsPerChapter: 3,
  payoffDebtMultiplier: 1.0,
  entropyDecayRate: 0.1,
  velocityMomentum: 0.8,
  stallThresholdChapters: 5,
  bloomThresholdKarma: 70,
  directorConstraintsPerChapter: 3,
  protectedThreadIds: [],
};
```

## Integration with Chapter Generation

The Loom integrates at two points:

1. **Pre-generation**: Director generates constraints → appended to Writer prompt
2. **Post-generation**: Clerk audits chapter → updates thread state

This creates a feedback loop where threads are automatically tracked and the narrative is guided toward satisfying payoffs.
