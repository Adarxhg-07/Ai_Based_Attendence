# Reference Poster Layout Analysis

Source: `Poster/Ref_1.jpeg` (816×1104 px, aspect 0.739) and `Poster/Ref_2.jpeg` (576×1440 px, aspect 0.400).

Both references use the same content (CIM Automation Lab Trainer, Faculty of EE, GIKI) in two different aspect ratios — a **standard poster** (~A1 portrait) and a **vertical standee** (~roll-up banner). The sections are the same; only the arrangement differs.

---

## Common sections (both variants)

| # | Section | Content |
|---|---------|---------|
| 1 | Header strip | GIKI name (red), Faculty subtitle, small GIKI logo in top-right corner. |
| 2 | Title band | Project title in bold uppercase, white text on dark accent background. |
| 3 | Abstract | Paragraph explaining project motivation & overview. |
| 4 | Flowchart | Process flow diagram (top-level method). |
| 5 | Objectives | Bullet list of project goals. |
| 6 | Applications | Bullet list of real-world uses. |
| 7 | Top View / System Image | A photo or rendering of the hardware / system. |
| 8 | Results | Key findings and photos of working system. |
| 9 | Key Tools | Bullet list of software/hardware tools used. |
| 10 | Conclusion | Short summary of outcome and significance. |
| 11 | Partners strip | Sponsor / industry-partner logos (Siemens, etc.). |
| 12 | Group members | Team names + registration numbers. |
| 13 | Advisor / Co-advisor | Name + designation. |

---

## Ref_1 — Poster (816×1104 px, 0.74 aspect ≈ A1 portrait 23.4 × 33.1 in)

Two-column layout:

```
┌────────────────────────────────────────────────────┐
│  HEADER STRIP  (institute + faculty + logo)        │ 6%
├────────────────────────────────────────────────────┤
│  TITLE BAND  (project title, dark background)      │ 7%
├──────────────────────────┬─────────────────────────┤
│  ABSTRACT                │  FLOWCHART              │
│  (justified paragraph)   │  (diagram)              │ 25%
│                          │                         │
├──────────────────────────┼─────────────────────────┤
│  OBJECTIVES              │  APPLICATIONS           │
│  (bullet list)           │  (bullet list)          │ 18%
├──────────────────────────┼─────────────────────────┤
│  KEY TOOLS               │  RESULTS                │
│  (bullet list w/ icons)  │  (photo + numbers)      │ 18%
├──────────────────────────┼─────────────────────────┤
│  TOP VIEW  (system img)  │  CONCLUSION             │ 12%
├──────────────────────────┴─────────────────────────┤
│  PARTNERS STRIP (sponsor logos)                    │ 5%
├────────────────────────────────────────────────────┤
│  GROUP MEMBERS            │  ADVISOR / CO-ADVISOR   │ 9%
└────────────────────────────────────────────────────┘
```

- Left column ~42% width; right column ~54% width; 4% gutter
- Margins ~3% all sides

## Ref_2 — Standee (576×1440 px, 0.40 aspect ≈ 33 × 82 in roll-up)

Single-column stack (plus some paired small blocks):

```
┌─────────────────────────────┐
│  HEADER STRIP               │ 4%
├─────────────────────────────┤
│  TITLE BAND                 │ 5%
├─────────────────────────────┤
│  ABSTRACT                   │ 10%
├──────────────┬──────────────┤
│  OBJECTIVES  │  FLOWCHART   │ 14%
├──────────────┼──────────────┤
│  TOP VIEW    │  APPLICATIONS│ 12%
├──────────────┴──────────────┤
│  SYSTEM / RESULTS IMAGE     │ 15%
├──────────────┬──────────────┤
│  KEY TOOLS   │  RESULTS     │ 14%
├──────────────┴──────────────┤
│  CONCLUSION                 │ 10%
├─────────────────────────────┤
│  PARTNERS STRIP             │ 4%
├─────────────────────────────┤
│  GROUP MEMBERS (compact)    │ 8%
├─────────────────────────────┤
│  ADVISORS                   │ 4%
└─────────────────────────────┘
```

---

## Typography observations (from the reference)

- All-caps bold sans-serif for section headers.
- Justified body text.
- Section headers inside coloured pill-shaped bars.
- Title uses a heavy condensed sans at large size.
- Numbers in bullet lists prefixed with ▶ or arrow icons.

## Color observations (to be DIFFERENTIATED in our version)

Reference palette: red (#C8102E), navy (#0B2239), light gray (#D7DEE4), white.
**Our version will use a distinctly different palette** — see `poster_theme.md`.
