<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Hall of Jade Manuscripts

A sophisticated AI-powered novel writing application for Xianxia, Xuanhuan, and System epics. Built with React, TypeScript, Supabase, and AI integration (Gemini/DeepSeek).

## Features

- **AI-Powered Chapter Generation**: Generate chapters using Google Gemini or DeepSeek AI
- **World Building**: Manage realms, territories, and world entries
- **Character Management**: Track characters, relationships, cultivation levels, and more
- **Chapter & Scene Organization**: Organize your novel with chapters and scenes
- **Plot Arc Planning**: Plan and track story arcs
- **Voice Input**: Dictate lore and content using voice recognition
- **Text-to-Speech**: Listen to your chapters
- **Export**: Export novels in Markdown or plain text
- **Writing Goals**: Set and track writing goals
- **Revision History**: Track changes to your content
- **Tags System**: Organize content with tags
- **Auto-save**: Automatic saving to Supabase database

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **Supabase Account** (free tier works)
- **AI API Key**: At least one of:
  - Google Gemini API key ([Get one here](https://makersuite.google.com/app/apikey))
  - DeepSeek API key ([Get one here](https://platform.deepseek.com/api_keys))

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase Database

1. Create a new project at [Supabase](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Copy and run the entire contents of `COMPLETE_DATABASE_SETUP.sql`
4. This will create all necessary tables, indexes, triggers, and RLS policies

### 3. Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and fill in your credentials:

   ```env
   # Supabase Configuration
   # Get these from: Supabase Dashboard > Settings > API
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here

   # AI API Keys (at least one required)
   # Gemini is recommended for full features (portraits + read-aloud)
   GEMINI_API_KEY=your-gemini-api-key-here
   
   # Optional: DeepSeek as alternative LLM
   # DEEPSEEK_API_KEY=your-deepseek-api-key-here
   ```

### 4. Run the Application

**Development mode:**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

**Production build:**
```bash
npm run build
npm run preview
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous/public key |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key (recommended) |
| `DEEPSEEK_API_KEY` | Yes* | DeepSeek API key (alternative) |

*At least one AI API key is required. Gemini is recommended for full feature support.

**Note:** All environment variables are validated on app startup. If any are missing, you'll see a helpful error message with instructions.

## Database Setup

The application uses Supabase (PostgreSQL) for data storage. The database schema includes:

- **Novels**: Main novel metadata
- **Chapters & Scenes**: Content organization
- **Characters**: Character profiles and relationships
- **Realms & Territories**: World-building
- **World Entries**: Lore and world knowledge
- **Arcs**: Plot arc planning
- **Tags**: Content organization
- **Writing Goals**: Progress tracking
- **Revisions**: Version history

See `DATABASE_SETUP.md` for detailed schema documentation.

## Troubleshooting

### App won't start / Configuration Error

- **Problem**: Error message about missing environment variables
- **Solution**: 
  1. Ensure `.env.local` exists in the root directory
  2. Check that all required variables are set (no empty values)
  3. Restart the dev server after changing `.env.local`

### Database connection errors

- **Problem**: "Failed to load novels from database"
- **Solution**:
  1. Verify Supabase URL and anon key are correct
  2. Check that you've run `COMPLETE_DATABASE_SETUP.sql` in Supabase
  3. Verify RLS policies allow public access (for MVP)
  4. Check browser console for detailed error messages

### AI generation fails

- **Problem**: "Dao failure! Connection severed" when generating chapters
- **Solution**:
  1. Verify your API key is set correctly in `.env.local`
  2. Check your internet connection
  3. Verify API key has sufficient quota/credits
  4. Check browser console (F12) for detailed error messages

### Build errors

- **Problem**: TypeScript or build errors
- **Solution**:
  1. Run `npm install` to ensure all dependencies are installed
  2. Check for TypeScript errors: `npm run build`
  3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Data not saving

- **Problem**: Changes not persisting
- **Solution**:
  1. Check browser console for save errors
  2. Verify Supabase connection
  3. Check network tab for failed requests
  4. Ensure RLS policies allow writes

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage

### Project Structure

```
├── components/          # React components
├── contexts/           # React contexts (state management)
├── services/           # Business logic and API services
├── utils/              # Utility functions
├── types.ts            # TypeScript type definitions
├── constants.tsx        # App constants
└── config/             # Configuration files
```

## Production Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to your hosting service:
   - Vercel, Netlify, or any static hosting
   - Ensure environment variables are set in your hosting platform

3. **Configure environment variables** in your hosting platform:
   - Set all required variables (VITE_SUPABASE_URL, etc.)
   - Note: Vite requires `VITE_` prefix for client-side variables

4. **Database**: Ensure your Supabase database is accessible from production

## Security Notes

- **Current Setup**: RLS policies allow public read/write (for MVP)
- **Production Recommendation**: 
  - Implement Supabase Authentication
  - Add user_id columns to tables
  - Update RLS policies to restrict access by user
  - Never commit `.env.local` or expose API keys

## License

This project is private and proprietary.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Check Supabase dashboard for database issues
