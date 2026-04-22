# SightViz Design Philosophy

## Purpose

SightViz is an assistive vision tool. Every design decision must serve
one goal: reduce cognitive load so the user can focus on the world
around them, not on the interface.

---

## Principles

### 1. The Interface Recedes

The screen should never compete with the environment. Warm sage and
stone neutrals (bgPage #e9e9df, bgCard #d8dcdb) feel like ambient
background, not a focal point. Colour is earned — it appears only
where the user needs to act or where the system is speaking.

### 2. Calm Clarity

There are no deep dark backgrounds, no aggressive saturated blues.
Even the primary accent (teal #5db1b6) is desaturated enough to read
as "calm confidence" rather than "urgent alert". Semantic reds and
ambers are reserved strictly for error and warning states — they must
retain their signal value.

### 3. Generous Typography

Text is never rushed. Letter-spacing on headings is slightly open
(+0.07 em on h1, +1 on logo) to give words room to breathe. Font
weights step in clear jumps: Regular body → Medium metadata →
SemiBold labels → Bold display. No weight is used decoratively.

### 4. Haptic-Scale Touch Targets

Every interactive element is at minimum 44 × 44 pt (Apple HIG / WCAG
2.5.5). Segment buttons are 52 pt tall. Tab icons sit inside 40 × 40
containers. The extra space is not padding waste — it is the margin of
error for users who cannot look at what they are tapping.

### 5. Predictable Structure

Every screen follows the same three-layer stack:

- Header (title + subtitle or breadcrumb)
- Content cards (grouped by topic, separated by 12 pt gaps)
- Bottom navigation bar

This consistency means a user who knows one screen already knows all
screens. Do not introduce one-off layouts.

### 6. Light Over Dark

The app defaults to the warm sage light theme. A dark mode may be
implemented at a later stage, but it must honour the same calm,
desaturated palette (dark navy, not deep black; teal stays teal).
Do not revert to high-contrast navy-and-neon aesthetics.

---

## Color Intent

| Token         | Hex     | Meaning                                     |
| ------------- | ------- | ------------------------------------------- |
| primary       | #5db1b6 | "I can act here." Sliders, toggles, links.  |
| primaryBright | #3dbdb3 | "Act now." CTA button background.           |
| brand         | #5F33E1 | "This is SightViz." Logo and brand marks.   |
| bgCard        | #d8dcdb | "This is a grouping." Card surface.         |
| bgInactive    | #ecede8 | "This is available but not selected."       |
| bgTabActive   | #cad6ff | "You are here." Active tab pill background. |
| textPrimary   | #1f1f17 | All content meant to be read.               |
| textMuted     | #878787 | Supporting, secondary information.          |
| success       | #10b981 | Positive state, active session, data found. |
| warning       | #f59e0b | Caution required, partial state.            |
| error         | #ef4444 | Action blocked, permission denied.          |

---

## Typography Scale

| Token     | Weight    | Size | Use case                       |
| --------- | --------- | ---- | ------------------------------ |
| displayLg | Bold 700  | 28   | App logo wordmark              |
| displayMd | ExtraBold | 28   | Page-level tab titles          |
| h1        | SemiBold  | 24   | Screen page title              |
| h2        | SemiBold  | 20   | Card / section title           |
| body      | Regular   | 14   | Primary reading text           |
| bodyLg    | Regular   | 16   | Slightly emphasised body text  |
| caption   | Regular   | 12   | Timestamps, metadata, hints    |
| label     | SemiBold  | 16   | Segment buttons, action labels |
| labelSm   | Medium    | 12   | Tab bar labels                 |
| cta       | SemiBold  | 19   | Call-to-action button text     |
| badge     | Bold      | 11   | Uppercase status badges        |

---

## Spacing System

Based on an 8 pt base unit:

xs = 4 pt — icon-to-label gaps
sm = 8 pt — tight internal padding
md = 12 pt — gap between cards
lg = 16 pt — internal card child gaps, scroll padding
xl = 20 pt — medium section separation
xxl = 24 pt — card padding, major section separation
xxxl = 32 pt — bottom bar horizontal padding, outer margins

---

## Border Radius

sm = 12 — tab icon containers, chips
md = 16 — segment buttons, stat cards
lg = 20 — main content cards
xl = 28 — modal sheets, floating panels
full = 9999 — circular elements (avatar, status dot)

---

## Shadow Guidelines

Shadows should reinforce layer depth, not add decoration.

card — subtle lift (opacity 0.10, radius 4): cards above page surface
bar — upward lift (opacity 0.08): bottom navigation bar
button — teal-coloured glow (opacity 0.30): primary CTA only
heavy — strong depth (opacity 0.50): camera viewfinder, full-bleed elements

Use `elevation` to mirror the Android shadow values (card=2, bar=4, button=6, heavy=10).

---

## Accessibility

- All text must meet WCAG AA contrast (4.5:1 for body, 3:1 for large text).
- textPrimary on bgCard: #1f1f17 on #d8dcdb ≈ 9.4:1 ✓
- textMuted on bgCard: #878787 on #d8dcdb ≈ 3.5:1 (large text / captions only) ✓
- primary (teal) is not used as the sole indicator — always paired with shape or label.
- Screen reader labels are required on every interactive element.

---

## What to Avoid

- ❌ Deep navy / dark background by default — reserved for future dark mode
- ❌ Saturated blue primary (#3b82f6 etc.) — clashes with teal accent
- ❌ Inline magic numbers — every value must come from the design system
- ❌ Font weight below Regular (300) in body copy — too light for accessibility
- ❌ Shadow-only affordance — combine with border or background change
- ❌ Animations over 300 ms for state transitions — keep UI snappy
