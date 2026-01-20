/**
 * Fate Path Generator Service
 * 
 * Uses AI to generate 3 compelling, narratively-distinct fate path options
 * for Tribulation Gates. Each path should offer genuinely different narrative
 * directions with varying risk/reward profiles.
 */

import { NovelState, Character, Arc, StoryThread } from '../types';
import {
  TribulationTrigger,
  FatePath,
  FatePathRisk,
  FatePathGenerationResponse,
  TRIGGER_DISPLAY_INFO,
} from '../types/tribulationGates';
import { routeJsonTask } from './modelOrchestrator';
import { rateLimiter } from './rateLimiter';
import { logger } from './loggingService';
import { generateUUID } from '../utils/uuid';
import { SYSTEM_INSTRUCTION } from '../constants';

/**
 * Generate 3 fate paths for a tribulation gate
 */
export async function generateFatePaths(
  state: NovelState,
  triggerType: TribulationTrigger,
  situation: string,
  protagonistName: string,
  context?: string
): Promise<FatePath[]> {
  const startTime = Date.now();
  
  logger.info('Generating fate paths for tribulation gate', 'tribulationGate', {
    triggerType,
    protagonistName,
    novelId: state.id,
  });
  
  try {
    // Gather context for generation
    const protagonist = state.characterCodex.find(c => c.name === protagonistName) 
      || state.characterCodex.find(c => c.isProtagonist)
      || state.characterCodex[0];
    
    const activeArc = state.plotLedger.find(a => a.status === 'active');
    const activeThreads = (state.storyThreads || [])
      .filter(t => t.status === 'active')
      .slice(0, 10);
    const criticalThreads = activeThreads.filter(t => t.priority === 'critical');
    
    const recentChapters = state.chapters.slice(-3);
    const recentContent = recentChapters
      .map(c => `Chapter ${c.number}: ${c.summary || c.content.slice(0, 500)}`)
      .join('\n\n');
    
    // Build the prompt
    const prompt = buildFatePathPrompt({
      triggerType,
      situation,
      protagonist,
      activeArc,
      activeThreads,
      criticalThreads,
      recentContent,
      worldContext: buildWorldContext(state),
      characterContext: buildCharacterContext(state, protagonist),
    });
    
    // Call AI to generate paths
    const response = await rateLimiter.queueRequest(
      'refine',
      async () => routeJsonTask<FatePathGenerationResponse>('metadata_extraction', {
        system: buildFatePathSystemPrompt(),
        user: prompt,
        temperature: 0.85, // Higher temperature for creative variety
        maxTokens: 4096,
      }),
      `fate-paths-${state.id}-${Date.now()}`
    );
    
    if (!response || !response.paths || response.paths.length < 3) {
      logger.warn('AI did not return valid fate paths, using fallback', 'tribulationGate');
      return generateFallbackPaths(triggerType, protagonistName, situation);
    }
    
    // Convert response to FatePath objects
    const fatePaths: FatePath[] = response.paths.slice(0, 3).map((path, index) => ({
      id: generateUUID(),
      label: path.label || `Path ${String.fromCharCode(65 + index)})`, // A), B), C)
      description: path.description || '',
      consequences: path.consequences || [],
      riskLevel: normalizeRiskLevel(path.riskLevel),
      emotionalTone: path.emotionalTone || 'uncertain',
      affectedCharacters: path.affectedCharacters,
      characterAlignment: path.characterAlignment,
    }));
    
    // Ensure we have exactly 3 paths
    while (fatePaths.length < 3) {
      fatePaths.push(generateFallbackPaths(triggerType, protagonistName, situation)[fatePaths.length]);
    }
    
    logger.info('Fate paths generated successfully', 'tribulationGate', {
      durationMs: Date.now() - startTime,
      pathCount: fatePaths.length,
      triggerType,
    });
    
    return fatePaths;
    
  } catch (error) {
    logger.error('Failed to generate fate paths', 'tribulationGate', 
      error instanceof Error ? error : undefined, {
        triggerType,
        error: error instanceof Error ? error.message : String(error),
      }
    );
    
    // Return fallback paths on error
    return generateFallbackPaths(triggerType, protagonistName, situation);
  }
}

