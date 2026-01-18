import { z } from 'zod';

// Novel validation schemas
export const NovelStateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  genre: z.string().min(1, 'Genre is required'),
  grandSaga: z.string().optional(),
  currentRealmId: z.string().uuid(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const ChapterSchema = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive('Chapter number must be positive'),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  summary: z.string().optional(),
  createdAt: z.number(),
});

export const CharacterSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  age: z.string().optional(),
  personality: z.string().optional(),
  currentCultivation: z.string().optional(),
  appearance: z.string().optional(),
  background: z.string().optional(),
  goals: z.string().optional(),
  flaws: z.string().optional(),
  skills: z.array(z.string()),
  items: z.array(z.string()),
  notes: z.string().optional(),
  portraitUrl: z.string().url().optional().or(z.literal('')),
  status: z.enum(['Alive', 'Deceased', 'Unknown']),
  relationships: z.array(z.object({
    characterId: z.string().uuid(),
    type: z.string(),
    history: z.string(),
    impact: z.string(),
  })),
});

export const WorldEntrySchema = z.object({
  id: z.string().uuid(),
  realmId: z.string().uuid(),
  category: z.enum(['Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other']),
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
});

export const ArcSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().optional(),
  status: z.enum(['active', 'completed']),
});

export const TerritorySchema = z.object({
  id: z.string().uuid(),
  realmId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(200),
  type: z.enum(['Empire', 'Kingdom', 'Neutral', 'Hidden']),
  description: z.string().optional(),
});

// Input validation helpers
export function validateNovelInput(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = NovelStateSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((e: z.ZodIssue) => e.message).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

export function validateChapterInput(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = ChapterSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((e: z.ZodIssue) => e.message).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

export function validateCharacterInput(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = CharacterSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((e: z.ZodIssue) => e.message).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

export function validateWorldEntryInput(data: unknown): { success: boolean; data?: any; error?: string } {
  try {
    const result = WorldEntrySchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues.map((e: z.ZodIssue) => e.message).join(', ') };
    }
    return { success: false, error: 'Validation failed' };
  }
}

// Type guards
export function isValidChapter(data: unknown): data is z.infer<typeof ChapterSchema> {
  return ChapterSchema.safeParse(data).success;
}

export function isValidCharacter(data: unknown): data is z.infer<typeof CharacterSchema> {
  return CharacterSchema.safeParse(data).success;
}

export function isValidWorldEntry(data: unknown): data is z.infer<typeof WorldEntrySchema> {
  return WorldEntrySchema.safeParse(data).success;
}
