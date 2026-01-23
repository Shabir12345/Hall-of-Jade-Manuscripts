import { Chapter, LogicAudit, NovelState } from '../types';
import { routeJsonTask } from './modelOrchestrator';
import { logger } from './loggingService';

/**
 * Logic Audit Service
 * 
 * Provides automated auditing of chapters to ensure clear value shifts
 * and narrative causality (Delta Principle). Consistent with the 
 * "Self-Correction" architecture, this service fills in narrative gaps
 * to strengthen continuity between generated chapters.
 */

/**
 * Generates a logic audit for a single chapter using the "Clerk" model.
 */
export async function generateLogicAudit(chapter: Chapter): Promise<LogicAudit | null> {
    const startTime = Date.now();

    const systemPrompt = `You are a professional literary auditor specializing in the Delta Principle of story structure.
Your task is to analyze a chapter and identify the core value shift using the Logic Audit framework.

The Logic Audit captures the "Delta" (change) in the chapter. Every meaningful scene or chapter must result in a value shift.

Framework:
1. **Starting Value**: The emotional or narrative state at the beginning (e.g., "Isolated and weak", "Confident in security").
2. **The Friction**: The specific conflict, pressure, or obstacle that forced a change.
3. **The Choice**: The decisive action, revelation, or risk the protagonist took in response to the friction.
4. **Resulting Value**: The new state at the end, which MUST be different from the start (e.g., "Acknowledged and determined", "Exposed and vulnerable").
5. **Causality Type**:
   - "Therefore": The change is a logical consequence of the protagonist's action.
   - "But": The change is an unexpected complication or reversal.

Return only a JSON object matching the LogicAudit interface.`;

    const userPrompt = `Analyze Chapter ${chapter.number} ("${chapter.title}") and provide a Logic Audit:

--- CHAPTER CONTENT ---
${chapter.content}
--- END CONTENT ---

Return exactly this JSON structure:
{
  "startingValue": "string",
  "theFriction": "string",
  "theChoice": "string",
  "resultingValue": "string",
  "causalityType": "Therefore" | "But"
}`;

    try {
        const audit = await routeJsonTask<LogicAudit>('metadata_extraction', {
            system: systemPrompt,
            user: userPrompt,
            temperature: 0.3,
        });

        if (audit) {
            const duration = Date.now() - startTime;
            logger.info(`Generated logic audit for Chapter ${chapter.number} in ${duration}ms`, 'logicAudit', {
                startingValue: audit.startingValue,
                resultingValue: audit.resultingValue,
                causalityType: audit.causalityType
            });
            return audit;
        }
        return null;
    } catch (error) {
        logger.error(`Failed to generate logic audit for Chapter ${chapter.number}`, 'logicAudit', error instanceof Error ? error : undefined);
        return null;
    }
}

/**
 * Manually audit a novel state to fill in missing logic audits.
 * This can be used to "back-fill" audits for older chapters.
 */
export async function auditNovel(state: NovelState, onProgress?: (msg: string, progress: number) => void): Promise<{
    updatedState: NovelState;
    auditCount: number;
}> {
    const chaptersToAudit = state.chapters.filter(ch => !ch.logicAudit);
    const totalToAudit = chaptersToAudit.length;

    if (totalToAudit === 0) {
        return { updatedState: state, auditCount: 0 };
    }

    logger.info(`Starting auto-audit for ${totalToAudit} chapters`, 'logicAudit');
    let auditCount = 0;
    const updatedChapters = [...state.chapters];

    for (let i = 0; i < updatedChapters.length; i++) {
        const chapter = updatedChapters[i];
        if (!chapter.logicAudit) {
            const currentProgress = Math.round((auditCount / totalToAudit) * 100);
            const msg = `Auditing Chapter ${chapter.number}: ${chapter.title}...`;
            onProgress?.(msg, currentProgress);

            const audit = await generateLogicAudit(chapter);
            if (audit) {
                updatedChapters[i] = {
                    ...chapter,
                    logicAudit: audit
                };
                auditCount++;
            }
        }
    }

    onProgress?.('Audit complete', 100);

    return {
        updatedState: {
            ...state,
            chapters: updatedChapters,
            updatedAt: Date.now()
        },
        auditCount
    };
}

/**
 * Checks if a novel state has missing audits and returns recommended actions.
 */
export function checkAuditHealth(state: NovelState): {
    isHealthy: boolean;
    missingAuditCount: number;
    recommendation: string;
} {
    const missingCount = state.chapters.filter(ch => !ch.logicAudit).length;

    return {
        isHealthy: missingCount === 0,
        missingAuditCount: missingCount,
        recommendation: missingCount > 0
            ? `Novel has ${missingCount} chapters missing logic audits. Run the Auto-Audit service to restore narrative continuity.`
            : 'All chapters have logic audits. Continuity foundation is strong.'
    };
}
