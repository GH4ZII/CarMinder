# Car Care Scoring System

## Overview

The scoring system computes a **0-100 care score** for each vehicle based on five weighted categories. It evaluates how well the owner maintains their car using maintenance records, inspection history, incident reports, mileage data, and documentation completeness.

```
GET /cars/{car_id}/score
```

---

## Architecture

```
Repository (raw Supabase dicts)
        |
        v
  normalize.py          -- canonical dataclasses, enum validation, safe parsing
        |
        v
    engine.py            -- pure numeric scoring (no I/O, no date.today())
        |
        v
  scoring_explain.py     -- human-readable recommendations & summary
        |
        v
  scoring_service.py     -- orchestrator: fetch -> normalize -> score -> explain -> DTO
```

| Layer | File | Imports allowed |
|-------|------|-----------------|
| Normalization | `domain/scoring/normalize.py` | stdlib only |
| Engine | `domain/scoring/engine.py` | stdlib + normalize types |
| Explanation | `services/scoring_explain.py` | engine result types + normalize types |
| Orchestrator | `services/scoring_service.py` | everything above + repos + schemas |

The engine is **pure**: given the same inputs and same `as_of` date, the output is always identical.

---

## Categories & Weights

| # | Category | Key | Weight |
|---|----------|-----|--------|
| 1 | Maintenance Regularity | `maintenance_regularity` | **40%** |
| 2 | EU Inspection Compliance | `eu_inspection` | **15%** |
| 3 | Incident History & Repairs | `incident_history` | **20%** |
| 4 | Mileage Tracking | `mileage_tracking` | **10%** |
| 5 | Documentation Quality | `documentation_quality` | **15%** |

Each category produces a 0-100 score. The overall score is the weighted sum divided by 100, then passed through confidence dampening.

---

## Category 1: Maintenance Regularity (40%)

Measures how consistently the owner follows recommended service intervals.

### Service Type Weights

| Service Type | Weight | Interval (km) | Interval (months) |
|-------------|--------|---------------|-------------------|
| Oil Change | 0.35 | 15,000 | 12 |
| Brake Service | 0.25 | 30,000 | 24 |
| Tire Change | 0.15 | 40,000 | 48 |
| Inspection | 0.25 | -- | 12 |

Only these four types are tracked. `repair` and `other` events are excluded.

### Scoring Window

**5 years** from `as_of`, but never before the car's first registration date.

### How Intervals Are Scored

For each service type, events within the window are sorted and the gaps between consecutive events are scored. Each gap gets both a **time score** and a **mileage score** (if data exists); the **worse** of the two is used.

**Interval scoring tiers** (identical formula for both time and mileage):

| Actual vs Expected | Score |
|--------------------|-------|
| On time or early (`<= expected`) | **1.0** |
| Up to 25% late (`<= 1.25x`) | 1.0 -> 0.7 (linear) |
| Up to 50% late (`<= 1.5x`) | 0.7 -> 0.4 (linear) |
| Up to 100% late (`<= 2.0x`) | 0.4 -> 0.0 (linear) |
| More than double (`> 2.0x`) | **0.0** |

### Recency-Weighted Average

Recent intervals matter more. Weights are `[1, 2, 3, ..., N]` for N intervals in chronological order.

```
result = sum(score_i * i) / sum(1..N)
```

### No Events Case

- No schedule defined for type: **1.0**
- Car is too new (less than half the expected interval): **0.75**
- Otherwise: scored as one big missed interval

---

## Category 2: EU Inspection Compliance (15%)

### Current Status (60% of category)

Based on the EU inspection deadline relative to `as_of`:

| Situation | Score |
|-----------|-------|
| No deadline known, but has inspection events | 0.70 |
| No deadline known, no events | 0.50 |
| Overdue > 90 days | 0.00 |
| Overdue 1-90 days | 0.00 -> 0.30 (linear by recency) |
| Due within 30 days | 0.60 |
| Due within 90 days | 0.85 |
| Due in > 90 days | 1.00 |

