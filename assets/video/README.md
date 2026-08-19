# Feature videos — drop-in spec

The homepage (`index.html`, `#features`) references five screen-recording videos
that **do not exist yet**. Drop the real files in this directory with exactly
these names and the page picks them up with no markup changes:

| File | Shows |
|---|---|
| `log-income.mp4` | Logging income and watching it split across Needs / Wants / Savings |
| `log-expense.mp4` | Logging an expense with category + subcategory |
| `create-goal.mp4` | Creating a savings goal (target amount + timeline) |
| `create-debt-goal.mp4` | Creating a debt payoff goal |
| `fund-goal.mp4` | Setting money aside for a goal ("Set aside" flow) |

## Target format

- **Aspect ratio:** 9:19.5 portrait (iPhone screen). The markup declares
  `width="720" height="1560"` — encode at 720×1560, or any same-ratio size
  (e.g. 886×1920 straight off an iPhone recording, re-encoded down).
- **Container/codec:** MP4, H.264, no audio track (videos play muted).
- **Max file size designed for:** **2.5 MB per video.** Keep clips to
  10–20 seconds and 24–30 fps; that fits comfortably at this size.
- `preload="none"` is set, so file size affects only playback start, not page
  load — but stay under the cap anyway for mobile viewers.

## Posters

Each `<video>` has a `poster` attribute:

- `log-income.mp4` → `/assets/images/screen-income.png` (real screenshot)
- `log-expense.mp4` → `/assets/images/screen-expense.png` (real screenshot)
- `create-goal.mp4` → `/assets/images/screen-savings.png` (real screenshot)
- `fund-goal.mp4` → `/assets/images/screen-savings.png` (real screenshot, reused)
- `create-debt-goal.mp4` → `/assets/video/create-debt-goal-poster.svg`
  (**placeholder** — no debt-goal screenshot exists yet)

When you capture the real videos, ideally export a first-frame JPG for each
(720×1560) and update the `poster` attributes to match, especially for the
debt-goal card and the reused savings screenshot.

## Also pending

`#features` uses `/assets/images/screen-lessons.png` for the Lessons card and
`/assets/images/screen-dashboard.png` for the Dashboard card. Replace those
PNGs in place whenever newer screens are available (739×1600).
