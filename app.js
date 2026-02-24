/**
 * BGMI STAT EXTRACTOR — app.js
 * Browser-based OCR using Tesseract.js
 * No external AI. No API cost. Runs 100% locally.
 */

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let lobbyFiles = [];
let resultFiles = [];
let lastLobbyText = '';
let lastResultText = '';

// ═══════════════════════════════════════
// SESSION TIMESTAMP
// ═══════════════════════════════════════
function updateSessionTime() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const mon = now.toLocaleString('en-US', { month: 'short' });
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  document.getElementById('sessionTime').textContent = `${day}/${mon} · ${h}:${m} ${ampm}`;
}
updateSessionTime();
setInterval(updateSessionTime, 30000);

// ═══════════════════════════════════════
// FILE HANDLING — DRAG & DROP + INPUT
// ═══════════════════════════════════════
function setupZone(zoneId, dropId, inputId, previewId, countId, fileArray) {
  const zone = document.getElementById(zoneId);
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const count = document.getElementById(countId);

  drop.addEventListener('click', () => input.click());

  ['dragenter', 'dragover'].forEach(e => {
    zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(e => {
    zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', ev => {
    addFiles(Array.from(ev.dataTransfer.files), fileArray, preview, count, zone);
  });
  input.addEventListener('change', () => {
    addFiles(Array.from(input.files), fileArray, preview, count, zone);
    input.value = '';
  });
}

function addFiles(newFiles, fileArray, previewEl, countEl, zoneEl) {
  const imgFiles = newFiles.filter(f => f.type.startsWith('image/'));
  imgFiles.forEach(f => {
    if (!fileArray.find(x => x.name === f.name && x.size === f.size)) {
      fileArray.push(f);
      const img = document.createElement('img');
      img.className = 'preview-thumb';
      img.src = URL.createObjectURL(f);
      img.title = f.name;
      previewEl.appendChild(img);
    }
  });
  const n = fileArray.length;
  countEl.textContent = n > 0 ? `${n} file${n > 1 ? 's' : ''} selected` : '';
  if (n > 0) zoneEl.classList.add('has-files');
  checkReady();
}

function checkReady() {
  document.getElementById('processBtn').disabled = !(lobbyFiles.length > 0 && resultFiles.length > 0);
}

setupZone('lobbyZone',  'lobbyDrop',  'lobbyInput',  'lobbyPreview',  'lobbyCount',  lobbyFiles);
setupZone('resultZone', 'resultDrop', 'resultInput', 'resultPreview', 'resultCount', resultFiles);

// ═══════════════════════════════════════
// MAIN PROCESS BUTTON
// ═══════════════════════════════════════
document.getElementById('processBtn').addEventListener('click', async () => {
  document.getElementById('outputSection').style.display = 'none';
  document.getElementById('rawSection').style.display = 'none';
  document.getElementById('progressWrap').style.display = 'block';
  document.getElementById('processBtn').disabled = true;

  try {
    setProgress(0, 'Starting OCR on lobby images…');

    // OCR all lobby images
    const lobbyTexts = [];
    for (let i = 0; i < lobbyFiles.length; i++) {
      setProgress(
        Math.round((i / (lobbyFiles.length + resultFiles.length)) * 80),
        `Reading lobby image ${i + 1} of ${lobbyFiles.length}…`
      );
      const text = await ocrImage(lobbyFiles[i]);
      lobbyTexts.push(text);
    }

    // OCR all result images
    const resultTexts = [];
    for (let i = 0; i < resultFiles.length; i++) {
      setProgress(
        Math.round(((lobbyFiles.length + i) / (lobbyFiles.length + resultFiles.length)) * 80),
        `Reading result image ${i + 1} of ${resultFiles.length}…`
      );
      const text = await ocrImage(resultFiles[i]);
      resultTexts.push(text);
    }

    const lobbyRaw = lobbyTexts.join('\n\n---IMAGE BREAK---\n\n');
    const resultRaw = resultTexts.join('\n\n---IMAGE BREAK---\n\n');

    // Store raw text for manual editing
    lastLobbyText = lobbyRaw;
    lastResultText = resultRaw;
    document.getElementById('lobbyRaw').value = lobbyRaw;
    document.getElementById('resultRaw').value = resultRaw;
    document.getElementById('rawSection').style.display = 'block';

    setProgress(85, 'Parsing lobby data…');
    setProgress(90, 'Parsing result data…');
    setProgress(95, 'Cross-referencing & building output…');

    buildOutput(lobbyRaw, resultRaw);

    setProgress(100, 'Done!');
    setTimeout(() => {
      document.getElementById('progressWrap').style.display = 'none';
      document.getElementById('processBtn').disabled = false;
      checkReady();
    }, 800);

  } catch (err) {
    showError('OCR failed: ' + err.message);
    document.getElementById('progressWrap').style.display = 'none';
    document.getElementById('processBtn').disabled = false;
    checkReady();
  }
});

// ═══════════════════════════════════════
// RE-PARSE BUTTON (after manual edit)
// ═══════════════════════════════════════
document.getElementById('reparseBtn').addEventListener('click', () => {
  const lobbyText = document.getElementById('lobbyRaw').value;
  const resultText = document.getElementById('resultRaw').value;
  buildOutput(lobbyText, resultText);
});

// ═══════════════════════════════════════
// OCR ENGINE (Tesseract.js)
// ═══════════════════════════════════════
async function ocrImage(file) {
  const result = await Tesseract.recognize(file, 'eng', {
    logger: () => {},
  });
  return result.data.text;
}

// ═══════════════════════════════════════
// PROGRESS HELPERS
// ═══════════════════════════════════════
function setProgress(pct, label) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPercent').textContent = pct + '%';
  document.getElementById('progressLabel').textContent = label;
}

// ═══════════════════════════════════════
// LOBBY PARSER
// Extracts: { slotNumber: [playerName, ...] }
// ═══════════════════════════════════════
function parseLobby(text) {
  const slots = {};
  // Normalize text
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentSlot = null;

  for (const line of lines) {
    // Skip image break markers
    if (line.includes('---IMAGE BREAK---')) { continue; }

    // Detect slot number: a line starting with 1-2 digits (slot 1–50)
    // Slot number may appear alone OR with the first player on same line
    // E.g.: "06 REharshOG /0 Eliminations" OR just "06"
    const slotLineMatch = line.match(/^(\d{1,2})\s+(.*)/);
    const soloNumber = line.match(/^(\d{1,2})$/);

    if (soloNumber) {
      const n = parseInt(soloNumber[1]);
      if (n >= 1 && n <= 50) {
        currentSlot = n;
        if (!slots[currentSlot]) slots[currentSlot] = [];
        continue;
      }
    }

    if (slotLineMatch) {
      const n = parseInt(slotLineMatch[1]);
      if (n >= 1 && n <= 50) {
        currentSlot = n;
        if (!slots[currentSlot]) slots[currentSlot] = [];
        // Rest of line may be a player name
        const rest = slotLineMatch[2].replace(/\/[0oO]\s*Eliminations?/gi, '').trim();
        if (rest.length > 1 && !rest.match(/^elimination/i)) {
          slots[currentSlot].push(cleanPlayerName(rest));
        }
        continue;
      }
    }

    // Player line: contains "/0 Eliminations" or just a name
    if (currentSlot !== null) {
      const isElimLine = line.match(/\/[0oO]\s*Elim/i);
      if (isElimLine) {
        const playerName = line.replace(/\/[0oO]\s*Eliminations?/gi, '').trim();
        const cleaned = cleanPlayerName(playerName);
        if (cleaned.length > 1 && !slots[currentSlot].includes(cleaned)) {
          slots[currentSlot].push(cleaned);
        }
      } else if (line.match(/Remaining|Team\s+\d|Stage|Match\s+start/i)) {
        // Skip UI text
      } else {
        // Might be a player name without "Eliminations" (OCR missed it)
        const cleaned = cleanPlayerName(line);
        if (cleaned.length > 1 && cleaned.length < 30 && !cleaned.match(/^\d+$/) && !cleaned.match(/elimination/i)) {
          if (slots[currentSlot] && slots[currentSlot].length < 6) {
            if (!slots[currentSlot].includes(cleaned)) {
              slots[currentSlot].push(cleaned);
            }
          }
        }
      }
    }
  }

  return slots;
}

// ═══════════════════════════════════════
// RESULT PARSER
// Extracts: { rank: { players: [], kills: [] } }
// ═══════════════════════════════════════
function parseResult(text) {
  const ranks = {};
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let currentRank = null;
  let rank1Assigned = false;

  for (const line of lines) {
    if (line.includes('---IMAGE BREAK---')) { currentRank = null; continue; }

    // Detect "X finishes" or "X finish" — this is the key result pattern
    // Formats: "PlayerName 5 finishes" or "5 finishes PlayerName" (OCR may vary)
    const killAfter  = line.match(/^(.+?)\s+(\d+)\s+finish(?:es)?/i);
    const killBefore = line.match(/^(\d+)\s+finish(?:es)?\s+(.+)/i);
    const killOnly   = line.match(/^(\d+)\s+finish(?:es)?$/i);

    // Detect standalone rank number (1-30) on its own line
    const rankLine = line.match(/^(\d{1,2})$/);

    if (rankLine) {
      const n = parseInt(rankLine[1]);
      if (n >= 1 && n <= 50) {
        currentRank = n;
        if (!ranks[currentRank]) ranks[currentRank] = { players: [], kills: [] };
        if (n === 1) rank1Assigned = true;
        continue;
      }
    }

    if (killAfter) {
      // Assign to rank 1 if no rank seen yet (rank 1 LEFT panel doesn't show "1")
      if (currentRank === null && !rank1Assigned) {
        currentRank = 1;
        ranks[1] = { players: [], kills: [] };
        rank1Assigned = true;
      }
      if (currentRank === null) continue;
      if (!ranks[currentRank]) ranks[currentRank] = { players: [], kills: [] };

      const player = cleanPlayerName(killAfter[1]);
      const kills  = parseInt(killAfter[2]);
      if (player.length > 0) {
        ranks[currentRank].players.push(player);
        ranks[currentRank].kills.push(kills);
      }
      continue;
    }

    if (killBefore) {
      if (currentRank === null && !rank1Assigned) {
        currentRank = 1;
        ranks[1] = { players: [], kills: [] };
        rank1Assigned = true;
      }
      if (currentRank === null) continue;
      if (!ranks[currentRank]) ranks[currentRank] = { players: [], kills: [] };
      const player = cleanPlayerName(killBefore[2]);
      const kills  = parseInt(killBefore[1]);
      if (player.length > 0) {
        ranks[currentRank].players.push(player);
        ranks[currentRank].kills.push(kills);
      }
      continue;
    }

    if (killOnly) {
      // "0 finishes" alone on a line — OCR split player name from kills
      // Can't reliably assign without name, skip
      continue;
    }
  }

  return ranks;
}

// ═══════════════════════════════════════
// CROSS-REFERENCE ENGINE
// Links lobby slots → result ranks via player name matching
// ═══════════════════════════════════════
function crossReference(slotMap, rankMap) {
  const slotNums = Object.keys(slotMap).map(Number).sort((a, b) => a - b);
  if (slotNums.length === 0) return {};

  const minSlot = slotNums[0];
  const maxSlot = slotNums[slotNums.length - 1];

  const output = {};
  const usedRanks = new Set();

  for (let slot = minSlot; slot <= maxSlot; slot++) {
    const players = slotMap[slot] || null;

    if (!players || players.length === 0) {
      // Missing slot
      output[slot] = {
        rank: '""',
        teamKills: '""',
        players: [],
        playerKills: []
      };
      continue;
    }

    // Find best matching rank for this slot's players
    let bestRank = null;
    let bestScore = -1;

    for (const [rankStr, rankData] of Object.entries(rankMap)) {
      const rank = parseInt(rankStr);
      if (usedRanks.has(rank)) continue;
      const score = fuzzyMatchScore(players, rankData.players);
      if (score > bestScore) {
        bestScore = score;
        bestRank = rank;
      }
    }

    if (bestRank !== null && bestScore > 0) {
      usedRanks.add(bestRank);
      const rankData = rankMap[bestRank];

      // Build player-kills mapping
      const playerKills = players.map(lobbyPlayer => {
        const idx = findBestMatchIndex(lobbyPlayer, rankData.players);
        if (idx !== -1) {
          const k = rankData.kills[idx];
          return k === 0 ? '""' : k;
        }
        return '""';
      });

      const totalKills = players.reduce((sum, lobbyPlayer) => {
        const idx = findBestMatchIndex(lobbyPlayer, rankData.players);
        return idx !== -1 ? sum + rankData.kills[idx] : sum;
      }, 0);

      output[slot] = {
        rank: bestRank,
        teamKills: totalKills === 0 ? '""' : totalKills,
        players,
        playerKills
      };
    } else {
      output[slot] = {
        rank: '""',
        teamKills: '""',
        players,
        playerKills: players.map(() => '""')
      };
    }
  }

  return output;
}

// Score how many players match between two lists (normalized)
function fuzzyMatchScore(lobbyPlayers, resultPlayers) {
  let score = 0;
  const normResult = resultPlayers.map(normName);
  for (const lp of lobbyPlayers) {
    const nLp = normName(lp);
    for (const rp of normResult) {
      const s = similarity(nLp, rp);
      if (s > 0.65) { score++; break; }
    }
  }
  return score;
}

function findBestMatchIndex(lobbyPlayer, resultPlayers) {
  const nLp = normName(lobbyPlayer);
  let bestIdx = -1;
  let bestSim = 0.6; // threshold
  for (let i = 0; i < resultPlayers.length; i++) {
    const s = similarity(nLp, normName(resultPlayers[i]));
    if (s > bestSim) { bestSim = s; bestIdx = i; }
  }
  return bestIdx;
}

// Normalize name for comparison
function normName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Simple character-level similarity (Dice coefficient)
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const aBigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    aBigrams.set(bg, (aBigrams.get(bg) || 0) + 1);
  }
  let intersect = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    if (aBigrams.has(bg) && aBigrams.get(bg) > 0) {
      intersect++;
      aBigrams.set(bg, aBigrams.get(bg) - 1);
    }
  }
  return (2 * intersect) / (a.length + b.length - 2);
}