### Historical Compliance (40% of category)

Gaps between consecutive inspection events:

| Gap | Score |
|-----|-------|
| <= 14 months | 1.0 |
| <= 18 months | 0.6 |
| <= 24 months | 0.3 |
| > 24 months | 0.0 |

**Formula**: `(current_status * 0.6 + historical * 0.4) * 100`

---

## Category 3: Incident History & Repairs (20%)

### No Incidents

- Car >= 12 months old: **100**
- Car < 12 months old: **85** (less data certainty)

### Severity Penalties

| Severity | Penalty points |
|----------|---------------|
| Minor | 5 |
| Moderate | 12 |
| Severe | 25 |

### Repair Credits

For each incident: `recovery = penalty * repair_factor * 0.7`

| Repair Status | Factor |
|---------------|--------|
| Fully repaired | 1.0 |
| Partially repaired | 0.5 |
| Not repaired | 0.0 |

### Age-Adjusted Leniency

Expected incidents = `car_age_years * 0.3`. If actual incident count is below or equal to expected, total penalty is reduced by **30%**.

### Final Formula

```
net = min(total_penalty - total_recovery, 80)
score = max(0, 100 - net)
```

---

## Category 4: Mileage Tracking (10%)

| Sub-component | Weight | How it works |
|--------------|--------|--------------|
| Has current mileage | 0.20 | 1.0 if `current_km > 0`, else 0.0 |
| Recording ratio | 0.50 | Fraction of events that include a mileage reading |
| Consistency | 0.20 | 1.0 minus the ratio of mileage-decrease violations (should be monotonically increasing) |
| Reasonableness | 0.10 | 1.0 normally; 0.5 if < 1,000 km/year; 0.7 if > 60,000 km/year |

**Formula**: `(has_current * 0.20 + recording * 0.50 + consistency * 0.20 + reasonableness * 0.10) * 100`

---

## Category 5: Documentation Quality (15%)

### Per-Event Point System

| Field | Points | Max |
|-------|--------|-----|
| Mileage recorded | 3.0 | 3.0 |
| Cost recorded (> 0) | 2.0 | 2.0 |
| Vendor recorded | 2.0 | 2.0 |
| Notes present | 1.5 | 1.5 |
| Notes > 20 chars (bonus) | 0.5 | 0.5 |
| Receipt image uploaded | 2.0 | 2.0 |

Score per event = `points / max_points`

### Per-Incident Point System

| Field | Points | Max | Condition |
|-------|--------|-----|-----------|
| Damage description | 2.0 | 2.0 | Always |
| Mileage recorded | 2.0 | 2.0 | Always |
| Repair cost (> 0) | 1.5 | 1.5 | Only if repaired |
| Repair vendor | 1.5 | 1.5 | Only if repaired |
| Insurance claim (bool) | 1.0 | 1.0 | Always |

### Combining Scores

- Both events & incidents: `avg_events * 0.70 + avg_incidents * 0.30`
- Only events: `avg_events`
- Only incidents: `avg_incidents`
- Neither (new car < 6 months): **60**
- Neither (older car): **30**

**Volume bonus**: `min(1.0, total_records / max(1, car_age_years * 4)) * 10`

**Final**: `min(100, combined * 90 + volume_bonus)`

---

## Confidence System

Measures how much data is available to produce a reliable score.

```
event_ratio  = min(1.0, total_events / max(1, car_age_months // 12))
age_factor   = min(1.0, car_age_months / 24)

confidence = min(1.0,
    event_ratio * 0.40
  + has_mileage * 0.20
  + has_eu_deadline * 0.15
  + age_factor * 0.15
  + 0.10                   <- base constant
)
```

| Component | Max contribution |
|-----------|-----------------|
| Event ratio | 0.40 |
| Has mileage | 0.20 |
| Has EU deadline | 0.15 |
| Age factor (up to 24 months) | 0.15 |
| Base constant | 0.10 |

