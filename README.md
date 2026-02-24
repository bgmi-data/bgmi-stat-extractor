# BGMI Stat Extractor

Free, browser-based BGMI tournament data extractor. Upload lobby + result screenshots to auto-extract Slot Numbers, Ranks, Team Kills, Player Names, and Individual Kills.

**🌐 Live Site:** `https://YOUR-USERNAME.github.io/bgmi-stat-extractor`

## Features
- ✅ 100% free — no API keys, no backend, no cost ever
- ✅ Runs entirely in your browser (Tesseract.js OCR)
- ✅ Drag & drop multiple images
- ✅ 5 output columns with one-click Copy buttons
- ✅ Manual edit mode if OCR needs corrections
- ✅ Session timestamp: DD/Mon · H:MM AM/PM

## Deploy to GitHub Pages (3 steps)

1. **Create a new GitHub repository** (e.g. `bgmi-stat-extractor`)
2. **Upload these 3 files:** `index.html`, `style.css`, `app.js`
3. **Enable GitHub Pages:**
   - Go to repo → Settings → Pages
   - Source: `Deploy from branch` → `main` → `/ (root)`
   - Click Save → your site is live in ~1 minute!

## How to Use
1. Open the site
2. Drag lobby screenshots into the **Lobby** zone
3. Drag result screenshots into the **Result** zone
4. Click **Extract Data**
5. Copy each of the 5 columns into your spreadsheet

## Tech Stack
- **OCR:** [Tesseract.js v4](https://github.com/naptha/tesseract.js) (MIT License)
- **Frontend:** Vanilla HTML + CSS + JavaScript
- **Hosting:** GitHub Pages (free)

## Output Format
| Column | Content | Rows |
|--------|---------|------|
| 1 | Slot Numbers | 1 per slot |
| 2 | Ranks | 1 per slot |
| 3 | Team Total Kills | 1 per slot |
| 4 | Player Names | 6 per slot (padded) |
| 5 | Individual Kills | 6 per slot (padded) |
