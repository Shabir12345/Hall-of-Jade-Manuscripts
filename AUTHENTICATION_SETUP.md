# Authentication Setup Guide

## Overview

This document describes the authentication implementation for the Hall of Jade Manuscripts application.

## What Has Been Implemented

### 1. Authentication Context (`contexts/AuthContext.tsx`)
- ✅ Created AuthContext with authentication state management
- ✅ Provides sign up, sign in, sign out, password reset, and password update methods
- ✅ Handles session persistence and automatic token refresh
- ✅ Integrates with Supabase Auth

### 2. Database Migration (`DATABASE_MIGRATION_AUTHENTICATION.sql`)
- ✅ Adds `user_id` columns to all tables
- ✅ Creates indexes on `user_id` columns for performance
- ✅ Sets up RLS (Row Level Security) policies for all tables
- ✅ Creates trigger function to automatically set `user_id` on INSERT
- ✅ Creates triggers for all tables to use the `user_id` trigger function

### 3. UI Components
- ✅ Created `LoginForm` component for sign in/sign up
- ✅ Integrated authentication check in `App.tsx`
- ✅ Shows login form when user is not authenticated

### 4. Service Updates
- ✅ Added `getCurrentUserId()` helper function in `supabaseService.ts`
- ✅ Updated `fetchAllNovels()` to filter by `user_id`
- ✅ Updated `saveNovel()` to include `user_id` and require authentication
- ✅ Added authentication requirement check before database operations

### 5. App Integration
- ✅ Added `AuthProvider` to `index.tsx`
- ✅ Updated `App.tsx` to check authentication state
- ✅ Shows login form when not authenticated

## How RLS Works

With Row Level Security (RLS) enabled, Supabase automatically filters queries based on the authenticated user's ID. This means:

1. **SELECT queries**: Automatically filtered to only return rows where `user_id = auth.uid()`
2. **INSERT queries**: The trigger automatically sets `user_id = auth.uid()` if not provided
3. **UPDATE queries**: Users can only update rows where `user_id = auth.uid()`
4. **DELETE queries**: Users can only delete rows where `user_id = auth.uid()`

**Important**: You don't need to manually add `.eq('user_id', userId)` to SELECT queries - RLS handles it automatically!

However, you DO need to ensure `user_id` is included in INSERT/UPDATE operations.

## Remaining Work

### 1. Update All INSERT/UPDATE Operations
While the trigger handles INSERT operations automatically, UPDATE operations should explicitly include `user_id` to ensure consistency.

**Pattern to follow:**
```typescript
const userId = await getCurrentUserId();
if (!userId) {
  throw new AppError('User must be authenticated', 'AUTH_ERROR', 401, false);
}

await supabase
  .from('table_name')
  .upsert({
    ...data,
    user_id: userId, // Always include user_id
  });
```

**Files that need updates:**
- `services/supabaseService.ts` - Update all INSERT/UPDATE operations in:
  - `saveNovel()` - Already updated for novels table
  - All other table upserts (realms, characters, chapters, etc.)
- `services/antagonistService.ts` - Update antagonist operations
- `services/itemTechniqueService.ts` - Update item/technique operations
- `services/editorService.ts` - Update editor operations

### 2. Add User Profile Management
Consider adding:
- User profile page
- Password change functionality
- Email verification status
- Account deletion

### 3. Handle Existing Data Migration
If you have existing data in your database:

1. Run the migration: `DATABASE_MIGRATION_AUTHENTICATION.sql`
2. Optionally assign existing data to a user (see Step 6 in migration file)
3. After migrating data, make `user_id` NOT NULL (see Step 7 in migration file)

### 4. Test Authentication Flow
Test the following scenarios:
- Sign up with new account
- Sign in with existing account
- Sign out
- Password reset
- Access control (users can only see their own data)
- Session persistence across page refreshes

## Security Notes

1. **RLS is Enabled**: All tables now have RLS policies that require authentication
2. **User Scoping**: All queries are automatically filtered by `user_id`
3. **Triggers**: INSERT operations automatically set `user_id` if not provided
4. **No Public Access**: Unauthenticated users cannot access any data

## Troubleshooting

### Users can't see their data
- Check that `user_id` is being set on INSERT operations
- Verify RLS policies are correctly applied
- Check browser console for authentication errors

### "User must be authenticated" errors
- Ensure user is signed in
- Check that `AuthProvider` is wrapping the app
- Verify Supabase auth is properly configured

### Existing data not showing up
- Run Step 6 of the migration to assign existing data to a user
- Or create new data as an authenticated user

## Next Steps

1. **Complete Query Updates**: Update all INSERT/UPDATE operations to include `user_id`
2. **Test Thoroughly**: Test all CRUD operations with authenticated users
3. **Add User Management**: Create user profile and settings pages
4. **Handle Edge Cases**: Test error scenarios (network failures, auth token expiration, etc.)
5. **Documentation**: Update README with authentication instructions
