---
name: Transaction Reconciliation Engine
description: Audit-ready reconciliation outputs for fast reviewer verification
colors:
  accent: "#5B8CFF"
  bg: "#0F1115"
  surface: "#151922"
  border: "#23262F"
  text: "#E6E8EF"
  text-muted: "#A5ACB8"
typography:
  display:
    fontFamily: "Sora, Inter, system-ui, sans-serif"
    fontSize: "clamp(2rem, 3vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.15
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#4A7BFF"
    textColor: "{colors.bg}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
    typography: "{typography.label}"
---

# Design System: Transaction Reconciliation Engine

<!-- SEED -->

## 1. Overview

**Creative North Star: "The Calibration Console"**

This system should feel like a precise, reliable instrument for verification. The interface is deliberately restrained, with analytical clarity over visual flourish. It should communicate production‑grade confidence without resorting to glossy dashboards or attention‑seeking effects.

The visual tone is dark and focused, emphasizing contrast, legibility, and scanability. The UI stays out of the way so reviewers can validate matching logic, inspect conflicts, and confirm edge cases quickly.

**Key Characteristics:** precise, quiet, signal‑dense, reviewer‑friendly.

## 2. Colors

A restrained dark palette with a single clean accent for primary actions and highlights.

### Primary
- **Signal Blue** (#5B8CFF): Primary actions, key counts, and interactive highlights that confirm progress or selection.

### Neutral
- **Midnight Base** (#0F1115): App background and full‑bleed surfaces.
- **Graphite Surface** (#151922): Panels, tables, and elevated containers.
- **Fine Divider** (#23262F): Borders, table rules, and separators.
- **High‑Read Text** (#E6E8EF): Primary body text and headings.
- **Muted Text** (#A5ACB8): Secondary labels, metadata, and hints.

### Named Rules
**The Low‑Noise Rule.** Accent color is reserved for primary actions and the most important status signals. Everything else stays neutral.

## 3. Typography

**Display Font:** Sora (geometric sans)  
**Body Font:** Inter  

**Character:** modern, precise, and analytical, with clear hierarchy that emphasizes results and status.

### Hierarchy
- **Display** (600, clamp(2rem–2.75rem), 1.15): Run titles and major section headers.
- **Headline** (600, 20–24px, 1.3): Card and panel headings.
- **Title** (600, 16–18px, 1.35): Table headers and key labels.
- **Body** (400, 16px, 1.6): Primary content, explanations, and metadata. Keep line length to ~70ch where possible.
- **Label** (600, 12px, 0.02em): Tags, badges, and small UI labels.

### Named Rules
**The Evidence Rule.** Use the strongest weights for counts, run IDs, and discrepancies so verification is fast at a glance.

## 4. Elevation

This system uses subtle tonal layering rather than heavy shadows. Surfaces separate via background tone and borders; shadows appear only to confirm interaction states (hover, focus).

### Named Rules
**The Flat‑by‑Default Rule.** Resting surfaces are flat; elevation only appears during interaction.

## 5. Components

### Buttons
- **Shape:** compact, with a crisp 6px radius.
- **Primary:** Signal Blue on Midnight Base; used for reconciliation triggers and primary actions.
- **Secondary/Ghost:** Neutral text with subtle border; used for navigation and filters.

### Tables
- Emphasize row readability with soft separators and strong column labels.
- Keep row height consistent and avoid zebra striping unless dense data requires it.

### Status Badges
- Use muted text for informational states and reserve accent for success or active selection.

## 6. Do's and Don'ts

**Do**
- Keep outputs scan‑friendly with clear type hierarchy and minimal decoration.
- Use accent color sparingly for key actions and critical status cues.
- Preserve keyboard accessibility and readable contrast throughout.

**Don't**
- Add flashy gradients, heavy shadows, or animated flourishes.
- Use generic dashboard templates or multi‑accent palettes.
- Hide key verification details behind extra clicks or overlays.
