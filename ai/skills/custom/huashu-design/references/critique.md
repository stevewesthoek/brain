# 5-Dimension Design Critique

## What This Is

A structured audit of an existing design across five key dimensions, with concrete visual examples and recommendations.

**Not the same as existing-code redesign.** Critique identifies issues; redesign implements fixes in code.

## The Five Dimensions

### 1. Typography
- **Check:** Hierarchy, readability, character, font choices
- **Anti-patterns:** Generic/boring fonts, oversized H1s, unclear hierarchy, line-length too long
- **Good signs:** Intentional font choices, clear hierarchy, scannable, ~60–65 char line width

### 2. Color & Contrast
- **Check:** Palette cohesion, accessibility (WCAG AA minimum), emotional tone
- **Anti-patterns:** Too many colors, low contrast, generic AI purple, oversaturated accents
- **Good signs:** 1–2 accent colors, strong contrast, cohesive palette, intentional mood

### 3. Layout & Spacing
- **Check:** Alignment, breathing room, visual balance, grid system
- **Anti-patterns:** Chaotic alignment, too-dense packing, unintentional symmetry, missing whitespace
- **Good signs:** Intentional grid, consistent spacing, optical balance, generous whitespace

### 4. Interaction & Motion
- **Check:** Feedback quality, state clarity, animation purposefulness
- **Anti-patterns:** No hover states, instant transitions, generic spinners, over-animated
- **Good signs:** Clear hover/focus/active states, smooth transitions (200–300ms), spring physics

### 5. Branding & Consistency
- **Check:** Alignment to design system (if exists), coherence across pages
- **Anti-patterns:** Inconsistent colors, fonts, spacing; generic AI patterns; brand misuse
- **Good signs:** Follows `DESIGN.md`, applies brand consistently, no generic patterns

## Critique Format

### Structure

```
## Critique: [Project/Page Name]

### Current State
[Screenshot of existing design or link]

### Findings

#### 1. Typography
**Keep:** [What works]
**Fix:** [What needs improvement]
**Quick wins:** [Easy improvements]

#### 2. Color & Contrast
**Keep:** [What works]
**Fix:** [What needs improvement]
**Quick wins:** [Easy improvements]

#### 3. Layout & Spacing
**Keep:** [What works]
**Fix:** [What needs improvement]
**Quick wins:** [Easy improvements]

#### 4. Interaction & Motion
**Keep:** [What works]
**Fix:** [What needs improvement]
**Quick wins:** [Easy improvements]

#### 5. Branding & Consistency
**Keep:** [What works]
**Fix:** [What needs improvement]
**Quick wins:** [Easy improvements]

### Recommendations (Priority Order)
1. [High-impact fix]
2. [Medium-impact fix]
3. [Quick win]

### Before/After Comparison
[HTML side-by-side or screenshots showing current vs. improved]

### Tools & Checklist
- [ ] Used `/taste-skill` audit framework
- [ ] Checked against `DESIGN.md` (if exists)
- [ ] Verified contrast ratios (WCAG AA)
- [ ] Tested interactions in browser
- [ ] Before/after visuals clear and comparable
```

## Workflow

1. **Read** the existing design carefully
2. **Audit** each dimension systematically
3. **Screenshot** the current state
4. **Identify** issues + quick wins
5. **Build improved version** in HTML showing fixes
6. **Display** before/after side-by-side
7. **Document** findings in crisp, visual format

## Output Options

**Option A:** HTML side-by-side comparison
- Current design (left or top)
- Improved version (right or bottom)
- Toggle or slider to compare
- Annotations pointing out changes

**Option B:** PDF or PNG report
- Current screenshot
- Critique findings (text + visual callouts)
- Improved screenshot with annotations
- Exportable for sharing

## Quality Checklist

- [ ] Critique is specific, not vague ("fix the colors" vs. "increase contrast on buttons")
- [ ] Recommendations are actionable (user can implement or brief designer)
- [ ] Before/after visuals are clear and comparable
- [ ] Critique uses `/taste-skill` quality bar (no generic AI patterns)
- [ ] Critique does not claim to implement code changes (that's redesign-skill)
- [ ] Audio/video used if helpful (show hover state with recording)