### Confidence Labels

| Range | Label |
|-------|-------|
| < 0.25 | `very_low` |
| < 0.50 | `low` |
| < 0.75 | `moderate` |
| >= 0.75 | `high` |

### Dampening

When confidence is low, the score is pulled toward 50 (neutral):

```
if confidence < 0.5:
    factor = confidence / 0.5
    score = raw_score * factor + 50 * (1 - factor)
else:
    score = raw_score
```

At confidence = 0, score = 50. At confidence = 0.5+, score = raw score.

---

## Grading

| Score | Grade | Description |
|-------|-------|-------------|
| >= 90 | **A** | Excellent care |
| >= 75 | **B** | Good care |
| >= 60 | **C** | Fair care |
| >= 40 | **D** | Below average care |
| < 40 | **F** | Poor care |

---

## Recommendations

Up to 5 recommendations are generated based on category scores and detected issues:

| Trigger | Recommendation |
|---------|---------------|
| Maintenance < 50 | Set reminders for oil changes, brake service, tire rotations |
| Maintenance 50-74 | Check service intervals dashboard for due dates |
| EU inspection < 50 | Schedule inspection ASAP |
| EU inspection 50-74 | Plan ahead to book appointment |
| Unrepaired incidents > 0 | Complete repairs to improve score |
| Partially repaired > 0 | Finish incomplete repairs |
| Mileage tracking < 50 | Update mileage regularly, include in event logs |
| Documentation < 50 | Add cost, vendor, notes, upload receipts |
| Documentation 50-74 | Upload receipts and add vendor details |
| All scores good | "Great job maintaining your vehicle!" |

---

## Input Normalization

Raw database values are normalized before entering the engine:

| Raw Value | Canonical | Unknown/Invalid Default |
|-----------|-----------|------------------------|
| Event types | `oil_change`, `brake_service`, `tire_change`, `inspection`, `repair`, `other` | `other` |
| Severity | `minor`, `moderate`, `severe` | `minor` |
| Repair status | `not_repaired`, `partially_repaired`, `fully_repaired` | `not_repaired` |
| Dates | Parsed to `date` objects | Falls back to `as_of` |
| Kilometer | `int` | `0` |
| Strings | Stripped, empty -> `None` | `None` |

---

## Deterministic Sorting

Events and incidents are sorted with multi-field tie-breakers to guarantee stable results:

- **Events**: `(event_date, mileage or 0, event_type, id)`
- **Incidents**: `(incident_date, mileage or 0, severity, id)`

---

## Versioning

- `scoring_version`: `"1.0.0"` -- incremented when the algorithm changes
- `scored_as_of`: the reference `date` used for all time-based calculations
- `computed_at`: UTC timestamp of when the API call was made

---

## API Response

```
GET /cars/{car_id}/score
Authorization: Bearer <token>
```

```json
{
  "car_id": "uuid",
  "overall_score": 72,
  "grade": "C",
  "confidence": 0.65,
  "confidence_label": "moderate",
  "summary": "Toyota Corolla receives a care grade of C (Fair care). Overall score: 72/100.",
  "categories": {
    "maintenance_regularity": { "score": 68, "weight": 40, "label": "Maintenance Regularity" },
    "eu_inspection":          { "score": 85, "weight": 15, "label": "EU Inspection Compliance" },
    "incident_history":       { "score": 90, "weight": 20, "label": "Incident History & Repairs" },
    "mileage_tracking":       { "score": 45, "weight": 10, "label": "Mileage Tracking" },
    "documentation_quality":  { "score": 52, "weight": 15, "label": "Documentation Quality" }
  },
  "recommendations": [
    "Some maintenance services are overdue. Check your service intervals dashboard for upcoming due dates.",
    "Update your car's mileage regularly and include mileage when logging maintenance events for better tracking accuracy."
  ],
  "computed_at": "2026-02-26T14:30:00",
  "scoring_version": "1.0.0",
  "scored_as_of": "2026-02-26"
}
```
