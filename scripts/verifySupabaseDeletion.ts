/**
 * Verification Script: Check Supabase for Deleted Novel Data
 * 
 * This script checks all tables in Supabase to verify that deleted novels
 * and their related data have been properly removed.
 * 
 * Run this with: npx tsx scripts/verifySupabaseDeletion.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface TableCheck {
  tableName: string;
  count: number;
  sampleIds?: string[];
}

async function checkTable(tableName: string, filter?: { column: string; value: any }): Promise<TableCheck> {
  try {
    let query = supabase.from(tableName).select('id', { count: 'exact', head: false });
    
    if (filter) {
      query = query.eq(filter.column, filter.value);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      // Table might not exist, which is okay
      if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
        return { tableName, count: 0 };
      }
      throw error;
    }
    
    return {
      tableName,
      count: count || data?.length || 0,
      sampleIds: data?.slice(0, 5).map((row: any) => row.id) || [],
    };
  } catch (error: any) {
    console.warn(`⚠️  Warning checking ${tableName}:`, error.message);
    return { tableName, count: -1 }; // -1 indicates error
  }
}

async function verifyAllTables(): Promise<void> {
  console.log('🔍 Checking Supabase for all data...\n');
  
  // First, get all novels to check
  const { data: novels, error: novelsError } = await supabase
    .from('novels')
    .select('id, title, created_at')
    .order('created_at', { ascending: false });
  
  if (novelsError) {
    console.error('❌ Error fetching novels:', novelsError.message);
    return;
  }
  
  console.log(`📚 Found ${novels?.length || 0} novel(s) in database:\n`);
  
  if (novels && novels.length > 0) {
    novels.forEach((novel, index) => {
      console.log(`  ${index + 1}. ${novel.title || 'Untitled'} (ID: ${novel.id})`);
      console.log(`     Created: ${new Date(novel.created_at).toLocaleString()}\n`);
    });
  } else {
    console.log('  ✅ No novels found - database appears clean!\n');
  }
  
  // Check all tables for any data
  console.log('📊 Checking all tables for data...\n');
  
  const tablesToCheck = [
    // Core tables
    { name: 'novels', filter: undefined },
    { name: 'chapters', filter: undefined },
    { name: 'characters', filter: undefined },
    { name: 'realms', filter: undefined },
    { name: 'arcs', filter: undefined },
    { name: 'scenes', filter: undefined },
    
    // World building
    { name: 'territories', filter: undefined },
    { name: 'world_entries', filter: undefined },
    
    // Character relationships
    { name: 'character_skills', filter: undefined },
    { name: 'character_items', filter: undefined },
    { name: 'relationships', filter: undefined },
    
    // Antagonists
    { name: 'antagonists', filter: undefined },
    { name: 'antagonist_relationships', filter: undefined },
    { name: 'antagonist_arcs', filter: undefined },
    { name: 'antagonist_chapters', filter: undefined },
    { name: 'antagonist_groups', filter: undefined },
    { name: 'antagonist_progression', filter: undefined },
    
    // Items & Techniques
    { name: 'novel_items', filter: undefined },
    { name: 'novel_techniques', filter: undefined },
    { name: 'character_item_possessions', filter: undefined },
    { name: 'character_technique_mastery', filter: undefined },
    
    // Narrative elements
    { name: 'foreshadowing_elements', filter: undefined },
    { name: 'symbolic_elements', filter: undefined },
    { name: 'emotional_payoffs', filter: undefined },
    { name: 'subtext_elements', filter: undefined },
    
    // Other
    { name: 'tags', filter: undefined },
    { name: 'entity_tags', filter: undefined },
    { name: 'writing_goals', filter: undefined },
    { name: 'system_logs', filter: undefined },
    { name: 'improvement_history', filter: undefined },
  ];
  
  const results: TableCheck[] = [];
  
  for (const table of tablesToCheck) {
    const result = await checkTable(table.name, table.filter);
    results.push(result);
    
    if (result.count > 0) {
      console.log(`  ⚠️  ${table.name}: ${result.count} record(s)`);
      if (result.sampleIds && result.sampleIds.length > 0) {
        console.log(`     Sample IDs: ${result.sampleIds.join(', ')}`);
      }
    } else if (result.count === 0) {
      console.log(`  ✅ ${table.name}: Empty`);
    } else {
      console.log(`  ❌ ${table.name}: Error checking table`);
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY\n');
  
  const tablesWithData = results.filter(r => r.count > 0);
  const tablesEmpty = results.filter(r => r.count === 0);
  const tablesWithErrors = results.filter(r => r.count === -1);
  
  console.log(`✅ Empty tables: ${tablesEmpty.length}`);
  console.log(`⚠️  Tables with data: ${tablesWithData.length}`);
  if (tablesWithErrors.length > 0) {
    console.log(`❌ Tables with errors: ${tablesWithErrors.length}`);
  }
  
  if (tablesWithData.length > 0) {
    console.log('\n⚠️  Tables still containing data:');
    tablesWithData.forEach(table => {
      console.log(`   - ${table.tableName}: ${table.count} record(s)`);
    });
    
    // If novels table is empty but other tables have data, there might be orphaned records
    const novelsEmpty = results.find(r => r.tableName === 'novels')?.count === 0;
    if (novelsEmpty && tablesWithData.length > 0) {
      console.log('\n⚠️  WARNING: Novels table is empty but other tables have data!');
      console.log('   This might indicate orphaned records that should be cleaned up.');
    }
  } else {
    console.log('\n✅ All tables are empty! Database is clean.');
  }
  
  console.log('\n' + '='.repeat(60));
}

// Run the verification
verifyAllTables()
  .then(() => {
    console.log('\n✅ Verification complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
