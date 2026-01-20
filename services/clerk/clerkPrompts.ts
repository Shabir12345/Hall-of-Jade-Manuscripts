/**
 * Clerk Agent Prompts
 * 
 * Gemini-optimized system prompts for the Heavenly Record-Keeper.
 * Designed for long-context reasoning with structured JSON output.
 */

import { LoreBible } from '../../types/loreBible';
import { Chapter, NovelState } from '../../types';

/**
 * The main system prompt for the Clerk agent
 */
export const CLERK_SYSTEM_PROMPT = `
### ROLE: The Heavenly Record-Keeper (Narrative State Auditor)

You are a senior continuity editor and state-engine manager specializing in Cultivation (Xianxia/Wuxia) fiction. Your sacred duty is to read the LATEST_CHAPTER and update the CURRENT_LORE_BIBLE (JSON) to ensure absolute narrative consistency across thousands of chapters.

### CORE PRINCIPLES:

1. **Truth Over Inference**: Only record what is EXPLICITLY stated or clearly implied in the chapter text. Never hallucinate details that aren't present.

2. **Delta Format**: Return ONLY what has CHANGED. Do not repeat unchanged state.

3. **Chain-of-Analysis**: Think step-by-step through each audit category before generating updates.

4. **Conservative Updates**: When uncertain, flag it in observations rather than making questionable updates.

### AUDIT CATEGORIES:

#### 1. CULTIVATION AUDIT
- Did the protagonist (or key NPCs) break through to a new realm?
- Did anyone lose cultivation due to injury, curse, or backlash?
- Were there signs of bottleneck, instability, or approaching breakthrough?
- Note the EXACT wording used (e.g., "entered Middle Nascent Soul" vs "approached breakthrough")

#### 2. INVENTORY TRACKING
Track EVERY item mentioned:
- GAINED: Pills received, treasures found, artifacts given
- CONSUMED: Pills eaten, talismans used, spirit stones spent
- LOST: Items destroyed, stolen, or given away
- UPGRADED: Equipment refined or enhanced

Be precise about quantities when mentioned (e.g., "ate 2 of his 5 Qi Pills" → consumed: 2, remaining should be 3)

#### 3. KARMIC TIES (Relationships)
Identify changes in relationships:
- Did a neutral party become an ally or enemy?
- Did trust increase or decrease?
- Were new debts created (life debts, revenge vows, promises)?
- Were old debts resolved?

Use the relationship spectrum: Sworn Enemy → Enemy → Rival → Neutral → Acquaintance → Ally → Sworn Brother

#### 4. THREAD MANAGEMENT
- NEW THREADS: Mysteries introduced, secrets hinted, quests started
- PROGRESSED: Existing plots advanced, clues revealed
- RESOLVED: Threads concluded, promises fulfilled
- FORESHADOWED: Future events hinted at

### OUTPUT RULES:

1. Return ONLY a valid JSON object matching the ClerkDelta schema
2. Include an "updates" key for changed fields
3. Include an "observations" key with your reasoning
4. DO NOT hallucinate - if the text says "He looked at his sword," do not assume he bought a new one
5. When in doubt, add a continuityFlag warning rather than making an uncertain update
6. Keep observations concise but informative

### CONFIDENCE LEVELS:

Rate your confidence for each update:
- HIGH (0.9+): Explicit statement in text ("broke through to Core Formation")
- MEDIUM (0.7-0.9): Strong implication ("his dantian expanded, golden light solidified")
- LOW (0.5-0.7): Possible interpretation (flag in observations instead of updating)
- SKIP (<0.5): Too uncertain to include
`;

/**
 * Build the user prompt with the Lore Bible and chapter content
 */