/**
 * Build the system prompt for fate path generation
 */
function buildFatePathSystemPrompt(): string {
  return `${SYSTEM_INSTRUCTION}

You are the Fate Weaver for a Xianxia/Xuanhuan novel writing system. Your role is to generate exactly 3 distinct fate paths for critical decision moments called "Tribulation Gates."

CRITICAL REQUIREMENTS:
1. Each path must be GENUINELY DIFFERENT - not just variations of the same outcome
2. Paths should have VARYING RISK/REWARD profiles (one safe, one moderate, one high-risk)
3. All paths must be narratively interesting and advance the story
4. Paths should respect the character's established personality but can challenge it
5. Consider long-term consequences, not just immediate outcomes
6. Reference existing world elements (techniques, items, characters, factions)
7. Each path description should be 2-3 sentences of vivid narrative preview

PATH PHILOSOPHY:
- Path A: Often the "safe" or "conventional" choice - what a sensible cultivator might do
- Path B: The "balanced" choice - moderate risk with moderate reward
- Path C: The "bold" or "risky" choice - high risk but potentially transformative

RISK LEVELS:
- low: Minimal danger, predictable outcome
- medium: Some risk, uncertain elements
- high: Significant danger or sacrifice involved
- extreme: Life-threatening or world-changing consequences

Return ONLY valid JSON matching the specified schema.`;
}

/**
 * Build the user prompt for fate path generation
 */
function buildFatePathPrompt(params: {
  triggerType: TribulationTrigger;
  situation: string;
  protagonist: Character | undefined;
  activeArc: Arc | undefined;
  activeThreads: StoryThread[];
  criticalThreads: StoryThread[];
  recentContent: string;
  worldContext: string;
  characterContext: string;
}): string {
  const triggerInfo = TRIGGER_DISPLAY_INFO[params.triggerType];
  
  return `
TRIBULATION GATE: ${triggerInfo.title} ${triggerInfo.icon}
Type: ${params.triggerType}
Description: ${triggerInfo.description}

=== THE SITUATION ===
${params.situation}

=== PROTAGONIST ===
${params.characterContext}

=== CURRENT ARC ===
${params.activeArc 
  ? `Title: ${params.activeArc.title}\nDescription: ${params.activeArc.description?.slice(0, 500) || 'No description'}`
  : 'No active arc'}

=== CRITICAL THREADS ===
${params.criticalThreads.length > 0
  ? params.criticalThreads.map(t => `- ${t.title} (${t.type}): ${t.description?.slice(0, 100) || ''}`).join('\n')
  : 'None'}

=== ACTIVE THREADS ===
${params.activeThreads.slice(0, 5).map(t => `- ${t.title} (${t.type}, ${t.priority})`).join('\n') || 'None'}

=== RECENT STORY CONTEXT ===
${params.recentContent.slice(0, 2000)}

=== WORLD CONTEXT ===
${params.worldContext}

=== TASK ===
Generate exactly 3 distinct fate paths for this Tribulation Gate. Each path should:
1. Start with a clear label (e.g., "A) [Action Description]")
2. Have a 2-3 sentence narrative preview showing what happens
3. List 2-4 potential consequences (both positive and negative)
4. Have an appropriate risk level
5. Have a clear emotional tone

Return ONLY a JSON object with this exact shape:
{
  "situation": string (refined version of the situation above),
  "context": string (brief context summary),
  "protagonistName": string,
  "paths": [
    {
      "label": string (e.g., "A) Sacrifice the Sword Spirit"),
      "description": string (2-3 sentence narrative preview),
      "consequences": string[] (2-4 potential outcomes),
      "riskLevel": "low" | "medium" | "high" | "extreme",
      "emotionalTone": string (e.g., "desperate", "triumphant", "mysterious"),
      "affectedCharacters": string[] (optional, names of affected characters),
      "characterAlignment": number (optional, 0-100 how aligned with character's personality)
    },
    ... (exactly 2 more paths)
  ],
  "reasoning": string (brief explanation of why these paths were chosen)
}`;
}

