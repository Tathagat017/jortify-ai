# Confidence Score Algorithm - Simplified Version

## Overview

The confidence score algorithm has been simplified to provide more intuitive and accurate scores. The algorithm uses semantic similarity as the base score and only adds positive bonuses for additional signals:

1. **Base Score**: Semantic similarity from RAG embeddings (0-1 range)
2. **String Match Bonus**: Up to +0.2 for meaningful text matches
3. **Link Relationship Bonus**: Up to +0.15 for knowledge graph connections
4. **Topic Relevance**: ±5% adjustment (future enhancement)

## Algorithm Details

### 1. Semantic Similarity (Base Score)

The algorithm starts with the semantic similarity score from vector embeddings:

- Range: 0.0 to 1.0
- This captures conceptual relationships between pages
- No multiplication or reduction - used as-is

### 2. String Match Bonus (Up to +0.2)

Only applied when meaningful matches are found:

```typescript
if (contentScore > 0.3) {
  confidence += Math.min(contentScore * 0.2, 0.2);
}
```

String matching checks for:

- **Exact title match**: Returns score of 1.0 immediately
- **Significant title words**: Score of 0.8 if 70%+ of title words match
- **Keyword matches**: Up to 0.6 based on summary keyword matches

### 3. Link Relationship Bonus (Up to +0.15)

Rewards pages that are well-connected in the knowledge graph:

```typescript
const totalLinks = incomingLinks + outgoingLinks + mutualConnections * 2;
if (totalLinks > 0) {
  const linkBonus = Math.min(totalLinks * 0.02, 0.15);
  confidence += linkBonus;
}
```

- Mutual connections count double
- Maximum bonus capped at 0.15

### 4. Final Score Adjustment

```typescript
// Ensure confidence doesn't exceed 1.0
confidence = Math.min(confidence, 1.0);

// Apply gentle curve to spread scores
confidence = Math.pow(confidence, 0.95);
```

## Example Calculations

### Example 1: High Semantic Match

- Semantic similarity: 0.85
- String match: None (0.0)
- Link relationships: 2 incoming, 1 outgoing
- **Calculation**:
  - Base: 0.85
  - String bonus: 0 (no match)
  - Link bonus: min(3 \* 0.02, 0.15) = 0.06
  - Total: 0.91
  - After curve: 0.91^0.95 = 0.91
  - **Final: 0.91 (High confidence)**

### Example 2: Moderate Semantic + String Match

- Semantic similarity: 0.65
- String match: 0.5 (some keywords match)
- Link relationships: None
- **Calculation**:
  - Base: 0.65
  - String bonus: min(0.5 \* 0.2, 0.2) = 0.1
  - Link bonus: 0
  - Total: 0.75
  - After curve: 0.75^0.95 = 0.76
  - **Final: 0.76 (High confidence)**

### Example 3: Low Semantic but Exact Title Match

- Semantic similarity: 0.4
- String match: 1.0 (exact title)
- Link relationships: 1 mutual connection
- **Calculation**:
  - Base: 0.4
  - String bonus: min(1.0 \* 0.2, 0.2) = 0.2
  - Link bonus: min(2 \* 0.02, 0.15) = 0.04
  - Total: 0.64
  - After curve: 0.64^0.95 = 0.66
  - **Final: 0.66 (Medium-High confidence)**

## Benefits of Simplified Algorithm

1. **Intuitive**: Semantic similarity as base with only positive additions
2. **No Penalties**: Only bonuses are applied, making it easier to understand
3. **Balanced**: High semantic matches properly show as high confidence
4. **Flexible**: Easy to adjust bonus caps without affecting base scores
5. **Clean**: No complex weighted averages or multiple multiplication factors

## Implementation Notes

- Confidence threshold: 0.5 for filtering suggestions
- Maximum 8 suggestions returned
- Duplicates removed (keeping highest confidence)
- No word match information displayed in UI
- Console logs minimized for cleaner output
