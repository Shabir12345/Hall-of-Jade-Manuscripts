import { StoryThread, StoryThreadType } from '../types';
import { generateUUID } from './uuid';

export interface ThreadTemplate {
  id: string;
  name: string;
  type: StoryThreadType;
  description: string;
  defaultPriority: 'critical' | 'high' | 'medium' | 'low';
  defaultDescription: string;
  pacingGuidelines: string;
  suggestedFields: {
    description?: string;
    progressionNotes?: Array<{ chapterNumber: number; note: string; significance: 'major' | 'minor' }>;
  };
}

export const threadTemplates: ThreadTemplate[] = [
  {
    id: 'mystery-template',
    name: 'Mystery Thread',
    type: 'mystery',
    description: 'A mystery that needs solving - unsolved questions, hidden truths, unexplained events',
    defaultPriority: 'high',
    defaultDescription: 'A mystery that was introduced and needs periodic hints and eventual resolution.',
    pacingGuidelines: 'Mysteries can take longer to resolve (15-30 chapters). Provide periodic hints every 8-20 chapters. Build tension gradually.',
    suggestedFields: {
      description: 'Describe the mystery, what questions need answering, and any clues that have been revealed.',
    },
  },
  {
    id: 'promise-template',
    name: 'Promise Thread',
    type: 'promise',
    description: 'Character promises, vows, commitments that need fulfillment',
    defaultPriority: 'critical',
    defaultDescription: 'A promise made by a character that should be fulfilled relatively quickly.',
    pacingGuidelines: 'Promises should be fulfilled within 5-10 chapters. Update every 2-5 chapters to show progress.',
    suggestedFields: {
      description: 'Describe the promise, who made it, to whom, and what needs to be fulfilled.',
    },
  },
  {
    id: 'relationship-template',
    name: 'Relationship Thread',
    type: 'relationship',
    description: 'Relationship development between characters - romance, friendship, rivalry, family bonds',
    defaultPriority: 'medium',
    defaultDescription: 'A relationship thread tracking the development between characters.',
    pacingGuidelines: 'Relationships should evolve regularly (every 5-12 chapters). Show gradual development with major milestones.',
    suggestedFields: {
      description: 'Describe the relationship, the characters involved, and the current state of their bond.',
    },
  },
  {
    id: 'power-template',
    name: 'Power Progression Thread',
    type: 'power',
    description: 'Power progression/cultivation threads - realm breakthroughs, cultivation goals, power scaling',
    defaultPriority: 'high',
    defaultDescription: 'A power progression thread tracking cultivation or power advancement.',
    pacingGuidelines: 'Power progression should be regular (every 6-15 chapters). Track milestones and breakthroughs.',
    suggestedFields: {
      description: 'Describe the power goal, current level, and what needs to be achieved.',
    },
  },
  {
    id: 'quest-template',
    name: 'Quest Thread',
    type: 'quest',
    description: 'Quests or missions - objectives, tasks, goals that need completion',
    defaultPriority: 'high',
    defaultDescription: 'A quest or mission that needs to be completed.',
    pacingGuidelines: 'Quests should progress steadily (every 3-7 chapters). Show clear milestones and progress.',
    suggestedFields: {
      description: 'Describe the quest objective, requirements, and current progress.',
    },
  },
  {
    id: 'revelation-template',
    name: 'Revelation Thread',
    type: 'revelation',
    description: 'Secrets/revelations that need revealing - hidden identities, backstories, plot twists',
    defaultPriority: 'high',
    defaultDescription: 'A revelation thread tracking secrets that need to be revealed.',
    pacingGuidelines: 'Revelations can build over 10-25 chapters. Drop hints periodically before the big reveal.',
    suggestedFields: {
      description: 'Describe the secret, who knows it, and when/how it should be revealed.',
    },
  },
  {
    id: 'conflict-template',
    name: 'Conflict Thread',
    type: 'conflict',
    description: 'Ongoing conflicts that need resolution - disputes, wars, tensions between groups',
    defaultPriority: 'critical',
    defaultDescription: 'An ongoing conflict that needs escalation or resolution.',
    pacingGuidelines: 'Conflicts should escalate or resolve within 8-15 chapters. Show tension building or resolution progress.',
    suggestedFields: {
      description: 'Describe the conflict, the parties involved, and the current state of tension.',
    },
  },
];

export function createThreadFromTemplate(
  template: ThreadTemplate,
  novelId: string,
  currentChapter: number
): StoryThread {
  return {
    id: generateUUID(),
    novelId,
    title: `New ${template.name}`,
    type: template.type,
    status: 'active',
    priority: template.defaultPriority,
    description: template.defaultDescription,
    introducedChapter: currentChapter,
    lastUpdatedChapter: currentChapter,
    progressionNotes: [],
    chaptersInvolved: [currentChapter],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
