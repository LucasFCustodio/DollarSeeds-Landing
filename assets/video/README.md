# Feature videos

All five homepage feature videos are transcoded and live. Sources were
re-encoded (H.264 MP4 + VP9 WebM, audio stripped, 30fps, faststart) and the
original recordings deleted.

| File | Dimensions | Shows |
|---|---|---|
| `log-income.mp4` / `.webm` | 720×1434 | Logging income and watching it split |
| `log-expense.mp4` / `.webm` | 720×1420 | Logging an expense with category + subcategory |
| `create-goal.mp4` / `.webm` | 720×1444 | Creating a savings goal with target and timeline |
| `fund-goal.mp4` / `.webm` | 720×1558 | Setting money aside toward a goal |
| `pay-debt.mp4` / `.webm` | 720×1558 | Paying off debt using general savings |

Poster frames (first frame, JPG) live in `assets/images/posters/<name>.jpg`.

## Replacing a video later

1. Re-encode to H.264 MP4, audio stripped, ≤2.5 MB:
   `ffmpeg -i SOURCE -vf "scale=720:-2,fps=30" -c:v libx264 -profile:v main -crf 28 -preset slow -movflags +faststart -an -y NEW.mp4`
2. WebM alternate: `ffmpeg -i NEW.mp4 -c:v libvpx-vp9 -crf 36 -b:v 0 -an -y NEW.webm`
3. Poster: `ffmpeg -i NEW.mp4 -frames:v 1 -q:v 3 -y ../images/posters/NEW.jpg`
4. `ffprobe` the output and update the matching `<video>` `width`/`height`
   attributes in `index.html` — heights vary per recording, do not assume.
