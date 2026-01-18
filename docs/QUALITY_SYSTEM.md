# Authentic Chapter Quality & Originality System

## Overview

The Authentic Chapter Quality & Originality System is a comprehensive quality assurance system designed to ensure generated chapters meet professional fiction standards, maintain originality, and preserve consistent authorial voice.

## System Architecture

### Components

1. **Pre-Generation Quality Checks** (`services/chapterQualityValidator.ts`)
   - Validates narrative craft readiness
   - Checks originality preparation
   - Verifies voice consistency readiness

2. **Enhanced Prompt Engineering** (`services/promptEngine/writers/chapterPromptWriter.ts`)
   - Narrative craft enforcement
   - Originality constraints
   - Authorial voice consistency

3. **Post-Generation Validation** (`services/chapterQualityValidator.ts`)
   - Comprehensive quality metrics
   - Narrative craft analysis
   - Originality scoring
   - Voice consistency validation
   - Editorial quality assessment

4. **Automatic Regeneration** (`services/chapterRegenerationService.ts`)
   - Detects quality failures
   - Regenerates with enhanced constraints
   - Tracks improvement attempts

5. **Narrative Craft Analyzer** (`services/narrativeCraftAnalyzer.ts`)
   - Sentence variation (burstiness)
   - Vocabulary unpredictability (perplexity)
   - Subtext detection
   - Character interiority
   - Scene intent validation
   - Dialogue naturalness

6. **Originality Detector** (`services/originalityDetector.ts`)
   - Creative distance calculation
   - Novel metaphor detection
   - Unique imagery analysis
   - Scene construction originality
   - Emotional beat originality

7. **Style Profile System** (`services/promptEngine/styleAnalyzer.ts`)
   - Authorial voice profile extraction
   - Voice consistency enforcement

## Quality Metrics

### Narrative Craft Score (0-100)
- **Burstiness**: Sentence length variation (target: >60)
- **Perplexity**: Vocabulary unpredictability (target: >60)
- **Subtext**: Subtext instances per 1000 words (target: 3+)
- **Interiority**: Character interiority depth (target: 40%+ paragraphs)
- **Scene Intent**: Value shift clarity (target: >60)
- **Dialogue Naturalness**: Natural dialogue patterns (target: >50)

### Originality Score (0-100)
- **Creative Distance**: Distance from training patterns (target: >60)
- **Novel Metaphors**: Novel metaphors per 1000 words (target: 2+)
- **Unique Imagery**: Unique imagery instances (target: 5+ per 1000 words)
- **Scene Construction**: Originality of scene structures (target: >60)
- **Emotional Beats**: Originality of emotional moments (target: >60)

### Voice Consistency Score (0-100)
- **Sentence Complexity Match**: Match to established complexity (target: >70)
- **Tone Consistency**: Consistency with established tone (target: >70)
- **Stylistic Pattern Preservation**: Preservation of quirks (target: >70)

### Editorial Score (0-100)
- **Readability**: Sentence complexity balance (target: 15-20 words avg)
- **Flow**: Transition quality (target: 3-5 per 1000 words)
- **Emotional Authenticity**: Emotional language density (target: 3-7 per 1000 words)
- **Narrative Coherence**: Logic audit completeness (target: >70)
- **Structural Balance**: Paragraph variety (target: >75)

## Regeneration Thresholds

### Critical Thresholds (Auto-Regeneration Triggered)
- Originality: <60
- Narrative Craft: <65
- Voice Consistency: <70
- Generic patterns detected
- Mechanical structures detected
- Derivative content detected

### Minor Thresholds (Warnings Only)
- Originality: <75
- Narrative Craft: <80
- Voice Consistency: <85

## Configuration

Quality thresholds and regeneration behavior can be configured in `constants.tsx`:

```typescript
export const QUALITY_CONFIG: RegenerationConfig = {
  maxAttempts: 3,
  criticalThresholds: {
    originality: 60,
    narrativeCraft: 65,
    voiceConsistency: 70,
  },
  minorThresholds: {
    originality: 75,
    narrativeCraft: 80,
    voiceConsistency: 85,
  },
  enabled: true,
};
```

## Usage

### Pre-Generation Checks

```typescript
import { validateChapterGenerationQuality } from './services/chapterQualityValidator';

const qualityCheck = validateChapterGenerationQuality(state, nextChapterNumber);
if (qualityCheck.suggestions.length > 0) {
  // Use suggestions to improve generation context
}
```

### Post-Generation Validation

```typescript
import { validateChapterQuality } from './services/chapterQualityValidator';

const metrics = await validateChapterQuality(chapter, state);
if (metrics.shouldRegenerate) {
  // Chapter will be automatically regenerated
}
```

### Manual Regeneration

```typescript
import { regenerateWithQualityCheck } from './services/chapterRegenerationService';

const result = await regenerateWithQualityCheck(chapter, state, metrics, QUALITY_CONFIG);
if (result.success) {
  // Use result.chapter
}
```

## Performance Considerations

- **Caching**: Analysis results are cached for 5 minutes
- **Early Exit**: Regeneration stops if quality improves sufficiently
- **Async Processing**: Non-critical analyses run asynchronously
- **Cache Limits**: Maximum 10 cached entries per analysis type

## Error Handling

All validation functions include graceful degradation:
- Fallback scores returned on errors
- Comprehensive error logging
- System continues operation even if analyses fail
- User-friendly error messages via phase callbacks

## Testing

Unit tests are available in `src/test/services/`:
- `narrativeCraftAnalyzer.test.ts`
- `originalityDetector.test.ts`
- `chapterQualityValidator.test.ts`
- `chapterRegenerationService.test.ts`

Run tests with:
```bash
npm test
```

## Monitoring

Quality metrics are tracked via phase callbacks:
- `pre_generation_quality_check`
- `post_generation_validation`
- `regeneration_start`
- `regeneration_complete`
- `quality_validation`

## Best Practices

1. **Monitor Quality Scores**: Track metrics over time to identify trends
2. **Adjust Thresholds**: Fine-tune thresholds based on your novel's style
3. **Review Regenerations**: Check regeneration history to understand common issues
4. **Voice Profile**: Ensure 3+ chapters exist before expecting voice consistency
5. **Performance**: Cache is automatically managed, but monitor cache hit rates

## Troubleshooting

### Low Originality Scores
- Check for generic patterns in recent chapters
- Review metaphor usage
- Ensure unique scene construction

### Low Narrative Craft Scores
- Increase sentence length variation
- Add more subtext to dialogue
- Include character interiority

### Low Voice Consistency
- Ensure sufficient chapters exist (3+)
- Check voice profile extraction
- Review stylistic quirks preservation

### High Regeneration Rates
- Review critical thresholds
- Check for systematic issues in prompts
- Consider adjusting thresholds
