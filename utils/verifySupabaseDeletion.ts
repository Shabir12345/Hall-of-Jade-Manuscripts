/**
 * Utility to verify Supabase deletion
 * Can be called from browser console or imported in components
 */

import { supabase } from '../services/supabaseService';

/**
 * Check all tables in Supabase for any remaining data
 * Returns a comprehensive report of what data exists
 */
export async function verifyAllSupabaseData(): Promise<{
  novels: number;
  chapters: number;
  characters: number;
  realms: number;
  arcs: number;
  scenes: number;
  territories: number;
  worldEntries: number;
  antagonists: number;
  novelItems: number;
  novelTechniques: number;
  improvementHistory: number;
  foreshadowing: number;
  symbolic: number;
  emotionalPayoffs: number;
  tags: number;
  writingGoals: number;
  systemLogs: number;
  allEmpty: boolean;
  summary: string;
}> {
  const checks = await Promise.all([
    supabase.from('novels').select('id', { count: 'exact', head: false }),
    supabase.from('chapters').select('id', { count: 'exact', head: false }),
    supabase.from('characters').select('id', { count: 'exact', head: false }),
    supabase.from('realms').select('id', { count: 'exact', head: false }),
    supabase.from('arcs').select('id', { count: 'exact', head: false }),
    supabase.from('scenes').select('id', { count: 'exact', head: false }),
    supabase.from('territories').select('id', { count: 'exact', head: false }),
    supabase.from('world_entries').select('id', { count: 'exact', head: false }),
    supabase.from('antagonists').select('id', { count: 'exact', head: false }),
    supabase.from('novel_items').select('id', { count: 'exact', head: false }),
    supabase.from('novel_techniques').select('id', { count: 'exact', head: false }),
    supabase.from('improvement_history').select('id', { count: 'exact', head: false }),
    supabase.from('foreshadowing_elements').select('id', { count: 'exact', head: false }),
    supabase.from('symbolic_elements').select('id', { count: 'exact', head: false }),
    supabase.from('emotional_payoffs').select('id', { count: 'exact', head: false }),
    supabase.from('tags').select('id', { count: 'exact', head: false }),
    supabase.from('writing_goals').select('id', { count: 'exact', head: false }),
    supabase.from('system_logs').select('id', { count: 'exact', head: false }),
  ]);
  
  const counts = {
    novels: checks[0].count || 0,
    chapters: checks[1].count || 0,
    characters: checks[2].count || 0,
    realms: checks[3].count || 0,
    arcs: checks[4].count || 0,
    scenes: checks[5].count || 0,
    territories: checks[6].count || 0,
    worldEntries: checks[7].count || 0,
    antagonists: checks[8].count || 0,
    novelItems: checks[9].count || 0,
    novelTechniques: checks[10].count || 0,
    improvementHistory: checks[11].count || 0,
    foreshadowing: checks[12].count || 0,
    symbolic: checks[13].count || 0,
    emotionalPayoffs: checks[14].count || 0,
    tags: checks[15].count || 0,
    writingGoals: checks[16].count || 0,
    systemLogs: checks[17].count || 0,
  };
  
  const allEmpty = Object.values(counts).every(count => count === 0);
  
  const tablesWithData = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .map(([table, count]) => `${table}: ${count}`)
    .join(', ');
  
  const summary = allEmpty
    ? '✅ All tables are empty! Database is completely clean.'
    : `⚠️ Found data in: ${tablesWithData || 'none'}`;
  
  return {
    ...counts,
    allEmpty,
    summary,
  };
}

/**
 * Log verification results to console in a readable format
 */
export async function logSupabaseVerification(): Promise<void> {
  console.log('🔍 Verifying Supabase Database...\n');
  
  const result = await verifyAllSupabaseData();
  
  console.log('📊 Table Counts:');
  console.log(`  Novels: ${result.novels}`);
  console.log(`  Chapters: ${result.chapters}`);
  console.log(`  Characters: ${result.characters}`);
  console.log(`  Realms: ${result.realms}`);
  console.log(`  Arcs: ${result.arcs}`);
  console.log(`  Scenes: ${result.scenes}`);
  console.log(`  Territories: ${result.territories}`);
  console.log(`  World Entries: ${result.worldEntries}`);
  console.log(`  Antagonists: ${result.antagonists}`);
  console.log(`  Novel Items: ${result.novelItems}`);
  console.log(`  Novel Techniques: ${result.novelTechniques}`);
  console.log(`  Improvement History: ${result.improvementHistory}`);
  console.log(`  Foreshadowing: ${result.foreshadowing}`);
  console.log(`  Symbolic: ${result.symbolic}`);
  console.log(`  Emotional Payoffs: ${result.emotionalPayoffs}`);
  console.log(`  Tags: ${result.tags}`);
  console.log(`  Writing Goals: ${result.writingGoals}`);
  console.log(`  System Logs: ${result.systemLogs}`);
  
  console.log('\n' + '='.repeat(60));
  console.log(result.summary);
  console.log('='.repeat(60));
  
  if (!result.allEmpty && result.novels === 0) {
    console.log('\n⚠️  WARNING: Novels table is empty but other tables have data!');
    console.log('   This indicates orphaned records. CASCADE delete may not have worked.');
  }
}

// Make it available globally for browser console
if (typeof window !== 'undefined') {
  (window as any).verifySupabase = logSupabaseVerification;
}
