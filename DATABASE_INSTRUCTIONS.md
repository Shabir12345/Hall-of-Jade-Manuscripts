# Database Setup Instructions

To fix the issue where chapters disappear after refreshing, you need to set up your Supabase database tables and permissions correctly.

## 1. Open Supabase Dashboard
Go to your [Supabase Dashboard](https://supabase.com/dashboard) and open your project.

## 2. Go to SQL Editor
Click on the **SQL Editor** icon (it looks like a terminal `>_`) in the left sidebar.

## 3. Run the Setup Script
1. Click **"New query"**.
2. Copy **ALL** the code from the file `COMPLETE_DATABASE_SETUP.sql` in your project folder.
3. Paste it into the SQL Editor in Supabase.
4. Click **"Run"** (bottom right).

## 4. Verify
After running the script, go back to your app:
1. Refresh the page.
2. Create a new chapter or novel.
3. Wait for the "Saving..." indicator to finish.
4. Refresh the page again.
5. Your data should now persist!

## Explanation of the Issue
The issue was likely caused by "Row Level Security" (RLS). By default, Supabase secures your data so no one can read it without permission. The script above creates the necessary tables and adds "policies" to allow your app to read and write data.
