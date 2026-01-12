import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NovelState, Character, Scene, NovelItem, NovelTechnique, CharacterItemPossession, CharacterTechniqueMastery, Antagonist, ForeshadowingElement, SymbolicElement, EmotionalPayoffMoment, SubtextElement } from '../types';
import { EditorReport, EditorFix, RecurringIssuePattern, PatternOccurrence } from '../types/editor';
import { SUPABASE_CONFIG } from '../config/supabase';
import { withRetry, isRetryableError, AppError } from '../utils/errorHandling';
import { fetchAntagonists } from './antagonistService';
import { logger } from './loggingService';
import { queryCache } from './queryCache';

// Singleton pattern to prevent multiple GoTrueClient instances
let supabaseInstance: SupabaseClient | null = null;
let isInitializing = false;

function getSupabaseClient(): SupabaseClient {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  if (isInitializing) {
    // If we're already initializing, wait a bit and try again
    // This prevents race conditions during module loading
    throw new Error('Supabase client is being initialized. Please try again.');
  }
  
  isInitializing = true;
  try {
    if (!SUPABASE_CONFIG.url || !SUPABASE_CONFIG.anonKey) {
      logger.error('Supabase configuration is missing', 'supabase', new Error('Configuration missing'), {
        message: 'Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file'
      });
      throw new Error('Supabase configuration is missing');
    }
    
    // Only log once to reduce console noise
    if (!supabaseInstance) {
      logger.debug('Initializing Supabase client', 'supabase', {
        url: SUPABASE_CONFIG.url
      });
    }
    
    supabaseInstance = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'sb-wvxhittdnmvnobwonrex-auth-token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
    
    return supabaseInstance;
  } finally {
    isInitializing = false;
  }
}

export const supabase = getSupabaseClient();

/**
 * Test Supabase connection
 * Call this from browser console: window.testSupabaseConnection()
 */
