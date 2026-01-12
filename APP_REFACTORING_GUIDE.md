# App.tsx Refactoring Guide

## Current State

- **File Size**: 5,526 lines
- **Component Type**: Monolithic component handling all views
- **State Variables**: 20+ useState hooks
- **Views**: 16 different views handled in a single component

## Refactoring Strategy

### Phase 1: Extract View Components ✅ (Started)

Created view components:
- ✅ `components/views/DashboardView.tsx`
- ✅ `components/views/CharactersView.tsx`
- ✅ `components/views/WorldBibleView.tsx`

### Phase 2: Extract Business Logic Hooks ✅ (Started)

Created hooks:
- ✅ `hooks/useCharacterManagement.ts` - Character CRUD operations
- ✅ `hooks/useWorldManagement.ts` - World entry CRUD operations
- ✅ `hooks/useArcManagement.ts` - Arc CRUD operations

### Phase 3: Remaining Work

#### Views to Create:
- [ ] `components/views/ChaptersView.tsx` - Chapter list and management
- [ ] `components/views/PlanningView.tsx` - Arc planning and editing
- [ ] `components/views/AntagonistsView.tsx` - Antagonist management (partially exists as AntagonistManager)

#### Hooks to Create:
- [ ] `hooks/useChapterGeneration.ts` - Chapter generation logic (partially exists)
- [ ] `hooks/useChapterProcessing.ts` - Post-generation processing (partially exists)
- [ ] `hooks/useNovelManagement.ts` - Novel CRUD operations
- [ ] `hooks/useEditorIntegration.ts` - Editor review and fixes logic

#### View Router:
- [ ] Create `components/ViewRouter.tsx` to handle view routing
- [ ] Move all view conditionals to router component

## Current View Structure in App.tsx

```typescript
{currentView === 'dashboard' && <DashboardView />}
{currentView === 'chapters' && <ChapterList />}
{currentView === 'editor' && <ChapterEditor />}
{currentView === 'world-bible' && <WorldBibleView />}
{currentView === 'characters' && <CharactersView />}
{currentView === 'planning' && <ArcPlanning />}
{currentView === 'antagonists' && <AntagonistManager />}
// ... 9 more views
```

## Target Structure

```typescript
// App.tsx (simplified)
const App: React.FC = () => {
  // Auth check
  // Main hooks
  // View router
  
  return (
    <ViewRouter 
      currentView={currentView}
      novel={activeNovel}
      chapter={activeChapter}
      // ... props
    />
  );
};
```

## Benefits of Refactoring

1. **Maintainability**: Smaller, focused components
2. **Testability**: Easier to test individual views
3. **Performance**: Better code splitting and lazy loading
4. **Reusability**: Views can be reused in different contexts
5. **Type Safety**: Better TypeScript inference in smaller files

## Remaining Work Priority

1. **High Priority**: Extract chapter generation and processing logic (most complex)
2. **Medium Priority**: Extract remaining view components
3. **Low Priority**: Create view router (mostly organizational)

## Estimated Effort

- **View Components**: ~2-3 hours per view (16 views = 32-48 hours)
- **Business Logic Hooks**: ~1-2 hours per hook (4-6 hooks = 4-12 hours)
- **Testing & Refinement**: ~8-16 hours
- **Total**: ~44-76 hours of focused work

## Migration Strategy

1. Create new view component
2. Extract related logic to hook
3. Update App.tsx to use new component
4. Test thoroughly
5. Remove old code from App.tsx
6. Repeat for each view

This can be done incrementally without breaking existing functionality.