/**
 * Build world context summary
 */
function buildWorldContext(state: NovelState): string {
  const parts: string[] = [];
  
  // Current realm
  const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
  if (currentRealm) {
    parts.push(`Current Realm: ${currentRealm.name}`);
  }
  
  // Key territories
  const keyTerritories = state.territories.slice(0, 3);
  if (keyTerritories.length > 0) {
    parts.push(`Key Locations: ${keyTerritories.map(t => t.name).join(', ')}`);
  }
  
  // Relevant world entries
  const relevantEntries = state.worldBible
    .filter(w => ['Sects', 'PowerLevels', 'Systems'].includes(w.category))
    .slice(0, 5);
  if (relevantEntries.length > 0) {
    parts.push(`World Elements: ${relevantEntries.map(e => e.title).join(', ')}`);
  }
  
  // Active antagonists
  const activeAntagonists = (state.antagonists || [])
    .filter(a => a.status === 'active')
    .slice(0, 3);
  if (activeAntagonists.length > 0) {
    parts.push(`Active Threats: ${activeAntagonists.map(a => a.name).join(', ')}`);
  }
  
  return parts.join('\n') || 'Standard Xianxia cultivation world';
}

/**
 * Build character context summary
 */
function buildCharacterContext(state: NovelState, protagonist: Character | undefined): string {
  if (!protagonist) {
    return 'Protagonist details unknown';
  }
  
  const parts: string[] = [];
  parts.push(`Name: ${protagonist.name}`);
  
  if (protagonist.currentCultivation) {
    parts.push(`Cultivation: ${protagonist.currentCultivation}`);
  }
  
  if (protagonist.personality) {
    parts.push(`Personality: ${protagonist.personality.slice(0, 200)}`);
  }
  
  if (protagonist.goals) {
    parts.push(`Goals: ${protagonist.goals.slice(0, 200)}`);
  }
  
  if (protagonist.flaws) {
    parts.push(`Flaws: ${protagonist.flaws.slice(0, 150)}`);
  }
  
  // Key relationships
  const keyRelationships = protagonist.relationships?.slice(0, 3);
  if (keyRelationships && keyRelationships.length > 0) {
    const relNames = keyRelationships.map(r => {
      const target = state.characterCodex.find(c => c.id === r.characterId);
      return target ? `${target.name} (${r.type})` : null;
    }).filter(Boolean);
    if (relNames.length > 0) {
      parts.push(`Key Relationships: ${relNames.join(', ')}`);
    }
  }
  
  // Active techniques
  const activeTechniques = protagonist.techniqueMasteries
    ?.filter(t => t.status === 'active')
    .slice(0, 3);
  if (activeTechniques && activeTechniques.length > 0) {
    const techNames = activeTechniques.map(t => {
      const tech = (state.novelTechniques || []).find(nt => nt.id === t.techniqueId);
      return tech?.name;
    }).filter(Boolean);
    if (techNames.length > 0) {
      parts.push(`Key Techniques: ${techNames.join(', ')}`);
    }
  }
  
  return parts.join('\n');
}

/**
 * Normalize risk level from AI response
 */
function normalizeRiskLevel(risk: string | undefined): FatePathRisk {
  if (!risk) return 'medium';
  
  const normalized = risk.toLowerCase().trim();
  
  if (normalized.includes('low') || normalized.includes('safe')) return 'low';
  if (normalized.includes('extreme') || normalized.includes('deadly') || normalized.includes('fatal')) return 'extreme';
  if (normalized.includes('high') || normalized.includes('danger')) return 'high';
  
  return 'medium';
}