export function buildClerkUserPrompt(
  loreBible: LoreBible,
  chapter: Chapter,
  novelState: NovelState
): string {
  // Format the Lore Bible as compact JSON
  const loreBibleJson = JSON.stringify(loreBible, null, 2);
  
  // Get chapter content (limit to reasonable size)
  const chapterContent = chapter.content.substring(0, 25000); // ~6000 tokens max
  
  // Build context about active threads for better matching
  const activeThreadsContext = novelState.storyThreads
    ?.filter(t => t.status === 'active')
    .slice(0, 20)
    .map(t => `- "${t.title}" (${t.type}): ${t.description?.substring(0, 100) || 'No description'}`)
    .join('\n') || 'No active threads';

  // Build character list for relationship matching
  const characterList = novelState.characterCodex
    .slice(0, 30)
    .map(c => `- ${c.name} (${c.status}, ${c.currentCultivation || 'Unknown level'})`)
    .join('\n');

  return `
=== CURRENT LORE BIBLE ===
${loreBibleJson}

=== ACTIVE STORY THREADS (for matching) ===
${activeThreadsContext}

=== CHARACTER ROSTER (for relationship matching) ===
${characterList}

=== LATEST CHAPTER (Chapter ${chapter.number}: "${chapter.title}") ===
${chapterContent}

=== YOUR TASK ===

Analyze the chapter above and produce a JSON delta update for the Lore Bible.

Follow the Chain-of-Analysis approach:

STEP 1 - CULTIVATION AUDIT:
Think: What cultivation-related events occurred? Any breakthroughs, injuries, or power changes?

STEP 2 - INVENTORY AUDIT:
Think: What items were gained, lost, consumed, or upgraded? Be precise about quantities.

STEP 3 - KARMIC TIES AUDIT:
Think: How did relationships change? Any new debts or resolved obligations?

STEP 4 - THREAD AUDIT:
Think: Were any story threads introduced, progressed, or resolved?

After your analysis, return ONLY a JSON object with this structure:

{
  "updates": {
    "protagonist": { /* only include if protagonist state changed */ },
    "characters": [ /* only include characters whose state changed */ ],
    "worldState": { /* only include if world state changed */ },
    "narrativeAnchors": { /* only include if narrative anchors changed */ },
    "activeConflicts": [ /* only include conflicts that changed */ ],
    "karmaDebts": [ /* only include debts that changed */ ],
    "powerSystem": { /* only include if power system info changed */ }
  },
  "observations": {
    "reasoning": [
      "Step 1: [Your cultivation audit reasoning]",
      "Step 2: [Your inventory audit reasoning]",
      "Step 3: [Your karmic ties reasoning]",
      "Step 4: [Your thread management reasoning]"
    ],
    "warnings": [ /* Any potential consistency issues */ ],
    "continuityFlags": [ /* Flags for attention */ ]
  }
}

Remember: Only include fields that ACTUALLY CHANGED based on this chapter. Empty objects or arrays should be omitted entirely.
`;
}

/**
 * Build a minimal prompt for quick updates (less thorough but faster)
 */
export function buildQuickClerkPrompt(
  loreBible: LoreBible,
  chapter: Chapter
): string {
  // Compact Lore Bible (only protagonist and recent state)
  const compactBible = {
    protagonist: loreBible.protagonist,
    asOfChapter: loreBible.asOfChapter,
    narrativeAnchors: loreBible.narrativeAnchors,
    activeConflicts: loreBible.activeConflicts.slice(0, 3),
  };

  return `
=== CURRENT STATE (Chapter ${loreBible.asOfChapter}) ===
${JSON.stringify(compactBible, null, 2)}

=== NEW CHAPTER ${chapter.number}: "${chapter.title}" ===
${chapter.content.substring(0, 15000)}

=== QUICK AUDIT ===

Scan the chapter for:
1. Cultivation changes (breakthroughs, injuries)
2. Important items gained/lost
3. Major relationship changes
4. Plot developments

Return a JSON delta with only SIGNIFICANT changes. Skip minor details.

{
  "updates": { /* significant changes only */ },
  "observations": {
    "reasoning": ["Quick scan summary"],
    "warnings": [],
    "continuityFlags": []
  }
}
`;
}

/**
 * Validation prompt to double-check a delta before applying
 */
export function buildValidationPrompt(
  loreBible: LoreBible,
  delta: unknown,
  chapter: Chapter
): string {
  return `
=== VALIDATION TASK ===

A Clerk audit produced the following delta. Please validate it against the original chapter.

=== PROPOSED DELTA ===
${JSON.stringify(delta, null, 2)}

=== RELEVANT CHAPTER EXCERPT ===
${chapter.content.substring(0, 10000)}

=== CURRENT LORE BIBLE STATE ===
Protagonist: ${loreBible.protagonist.identity.name} at ${loreBible.protagonist.cultivation.realm} - ${loreBible.protagonist.cultivation.stage}

=== VALIDATION CHECKLIST ===

For each update in the delta, verify:
1. Is this change EXPLICITLY supported by the chapter text?
2. Does this contradict existing Lore Bible state without justification?
3. Are quantities/levels accurate?
4. Are character names spelled correctly?

Return:
{
  "valid": true/false,
  "issues": [
    { "field": "path.to.field", "issue": "description", "severity": "warning|error" }
  ],
  "suggestions": ["any corrections needed"]
}
`;
}

