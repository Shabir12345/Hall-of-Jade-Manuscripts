# Prompt Engineering Guide

## Overview

This guide covers the prompt engineering system for the Hall of Jade Manuscripts application, including best practices, structure, and optimization strategies.

## Prompt System Architecture

### Core Components

1. **Prompt Builder** (`services/promptEngine/promptBuilder.ts`)
   - Main prompt construction logic
   - Dynamic compression to fit token limits
   - Section prioritization

2. **Context Gatherer** (`services/promptEngine/contextGatherer.ts`)
   - Gathers story context
   - Truncates content intelligently
   - Builds context sections

3. **Prompt Writers** (`services/promptEngine/writers/`)
   - `chapterPromptWriter.ts` - Chapter generation prompts
   - `arcPromptWriter.ts` - Arc planning prompts
   - `editPromptWriter.ts` - Chapter editing prompts
   - `expansionPromptWriter.ts` - Content expansion prompts

4. **Style Analyzer** (`services/promptEngine/styleAnalyzer.ts`)
   - Analyzes writing style
   - Generates style guidelines
   - Provides style constraints

5. **Token Estimator** (`services/promptEngine/tokenEstimator.ts`)
   - Estimates token usage
   - Helps with prompt optimization

## Prompt Structure

### Standard Prompt Sections

1. **Role Definition** - AI's role and expertise
2. **Chapter Transition** - Critical continuity bridge
3. **Story Context** - Novel metadata and current state
4. **Character Context** - Active characters and development
5. **World Context** - World-building elements
6. **Arc Context** - Current arc and progression
7. **Style Guidelines** - Writing style and consistency
8. **Genre Conventions** - Genre-specific conventions
9. **Literary Principles** - Core writing principles
10. **Task Definition** - Specific task and instructions
11. **Constraints & Requirements** - Rules and requirements
12. **Output Format** - Expected output structure

### Section Priority

Critical sections (highest priority):
- Chapter Transition (continuity)
- Task Definition
- Output Format
- Constraints

High priority:
- Character Context (main characters)
- Arc Context (current arc)
- Literary Principles (core principles)

Medium priority:
- Story Context (metadata)
- World Context (relevant world elements)
- Style Guidelines

Low priority (can be truncated):
- Full character codex
- Complete world bible
- All arc history

## Prompt Optimization

### Dynamic Compression

The prompt builder automatically compresses prompts to fit token limits:
- Intelligent truncation of low-priority sections
- Preserves critical information
- Maintains prompt effectiveness

### Token Estimation

Uses token estimation for accurate size calculation:
- Character-based estimation (4 chars ≈ 1 token)
- Handles different tokenizers
- Accounts for special characters

### Context Prioritization

Prioritizes recent and relevant content:
- Recent chapters (last 4-5 chapters)
- Active arc context
- Current realm information
- Protagonist and main characters

## Prompt Best Practices

### 1. Clear Instructions

```typescript
taskDescription: `
Generate the next chapter that:
- Advances the plot naturally
- Develops characters meaningfully
- Maintains narrative momentum
`
```

### 2. Specific Constraints

```typescript
specificConstraints: [
  'Chapter must be at least 1500 words',
  'Must include proper paragraph breaks',
  'Must advance at least one plot thread',
]
```

### 3. Output Format

```typescript
outputFormat: `
Return ONLY valid JSON with:
- chapterTitle: string
- chapterContent: string (at least 1500 words)
- chapterSummary: string
- characterUpdates: array
`
```

### 4. Context Selection

Include only relevant context:
- Recent chapters (not all chapters)
- Active characters (not entire codex)
- Current realm (not all realms)
- Active arc (not all arcs)

## Prompt Testing

### Testing Framework (Recommended)

```typescript
interface PromptTest {
  input: NovelState;
  userInstruction: string;
  expectedSections: string[];
  maxLength: number;
}

function testPrompt(promptTest: PromptTest) {
  const prompt = await buildChapterPrompt(
    promptTest.input,
    promptTest.userInstruction
  );
  
  // Verify sections are present
  promptTest.expectedSections.forEach(section => {
    expect(prompt.userPrompt).toContain(section);
  });
  
  // Verify length constraint
  expect(prompt.userPrompt.length).toBeLessThan(promptTest.maxLength);
}
```

## Prompt Versioning

### Version Control

Keep track of prompt versions:
- Version number in prompt metadata
- Track prompt effectiveness
- A/B test different variations

### Analytics

Monitor prompt performance:
- Success rates
- Token usage
- Generation quality
- User satisfaction

## Remaining Work

### High Priority
- [ ] Create prompt testing framework
- [ ] Add prompt versioning system
- [ ] Implement prompt analytics
- [ ] Optimize prompt length (currently 12,000 char limit)

### Medium Priority
- [ ] A/B test different prompt variations
- [ ] Create prompt templates library
- [ ] Add prompt quality metrics
- [ ] Document prompt patterns

### Low Priority
- [ ] Add prompt debugging tools
- [ ] Create prompt preview UI
- [ ] Implement prompt caching
- [ ] Add prompt optimization suggestions

## Prompt Improvement Checklist

- [ ] Clear and specific instructions
- [ ] Relevant context only
- [ ] Proper output format specification
- [ ] Appropriate length (fit token limits)
- [ ] Section prioritization
- [ ] Style consistency
- [ ] Genre conventions
- [ ] Literary principles
- [ ] User instructions respected
- [ ] Constraints properly specified
