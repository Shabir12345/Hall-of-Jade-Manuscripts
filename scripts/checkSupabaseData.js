/**
 * Simple Supabase Data Checker
 * 
 * This script checks Supabase directly to see if there's any data remaining.
 * Run with: node scripts/checkSupabaseData.js
 * 
 * Make sure you have VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file
 */

// Simple fetch-based checker (no dependencies needed)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase configuration!');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error('\nYou can find these in your .env.local file or Supabase dashboard');
  process.exit(1);
}

async function checkTable(tableName) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?select=id&limit=10`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'count=exact'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        return { tableName, count: 0, exists: false };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const count = response.headers.get('content-range')?.split('/')[1] || '0';
    const data = await response.json();
    
    return {
      tableName,
      count: parseInt(count) || data.length || 0,
      exists: true,
      sampleIds: data.slice(0, 5).map(row => row.id)
    };
  } catch (error) {
    return {
      tableName,
      count: -1,
      exists: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🔍 Checking Supabase Database...\n');
  console.log(`📍 Supabase URL: ${SUPABASE_URL.replace(/\/$/, '')}\n`);
  
  const tables = [
    'novels',
    'chapters',
    'characters',
    'realms',
    'arcs',
    'scenes',
    'territories',
    'world_entries',
    'character_skills',
    'character_items',
    'relationships',
    'antagonists',
    'antagonist_relationships',
    'antagonist_arcs',
    'antagonist_chapters',
    'antagonist_groups',
    'antagonist_progression',
    'novel_items',
    'novel_techniques',
    'character_item_possessions',
    'character_technique_mastery',
    'foreshadowing_elements',
    'symbolic_elements',
    'emotional_payoffs',
    'subtext_elements',
    'tags',
    'entity_tags',
    'writing_goals',
    'system_logs',
    'improvement_history'
  ];
  
  console.log('📊 Checking tables...\n');
  
  const results = [];
  for (const table of tables) {
    const result = await checkTable(table);
    results.push(result);
    
    if (result.count > 0) {
      console.log(`  ⚠️  ${table}: ${result.count} record(s)`);
      if (result.sampleIds && result.sampleIds.length > 0) {
        console.log(`     Sample IDs: ${result.sampleIds.join(', ')}`);
      }
    } else if (result.count === 0) {
      console.log(`  ✅ ${table}: Empty`);
    } else {
      console.log(`  ❓ ${table}: ${result.exists ? 'Table exists' : 'Table does not exist or error occurred'}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 SUMMARY\n');
  
  const withData = results.filter(r => r.count > 0);
  const empty = results.filter(r => r.count === 0);
  const errors = results.filter(r => r.count === -1);
  
  console.log(`✅ Empty tables: ${empty.length}`);
  console.log(`⚠️  Tables with data: ${withData.length}`);
  if (errors.length > 0) {
    console.log(`❓ Tables with issues: ${errors.length}`);
  }
  
  if (withData.length > 0) {
    console.log('\n⚠️  Tables still containing data:');
    withData.forEach(table => {
      console.log(`   - ${table.tableName}: ${table.count} record(s)`);
    });
    
    const novelsEmpty = results.find(r => r.tableName === 'novels')?.count === 0;
    if (novelsEmpty && withData.length > 0) {
      console.log('\n⚠️  WARNING: Novels table is empty but other tables have data!');
      console.log('   This indicates orphaned records that should be cleaned up.');
      console.log('   The CASCADE delete may not have worked properly.');
    }
  } else {
    console.log('\n✅ All tables are empty! Database is completely clean.');
    console.log('   Your novel deletion was successful! 🎉');
  }
  
  console.log('\n' + '='.repeat(60));
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