/**
 * Format the Lore Bible for inclusion in prompts (compact version)
 */
export function formatLoreBibleForClerk(bible: LoreBible): string {
  const sections: string[] = [];

  sections.push(`[LORE BIBLE - Chapter ${bible.asOfChapter}]`);
  
  // Protagonist
  sections.push(`\nPROTAGONIST: ${bible.protagonist.identity.name}`);
  sections.push(`  Cultivation: ${bible.protagonist.cultivation.realm} (${bible.protagonist.cultivation.stage})`);
  sections.push(`  Sect: ${bible.protagonist.identity.sect}`);
  if (bible.protagonist.identity.aliases.length > 0) {
    sections.push(`  Aliases: ${bible.protagonist.identity.aliases.join(', ')}`);
  }
  if (bible.protagonist.techniques.length > 0) {
    sections.push(`  Techniques: ${bible.protagonist.techniques.map(t => `${t.name}(${t.masteryLevel})`).join(', ')}`);
  }
  if (bible.protagonist.inventory.equipped.length > 0) {
    sections.push(`  Equipped: ${bible.protagonist.inventory.equipped.map(i => i.name).join(', ')}`);
  }
  if (bible.protagonist.inventory.storageRing.length > 0) {
    sections.push(`  Storage: ${bible.protagonist.inventory.storageRing.map(i => i.name).join(', ')}`);
  }

  // World State
  sections.push(`\nWORLD STATE:`);
  sections.push(`  Location: ${bible.worldState.currentLocation}`);
  sections.push(`  Realm: ${bible.worldState.currentRealm}`);
  sections.push(`  Situation: ${bible.worldState.currentSituation}`);

  // Narrative Anchors
  sections.push(`\nNARRATIVE:`);
  sections.push(`  Last Event (Ch${bible.narrativeAnchors.lastMajorEventChapter}): ${bible.narrativeAnchors.lastMajorEvent}`);
  sections.push(`  Objective: ${bible.narrativeAnchors.currentObjective}`);
  if (bible.narrativeAnchors.pendingPromises.length > 0) {
    sections.push(`  Pending Promises: ${bible.narrativeAnchors.pendingPromises.map(p => p.description).join('; ')}`);
  }

  // Active Conflicts
  if (bible.activeConflicts.length > 0) {
    sections.push(`\nACTIVE CONFLICTS:`);
    bible.activeConflicts.forEach(c => {
      sections.push(`  - ${c.description} [${c.urgency}]`);
    });
  }

  // Karma Debts
  if (bible.karmaDebts.length > 0) {
    sections.push(`\nKARMA DEBTS:`);
    bible.karmaDebts.forEach(k => {
      sections.push(`  - ${k.target}: ${k.consequence} [${k.threatLevel}]`);
    });
  }

  // Major Characters
  if (bible.majorCharacters.length > 0) {
    sections.push(`\nMAJOR CHARACTERS:`);
    bible.majorCharacters.slice(0, 10).forEach(c => {
      sections.push(`  - ${c.name} (${c.status}, ${c.cultivation || 'Unknown'}) - ${c.relationshipToProtagonist || 'Unknown relation'}`);
    });
  }

  return sections.join('\n');
}

/**
 * JSON schema for the Clerk delta output (for structured output models)
 */
export const CLERK_DELTA_SCHEMA = {
  type: 'object',
  properties: {
    updates: {
      type: 'object',
      properties: {
        protagonist: {
          type: 'object',
          properties: {
            cultivation: { type: 'object' },
            techniques: { type: 'array' },
            inventory: { type: 'array' },
            emotionalState: { type: 'string' },
            physicalState: { type: 'string' },
            location: { type: 'string' },
          },
        },
        characters: { type: 'array' },
        worldState: { type: 'object' },
        narrativeAnchors: { type: 'object' },
        activeConflicts: { type: 'array' },
        karmaDebts: { type: 'array' },
        powerSystem: { type: 'object' },
      },
    },
    observations: {
      type: 'object',
      required: ['reasoning', 'warnings', 'continuityFlags'],
      properties: {
        reasoning: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        continuityFlags: { type: 'array' },
      },
    },
  },
  required: ['updates', 'observations'],
};