export async function testSupabaseConnection(): Promise<void> {
  try {
    logger.debug('Testing Supabase connection', 'supabase', undefined, {
      url: SUPABASE_CONFIG.url
    });
    
    // Test basic connection by trying to fetch from novels table
    const { data, error } = await supabase
      .from('novels')
      .select('id')
      .limit(1);
    
    if (error) {
      logger.error('Supabase connection failed', 'supabase', error, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }
    
    logger.info('Supabase connection successful', 'supabase', {
      testQueryResult: data
    });
  } catch (error) {
    logger.error('Supabase connection test failed', 'supabase', error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// Expose test function to window for debugging
if (typeof window !== 'undefined') {
  (window as Window & { testSupabaseConnection?: () => Promise<void> }).testSupabaseConnection = testSupabaseConnection;
}

// Helper function to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Gets the current authenticated user's ID
 * 
 * @returns Promise resolving to user ID string or null if not authenticated
 * @throws {Error} If session retrieval fails
 * 
 * @example
 * ```typescript
 * const userId = await getCurrentUserId();
 * if (!userId) {
 *   throw new Error('User must be authenticated');
 * }
 * ```
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      logger.error('Error getting current user session', 'supabase', error);
      return null;
    }
    return session?.user?.id ?? null;
  } catch (error) {
    logger.error('Unexpected error getting current user ID', 'supabase', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Fetches all novels for the current authenticated user.
 * 
 * Uses query caching to reduce database load. Results are cached for 30 seconds.
 * Automatically filters by user_id if authentication is enabled.
 * Fetches all related data including realms, characters, chapters, arcs, etc.
 * 
 * @returns {Promise<NovelState[]>} Promise that resolves to an array of novel states
 * @throws {Error} If database fetch fails
 * 
 * @example
 * ```typescript
 * const novels = await fetchAllNovels();
 * console.log(`Loaded ${novels.length} novels`);
 * ```
 */
export const fetchAllNovels = async (): Promise<NovelState[]> => {
  // Check cache first
  const userId = await getCurrentUserId();
  const cacheKey = `novels:${userId || 'anonymous'}`;
  const cached = queryCache.get<NovelState[]>(cacheKey);
  if (cached) {
    logger.debug('Cache hit', 'supabase', undefined, { key: cacheKey });
    return cached;
  }

  // Cache miss - fetch from database
  logger.debug('Cache miss, fetching from database', 'supabase', undefined, { key: cacheKey });
  const novels = await withRetry(async () => {
    
    // Build query - only filter by user_id if authentication is enabled
    let query = supabase
      .from('novels')
      .select('*');
    
    if (userId) {
      query = query.eq('user_id', userId); // Filter by user_id when authenticated
    }
    
    const { data: novels, error } = await query
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Error fetching novels', 'supabase', error);
      throw error;
    }

    if (!novels || novels.length === 0) {
      return [];
    }

    const ensureOk = <T,>(label: string, result: { data: T | null; error: any }): T => {
      if (result.error) {
        logger.error(`Error fetching ${label}`, 'supabase', result.error instanceof Error ? result.error : new Error(String(result.error)));
        throw new Error(`Failed to fetch ${label}: ${result.error.message || String(result.error)}`);
      }
      return (result.data ?? ([] as any)) as T;
    };

    // Fetch all related data for each novel
    const novelStates = await Promise.all(
      novels.map(async (novel) => {
        const novelId = novel.id;

        // Fetch novel-scoped tables in parallel
        const [
          realmsRes,
          charactersRes,
          chaptersRes,
          arcsRes,
          systemLogsRes,
          tagsRes,
          writingGoalsRes,
        ] = await Promise.all([
          supabase.from('realms').select('*').eq('novel_id', novelId),
          supabase.from('characters').select('*').eq('novel_id', novelId),
          supabase.from('chapters').select('*').eq('novel_id', novelId).order('number', { ascending: true }),
          supabase.from('arcs').select('*').eq('novel_id', novelId),
          supabase.from('system_logs').select('*').eq('novel_id', novelId).order('timestamp', { ascending: false }),
          supabase.from('tags').select('*').eq('novel_id', novelId),
          supabase.from('writing_goals').select('*').eq('novel_id', novelId),
        ]);

        const realmsRows = ensureOk<RealmRow>('realms', realmsRes);
        const charactersRows = ensureOk<CharacterRow>('characters', charactersRes);
        const chaptersRows = ensureOk<ChapterRow>('chapters', chaptersRes);
        const arcsRows = ensureOk<ArcRow>('arcs', arcsRes);
        const systemLogsRows = ensureOk<SystemLogRow>('system_logs', systemLogsRes);
        const tagsRows = ensureOk<TagRow>('tags', tagsRes);
        const writingGoalsRows = ensureOk<WritingGoalRow>('writing_goals', writingGoalsRes);

        // Realm-scoped tables depend on realm IDs
        const realmIds = realmsRows.map(r => r.id).filter(Boolean);
        const [territoriesRes, worldEntriesRes] = await Promise.all([
          realmIds.length > 0
            ? supabase.from('territories').select('*').in('realm_id', realmIds)
            : Promise.resolve({ data: [], error: null } as any),
          realmIds.length > 0
            ? supabase.from('world_entries').select('*').in('realm_id', realmIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        const territoriesRows = ensureOk<any[]>('territories', territoriesRes);
        const worldEntriesRows = ensureOk<any[]>('world_entries', worldEntriesRes);

        // Scenes depend on chapter IDs
        const chapterIds = chaptersRows.map(c => c.id).filter(Boolean);
        const scenesRes =
          chapterIds.length > 0
            ? await supabase
                .from('scenes')
                .select('*')
                .in('chapter_id', chapterIds)
                .order('chapter_id', { ascending: true })
                .order('number', { ascending: true })
            : ({ data: [], error: null } as any);
        const scenesRows = ensureOk<SceneRow>('scenes', scenesRes);

        // Group scenes by chapter
        const scenesByChapter = new Map<string, Scene[]>();
        scenesRows.forEach((s) => {
          if (!scenesByChapter.has(s.chapter_id)) {
            scenesByChapter.set(s.chapter_id, []);
          }
          scenesByChapter.get(s.chapter_id)!.push({
            id: s.id,
            chapterId: s.chapter_id,
            number: s.number,
            title: s.title || '',
            content: s.content || '',
            summary: s.summary || '',
            wordCount: s.word_count || 0,
            tags: [],
            createdAt: timestampToNumber(s.created_at),
            updatedAt: timestampToNumber(s.updated_at),
          });
        });

        // Novel-scoped: items and techniques
        const [novelItemsRes, novelTechniquesRes] = await Promise.all([
          supabase.from('novel_items').select('*').eq('novel_id', novelId),
          supabase.from('novel_techniques').select('*').eq('novel_id', novelId),
        ]);

        const novelItemsRows = ensureOk<NovelItemRow>('novel_items', novelItemsRes);
        const novelTechniquesRows = ensureOk<NovelTechniqueRow>('novel_techniques', novelTechniquesRes);

        // Fetch antagonists - wrap in try-catch in case tables don't exist yet
        let antagonists: Antagonist[] = [];
        try {
          antagonists = await fetchAntagonists(novelId);
        } catch (error) {
          logger.warn('Failed to fetch antagonists (tables may not exist yet)', 'supabase', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue without antagonists if fetch fails
        }

        // Fetch narrative elements - wrap in try-catch in case tables don't exist yet
        let foreshadowingElements: ForeshadowingElement[] = [];
        let symbolicElements: SymbolicElement[] = [];
        let emotionalPayoffs: EmotionalPayoffMoment[] = [];
        let subtextElements: SubtextElement[] = [];
        
        try {
          const [foreshadowingRes, symbolicRes, emotionalRes, subtextRes] = await Promise.all([
            supabase.from('foreshadowing_elements').select('*').eq('novel_id', novelId),
            supabase.from('symbolic_elements').select('*').eq('novel_id', novelId),
            supabase.from('emotional_payoffs').select('*').eq('novel_id', novelId),
            supabase.from('subtext_elements').select('*').eq('novel_id', novelId),
          ]);

          if (foreshadowingRes.data && !foreshadowingRes.error) {
            foreshadowingElements = (foreshadowingRes.data as ForeshadowingElementRow[]).map((f) => ({
              id: f.id,
              novelId: f.novel_id,
              type: f.type as ForeshadowingType,
              content: f.content || '',
              introducedChapter: f.introduced_chapter,
              paidOffChapter: f.paid_off_chapter || undefined,
              status: f.status as ForeshadowingStatus,
              subtlety: f.subtlety as ForeshadowingSubtlety,
              relatedElement: f.related_element || undefined,
              chaptersReferenced: Array.isArray(f.chapters_referenced) ? (f.chapters_referenced as number[]) : [],
              notes: f.notes || '',
              createdAt: timestampToNumber(f.created_at),
              updatedAt: timestampToNumber(f.updated_at || f.created_at),
            }));
          }

          if (symbolicRes.data && !symbolicRes.error) {
            symbolicElements = (symbolicRes.data as SymbolicElementRow[]).map((s) => ({
              id: s.id,
              novelId: s.novel_id,
              name: s.name || '',
              symbolicMeaning: s.symbolic_meaning || '',
              firstAppearedChapter: s.first_appeared_chapter,
              chaptersAppeared: Array.isArray(s.chapters_appeared) ? (s.chapters_appeared as number[]) : [],
              evolutionNotes: Array.isArray(s.evolution_notes) ? (s.evolution_notes as string[]) : [],
              relatedThemes: Array.isArray(s.related_themes) ? (s.related_themes as string[]) : [],
              notes: s.notes || '',
              createdAt: timestampToNumber(s.created_at),
              updatedAt: timestampToNumber(s.updated_at || s.created_at),
            }));
          }

          if (emotionalRes.data && !emotionalRes.error) {
            emotionalPayoffs = (emotionalRes.data as EmotionalPayoffRow[]).map((e) => ({
              id: e.id,
              novelId: e.novel_id,
              type: e.type as EmotionalPayoffType,
              description: e.description || '',
              chapterNumber: e.chapter_number,
              intensity: Math.min(5, Math.max(1, e.intensity)) as EmotionalIntensity,
              charactersInvolved: Array.isArray(e.characters_involved) ? (e.characters_involved as string[]) : [],
              setupChapters: Array.isArray(e.setup_chapters) ? (e.setup_chapters as number[]) : [],
              readerImpact: e.reader_impact || '',
              notes: e.notes || '',
              createdAt: timestampToNumber(e.created_at),
              updatedAt: timestampToNumber(e.updated_at || e.created_at),
            }));
          }

          if (subtextRes.data && !subtextRes.error) {
            subtextElements = (subtextRes.data as SubtextElementRow[]).map((s) => ({
              id: s.id,
              novelId: s.novel_id,
              chapterId: s.chapter_id || undefined,
              sceneId: s.scene_id || undefined,
              type: s.type as SubtextType,
              surfaceContent: s.surface_content || '',
              hiddenMeaning: s.hidden_meaning || '',
              charactersInvolved: Array.isArray(s.characters_involved) ? (s.characters_involved as string[]) : [],
              significance: s.significance || undefined,
              relatedTo: s.related_to || undefined,
              notes: s.notes || '',
              createdAt: timestampToNumber(s.created_at),
              updatedAt: timestampToNumber(s.updated_at || s.created_at),
            }));
          }
        } catch (error) {
          logger.warn('Failed to fetch narrative elements (tables may not exist yet)', 'supabase', {
            error: error instanceof Error ? error.message : String(error)
          });
          // Continue without narrative elements if fetch fails
        }

        // Character sub-tables depend on character IDs
        const characterIds = charactersRows.map(c => c.id).filter(Boolean);
        const [skillsRes, itemsRes, relationshipsRes, possessionsRes, masteriesRes] = await Promise.all([
          characterIds.length > 0
            ? supabase.from('character_skills').select('*').in('character_id', characterIds)
            : Promise.resolve({ data: [], error: null } as any),
          characterIds.length > 0
            ? supabase.from('character_items').select('*').in('character_id', characterIds)
            : Promise.resolve({ data: [], error: null } as any),
          characterIds.length > 0
            ? supabase
                .from('relationships')
                .select('*')
                .or(
                  `character_id.in.(${characterIds.join(
                    ','
                  )}),target_character_id.in.(${characterIds.join(',')})`
                )
            : Promise.resolve({ data: [], error: null } as any),
          characterIds.length > 0
            ? supabase.from('character_item_possessions').select('*').in('character_id', characterIds)
            : Promise.resolve({ data: [], error: null } as any),
          characterIds.length > 0
            ? supabase.from('character_technique_mastery').select('*').in('character_id', characterIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        const skillsRows = ensureOk<CharacterSkillRow>('character_skills', skillsRes);
        const itemsRows = ensureOk<CharacterItemRow>('character_items', itemsRes);
        const relationshipsRows = ensureOk<RelationshipRow>('relationships', relationshipsRes);
        const possessionsRows = ensureOk<CharacterItemPossessionRow>('character_item_possessions', possessionsRes);
        const masteriesRows = ensureOk<CharacterTechniqueMasteryRow>('character_technique_mastery', masteriesRes);

        // Build characters with skills, items, and relationships
        const characterMap = new Map<string, Character>();
        charactersRows.forEach((char: any) => {
          characterMap.set(char.id, {
            id: char.id,
            name: char.name,
            age: char.age || '',
            personality: char.personality || '',
            currentCultivation: char.current_cultivation || '',
            notes: char.notes || '',
            portraitUrl: char.portrait_url || undefined,
            status: char.status as 'Alive' | 'Deceased' | 'Unknown',
            isProtagonist: char.is_protagonist || false,
            skills: [], // Backward compatibility
            items: [], // Backward compatibility
            techniqueMasteries: [],
            itemPossessions: [],
            relationships: [],
          });
        });

        // Add skills and items (backward compatibility)
        skillsRows.forEach((skill) => {
          const char = characterMap.get(skill.character_id);
          if (char) char.skills.push(skill.skill);
        });

        itemsRows.forEach((item) => {
          const char = characterMap.get(item.character_id);
          if (char) char.items.push(item.item);
        });

        // Add item possessions
        possessionsRows.forEach((poss) => {
          const char = characterMap.get(poss.character_id);
          if (char && !char.itemPossessions) char.itemPossessions = [];
          if (char) {
            char.itemPossessions!.push({
              id: poss.id,
              characterId: poss.character_id,
              itemId: poss.item_id,
              status: poss.status,
              acquiredChapter: poss.acquired_chapter || undefined,
              archivedChapter: poss.archived_chapter || undefined,
              notes: poss.notes || '',
              createdAt: timestampToNumber(poss.created_at),
              updatedAt: timestampToNumber(poss.updated_at),
            });
          }
        });

        // Add technique masteries
        masteriesRows.forEach((mast) => {
          const char = characterMap.get(mast.character_id);
          if (char && !char.techniqueMasteries) char.techniqueMasteries = [];
          if (char) {
            char.techniqueMasteries!.push({
              id: mast.id,
              characterId: mast.character_id,
              techniqueId: mast.technique_id,
              status: mast.status,
              masteryLevel: mast.mastery_level || 'Novice',
              learnedChapter: mast.learned_chapter || undefined,
              archivedChapter: mast.archived_chapter || undefined,
              notes: mast.notes || '',
              createdAt: timestampToNumber(mast.created_at),
              updatedAt: timestampToNumber(mast.updated_at),
            });
          }
        });

        // Add relationships
        relationshipsRows.forEach((rel) => {
          const char = characterMap.get(rel.character_id);
          if (char) {
            char.relationships.push({
              characterId: rel.target_character_id,
              type: rel.type,
              history: rel.history || '',
              impact: rel.impact || '',
            });
          }
        });

        return {
          id: novel.id,
          title: novel.title,
          genre: novel.genre,
          grandSaga: novel.grand_saga || '',
          currentRealmId: novel.current_realm_id || '',
          realms: realmsRows.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            status: r.status,
          })),
          territories: territoriesRows.map((t) => ({
            id: t.id,
            realmId: t.realm_id,
            name: t.name,
            type: t.type,
            description: t.description,
          })),
          worldBible: worldEntriesRows.map((w) => ({
            id: w.id,
            realmId: w.realm_id,
            category: w.category,
            title: w.title,
            content: w.content,
          })),
          novelItems: novelItemsRows.map((ni) => ({
            id: ni.id,
            novelId: ni.novel_id,
            name: ni.name,
            canonicalName: ni.canonical_name,
            description: ni.description || '',
            category: ni.category,
            powers: Array.isArray(ni.powers) ? (ni.powers as string[]) : [],
            history: ni.history || '',
            firstAppearedChapter: ni.first_appeared_chapter || undefined,
            lastReferencedChapter: ni.last_referenced_chapter || undefined,
            createdAt: timestampToNumber(ni.created_at),
            updatedAt: timestampToNumber(ni.updated_at || ni.created_at),
          })),
          novelTechniques: novelTechniquesRows.map((nt) => ({
            id: nt.id,
            novelId: nt.novel_id,
            name: nt.name,
            canonicalName: nt.canonical_name,
            description: nt.description || '',
            category: nt.category,
            type: nt.type,
            functions: Array.isArray(nt.functions) ? (nt.functions as string[]) : [],
            history: nt.history || '',
            firstAppearedChapter: nt.first_appeared_chapter || undefined,
            lastReferencedChapter: nt.last_referenced_chapter || undefined,
            createdAt: timestampToNumber(nt.created_at),
            updatedAt: timestampToNumber(nt.updated_at || nt.created_at),
          })),
          characterCodex: Array.from(characterMap.values()),
          chapters: chaptersRows.map((c) => ({
            id: c.id,
            number: c.number,
            title: c.title,
            content: c.content,
            summary: c.summary || '',
            logicAudit: (c.logic_audit as NovelState['chapters'][0]['logicAudit']) || undefined,
            scenes: scenesByChapter.get(c.id) || [],
            createdAt: timestampToNumber(c.created_at),
          })),
          plotLedger: arcsRows.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            status: a.status,
            startedAtChapter: typeof a.started_at_chapter === 'number' ? a.started_at_chapter : undefined,
            endedAtChapter: typeof a.ended_at_chapter === 'number' ? a.ended_at_chapter : undefined,
            targetChapters: typeof a.target_chapters === 'number' ? a.target_chapters : undefined,
            checklist: Array.isArray(a.checklist) ? (a.checklist as Arc['checklist']) : undefined,
          })),
          systemLogs: systemLogsRows.map((l) => ({
            id: l.id,
            message: l.message,
            type: l.type,
            timestamp: timestampToNumber(l.timestamp),
          })),
          tags: tagsRows.map((t) => ({
            id: t.id,
            novelId: t.novel_id,
            name: t.name,
            color: t.color || undefined,
            category: t.category || undefined,
            createdAt: timestampToNumber(t.created_at),
          })),
          writingGoals: writingGoalsRows.map((g) => ({
            id: g.id,
            novelId: g.novel_id,
            type: g.type as 'daily' | 'weekly' | 'total',
            target: g.target,
            current: g.current || 0,
            deadline: g.deadline ? timestampToNumber(g.deadline) : undefined,
            createdAt: timestampToNumber(g.created_at),
            updatedAt: timestampToNumber(g.updated_at),
          })),
          antagonists: antagonists,
          foreshadowingElements: foreshadowingElements,
          symbolicElements: symbolicElements,
          emotionalPayoffs: emotionalPayoffs,
          subtextElements: subtextElements,
          createdAt: timestampToNumber(novel.created_at),
          updatedAt: timestampToNumber(novel.updated_at),
        };
      })
    );

    return novelStates;
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });

  // Cache the result with 30 second TTL
  queryCache.set(cacheKey, novels, 30000);
  
  return novels;
};

/**
 * Saves a complete novel state to the database
 * 
 * Automatically sets user_id to the authenticated user.
 * Validates required fields before saving.
 * Uses transactions to ensure data consistency.
 * 
 * @param novel - The novel state to save
 * @returns Promise that resolves when save is complete
 * @throws {AppError} If user is not authenticated or validation fails
 * @throws {Error} If database save fails
 * 
 * @example
 * ```typescript
 * await saveNovel(updatedNovel);
 * console.log('Novel saved successfully');
 * ```
 */
export const saveNovel = async (novel: NovelState): Promise<void> => {
  // Validate required fields before saving (non-retryable errors)
  if (!novel.title || novel.title.trim() === '') {
    throw new AppError('Novel title cannot be empty', 'VALIDATION_ERROR', undefined, false);
  }
  if (!novel.genre || novel.genre.trim() === '') {
    throw new AppError('Novel genre cannot be empty', 'VALIDATION_ERROR', undefined, false);
  }

  return withRetry(async () => {
    // Get current authenticated user ID (returns null if authentication is disabled)
    const userId = await getCurrentUserId();
    // Only require authentication if authentication is enabled
    if (AUTHENTICATION_ENABLED && !userId) {
      throw new AppError('User must be authenticated to save novels', 'AUTH_ERROR', 401, false);
    }
    
    // Validate currentRealmId - must be a valid UUID present in the novel's realms.
    // IMPORTANT: The DB has a FK from novels.current_realm_id -> realms.id.
    // On first save (or if realms are not yet inserted), setting current_realm_id to a new realm
    // will violate the FK. So we do a 2-step save:
    //   1) Upsert novel with current_realm_id = NULL
    //   2) Upsert realms
    //   3) Update novel.current_realm_id to the desired realm (now that it exists)
    const desiredRealmId =
      novel.currentRealmId &&
      novel.currentRealmId.trim() !== '' &&
      novel.realms.some((r) => r.id === novel.currentRealmId)
        ? novel.currentRealmId
        : null;
    
    // Validate chapters have positive numbers
    const invalidChapters = novel.chapters.filter(c => c.number <= 0);
    if (invalidChapters.length > 0) {
      throw new Error(`Chapters must have positive numbers. Invalid chapters: ${invalidChapters.map(c => c.number).join(', ')}`);
    }
    
    // Validate chapters have non-empty titles and content
    const emptyChapters = novel.chapters.filter(c => 
      !c.title || c.title.trim() === '' || !c.content || c.content.trim() === ''
    );
    if (emptyChapters.length > 0) {
      throw new Error(`Chapters must have non-empty titles and content. Invalid chapters: ${emptyChapters.map(c => c.number).join(', ')}`);
    }
    
    // Step 1: upsert novel WITHOUT current_realm_id to avoid FK violation during initial writes.
    const novelData: any = {
      id: novel.id,
      title: novel.title.trim(),
      genre: novel.genre.trim(),
      grand_saga: novel.grandSaga || '',
      current_realm_id: null,
      updated_at: new Date().toISOString()
    };
    
    // Only add user_id if authentication is enabled
    if (userId) {
      novelData.user_id = userId;
    }
    
    const { error: novelError } = await supabase
      .from('novels')
      .upsert(novelData, { onConflict: 'id' })
      .select()
      .single();

    if (novelError) {
      logger.error('Error saving novel', 'supabase', novelError);
      throw new Error(`Failed to save novel: ${novelError.message}`);
    }

    const novelId = novel.id;

    // Delete orphaned data and upsert current data
    // This approach is safer than delete-all-then-insert because it preserves data if upsert fails
    
    // 1. Get existing IDs to identify what to delete
    const chapterIds = novel.chapters.map(c => c.id);
    const results = await Promise.allSettled([
      // Fetch realms with names to check for unique constraint conflicts
      supabase.from('realms').select('id, name').eq('novel_id', novelId),
      supabase.from('chapters').select('id').eq('novel_id', novelId),
      supabase.from('arcs').select('id').eq('novel_id', novelId),
      supabase.from('system_logs').select('id').eq('novel_id', novelId),
      supabase.from('characters').select('id').eq('novel_id', novelId),
      supabase.from('territories').select('id').in('realm_id', novel.realms.map(r => r.id)),
      supabase.from('world_entries').select('id').in('realm_id', novel.realms.map(r => r.id)),
      chapterIds.length > 0 ? supabase.from('scenes').select('id').in('chapter_id', chapterIds) : { data: [], error: null },
      supabase.from('tags').select('id').eq('novel_id', novelId),
      supabase.from('writing_goals').select('id').eq('novel_id', novelId),
      supabase.from('antagonists').select('id').eq('novel_id', novelId),
      (async () => {
        try {
          const res = await supabase.from('foreshadowing_elements').select('id').eq('novel_id', novelId);
          return res;
        } catch {
          return { data: [], error: null };
        }
      })(),
      (async () => {
        try {
          const res = await supabase.from('symbolic_elements').select('id').eq('novel_id', novelId);
          return res;
        } catch {
          return { data: [], error: null };
        }
      })(),
      (async () => {
        try {
          const res = await supabase.from('emotional_payoffs').select('id').eq('novel_id', novelId);
          return res;
        } catch {
          return { data: [], error: null };
        }
      })(),
      (async () => {
        try {
          const res = await supabase.from('subtext_elements').select('id').eq('novel_id', novelId);
          return res;
        } catch {
          return { data: [], error: null };
        }
      })()
    ]);

    // Extract results from Promise.allSettled
    const existingRealms = results[0].status === 'fulfilled' && results[0].value.data ? results[0].value.data : [];
    const existingChapters = results[1].status === 'fulfilled' && results[1].value.data ? results[1].value.data : [];
    const existingArcs = results[2].status === 'fulfilled' && results[2].value.data ? results[2].value.data : [];
    const existingLogs = results[3].status === 'fulfilled' && results[3].value.data ? results[3].value.data : [];
    const existingCharacters = results[4].status === 'fulfilled' && results[4].value.data ? results[4].value.data : [];
    const existingTerritories = results[5].status === 'fulfilled' && results[5].value.data ? results[5].value.data : [];
    const existingWorldEntries = results[6].status === 'fulfilled' && results[6].value.data ? results[6].value.data : [];
    const existingScenes = results[7].status === 'fulfilled' && results[7].value.data ? results[7].value.data : [];
    const existingTags = results[8].status === 'fulfilled' && results[8].value.data ? results[8].value.data : [];
    const existingWritingGoals = results[9].status === 'fulfilled' && results[9].value.data ? results[9].value.data : [];
    const existingAntagonists = results[10].status === 'fulfilled' && results[10].value.data ? results[10].value.data : [];
    const existingForeshadowing = results[11].status === 'fulfilled' && results[11].value.data ? results[11].value.data : [];
    const existingSymbolic = results[12].status === 'fulfilled' && results[12].value.data ? results[12].value.data : [];
    const existingEmotionalPayoffs = results[13].status === 'fulfilled' && results[13].value.data ? results[13].value.data : [];
    const existingSubtext = results[14].status === 'fulfilled' && results[14].value.data ? results[14].value.data : [];

    // For realms: need to handle unique constraint on (novel_id, name)
    // The database has a unique constraint: realms_novel_name_unique on (novel_id, name)
    // First, deduplicate realms within the array itself (case-insensitive)
    const seenNames = new Set<string>();
    const deduplicatedRealms = novel.realms.filter(r => {
      const nameLower = r.name.toLowerCase().trim();
      if (seenNames.has(nameLower)) {
        logger.warn('Duplicate realm name detected, keeping first occurrence only', 'supabase', {
          realmName: r.name
        });
        return false;
      }
      seenNames.add(nameLower);
      return true;
    });

    // Calculate IDs to delete (using deduplicated realms)
    const currentRealmIds = new Set(deduplicatedRealms.map(r => r.id));
    const currentChapterIds = new Set(novel.chapters.map(c => c.id));
    const currentArcIds = new Set(novel.plotLedger.map(a => a.id));
    const currentLogIds = new Set(novel.systemLogs.map(l => l.id));
    const currentCharacterIds = new Set(novel.characterCodex.map(c => c.id));
    const currentTerritoryIds = new Set(novel.territories.map(t => t.id));
    const currentWorldEntryIds = new Set(novel.worldBible.map(w => w.id));
    const currentTagIds = new Set(novel.tags.map(t => t.id));
    const currentWritingGoalIds = new Set(novel.writingGoals.map(g => g.id));
    const currentAntagonistIds = new Set((novel.antagonists || []).map((a: Antagonist) => a.id));
    const currentForeshadowingIds = new Set((novel.foreshadowingElements || []).map(f => f.id));
    const currentSymbolicIds = new Set((novel.symbolicElements || []).map(s => s.id));
    const currentEmotionalPayoffIds = new Set((novel.emotionalPayoffs || []).map(e => e.id));
    const currentSubtextIds = new Set((novel.subtextElements || []).map(s => s.id));
    
    // Collect all scene IDs from chapters
    const currentSceneIds = new Set<string>();
    novel.chapters.forEach(ch => {
      ch.scenes.forEach(s => currentSceneIds.add(s.id));
    });

    // Now check for conflicts with existing realms in DB:
    // 1. Delete orphaned realms (not in current list)
    // 2. Delete existing realms that have same name as new realm but different ID (unique constraint conflict)
    
    // Now check for conflicts with existing realms in DB
    const realmIdsToDelete: string[] = [];
    const newRealmNamesLower = new Set(deduplicatedRealms.map(r => r.name.toLowerCase().trim()));
    
    if (existingRealms) {
      for (const existing of existingRealms) {
        const existingNameLower = existing.name.toLowerCase().trim();
        const existingInCurrent = currentRealmIds.has(existing.id);
        const nameMatchesNewRealm = newRealmNamesLower.has(existingNameLower);
        
        // Delete if:
        // 1. Not in current list (orphaned), OR
        // 2. Has same name as a new realm but different ID (unique constraint conflict)
        if (!existingInCurrent) {
          realmIdsToDelete.push(existing.id);
        } else if (nameMatchesNewRealm) {
          // Check if the existing realm with same name has a different ID
          const newRealmWithSameName = deduplicatedRealms.find(r => 
            r.name.toLowerCase().trim() === existingNameLower && r.id !== existing.id
          );
          if (newRealmWithSameName) {
            // Delete the existing realm to allow the new one to be saved
            realmIdsToDelete.push(existing.id);
          }
        }
      }
    }
    
    // Remove duplicates
    const uniqueRealmIdsToDelete = Array.from(new Set(realmIdsToDelete));
    
    // Update novel.realms to use deduplicated version (for rest of save operation)
    novel.realms = deduplicatedRealms;
    
    // Calculate IDs to delete (but don't delete yet - we'll do it AFTER all upserts)
    const chapterIdsToDelete = existingChapters?.map(c => c.id).filter(id => !currentChapterIds.has(id)) || [];
    const arcIdsToDelete = existingArcs?.map(a => a.id).filter(id => !currentArcIds.has(id)) || [];
    const logIdsToDelete = existingLogs?.map(l => l.id).filter(id => !currentLogIds.has(id)) || [];
    const characterIdsToDelete = existingCharacters?.map(c => c.id).filter(id => !currentCharacterIds.has(id)) || [];
    const territoryIdsToDelete = existingTerritories?.map(t => t.id).filter(id => !currentTerritoryIds.has(id)) || [];
    const worldEntryIdsToDelete = existingWorldEntries?.map(w => w.id).filter(id => !currentWorldEntryIds.has(id)) || [];
    const sceneIdsToDelete = existingScenes?.map(s => s.id).filter(id => !currentSceneIds.has(id)) || [];
    const tagIdsToDelete = (existingTags || []).map((t: any) => t.id).filter((id: string) => !currentTagIds.has(id));
    const writingGoalIdsToDelete = (existingWritingGoals || []).map((g: any) => g.id).filter((id: string) => !currentWritingGoalIds.has(id));
    const antagonistIdsToDelete = (existingAntagonists || []).map((a: any) => a.id).filter((id: string) => !currentAntagonistIds.has(id));
    const foreshadowingIdsToDelete = (existingForeshadowing || []).map((f: any) => f.id).filter((id: string) => !currentForeshadowingIds.has(id));
    const symbolicIdsToDelete = (existingSymbolic || []).map((s: any) => s.id).filter((id: string) => !currentSymbolicIds.has(id));
    const emotionalPayoffIdsToDelete = (existingEmotionalPayoffs || []).map((e: any) => e.id).filter((id: string) => !currentEmotionalPayoffIds.has(id));
    const subtextIdsToDelete = (existingSubtext || []).map((s: any) => s.id).filter((id: string) => !currentSubtextIds.has(id));

    // CRITICAL: For realms, we need to handle unique constraint on (novel_id, name)
    // Delete conflicting realms FIRST before upserting to avoid unique constraint violations
    // This ensures we don't have two realms with the same name for the same novel
    if (uniqueRealmIdsToDelete.length > 0) {
      const { error: deleteRealmsError } = await supabase
        .from('realms')
        .delete()
        .in('id', uniqueRealmIdsToDelete);
      
      if (deleteRealmsError) {
        logger.error('Error deleting conflicting realms', 'supabase', deleteRealmsError);
        throw deleteRealmsError;
      }
    }
    
    // Now upsert Realms (needed by other tables)
    // After deleting conflicts, we can safely upsert
    if (novel.realms.length > 0) {
      // Map realms to database format, ensuring names are trimmed
      const realmsToUpsert = novel.realms.map(r => ({
        id: r.id,
        novel_id: novelId,
        name: r.name.trim(),
        description: r.description || '',
        status: r.status || 'current'
      }));
      
      // Delete any remaining conflicts: existing realms with same (novel_id, name) but different ID
      // This handles edge cases where the earlier deletion might have missed something
      for (const realm of realmsToUpsert) {
        const { data: conflicting } = await supabase
          .from('realms')
          .select('id')
          .eq('novel_id', realm.novel_id)
          .eq('name', realm.name)
          .neq('id', realm.id);
        
        if (conflicting && conflicting.length > 0) {
          const conflictIds = conflicting.map(c => c.id);
          await supabase.from('realms').delete().in('id', conflictIds);
        }
      }
      
      // Now upsert - this should work since we've deleted all conflicts
      const { error: realmsError } = await supabase
        .from('realms')
        .upsert(realmsToUpsert, { 
          onConflict: 'id'
        });

      if (realmsError) {
        logger.error('Error upserting realms', 'supabase', realmsError);
        throw realmsError;
      }
    }

    // Step 3: now that realms exist, update the novel's current_realm_id (if any).
    if (desiredRealmId) {
      const { error: setRealmError } = await supabase
        .from('novels')
        .update({
          current_realm_id: desiredRealmId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', novelId);

      if (setRealmError) {
        logger.error('Error updating current_realm_id', 'supabase', setRealmError);
        throw new Error(`Failed to set current realm: ${setRealmError.message}`);
      }
    }

    // Upsert Chapters EARLY (before deletion) to prevent loss if save fails
    if (novel.chapters.length > 0) {
      const validChapters = novel.chapters.filter(c => c.title && c.title.trim() !== '' && c.content && c.content.trim() !== '' && c.number > 0);
      if (validChapters.length > 0) {
        const { error: chaptersError } = await supabase
          .from('chapters')
          .upsert(validChapters.map(c => ({
            id: c.id,
            novel_id: novelId,
            number: c.number,
            title: c.title.trim(),
            content: c.content.trim(),
            summary: c.summary || '',
            logic_audit: c.logicAudit || null
          })), { onConflict: 'id' });

        if (chaptersError) throw new Error(`Failed to save chapters: ${chaptersError.message}`);
      }
      
      // Upsert Scenes for all chapters
      const allScenes: Scene[] = [];
      validChapters.forEach(chapter => {
        if (chapter.scenes && chapter.scenes.length > 0) {
          chapter.scenes.forEach(scene => {
            allScenes.push(scene);
          });
        }
      });
      
      if (allScenes.length > 0) {
        const validScenes = allScenes.filter(s => s.chapterId && s.number > 0);
        if (validScenes.length > 0) {
          const { error: scenesError } = await supabase
            .from('scenes')
            .upsert(validScenes.map(s => ({
              id: s.id,
              chapter_id: s.chapterId,
              number: s.number,
              title: s.title || '',
              content: s.content || '',
              summary: s.summary || '',
              word_count: s.wordCount || 0
            })), { onConflict: 'id' });
            
          if (scenesError) throw new Error(`Failed to save scenes: ${scenesError.message}`);
        }
      }
    }

    // Upsert Territories
    if (novel.territories.length > 0) {
      // Filter out territories with invalid realmIds (empty strings or invalid UUIDs)
      // Only include territories with valid realmIds that exist in the novel's realms
      const validRealmIds = new Set(novel.realms.map(r => r.id));
      const validTerritories = novel.territories.filter(t => {
        const hasValidName = t.name && t.name.trim() !== '';
        const hasValidRealmId = t.realmId && 
                                t.realmId.trim() !== '' && 
                                validRealmIds.has(t.realmId);
        return hasValidName && hasValidRealmId;
      });
      
      if (validTerritories.length > 0) {
        const { error: territoriesError } = await supabase
          .from('territories')
          .upsert(validTerritories.map(t => ({
            id: t.id,
            realm_id: t.realmId,
            name: t.name.trim(),
            type: t.type,
            description: t.description || ''
          })), { onConflict: 'id' });

        if (territoriesError) throw new Error(`Failed to save territories: ${territoriesError.message}`);
      }
    }

    // Upsert World Entries
    // Filter out world entries with invalid realmIds (empty strings or invalid UUIDs)
    const validRealmIds = new Set(novel.realms.map(r => r.id));
    const validWorldEntries = novel.worldBible.filter(w => {
      const hasValidContent = w.content != null && w.content.trim() !== '';
      const hasValidTitle = w.title != null && w.title.trim() !== '';
      const hasValidRealmId = w.realmId && 
                              w.realmId.trim() !== '' && 
                              validRealmIds.has(w.realmId);
      return hasValidContent && hasValidTitle && hasValidRealmId;
    });
    
    if (validWorldEntries.length > 0) {
      const { error: worldError } = await supabase
        .from('world_entries')
        .upsert(validWorldEntries.map(w => ({
          id: w.id,
          realm_id: w.realmId,
          category: w.category,
          title: w.title.trim(),
          content: w.content.trim()
        })), { onConflict: 'id' });

      if (worldError) throw worldError;
    }

    // Helper function to normalize character status to match database constraint
    const normalizeCharacterStatus = (status: string | undefined | null): 'Alive' | 'Deceased' | 'Unknown' => {
      if (!status) return 'Unknown';
      const normalized = status.trim();
      // Case-insensitive matching
      const lower = normalized.toLowerCase();
      if (lower === 'alive') return 'Alive';
      if (lower === 'deceased' || lower === 'dead') return 'Deceased';
      if (lower === 'unknown') return 'Unknown';
      // Default to 'Unknown' if value doesn't match
      logger.warn('Invalid character status, defaulting to Unknown', 'supabase', {
        invalidStatus: status
      });
      return 'Unknown';
    };

    // Upsert Novel Items (canonical items registry)
    if (novel.novelItems && novel.novelItems.length > 0) {
      const validItems = novel.novelItems.filter(item => item.name && item.name.trim() !== '');
      if (validItems.length > 0) {
        const { error: itemsError } = await supabase
          .from('novel_items')
          .upsert(validItems.map(item => ({
            id: item.id,
            novel_id: novelId,
            name: item.name.trim(),
            canonical_name: item.canonicalName,
            description: item.description || '',
            category: item.category,
            powers: item.powers || [],
            history: item.history || '',
            first_appeared_chapter: item.firstAppearedChapter || null,
            last_referenced_chapter: item.lastReferencedChapter || null,
            updated_at: new Date(item.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (itemsError) throw new Error(`Failed to save novel items: ${itemsError.message}`);
      }
    }

    // Upsert Novel Techniques (canonical techniques registry)
    if (novel.novelTechniques && novel.novelTechniques.length > 0) {
      const validTechniques = novel.novelTechniques.filter(tech => tech.name && tech.name.trim() !== '');
      if (validTechniques.length > 0) {
        const { error: techniquesError } = await supabase
          .from('novel_techniques')
          .upsert(validTechniques.map(tech => ({
            id: tech.id,
            novel_id: novelId,
            name: tech.name.trim(),
            canonical_name: tech.canonicalName,
            description: tech.description || '',
            category: tech.category,
            type: tech.type,
            functions: tech.functions || [],
            history: tech.history || '',
            first_appeared_chapter: tech.firstAppearedChapter || null,
            last_referenced_chapter: tech.lastReferencedChapter || null,
            updated_at: new Date(tech.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (techniquesError) throw new Error(`Failed to save novel techniques: ${techniquesError.message}`);
      }
    }

    // Upsert Characters
    if (novel.characterCodex.length > 0) {
      const validCharacters = novel.characterCodex.filter(c => c.name && c.name.trim() !== '');
      if (validCharacters.length > 0) {
        const { error: charsError } = await supabase
          .from('characters')
          .upsert(validCharacters.map(c => ({
            id: c.id,
            novel_id: novelId,
            name: c.name.trim(),
            age: c.age || '',
            personality: c.personality || '',
            current_cultivation: c.currentCultivation || '',
            notes: c.notes || '',
            portrait_url: c.portraitUrl || null,
            status: normalizeCharacterStatus(c.status),
            is_protagonist: c.isProtagonist || false
          })), { onConflict: 'id' });

        if (charsError) throw new Error(`Failed to save characters: ${charsError.message}`);

        // Update skills/items/relationships (delete all for current chars and re-insert is safer for sub-tables to avoid diffing complex lists)
        // Optimization: only delete/insert if there are changes? For now, we stick to delete-insert for sub-resources as they are small lists per character
        // We use the 'validCharacters' IDs
        const charIds = validCharacters.map(c => c.id);
        
        await Promise.all([
           supabase.from('character_skills').delete().in('character_id', charIds),
           supabase.from('character_items').delete().in('character_id', charIds),
           supabase.from('relationships').delete().in('character_id', charIds), // Only delete outgoing relationships to avoid clearing others' links
           supabase.from('character_item_possessions').delete().in('character_id', charIds),
           supabase.from('character_technique_mastery').delete().in('character_id', charIds)
        ]);

        const skillsInserts: any[] = [];
        const itemsInserts: any[] = [];
        const relationshipsInserts: any[] = [];
        const possessionsInserts: any[] = [];
        const masteriesInserts: any[] = [];

        validCharacters.forEach(char => {
            // Backward compatibility: save old skills/items format
            if (char.skills) char.skills.forEach(skill => skillsInserts.push({ character_id: char.id, skill }));
            if (char.items) char.items.forEach(item => itemsInserts.push({ character_id: char.id, item }));
            // New format: item possessions and technique masteries
            if (char.itemPossessions) {
              char.itemPossessions.forEach(poss => {
                possessionsInserts.push({
                  id: poss.id,
                  character_id: poss.characterId,
                  item_id: poss.itemId,
                  status: poss.status,
                  acquired_chapter: poss.acquiredChapter || null,
                  archived_chapter: poss.archivedChapter || null,
                  notes: poss.notes || '',
                  updated_at: new Date(poss.updatedAt || Date.now()).toISOString()
                });
              });
            }
            if (char.techniqueMasteries) {
              char.techniqueMasteries.forEach(mast => {
                masteriesInserts.push({
                  id: mast.id,
                  character_id: mast.characterId,
                  technique_id: mast.techniqueId,
                  status: mast.status,
                  mastery_level: mast.masteryLevel || 'Novice',
                  learned_chapter: mast.learnedChapter || null,
                  archived_chapter: mast.archivedChapter || null,
                  notes: mast.notes || '',
                  updated_at: new Date(mast.updatedAt || Date.now()).toISOString()
                });
              });
            }
            if (char.relationships) char.relationships.forEach(rel => relationshipsInserts.push({
                character_id: char.id,
                target_character_id: rel.characterId,
                type: rel.type,
                history: rel.history,
                impact: rel.impact
            }));
        });

        // Use upsert for tables with unique constraints to avoid 409 conflicts
        if (skillsInserts.length > 0) {
          await supabase.from('character_skills')
            .upsert(skillsInserts, { onConflict: 'character_id,skill' });
        }
        if (itemsInserts.length > 0) {
          await supabase.from('character_items')
            .upsert(itemsInserts, { onConflict: 'character_id,item' });
        }
        if (relationshipsInserts.length > 0) {
          await supabase.from('relationships')
            .upsert(relationshipsInserts, { onConflict: 'character_id,target_character_id' });
        }
        // Use upsert for tables with unique constraints to avoid 409 conflicts
        if (possessionsInserts.length > 0) {
          await supabase.from('character_item_possessions')
            .upsert(possessionsInserts, { onConflict: 'character_id,item_id' });
        }
        if (masteriesInserts.length > 0) {
          try {
            // Remove duplicates by (character_id, technique_id) before upsert
            const uniqueMasteries = Array.from(
              new Map(
                masteriesInserts.map(m => [`${m.character_id}_${m.technique_id}`, m])
              ).values()
            );
            
            const { error: masteryError } = await supabase
              .from('character_technique_mastery')
              .upsert(uniqueMasteries, { onConflict: 'character_id,technique_id' });
            
            if (masteryError) {
              logger.warn('Error upserting character technique masteries', 'supabase', {
                error: masteryError instanceof Error ? masteryError.message : String(masteryError)
              });
              // Don't throw - this is not critical for novel saving
            }
          } catch (masteryError) {
            logger.warn('Error upserting character technique masteries', 'supabase', {
              error: masteryError instanceof Error ? masteryError.message : String(masteryError)
            });
            // Don't throw - continue with other saves
          }
        }
      }
    }

    // Chapters were already upserted earlier (before deletion) to prevent data loss

    // Upsert Arcs
    if (novel.plotLedger.length > 0) {
      const validArcs = novel.plotLedger.filter(a => a.title && a.title.trim() !== '');
      if (validArcs.length > 0) {
        const { error: arcsError } = await supabase
          .from('arcs')
          .upsert(validArcs.map(a => ({
            id: a.id,
            novel_id: novelId,
            title: a.title.trim(),
            description: a.description || '',
            status: a.status,
            started_at_chapter: typeof a.startedAtChapter === 'number' ? a.startedAtChapter : null,
            ended_at_chapter: typeof a.endedAtChapter === 'number' ? a.endedAtChapter : null,
            target_chapters: typeof a.targetChapters === 'number' ? a.targetChapters : null,
            checklist: a.checklist || [],
          })), { onConflict: 'id' });

        if (arcsError) throw new Error(`Failed to save arcs: ${arcsError.message}`);
      }
    }

    // Upsert System Logs
    // We only save the last 100 logs. The logic earlier filtered this.
    const recentLogs = novel.systemLogs.slice(-100);
    const validLogs = recentLogs.filter(l => l.message && l.message.trim() !== '');
    if (validLogs.length > 0) {
        const { error: logsError } = await supabase
          .from('system_logs')
          .upsert(validLogs.map(l => ({
            id: l.id,
            novel_id: novelId,
            message: l.message.trim(),
            type: l.type,
            timestamp: new Date(l.timestamp).toISOString()
          })), { onConflict: 'id' });

        if (logsError) {
          throw new AppError(
            `Failed to save system logs: ${logsError.message}`,
            logsError.code,
            undefined,
            isRetryableError(logsError)
          );
        }
    }

    // Upsert Tags
    if (novel.tags && novel.tags.length > 0) {
      const validTags = novel.tags.filter(t => t.name && t.name.trim() !== '');
      if (validTags.length > 0) {
        const { error: tagsError } = await supabase
          .from('tags')
          .upsert(validTags.map(t => ({
            id: t.id,
            novel_id: novelId,
            name: t.name.trim(),
            color: t.color || null,
            category: t.category || null
          })), { onConflict: 'id' });
          
        if (tagsError) throw new Error(`Failed to save tags: ${tagsError.message}`);
      }
    }

    // Upsert Writing Goals
    if (novel.writingGoals && novel.writingGoals.length > 0) {
      const validGoals = novel.writingGoals.filter(g => g.target > 0);
      if (validGoals.length > 0) {
        const { error: goalsError } = await supabase
          .from('writing_goals')
          .upsert(validGoals.map(g => ({
            id: g.id,
            novel_id: novelId,
            type: g.type,
            target: g.target,
            current: g.current || 0,
            deadline: g.deadline ? new Date(g.deadline).toISOString() : null
          })), { onConflict: 'id' });
          
        if (goalsError) throw new Error(`Failed to save writing goals: ${goalsError.message}`);
      }
    }

    // Upsert Antagonists
    if (novel.antagonists && novel.antagonists.length > 0) {
      const validAntagonists = novel.antagonists.filter(a => a.name && a.name.trim() !== '');
      if (validAntagonists.length > 0) {
        const { error: antagonistsError } = await supabase
          .from('antagonists')
          .upsert(validAntagonists.map(a => ({
            id: a.id,
            novel_id: novelId,
            name: a.name.trim(),
            type: a.type,
            description: a.description || '',
            motivation: a.motivation || '',
            power_level: a.powerLevel || '',
            status: a.status,
            first_appeared_chapter: a.firstAppearedChapter || null,
            last_appeared_chapter: a.lastAppearedChapter || null,
            resolved_chapter: a.resolvedChapter || null,
            duration_scope: a.durationScope,
            threat_level: a.threatLevel,
            notes: a.notes || '',
          })), { onConflict: 'id' });

        if (antagonistsError) throw new Error(`Failed to save antagonists: ${antagonistsError.message}`);

        // Handle antagonist relationships, arc associations, and group members
        const antagonistIds = validAntagonists.map(a => a.id);
        
        // Delete existing relationships/associations for these antagonists
        await Promise.all([
          supabase.from('antagonist_relationships').delete().in('antagonist_id', antagonistIds),
          supabase.from('antagonist_arcs').delete().in('antagonist_id', antagonistIds),
          supabase.from('antagonist_groups').delete().in('antagonist_id', antagonistIds),
        ]);

        // Insert relationships
        const relationshipInserts: any[] = [];
        validAntagonists.forEach(ant => {
          if (ant.relationships) {
            ant.relationships.forEach(rel => {
              relationshipInserts.push({
                antagonist_id: ant.id,
                character_id: rel.characterId,
                relationship_type: rel.relationshipType,
                intensity: rel.intensity,
                history: rel.history || '',
                current_state: rel.currentState || '',
              });
            });
          }
        });
        if (relationshipInserts.length > 0) {
          await supabase.from('antagonist_relationships')
            .upsert(relationshipInserts, { onConflict: 'antagonist_id,character_id' });
        }

        // Insert arc associations
        const arcAssociationInserts: any[] = [];
        validAntagonists.forEach(ant => {
          if (ant.arcAssociations) {
            ant.arcAssociations.forEach(assoc => {
              arcAssociationInserts.push({
                antagonist_id: ant.id,
                arc_id: assoc.arcId,
                role: assoc.role,
                introduced_in_arc: assoc.introducedInArc || false,
                resolved_in_arc: assoc.resolvedInArc || false,
                notes: assoc.notes || '',
              });
            });
          }
        });
        if (arcAssociationInserts.length > 0) {
          await supabase.from('antagonist_arcs')
            .upsert(arcAssociationInserts, { onConflict: 'antagonist_id,arc_id' });
        }

        // Insert group members
        const groupMemberInserts: any[] = [];
        validAntagonists.forEach(ant => {
          if (ant.groupMembers) {
            ant.groupMembers.forEach(member => {
              groupMemberInserts.push({
                antagonist_id: ant.id,
                member_character_id: member.memberCharacterId,
                role_in_group: member.roleInGroup,
                joined_chapter: member.joinedChapter || null,
                left_chapter: member.leftChapter || null,
                notes: member.notes || '',
              });
            });
          }
        });
        if (groupMemberInserts.length > 0) {
          await supabase.from('antagonist_groups').insert(groupMemberInserts);
        }
      }
    }

    // Upsert Narrative Elements
    // Foreshadowing Elements
    if (novel.foreshadowingElements && novel.foreshadowingElements.length > 0) {
      const validForeshadowing = novel.foreshadowingElements.filter(f => f.content && f.content.trim() !== '' && f.introducedChapter > 0);
      if (validForeshadowing.length > 0) {
        const { error: foreshadowingError } = await supabase
          .from('foreshadowing_elements')
          .upsert(validForeshadowing.map(f => ({
            id: f.id,
            novel_id: novelId,
            type: f.type,
            content: f.content.trim(),
            introduced_chapter: f.introducedChapter,
            paid_off_chapter: f.paidOffChapter || null,
            status: f.status,
            subtlety: f.subtlety,
            related_element: f.relatedElement || '',
            chapters_referenced: f.chaptersReferenced || [],
            notes: f.notes || '',
            updated_at: new Date(f.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (foreshadowingError) {
          logger.warn('Failed to save foreshadowing elements', 'supabase', foreshadowingError);
          // Don't throw - these tables might not exist yet
        }
      }
    }

    // Symbolic Elements
    if (novel.symbolicElements && novel.symbolicElements.length > 0) {
      const validSymbolic = novel.symbolicElements.filter(s => s.name && s.name.trim() !== '' && s.firstAppearedChapter > 0);
      if (validSymbolic.length > 0) {
        const { error: symbolicError } = await supabase
          .from('symbolic_elements')
          .upsert(validSymbolic.map(s => ({
            id: s.id,
            novel_id: novelId,
            name: s.name.trim(),
            symbolic_meaning: s.symbolicMeaning || '',
            first_appeared_chapter: s.firstAppearedChapter,
            chapters_appeared: s.chaptersAppeared || [],
            evolution_notes: s.evolutionNotes || [],
            related_themes: s.relatedThemes || [],
            notes: s.notes || '',
            updated_at: new Date(s.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (symbolicError) {
          logger.warn('Failed to save symbolic elements', 'supabase', {
            error: symbolicError instanceof Error ? symbolicError.message : String(symbolicError),
            code: (symbolicError as any)?.code
          });
          // Don't throw - these tables might not exist yet
        }
      }
    }

    // Emotional Payoffs
    if (novel.emotionalPayoffs && novel.emotionalPayoffs.length > 0) {
      const validPayoffs = novel.emotionalPayoffs.filter(e => e.description && e.description.trim() !== '' && e.chapterNumber > 0);
      if (validPayoffs.length > 0) {
        const { error: payoffsError } = await supabase
          .from('emotional_payoffs')
          .upsert(validPayoffs.map(e => ({
            id: e.id,
            novel_id: novelId,
            type: e.type,
            description: e.description.trim(),
            chapter_number: e.chapterNumber,
            intensity: e.intensity,
            characters_involved: e.charactersInvolved || [],
            setup_chapters: e.setupChapters || [],
            reader_impact: e.readerImpact || '',
            notes: e.notes || '',
            updated_at: new Date(e.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (payoffsError) {
          logger.warn('Failed to save emotional payoffs', 'supabase', {
            error: payoffsError instanceof Error ? payoffsError.message : String(payoffsError),
            code: (payoffsError as any)?.code
          });
          // Don't throw - these tables might not exist yet
        }
      }
    }

    // Subtext Elements
    if (novel.subtextElements && novel.subtextElements.length > 0) {
      const validSubtext = novel.subtextElements.filter(s => s.surfaceContent && s.surfaceContent.trim() !== '');
      if (validSubtext.length > 0) {
        const { error: subtextError } = await supabase
          .from('subtext_elements')
          .upsert(validSubtext.map(s => ({
            id: s.id,
            novel_id: novelId,
            chapter_id: s.chapterId || null,
            scene_id: s.sceneId || null,
            type: s.type,
            surface_content: s.surfaceContent.trim(),
            hidden_meaning: s.hiddenMeaning || '',
            characters_involved: s.charactersInvolved || [],
            significance: s.significance || null,
            related_to: s.relatedTo || null,
            notes: s.notes || '',
            updated_at: new Date(s.updatedAt || Date.now()).toISOString()
          })), { onConflict: 'id' });

        if (subtextError) {
          logger.warn('Failed to save subtext elements', 'supabase', {
            error: subtextError instanceof Error ? subtextError.message : String(subtextError),
            code: (subtextError as any)?.code
          });
          // Don't throw - these tables might not exist yet
        }
      }
    }

    // NOW delete orphaned data (AFTER all upserts succeed, so we don't lose data if save fails)
    // Note: Realms with conflicts were already deleted before upserting to avoid unique constraint violations
    // We don't need to delete realms again here since they were already handled above
    const deletePromises = [];
    if (chapterIdsToDelete.length > 0) deletePromises.push(supabase.from('chapters').delete().in('id', chapterIdsToDelete));
    if (arcIdsToDelete.length > 0) deletePromises.push(supabase.from('arcs').delete().in('id', arcIdsToDelete));
    if (logIdsToDelete.length > 0) deletePromises.push(supabase.from('system_logs').delete().in('id', logIdsToDelete));
    if (characterIdsToDelete.length > 0) deletePromises.push(supabase.from('characters').delete().in('id', characterIdsToDelete));
    if (territoryIdsToDelete.length > 0) deletePromises.push(supabase.from('territories').delete().in('id', territoryIdsToDelete));
    if (worldEntryIdsToDelete.length > 0) deletePromises.push(supabase.from('world_entries').delete().in('id', worldEntryIdsToDelete));
    if (sceneIdsToDelete.length > 0) deletePromises.push(supabase.from('scenes').delete().in('id', sceneIdsToDelete));
    if (tagIdsToDelete.length > 0) deletePromises.push(supabase.from('tags').delete().in('id', tagIdsToDelete));
    if (writingGoalIdsToDelete.length > 0) deletePromises.push(supabase.from('writing_goals').delete().in('id', writingGoalIdsToDelete));
    if (antagonistIdsToDelete.length > 0) {
      // Also delete related antagonist data
      deletePromises.push(
        supabase.from('antagonists').delete().in('id', antagonistIdsToDelete),
        supabase.from('antagonist_relationships').delete().in('antagonist_id', antagonistIdsToDelete),
        supabase.from('antagonist_arcs').delete().in('antagonist_id', antagonistIdsToDelete),
        supabase.from('antagonist_chapters').delete().in('antagonist_id', antagonistIdsToDelete),
        supabase.from('antagonist_groups').delete().in('antagonist_id', antagonistIdsToDelete),
        supabase.from('antagonist_progression').delete().in('antagonist_id', antagonistIdsToDelete)
      );
    }
    if (foreshadowingIdsToDelete.length > 0) {
      deletePromises.push(
        supabase.from('foreshadowing_elements').delete().in('id', foreshadowingIdsToDelete).then(() => null, () => null)
      );
    }
    if (symbolicIdsToDelete.length > 0) {
      deletePromises.push(
        supabase.from('symbolic_elements').delete().in('id', symbolicIdsToDelete).then(() => null, () => null)
      );
    }
    if (emotionalPayoffIdsToDelete.length > 0) {
      deletePromises.push(
        supabase.from('emotional_payoffs').delete().in('id', emotionalPayoffIdsToDelete).then(() => null, () => null)
      );
    }
    if (subtextIdsToDelete.length > 0) {
      deletePromises.push(
        supabase.from('subtext_elements').delete().in('id', subtextIdsToDelete).then(() => null, () => null)
      );
    }

    // Also clean up character relations for deleted characters
    if (characterIdsToDelete.length > 0) {
      deletePromises.push(
        supabase.from('character_skills').delete().in('character_id', characterIdsToDelete),
        supabase.from('character_items').delete().in('character_id', characterIdsToDelete),
        supabase.from('character_item_possessions').delete().in('character_id', characterIdsToDelete),
        supabase.from('character_technique_mastery').delete().in('character_id', characterIdsToDelete),
        supabase.from('relationships').delete().or(`character_id.in.(${characterIdsToDelete.join(',')}),target_character_id.in.(${characterIdsToDelete.join(',')})`)
      );
    }

    // Clean up orphaned novel_items and novel_techniques
    const currentItemIds = new Set(novel.novelItems?.map(item => item.id) || []);
    const currentTechniqueIds = new Set(novel.novelTechniques?.map(tech => tech.id) || []);
    
    // Fetch existing items/techniques to find orphans
    const [existingItemsRes, existingTechniquesRes] = await Promise.all([
      supabase.from('novel_items').select('id').eq('novel_id', novelId),
      supabase.from('novel_techniques').select('id').eq('novel_id', novelId),
    ]);
    
    const existingItemIds = existingItemsRes.data?.map(i => i.id) || [];
    const existingTechniqueIds = existingTechniquesRes.data?.map(t => t.id) || [];
    
    const itemIdsToDelete = existingItemIds.filter(id => !currentItemIds.has(id));
    const techniqueIdsToDelete = existingTechniqueIds.filter(id => !currentTechniqueIds.has(id));
    
    if (itemIdsToDelete.length > 0) {
      deletePromises.push(supabase.from('novel_items').delete().in('id', itemIdsToDelete));
    }
    if (techniqueIdsToDelete.length > 0) {
      deletePromises.push(supabase.from('novel_techniques').delete().in('id', techniqueIdsToDelete));
    }

    await Promise.all(deletePromises);

    // Invalidate cache after successful save
    const userId = await getCurrentUserId();
    queryCache.invalidate(`novels:${userId || 'anonymous'}`);
    queryCache.invalidate(`novel:${novel.id}:`);
  }, {
    maxRetries: 2, // Fewer retries for writes
    retryable: isRetryableError,
  });
};

// Delete a novel
export const deleteNovel = async (novelId: string): Promise<void> => {
  const { error } = await supabase
    .from('novels')
    .delete()
    .eq('id', novelId);

  if (error) {
    logger.error('Error deleting novel', 'supabase', error);
    throw error;
  }
};

// Delete a chapter
export const deleteChapter = async (chapterId: string): Promise<void> => {
  const { error } = await supabase
    .from('chapters')
    .delete()
    .eq('id', chapterId);

  if (error) {
    logger.error('Error deleting chapter', 'supabase', error);
    throw error;
  }
};

// ============ EDITOR SYSTEM ============

/**
 * Save an editor report
 */
export const saveEditorReport = async (report: EditorReport): Promise<void> => {
  return withRetry(async () => {
    // Save the report
    const { error: reportError } = await supabase
      .from('editor_reports')
      .upsert({
        id: report.id,
        novel_id: report.novelId,
        trigger_type: report.triggerType,
        trigger_id: report.triggerId || null,
        chapters_analyzed: report.chaptersAnalyzed,
        report_data: report,
        auto_fixed_count: report.autoFixedCount,
        pending_fix_count: report.pendingFixCount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (reportError) {
      logger.error('Error saving editor report', 'supabase', reportError);
      throw new Error(`Failed to save editor report: ${reportError.message}`);
    }

    // Save fixes if any
    if (report.fixes && report.fixes.length > 0) {
      // Valid fix types according to database constraint
      const VALID_FIX_TYPES = ['gap', 'transition', 'grammar', 'continuity', 
        'time_skip', 'character_consistency', 'plot_hole', 'style', 'formatting'] as const;
      type ValidFixType = typeof VALID_FIX_TYPES[number];

      // Map fixType to valid database values
      // The database constraint only allows the values in VALID_FIX_TYPES
      // But IssueType also includes 'paragraph_structure' and 'sentence_structure'
      const mapFixTypeToDB = (fixType: string | undefined | null): ValidFixType => {
        if (!fixType || typeof fixType !== 'string') {
          logger.warn('Invalid fixType, defaulting to formatting', 'supabase', {
            invalidFixType: fixType
          });
          return 'formatting';
        }

        const normalizedType = fixType.trim().toLowerCase();

        switch (normalizedType) {
          case 'paragraph_structure':
          case 'sentence_structure':
            return 'formatting'; // Map structure issues to formatting
          case 'gap':
          case 'transition':
          case 'grammar':
          case 'continuity':
          case 'time_skip':
          case 'character_consistency':
          case 'plot_hole':
          case 'style':
          case 'formatting':
            return normalizedType as ValidFixType;
          default:
            logger.warn('Unknown fixType, defaulting to formatting', 'supabase', {
              unknownFixType: fixType
            });
            return 'formatting';
        }
      };

      // Filter and map fixes, logging any issues
      const validFixes: typeof report.fixes = [];
      const invalidFixes: typeof report.fixes = [];

      report.fixes.forEach((fix, index) => {
        // Validate fix has required fields
        if (!fix.id || !fix.chapterId || !fix.issueId) {
          logger.warn('Fix missing required fields, skipping', 'supabase', {
            fixIndex: index,
            hasId: !!fix.id,
            hasChapterId: !!fix.chapterId,
            hasIssueId: !!fix.issueId
          });
          invalidFixes.push(fix);
          return;
        }

        // Validate fixType can be mapped to a valid database value
        const mappedFixType = mapFixTypeToDB(fix.fixType);
        if (!VALID_FIX_TYPES.includes(mappedFixType)) {
          logger.error('Fix has invalid fixType after mapping, skipping', 'supabase', undefined, {
            fixId: fix.id,
            mappedFixType
          });
          invalidFixes.push(fix);
          return;
        }

        validFixes.push(fix);
      });

      if (invalidFixes.length > 0) {
        logger.warn('Skipping invalid fixes', 'supabase', {
          invalidCount: invalidFixes.length,
          totalCount: report.fixes.length
        });
      }

      if (validFixes.length === 0) {
        logger.warn('No valid fixes to save after validation', 'supabase');
        return;
      }

      const fixInserts = validFixes.map(fix => ({
        id: fix.id,
        report_id: report.id,
        chapter_id: fix.chapterId,
        issue_id: fix.issueId,
        fix_type: mapFixTypeToDB(fix.fixType),
        original_text: fix.originalText || '',
        fixed_text: fix.fixedText || '',
        reason: fix.reason || '',
        status: fix.status || 'pending',
        applied_at: fix.appliedAt ? new Date(fix.appliedAt).toISOString() : null,
        rejected_reason: fix.rejectedReason || null,
        updated_at: new Date().toISOString(),
      }));

      const { error: fixesError } = await supabase
        .from('editor_fixes')
        .upsert(fixInserts, { onConflict: 'id' });

      if (fixesError) {
        logger.error('Error saving editor fixes', 'supabase', fixesError, {
          failedFixCount: fixInserts.length,
          failedFixes: fixInserts.slice(0, 3).map(f => ({
            id: f.id,
            fix_type: f.fix_type,
            chapter_id: f.chapter_id,
          }))
        });
        // Don't throw - report was saved, fixes are secondary
        logger.warn('Editor report saved but fixes failed to save', 'supabase', {
          failedFixCount: fixInserts.length
        });
      } else {
        logger.info('Successfully saved editor fixes', 'supabase', {
          fixCount: fixInserts.length
        });
      }
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Fetch editor reports for a novel
 */
export const fetchEditorReports = async (novelId: string): Promise<EditorReport[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_reports')
      .select('*')
      .eq('novel_id', novelId)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Error fetching editor reports', 'supabase', error);
      throw new Error(`Failed to fetch editor reports: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert database format to EditorReport type
    return data.map((row: any) => {
      const report: EditorReport = row.report_data as EditorReport;
      // Ensure timestamps are numbers
      if (report.createdAt && typeof report.createdAt === 'string') {
        report.createdAt = timestampToNumber(report.createdAt);
      }
      return report;
    });
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Update editor fix status
 */
export const updateEditorFixStatus = async (
  fixId: string,
  status: EditorFix['status'],
  appliedAt?: number,
  rejectedReason?: string
): Promise<void> => {
  return withRetry(async () => {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'applied' && appliedAt) {
      updateData.applied_at = new Date(appliedAt).toISOString();
    }

    if (status === 'rejected' && rejectedReason) {
      updateData.rejected_reason = rejectedReason;
    }

    const { error } = await supabase
      .from('editor_fixes')
      .update(updateData)
      .eq('id', fixId);

    if (error) {
      logger.error('Error updating editor fix status', 'supabase', error);
      throw new Error(`Failed to update editor fix status: ${error.message}`);
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Fetch editor fixes for a report
 */
export const fetchEditorFixes = async (reportId: string): Promise<EditorFix[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('editor_fixes')
      .select('*')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('Error fetching editor fixes', 'supabase', error);
      throw new Error(`Failed to fetch editor fixes: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert database format to EditorFix type
    return data.map((row: any) => ({
      id: row.id,
      issueId: row.issue_id,
      chapterId: row.chapter_id,
      chapterNumber: 0, // Will need to be populated from chapter lookup if needed
      fixType: row.fix_type,
      originalText: row.original_text,
      fixedText: row.fixed_text,
      reason: row.reason || '',
      status: row.status,
      appliedAt: row.applied_at ? timestampToNumber(row.applied_at) : undefined,
      rejectedReason: row.rejected_reason || undefined,
    } as EditorFix));
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

// ============ RECURRING ISSUE PATTERNS ============

/**
 * Save a recurring issue pattern
 */
export const saveRecurringPattern = async (pattern: RecurringIssuePattern): Promise<void> => {
  return withRetry(async () => {
    // First, try to find existing pattern
    const { data: existing, error: fetchError } = await supabase
      .from('recurring_issue_patterns')
      .select('id')
      .eq('issue_type', pattern.issueType)
      .eq('location', pattern.location)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Error checking existing pattern', 'supabase', fetchError);
      throw new Error(`Failed to check existing pattern: ${fetchError.message}`);
    }

    if (existing) {
      // Update existing pattern
      const { error } = await supabase
        .from('recurring_issue_patterns')
        .update({
          pattern_description: pattern.patternDescription,
          occurrence_count: pattern.occurrenceCount,
          threshold_count: pattern.thresholdCount,
          first_detected_at: new Date(pattern.firstDetectedAt).toISOString(),
          last_seen_at: new Date(pattern.lastSeenAt).toISOString(),
          is_active: pattern.isActive,
          prompt_constraint_added: pattern.promptConstraintAdded || null,
          resolved_at: pattern.resolvedAt ? new Date(pattern.resolvedAt).toISOString() : null,
          updated_at: new Date(pattern.updatedAt).toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        logger.error('Error updating recurring pattern', 'supabase', error);
        throw new Error(`Failed to update recurring pattern: ${error.message}`);
      }
    } else {
      // Insert new pattern
      const { error } = await supabase
        .from('recurring_issue_patterns')
        .insert({
          id: pattern.id,
          issue_type: pattern.issueType,
          location: pattern.location,
          pattern_description: pattern.patternDescription,
          occurrence_count: pattern.occurrenceCount,
          threshold_count: pattern.thresholdCount,
          first_detected_at: new Date(pattern.firstDetectedAt).toISOString(),
          last_seen_at: new Date(pattern.lastSeenAt).toISOString(),
          is_active: pattern.isActive,
          prompt_constraint_added: pattern.promptConstraintAdded || null,
          resolved_at: pattern.resolvedAt ? new Date(pattern.resolvedAt).toISOString() : null,
          updated_at: new Date(pattern.updatedAt).toISOString(),
        });

      if (error) {
        logger.error('Error inserting recurring pattern', 'supabase', error);
        throw new Error(`Failed to insert recurring pattern: ${error.message}`);
      }
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Save a pattern occurrence
 */
export const savePatternOccurrence = async (occurrence: PatternOccurrence): Promise<void> => {
  return withRetry(async () => {
    const { error } = await supabase
      .from('pattern_occurrences')
      .insert({
        id: occurrence.id,
        pattern_id: occurrence.patternId,
        chapter_id: occurrence.chapterId || null,
        chapter_number: occurrence.chapterNumber,
        report_id: occurrence.reportId || null,
        issue_id: occurrence.issueId,
        novel_id: occurrence.novelId,
        detected_at: new Date(occurrence.detectedAt).toISOString(),
      });

    if (error) {
      logger.error('Error saving pattern occurrence', 'supabase', error);
      throw new Error(`Failed to save pattern occurrence: ${error.message}`);
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Get active recurring patterns
 */
export const getActiveRecurringPatterns = async (): Promise<RecurringIssuePattern[]> => {
  return withRetry(async () => {
    // First fetch all active patterns, then filter by threshold in memory
    // (Supabase doesn't support comparing columns in WHERE clause easily)
    const { data, error } = await supabase
      .from('recurring_issue_patterns')
      .select('*')
      .eq('is_active', true)
      .order('occurrence_count', { ascending: false })
      .order('last_seen_at', { ascending: false });

    if (error) {
      logger.error('Error fetching active recurring patterns', 'supabase', error);
      throw new Error(`Failed to fetch active recurring patterns: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert database format to RecurringIssuePattern type and filter by threshold
    return data
      .filter((row: any) => row.occurrence_count >= row.threshold_count) // Filter patterns that exceeded threshold
      .map((row: any) => ({
      id: row.id,
      issueType: row.issue_type,
      location: row.location,
      patternDescription: row.pattern_description,
      occurrenceCount: row.occurrence_count,
      thresholdCount: row.threshold_count,
      firstDetectedAt: timestampToNumber(row.first_detected_at),
      lastSeenAt: timestampToNumber(row.last_seen_at),
      isActive: row.is_active,
      promptConstraintAdded: row.prompt_constraint_added || undefined,
      resolvedAt: row.resolved_at ? timestampToNumber(row.resolved_at) : undefined,
      createdAt: timestampToNumber(row.created_at),
      updatedAt: timestampToNumber(row.updated_at),
    } as RecurringIssuePattern));
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Get all recurring patterns (active and resolved)
 */
export const getAllRecurringPatterns = async (): Promise<RecurringIssuePattern[]> => {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('recurring_issue_patterns')
      .select('*')
      .order('is_active', { ascending: false })
      .order('occurrence_count', { ascending: false })
      .order('last_seen_at', { ascending: false });

    if (error) {
      logger.error('Error fetching all recurring patterns', 'supabase', error);
      throw new Error(`Failed to fetch recurring patterns: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Convert database format to RecurringIssuePattern type
    return data.map((row: any) => ({
      id: row.id,
      issueType: row.issue_type,
      location: row.location,
      patternDescription: row.pattern_description,
      occurrenceCount: row.occurrence_count,
      thresholdCount: row.threshold_count,
      firstDetectedAt: timestampToNumber(row.first_detected_at),
      lastSeenAt: timestampToNumber(row.last_seen_at),
      isActive: row.is_active,
      promptConstraintAdded: row.prompt_constraint_added || undefined,
      resolvedAt: row.resolved_at ? timestampToNumber(row.resolved_at) : undefined,
      createdAt: timestampToNumber(row.created_at),
      updatedAt: timestampToNumber(row.updated_at),
    } as RecurringIssuePattern));
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Get or create a pattern by issue type and location
 */
export const getOrCreatePattern = async (
  issueType: string,
  location: string,
  patternDescription: string,
  thresholdCount: number = 5
): Promise<RecurringIssuePattern> => {
  return withRetry(async () => {
    // Try to find existing pattern
    const { data: existing, error: fetchError } = await supabase
      .from('recurring_issue_patterns')
      .select('*')
      .eq('issue_type', issueType)
      .eq('location', location)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Error fetching pattern', 'supabase', fetchError);
      throw new Error(`Failed to fetch pattern: ${fetchError.message}`);
    }

    if (existing) {
      // Return existing pattern
      return {
        id: existing.id,
        issueType: existing.issue_type,
        location: existing.location,
        patternDescription: existing.pattern_description,
        occurrenceCount: existing.occurrence_count,
        thresholdCount: existing.threshold_count,
        firstDetectedAt: timestampToNumber(existing.first_detected_at),
        lastSeenAt: timestampToNumber(existing.last_seen_at),
        isActive: existing.is_active,
        promptConstraintAdded: existing.prompt_constraint_added || undefined,
        resolvedAt: existing.resolved_at ? timestampToNumber(existing.resolved_at) : undefined,
        createdAt: timestampToNumber(existing.created_at),
        updatedAt: timestampToNumber(existing.updated_at),
      } as RecurringIssuePattern;
    }

    // Create new pattern
    const newPattern: RecurringIssuePattern = {
      id: crypto.randomUUID(),
      issueType: issueType as any,
      location: location as any,
      patternDescription,
      occurrenceCount: 0,
      thresholdCount,
      firstDetectedAt: Date.now(),
      lastSeenAt: Date.now(),
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveRecurringPattern(newPattern);
    return newPattern;
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Update pattern status (active/resolved)
 */
export const updatePatternStatus = async (patternId: string, isActive: boolean): Promise<void> => {
  return withRetry(async () => {
    const updateData: any = {
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };

    if (!isActive) {
      // Mark as resolved
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('recurring_issue_patterns')
      .update(updateData)
      .eq('id', patternId);

    if (error) {
      logger.error('Error updating pattern status', 'supabase', error);
      throw new Error(`Failed to update pattern status: ${error.message}`);
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};

/**
 * Increment pattern occurrence count
 * Note: This is handled by the database trigger, but we provide this for manual updates if needed
 */
export const incrementPatternCount = async (patternId: string): Promise<void> => {
  return withRetry(async () => {
    const { error } = await supabase.rpc('increment_pattern_count', { pattern_id: patternId });

    if (error) {
      // Fallback to manual update if RPC doesn't exist
      const { data: pattern, error: fetchError } = await supabase
        .from('recurring_issue_patterns')
        .select('occurrence_count')
        .eq('id', patternId)
        .single();

      if (fetchError) {
        logger.error('Error fetching pattern for increment', 'supabase', fetchError);
        throw new Error(`Failed to increment pattern count: ${fetchError.message}`);
      }

      const { error: updateError } = await supabase
        .from('recurring_issue_patterns')
        .update({
          occurrence_count: (pattern.occurrence_count || 0) + 1,
          last_seen_at: new Date().toISOString(),
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', patternId);

      if (updateError) {
        logger.error('Error incrementing pattern count', 'supabase', updateError);
        throw new Error(`Failed to increment pattern count: ${updateError.message}`);
      }
    }
  }, {
    maxRetries: 3,
    retryable: isRetryableError,
  });
};
