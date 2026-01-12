# Architecture Documentation

## Overview

Hall of Jade Manuscripts is a React + TypeScript application for AI-powered novel writing, specifically designed for Xianxia, Xuanhuan, and System epics.

## Technology Stack

- **Frontend**: React 19.2.3, TypeScript 5.8.2
- **Build Tool**: Vite 6.2.0
- **Database**: Supabase (PostgreSQL)
- **AI Services**: Google Gemini API, DeepSeek API
- **Styling**: Tailwind CSS 3.4.19
- **State Management**: React Context API
- **Testing**: Vitest 4.0.16

## Project Structure

```
├── components/          # React components
│   ├── views/          # View components (dashboard, characters, etc.)
│   └── ...             # Shared components
├── contexts/           # React contexts (state management)
│   ├── AuthContext.tsx      # Authentication state
│   ├── NovelContext.tsx     # Novel data state
│   ├── ToastContext.tsx     # Toast notifications
│   ├── LoadingContext.tsx   # Loading states
│   └── LlmContext.tsx       # LLM selection state
├── services/           # Business logic and API services
│   ├── aiService.ts         # AI generation orchestration
│   ├── geminiService.ts     # Gemini API integration
│   ├── deepseekService.ts   # DeepSeek API integration
│   ├── supabaseService.ts   # Database operations
│   ├── promptEngine/        # Prompt building system
│   │   ├── promptBuilder.ts      # Main prompt builder
│   │   ├── contextGatherer.ts    # Context collection
│   │   ├── arcContextAnalyzer.ts # Arc analysis
│   │   └── writers/              # Prompt writers
│   └── ...              # Other services
├── hooks/              # Custom React hooks
│   ├── useCharacterManagement.ts
│   ├── useWorldManagement.ts
│   ├── useArcManagement.ts
│   └── ...              # Other hooks
├── utils/              # Utility functions
│   ├── errorHandling.ts    # Error handling utilities
│   ├── validation.ts       # Input validation
│   ├── performance.ts      # Performance utilities
│   └── ...                 # Other utilities
├── types/              # TypeScript type definitions
│   ├── database.ts         # Database row types
│   ├── ai.ts               # AI service types
│   ├── editor.ts           # Editor types
│   └── ...                 # Other types
├── constants.tsx       # Application constants
└── App.tsx            # Main application component
```

## Architecture Patterns

### 1. Service Layer Pattern

All business logic is in service files:
- `services/aiService.ts` - Orchestrates AI operations
- `services/supabaseService.ts` - Database operations
- `services/editorService.ts` - Editor analysis and fixes

### 2. Context Pattern

State management uses React Context:
- `NovelContext` - Novel data and operations
- `AuthContext` - Authentication state
- `ToastContext` - User notifications
- `LoadingContext` - Loading states

### 3. Hook Pattern

Business logic extracted to custom hooks:
- `useCharacterManagement` - Character CRUD
- `useWorldManagement` - World entry CRUD
- `useArcManagement` - Arc CRUD

### 4. Component Composition

Large components broken into smaller, focused components:
- View components in `components/views/`
- Shared components in `components/`

## Data Flow

```
User Action
  ↓
Component Event Handler
  ↓
Hook or Service Function
  ↓
API Call (Supabase/AI)
  ↓
Update Context State
  ↓
Re-render Components
```

## Key Services

### AI Service (`services/aiService.ts`)
- `generateNextChapter()` - Generate next chapter
- `generatePortrait()` - Generate character portrait
- `planArc()` - Plan story arc
- `processLoreDictation()` - Process voice input

### Supabase Service (`services/supabaseService.ts`)
- `fetchAllNovels()` - Fetch user's novels
- `saveNovel()` - Save novel state
- `deleteNovel()` - Delete novel
- `deleteChapter()` - Delete chapter

### Prompt Engine (`services/promptEngine/`)
- `promptBuilder.ts` - Main prompt building logic
- `contextGatherer.ts` - Gathers context for prompts
- `arcContextAnalyzer.ts` - Analyzes arc context
- `writers/` - Specific prompt writers

## Authentication Flow

```
App Startup
  ↓
AuthProvider checks session
  ↓
If authenticated → Show App
If not authenticated → Show LoginForm
  ↓
User signs in/signs up
  ↓
Session stored in localStorage
  ↓
All database queries filtered by user_id (RLS)
```

## Error Handling Flow

```
Operation
  ↓
Try/Catch Block
  ↓
If error:
  - Log with logger service
  - Format error message
  - Show user-friendly message
  - Retry if retryable
```

## Performance Optimizations

1. **Lazy Loading**: Heavy components loaded on demand
2. **Memoization**: Expensive computations memoized
3. **Code Splitting**: Routes split into separate bundles
4. **Database Indexing**: Comprehensive indexes for fast queries

## Security

1. **Authentication**: Supabase Auth required
2. **RLS**: Row Level Security filters all queries
3. **API Keys**: Environment variables, never exposed
4. **Input Validation**: All inputs validated before processing

## Testing Strategy

- **Unit Tests**: Utilities and services
- **Integration Tests**: Service interactions
- **Component Tests**: React components
- **E2E Tests**: Full user flows

## Deployment

1. Build: `npm run build`
2. Deploy `dist/` folder to static hosting
3. Set environment variables in hosting platform
4. Ensure Supabase database is accessible