/**
 * Generate fallback paths when AI fails
 */
function generateFallbackPaths(
  triggerType: TribulationTrigger,
  protagonistName: string,
  situation: string
): FatePath[] {
  const fallbackTemplates: Record<TribulationTrigger, FatePath[]> = {
    realm_breakthrough: [
      {
        id: generateUUID(),
        label: 'A) Stabilize and Consolidate',
        description: `${protagonistName} chooses caution, stabilizing their current realm before attempting the breakthrough. The tribulation clouds disperse—for now.`,
        consequences: ['Safer cultivation path', 'Delayed breakthrough', 'Stronger foundation for future'],
        riskLevel: 'low',
        emotionalTone: 'cautious',
      },
      {
        id: generateUUID(),
        label: 'B) Face the Tribulation Directly',
        description: `${protagonistName} steels their resolve and faces the heavenly tribulation head-on, trusting in their accumulated cultivation and will.`,
        consequences: ['Breakthrough if successful', 'Severe injury if failed', 'Gains recognition'],
        riskLevel: 'medium',
        emotionalTone: 'determined',
      },
      {
        id: generateUUID(),
        label: 'C) Use Forbidden Means',
        description: `${protagonistName} draws upon forbidden techniques or external aids to force the breakthrough, risking catastrophic backlash for certain success.`,
        consequences: ['Guaranteed breakthrough', 'Hidden injuries', 'Karmic debt', 'Attract powerful attention'],
        riskLevel: 'extreme',
        emotionalTone: 'desperate',
      },
    ],
    life_death_crisis: [
      {
        id: generateUUID(),
        label: 'A) Strategic Retreat',
        description: `${protagonistName} recognizes the overwhelming odds and executes a tactical retreat, preserving their life to fight another day.`,
        consequences: ['Survival guaranteed', 'Lost opportunity', 'May appear cowardly', 'Can prepare better'],
        riskLevel: 'low',
        emotionalTone: 'pragmatic',
      },
      {
        id: generateUUID(),
        label: 'B) Desperate Gamble',
        description: `${protagonistName} makes a calculated risk, using every resource at their disposal in a final desperate attempt to survive and triumph.`,
        consequences: ['Potential victory', 'May suffer grievous wounds', 'Could gain enemy respect'],
        riskLevel: 'high',
        emotionalTone: 'desperate',
      },
      {
        id: generateUUID(),
        label: 'C) Embrace the Void',
        description: `${protagonistName} accepts death and channels that acceptance into a transcendent state, potentially unlocking hidden power at the ultimate cost.`,
        consequences: ['May unlock hidden potential', 'Near-certain death', 'Legendary sacrifice', 'Could inspire others'],
        riskLevel: 'extreme',
        emotionalTone: 'transcendent',
      },
    ],
    major_confrontation: [
      {
        id: generateUUID(),
        label: 'A) Seek Peaceful Resolution',
        description: `${protagonistName} attempts to resolve the confrontation through negotiation, appealing to reason or offering terms.`,
        consequences: ['Avoids bloodshed', 'May appear weak', 'Could gain unexpected ally', 'Enemy may betray trust'],
        riskLevel: 'low',
        emotionalTone: 'diplomatic',
      },
      {
        id: generateUUID(),
        label: 'B) Honorable Duel',
        description: `${protagonistName} challenges their adversary to a formal duel, setting clear terms and stakes for a decisive confrontation.`,
        consequences: ['Clear outcome', 'Maintains honor', 'Risk of defeat', 'Others will not interfere'],
        riskLevel: 'medium',
        emotionalTone: 'honorable',
      },
      {
        id: generateUUID(),
        label: 'C) All-Out Attack',
        description: `${protagonistName} unleashes their full power without restraint, aiming to utterly destroy their enemy regardless of collateral damage.`,
        consequences: ['Maximum destructive power', 'Collateral damage', 'May alienate allies', 'Decisive if successful'],
        riskLevel: 'high',
        emotionalTone: 'ruthless',
      },
    ],
    alliance_decision: [
      {
        id: generateUUID(),
        label: 'A) Maintain Independence',
        description: `${protagonistName} chooses to remain unaligned, preserving their freedom but potentially making enemies of both sides.`,
        consequences: ['Freedom preserved', 'No faction support', 'May be targeted by both sides', 'Self-reliance required'],
        riskLevel: 'medium',
        emotionalTone: 'independent',
      },
      {
        id: generateUUID(),
        label: 'B) Join the Offer',
        description: `${protagonistName} accepts the alliance proposal, gaining powerful backing but committing to their cause and constraints.`,
        consequences: ['Powerful allies', 'Resources and support', 'Obligations and duties', 'Enemies of faction become your enemies'],
        riskLevel: 'low',
        emotionalTone: 'cooperative',
      },
      {
        id: generateUUID(),
        label: 'C) Play Both Sides',
        description: `${protagonistName} pretends to accept while secretly planning to manipulate the situation for personal gain.`,
        consequences: ['Potential for great gain', 'Extreme danger if discovered', 'Moral compromise', 'Trust will be hard to gain'],
        riskLevel: 'extreme',
        emotionalTone: 'cunning',
      },
    ],
    treasure_discovery: [
      {
        id: generateUUID(),
        label: 'A) Secure and Study',
        description: `${protagonistName} carefully secures the treasure and takes time to study its properties before attempting to use it.`,
        consequences: ['Safe approach', 'Delayed benefits', 'Full understanding', 'Others may catch up'],
        riskLevel: 'low',
        emotionalTone: 'cautious',
      },
      {
        id: generateUUID(),
        label: 'B) Immediate Refinement',
        description: `${protagonistName} begins the refinement process immediately, accepting some risk for quicker access to power.`,
        consequences: ['Quick power gain', 'May not unlock full potential', 'Some danger', 'Immediate advantage'],
        riskLevel: 'medium',
        emotionalTone: 'eager',
      },
      {
        id: generateUUID(),
        label: 'C) Forceful Absorption',
        description: `${protagonistName} forcefully absorbs the treasure's power all at once, risking severe backlash for maximum immediate gain.`,
        consequences: ['Maximum power quickly', 'Severe strain on body/soul', 'May transform unexpectedly', 'Could attract attention'],
        riskLevel: 'high',
        emotionalTone: 'greedy',
      },
    ],
    identity_revelation: [
      {
        id: generateUUID(),
        label: 'A) Maintain the Secret',
        description: `${protagonistName} chooses to keep their true identity hidden, continuing their deception for safety.`,
        consequences: ['Safety preserved', 'Continued deception burden', 'May lose trust if discovered later', 'Can prepare reveal'],
        riskLevel: 'low',
        emotionalTone: 'secretive',
      },
      {
        id: generateUUID(),
        label: 'B) Selective Revelation',
        description: `${protagonistName} reveals their identity to a trusted few, gaining allies while maintaining broader secrecy.`,
        consequences: ['Trusted allies gained', 'Risk of leak', 'Burden shared', 'Must trust judgment'],
        riskLevel: 'medium',
        emotionalTone: 'trusting',
      },
      {
        id: generateUUID(),
        label: 'C) Full Disclosure',
        description: `${protagonistName} dramatically reveals their true identity to all, accepting whatever consequences follow.`,
        consequences: ['No more deception', 'Enemies and allies revealed', 'Dramatic impact', 'Cannot be undone'],
        riskLevel: 'high',
        emotionalTone: 'dramatic',
      },
    ],
    marriage_proposal: [
      {
        id: generateUUID(),
        label: 'A) Decline Gracefully',
        description: `${protagonistName} politely declines the proposal, prioritizing their cultivation path or other commitments.`,
        consequences: ['Freedom maintained', 'May hurt feelings', 'Potential alliance lost', 'Focused cultivation'],
        riskLevel: 'low',
        emotionalTone: 'regretful',
      },
      {
        id: generateUUID(),
        label: 'B) Accept the Union',
        description: `${protagonistName} accepts the proposal, embracing the partnership and its implications for their future.`,
        consequences: ['Powerful partner', 'Obligations to partner', 'Combined resources', 'Life path changed'],
        riskLevel: 'medium',
        emotionalTone: 'hopeful',
      },
      {
        id: generateUUID(),
        label: 'C) Propose Counter-Terms',
        description: `${protagonistName} neither accepts nor declines, but proposes different terms that serve their interests better.`,
        consequences: ['May get better terms', 'Risk of offense', 'Shows confidence', 'Negotiation continues'],
        riskLevel: 'medium',
        emotionalTone: 'calculating',
      },
    ],
    sect_choice: [
      {
        id: generateUUID(),
        label: 'A) Loyal Service',
        description: `${protagonistName} commits fully to the sect, embracing its teachings and hierarchy.`,
        consequences: ['Full sect support', 'Must follow rules', 'Clear advancement path', 'Sect enemies become yours'],
        riskLevel: 'low',
        emotionalTone: 'loyal',
      },
      {
        id: generateUUID(),
        label: 'B) Independent Path',
        description: `${protagonistName} maintains a loose association, taking what benefits are offered while preserving autonomy.`,
        consequences: ['Some support', 'Limited obligations', 'Less trust from sect', 'Flexible path'],
        riskLevel: 'medium',
        emotionalTone: 'independent',
      },
      {
        id: generateUUID(),
        label: 'C) Seize Power',
        description: `${protagonistName} sees an opportunity to claim leadership or significantly alter the sect's direction.`,
        consequences: ['Potential for great power', 'Many enemies', 'Heavy responsibility', 'Dramatic change'],
        riskLevel: 'extreme',
        emotionalTone: 'ambitious',
      },
    ],
    forbidden_technique: [
      {
        id: generateUUID(),
        label: 'A) Resist Temptation',
        description: `${protagonistName} resists the allure of forbidden power, staying true to their principles.`,
        consequences: ['Principles maintained', 'Power foregone', 'Righteous path', 'May face stronger enemies unprepared'],
        riskLevel: 'low',
        emotionalTone: 'righteous',
      },
      {
        id: generateUUID(),
        label: 'B) Cautious Study',
        description: `${protagonistName} studies the forbidden technique carefully, seeking to understand without fully committing.`,
        consequences: ['Knowledge gained', 'Risk of corruption', 'May find safer adaptation', 'Slippery slope'],
        riskLevel: 'medium',
        emotionalTone: 'curious',
      },
      {
        id: generateUUID(),
        label: 'C) Full Embrace',
        description: `${protagonistName} fully embraces the forbidden power, accepting whatever transformation it brings.`,
        consequences: ['Massive power boost', 'Possible corruption', 'Enemies among righteous', 'Fundamental change'],
        riskLevel: 'extreme',
        emotionalTone: 'dark',
      },
    ],
    sacrifice_moment: [
      {
        id: generateUUID(),
        label: 'A) Refuse the Sacrifice',
        description: `${protagonistName} refuses to sacrifice what is demanded, seeking another way.`,
        consequences: ['Precious thing preserved', 'Goal may be unachieved', 'Must find alternative', 'True to self'],
        riskLevel: 'medium',
        emotionalTone: 'defiant',
      },
      {
        id: generateUUID(),
        label: 'B) Partial Sacrifice',
        description: `${protagonistName} seeks a compromise, sacrificing something lesser while preserving what matters most.`,
        consequences: ['Compromise achieved', 'May not be enough', 'Shows wisdom', 'Partial loss'],
        riskLevel: 'medium',
        emotionalTone: 'wise',
      },
      {
        id: generateUUID(),
        label: 'C) Complete Sacrifice',
        description: `${protagonistName} makes the full sacrifice, giving up everything demanded regardless of personal cost.`,
        consequences: ['Goal achieved', 'Great personal loss', 'Heroic act', 'Changes everything'],
        riskLevel: 'extreme',
        emotionalTone: 'selfless',
      },
    ],
    dao_comprehension: [
      {
        id: generateUUID(),
        label: 'A) Orthodox Understanding',
        description: `${protagonistName} follows the traditional interpretation of the dao insight, aligning with established wisdom.`,
        consequences: ['Safe comprehension', 'Accepted by orthodox', 'Limited innovation', 'Solid foundation'],
        riskLevel: 'low',
        emotionalTone: 'traditional',
      },
      {
        id: generateUUID(),
        label: 'B) Personal Interpretation',
        description: `${protagonistName} interprets the insight through their own unique lens, creating a personalized understanding.`,
        consequences: ['Unique dao', 'May conflict with others', 'True to self', 'Uncertain outcome'],
        riskLevel: 'medium',
        emotionalTone: 'individualistic',
      },
      {
        id: generateUUID(),
        label: 'C) Defiant Reversal',
        description: `${protagonistName} comprehends by denying the conventional wisdom entirely, forging a contradictory but potentially powerful dao.`,
        consequences: ['Revolutionary understanding', 'Rejection by orthodox', 'Unique power', 'Lonely path'],
        riskLevel: 'high',
        emotionalTone: 'rebellious',
      },
    ],
    inheritance_acceptance: [
      {
        id: generateUUID(),
        label: 'A) Decline Respectfully',
        description: `${protagonistName} respectfully declines the inheritance, feeling unready or unwilling to bear its burden.`,
        consequences: ['No new obligations', 'Lost opportunity', 'May be offered again', 'Own path preserved'],
        riskLevel: 'low',
        emotionalTone: 'humble',
      },
      {
        id: generateUUID(),
        label: 'B) Accept with Conditions',
        description: `${protagonistName} accepts the inheritance but sets their own terms for how they will carry the legacy.`,
        consequences: ['Inheritance gained', 'Modified obligations', 'Shows strength', 'May displease spirits'],
        riskLevel: 'medium',
        emotionalTone: 'confident',
      },
      {
        id: generateUUID(),
        label: 'C) Seize Everything',
        description: `${protagonistName} claims not just the offered inheritance but attempts to take everything the legacy contains.`,
        consequences: ['Maximum gain', 'Severe tests', 'May face guardian wrath', 'Transform completely'],
        riskLevel: 'extreme',
        emotionalTone: 'greedy',
      },
    ],
  };
  
  return fallbackTemplates[triggerType] || fallbackTemplates.major_confrontation;
}

/**
 * Validate that paths are sufficiently distinct
 */
export function validatePathDistinctness(paths: FatePath[]): boolean {
  if (paths.length < 3) return false;
  
  // Check risk level variety
  const riskLevels = new Set(paths.map(p => p.riskLevel));
  if (riskLevels.size < 2) return false;
  
  // Check emotional tone variety
  const tones = new Set(paths.map(p => p.emotionalTone.toLowerCase()));
  if (tones.size < 2) return false;
  
  // Check description variety (simple length/word check)
  const descriptions = paths.map(p => p.description.toLowerCase());
  for (let i = 0; i < descriptions.length; i++) {
    for (let j = i + 1; j < descriptions.length; j++) {
      const similarity = calculateStringSimilarity(descriptions[i], descriptions[j]);
      if (similarity > 0.7) return false; // Too similar
    }
  }
  
  return true;
}

/**
 * Simple string similarity calculation
 */
function calculateStringSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));
  
  let intersection = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) intersection++;
  }
  
  const union = wordsA.size + wordsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}