// Clean noisy OCR player name
function cleanPlayerName(name) {
  return name
    .replace(/\/[0oO]\s*Eliminations?/gi, '')
    .replace(/^\s*[\d]{1,2}\s+/, '') // Remove leading slot number
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ═══════════════════════════════════════
// OUTPUT BUILDER
// Pads each slot to 6 rows for Blocks 4 & 5
// ═══════════════════════════════════════
function buildOutput(lobbyRaw, resultRaw) {
  const slotMap = parseLobby(lobbyRaw);
  const rankMap = parseResult(resultRaw);
  const data    = crossReference(slotMap, rankMap);

  const allSlots = Object.keys(data).map(Number).sort((a, b) => a - b);

  if (allSlots.length === 0) {
    showError('Could not detect any slot numbers. Check raw OCR text and re-parse manually.');
    return;
  }

  const ROWS_PER_SLOT = 6;

  const b1 = [], b2 = [], b3 = [], b4 = [], b5 = [];

  let totalComplete = 0;
  let totalMissing  = 0;

  for (const slot of allSlots) {
    const d = data[slot];
    const isComplete = d.rank !== '""';
    if (isComplete) totalComplete++; else totalMissing++;

    // Blocks 1, 2, 3 — one line per slot
    b1.push(slot);
    b2.push(d.rank);
    b3.push(d.teamKills);

    // Blocks 4, 5 — 6 lines per slot
    const players = d.players.slice(0, ROWS_PER_SLOT);
    const kills   = d.playerKills.slice(0, ROWS_PER_SLOT);

    for (let r = 0; r < ROWS_PER_SLOT; r++) {
      b4.push(r < players.length ? players[r] : '""');
      b5.push(r < kills.length   ? kills[r]   : '""');
    }
  }

  // Write to textareas
  document.getElementById('block1').value = b1.join('\n');
  document.getElementById('block2').value = b2.join('\n');
  document.getElementById('block3').value = b3.join('\n');
  document.getElementById('block4').value = b4.join('\n');
  document.getElementById('block5').value = b5.join('\n');

  // Summary
  const now = new Date();
  const day = String(now.getDate()).padStart(2,'0');
  const mon = now.toLocaleString('en-US', { month: 'short' });
  let h = now.getHours(); const m = String(now.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  const stamp = `📅 ${day}/${mon} · ${h}:${m} ${ampm}`;

  document.getElementById('outputMeta').textContent = stamp;
  document.getElementById('summaryBar').textContent =
    `📊 ${stamp}  |  Processed ${allSlots.length} slots  ·  Blocks 1–3: ${allSlots.length} lines  ·  Blocks 4–5: ${allSlots.length * ROWS_PER_SLOT} lines  ·  ${totalComplete} complete  ·  ${totalMissing} missing`;

  document.getElementById('outputSection').style.display = 'block';
  document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════
// COPY BUTTONS
// ═══════════════════════════════════════
function copyBlock(blockId) {
  const el = document.getElementById(blockId);
  navigator.clipboard.writeText(el.value).then(() => {
    const btn = el.closest('.output-block').querySelector('.copy-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  }).catch(() => {
    el.select();
    document.execCommand('copy');
  });
}

// ═══════════════════════════════════════
// RESET
// ═══════════════════════════════════════
function resetAll() {
  lobbyFiles.length = 0;
  resultFiles.length = 0;
  document.getElementById('lobbyPreview').innerHTML  = '';
  document.getElementById('resultPreview').innerHTML = '';
  document.getElementById('lobbyCount').textContent  = '';
  document.getElementById('resultCount').textContent = '';
  document.getElementById('lobbyZone').classList.remove('has-files');
  document.getElementById('resultZone').classList.remove('has-files');
  document.getElementById('outputSection').style.display = 'none';
  document.getElementById('rawSection').style.display    = 'none';
  document.getElementById('progressWrap').style.display  = 'none';
  checkReady();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ═══════════════════════════════════════
// ERROR TOAST
// ═══════════════════════════════════════
function showError(msg) {
  const el = document.getElementById('errorToast');
  el.textContent = '⚠️ ' + msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 6000);
}
