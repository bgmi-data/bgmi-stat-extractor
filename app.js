/**
 * BGMI STAT EXTRACTOR — app.js v2
 * ─────────────────────────────────
 * • Single upload zone — drop ALL images together
 * • Ctrl+V paste from clipboard support
 * • Auto-detects lobby vs result via OCR text analysis
 * • Fuzzy player-name matching for cross-reference
 * • 6-row padded output (Blocks 4 & 5)
 * • Runs 100% in browser — zero cost, zero API
 */

'use strict';

// ═══════════════════════════════ STATE ════════════════════════════════
const state = {
  files: [],          // { file, url, id }
  ocrResults: [],     // { id, text, type: 'lobby'|'result'|'unknown' }
};

// ═══════════════════════════════ TIMESTAMP ════════════════════════════
function stamp() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-US', { month: 'short' });
  let h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${day}/${mon} · ${h}:${m} ${ap}`;
}
function refreshStamp() { $('#sessionStamp').textContent = stamp(); }
refreshStamp();
setInterval(refreshStamp, 30000);

// ═══════════════════════════════ $ HELPER ═════════════════════════════
function $(id) { return typeof id === 'string' ? document.getElementById(id) : id; }

// ═══════════════════════════════ FILE MANAGEMENT ══════════════════════
let uidCounter = 0;

function addFiles(fileList) {
  const imgs = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (!imgs.length) return;

  imgs.forEach(f => {
    // Deduplicate by name + size
    if (state.files.find(x => x.file.name === f.name && x.file.size === f.size)) return;
    const id = ++uidCounter;
    const url = URL.createObjectURL(f);
    state.files.push({ file: f, url, id });
    addThumb(id, url);
  });

  updateCounter();
  updateProcessBtn();
  $('dropZone').classList.add('has-files');
}

function addThumb(id, url) {
  const area = $('previewArea');
  const wrap = document.createElement('div');
  wrap.className = 'thumb-wrap';
  wrap.id = 'thumb-' + id;
  wrap.innerHTML = `
    <img src="${url}" alt="screenshot"/>
    <div class="thumb-badge pend" id="badge-${id}">⏳ Pending</div>
    <button class="thumb-del" title="Remove" onclick="removeFile(${id})">✕</button>
  `;
  area.appendChild(wrap);
}

function removeFile(id) {
  const idx = state.files.findIndex(x => x.id === id);
  if (idx !== -1) { URL.revokeObjectURL(state.files[idx].url); state.files.splice(idx, 1); }
  const el = $('thumb-' + id);
  if (el) el.remove();
  updateCounter();
  updateProcessBtn();
  if (state.files.length === 0) $('dropZone').classList.remove('has-files');
}

function updateCounter() {
  $('fileCounter').textContent = state.files.length
    ? `${state.files.length} image${state.files.length > 1 ? 's' : ''} loaded`
    : '';
}

function updateProcessBtn() {
  $('processBtn').disabled = state.files.length === 0;
}

// ═══════════════════════════════ DROP ZONE ════════════════════════════
const zone = $('dropZone');

zone.addEventListener('click', e => {
  if (!e.target.closest('.thumb-del') && !e.target.closest('.btn-secondary')) {
    $('fileInput').click();
  }
});
$('browseBtn').addEventListener('click', e => { e.stopPropagation(); $('fileInput').click(); });

$('fileInput').addEventListener('change', function () {
  addFiles(this.files);
  this.value = '';  // reset so same file can be re-added after removal
});

['dragenter', 'dragover'].forEach(ev =>
  zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('over'); })
);
['dragleave', 'drop'].forEach(ev =>
  zone.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('over'); })
);
zone.addEventListener('drop', e => {
  addFiles(e.dataTransfer.files);
});

// ═══════════════════════════════ PASTE FROM CLIPBOARD ═════════════════
document.addEventListener('paste', e => {
  const items = e.clipboardData?.items || [];
  const imageItems = Array.from(items).filter(it => it.type.startsWith('image/'));
  if (!imageItems.length) return;
  e.preventDefault();
  const files = imageItems.map(it => it.getAsFile()).filter(Boolean);
  // Name pasted files by timestamp
  const namedFiles = files.map((f, i) => {
    const ext = f.type.split('/')[1] || 'png';
    return new File([f], `paste_${Date.now()}_${i}.${ext}`, { type: f.type });
  });
  addFiles(namedFiles);
  toast('📋 Image pasted!', 'ok');
});

// ═══════════════════════════════ MAIN PROCESS ═════════════════════════
$('processBtn').addEventListener('click', runProcess);

async function runProcess() {
  if (state.files.length === 0) return;

  $('outputCard').style.display = 'none';
  $('rawCard').style.display = 'none';
  $('progressCard').style.display = 'block';
  $('classifyRow').style.display = 'none';
  $('processBtn').disabled = true;

  state.ocrResults = [];

  try {
    const total = state.files.length;

    for (let i = 0; i < total; i++) {
      const item = state.files[i];
      setProgress(
        Math.round((i / total) * 90),
        `OCR image ${i + 1} of ${total}: ${item.file.name}…`
      );

      const text = await ocrImage(item.file);
      const type = classifyImage(text);
      state.ocrResults.push({ id: item.id, text, type });

      // Update thumbnail badge
      const badge = $('badge-' + item.id);
      if (badge) {
        if (type === 'lobby') { badge.textContent = '🏟️ Lobby'; badge.className = 'thumb-badge lobby'; }
        if (type === 'result') { badge.textContent = '🏆 Result'; badge.className = 'thumb-badge result'; }
        if (type === 'unknown') { badge.textContent = '❓ Auto'; badge.className = 'thumb-badge pend'; }
      }
    }

    // Show classify summary
    const lobbyN = state.ocrResults.filter(x => x.type === 'lobby').length;
    const resultN = state.ocrResults.filter(x => x.type === 'result').length;
    $('lobbyCount').textContent = lobbyN;
    $('resultCount').textContent = resultN;
    $('classifyRow').style.display = 'flex';

    setProgress(95, 'Parsing & cross-referencing…');

    // Merge texts by type
    const lobbyText = state.ocrResults.filter(x => x.type !== 'result').map(x => x.text).join('\n\n');
    const resultText = state.ocrResults.filter(x => x.type !== 'lobby').map(x => x.text).join('\n\n');

    // Save to raw editor
    $('lobbyRaw').value = lobbyText;
    $('resultRaw').value = resultText;
    $('rawCard').style.display = 'block';

    buildOutput(lobbyText, resultText);

    setProgress(100, 'Done! ✅');
    setTimeout(() => {
      $('progressCard').style.display = 'none';
      $('processBtn').disabled = false;
    }, 1000);

  } catch (err) {
    $('progressCard').style.display = 'none';
    $('processBtn').disabled = false;
    toast('Error: ' + err.message);
    console.error(err);
  }
}

// ═══════════════════════════════ OCR ══════════════════════════════════
async function ocrImage(file) {
  const res = await Tesseract.recognize(file, 'eng', { logger: () => { } });
  return res.data.text || '';
}

// ═══════════════════════════════ IMAGE CLASSIFIER ══════════════════════
/**
 * Classifies OCR text as 'lobby', 'result', or 'unknown'
 * - Lobby: contains "Elimination" (pre-match marker)
 * - Result: contains "finish" (post-match marker)
 */
function classifyImage(text) {
  const t = text.toLowerCase();
  const hasElim = /eliminat/i.test(t);
  const hasFinish = /finish/i.test(t);
  const hasRemain = /remaining/i.test(t);

  if (hasElim && !hasFinish) return 'lobby';
  if (hasFinish && !hasElim) return 'result';
  if (hasRemain && !hasFinish) return 'lobby';

  if (hasElim && hasFinish) {
    // Both — pick by count
    const ec = (t.match(/eliminat/g) || []).length;
    const fc = (t.match(/finish/g) || []).length;
    return ec >= fc ? 'lobby' : 'result';
  }

  return 'unknown';
}

// ═══════════════════════════════ RE-PARSE BUTTON ═══════════════════════
$('reparseBtn').addEventListener('click', () => {
  buildOutput($('lobbyRaw').value, $('resultRaw').value);
});

// ═══════════════════════════════ LOBBY PARSER ═════════════════════════
/**
 * Returns { slotNum: [playerName, ...], ... }
 */
function parseLobby(text) {
  const slots = {};

  // Split on image boundaries and process each section
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let curSlot = null;

  for (const line of lines) {
    // Skip UI header lines
    if (/remaining|^team\s+\d|stage|match\s+start|image\s+break/i.test(line)) continue;

    // ── Pattern: "06 REharshOG /0 Eliminations" (slot + player on same line)
    const fullLine = line.match(/^(\d{1,2})\s+(.+?)(?:\s+\/[0oO]\s*Eliminat.*)?$/i);
    // ── Pattern: standalone slot number
    const soloNum = line.match(/^(\d{1,2})$/);
    // ── Pattern: player line with Eliminations
    const elimLine = line.match(/^(.+?)\s+\/[0oO]\s*Eliminat/i);
    // ── Pattern: "PlayerName /0 Eliminations" compact
    const elimLine2 = line.match(/^(.+?)\/[0oO]\s*Eliminat/i);

    if (soloNum) {
      const n = +soloNum[1];
      if (n >= 1 && n <= 60) { curSlot = n; slots[curSlot] = slots[curSlot] || []; }
      continue;
    }

    if (fullLine) {
      const n = +fullLine[1];
      if (n >= 1 && n <= 60) {
        curSlot = n;
        slots[curSlot] = slots[curSlot] || [];
        const rest = fullLine[2].replace(/\/[0oO]\s*Eliminat.*/i, '').trim();
        if (rest.length > 1) addPlayer(slots[curSlot], rest);
        continue;
      }
    }

    if (curSlot !== null) {
      if (elimLine) {
        const name = elimLine[1].trim();
        addPlayer(slots[curSlot], name);
        continue;
      }
      if (elimLine2) {
        const name = elimLine2[1].trim();
        addPlayer(slots[curSlot], name);
        continue;
      }
      // Plain text line that might be a player name
      if (line.length > 1 && line.length < 32 && !/^\d+$/.test(line) && !/eliminat/i.test(line)) {
        addPlayer(slots[curSlot], line);
      }
    }
  }

  return slots;
}

function addPlayer(arr, name) {
  const clean = name.replace(/\/[0oO]\s*Eliminat.*/i, '').trim();
  if (clean.length > 1 && arr.length < 6 && !arr.includes(clean)) {
    arr.push(clean);
  }
}

// ═══════════════════════════════ RESULT PARSER ════════════════════════
/**
 * Returns { rank: { players: [], kills: [] }, ... }
 */
function parseResult(text) {
  const ranks = {};
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let curRank = null;
  let foundRank1 = false;

  for (const line of lines) {
    if (/image\s+break|continue|^stage/i.test(line)) continue;

    // ── "PlayerName 5 finishes" or "PlayerName 1 finish"
    const killMatch = line.match(/^(.+?)\s+(\d+)\s+finish(?:es)?/i);
    // ── "5 finishes" alone (OCR split)
    // ── Standalone rank number
    const rankMatch = line.match(/^(\d{1,2})$/);

    if (rankMatch) {
      const n = +rankMatch[1];
      if (n >= 1 && n <= 60) {
        curRank = n;
        ranks[curRank] = ranks[curRank] || { players: [], kills: [] };
        if (n === 1) foundRank1 = true;
      }
      continue;
    }

    if (killMatch) {
      // If we haven't seen any rank yet, assume rank 1 (left panel, no explicit "1")
      if (curRank === null) {
        curRank = 1;
        foundRank1 = true;
        ranks[1] = { players: [], kills: [] };
      }
      if (!ranks[curRank]) ranks[curRank] = { players: [], kills: [] };

      const player = killMatch[1].trim();
      const kills = parseInt(killMatch[2], 10);
      if (player.length > 0) {
        ranks[curRank].players.push(player);
        ranks[curRank].kills.push(kills);
      }
    }
  }

  return ranks;
}

// ═══════════════════════════════ CROSS-REFERENCE ══════════════════════
function crossReference(slotMap, rankMap) {
  const slotNums = Object.keys(slotMap).map(Number).sort((a, b) => a - b);
  if (!slotNums.length) return {};

  const min = slotNums[0], max = slotNums[slotNums.length - 1];
  const usedRanks = new Set();
  const output = {};

  for (let s = min; s <= max; s++) {
    const players = slotMap[s];

    if (!players || players.length === 0) {
      output[s] = { rank: '""', teamKills: '""', players: [], playerKills: [] };
      continue;
    }

    // Find best matching rank group
    let bestRank = null, bestScore = 0;
    for (const [rk, rd] of Object.entries(rankMap)) {
      if (usedRanks.has(+rk)) continue;
      const sc = matchScore(players, rd.players);
      if (sc > bestScore) { bestScore = sc; bestRank = +rk; }
    }

    if (bestRank !== null && bestScore > 0) {
      usedRanks.add(bestRank);
      const rd = rankMap[bestRank];
      let total = 0;

      const playerKills = players.map(p => {
        const idx = bestMatchIdx(p, rd.players);
        if (idx !== -1) {
          const k = rd.kills[idx];
          total += k;
          return k === 0 ? '""' : k;
        }
        return '""';
      });

      output[s] = {
        rank: bestRank,
        teamKills: total === 0 ? '""' : total,
        players,
        playerKills
      };
    } else {
      output[s] = {
        rank: '""',
        teamKills: '""',
        players,
        playerKills: players.map(() => '""')
      };
    }
  }

  return output;
}

function matchScore(lobbyPs, resultPs) {
  let score = 0;
  const norm = resultPs.map(normStr);
  for (const lp of lobbyPs) {
    const nl = normStr(lp);
    if (norm.some(rp => diceSim(nl, rp) > 0.62)) score++;
  }
  return score;
}

function bestMatchIdx(lobbyP, resultPs) {
  const nl = normStr(lobbyP);
  let best = -1, bestS = 0.58;
  for (let i = 0; i < resultPs.length; i++) {
    const s = diceSim(nl, normStr(resultPs[i]));
    if (s > bestS) { bestS = s; best = i; }
  }
  return best;
}

function normStr(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ''); }

function diceSim(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  const ab = new Map();
  for (let i = 0; i < a.length - 1; i++) { const g = a.slice(i, i + 2); ab.set(g, (ab.get(g) || 0) + 1); }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    if (ab.has(g) && ab.get(g) > 0) { inter++; ab.set(g, ab.get(g) - 1); }
  }
  return (2 * inter) / (a.length + b.length - 2);
}

// ═══════════════════════════════ OUTPUT BUILDER ════════════════════════
function buildOutput(lobbyText, resultText) {
  let slotMap, rankMap;

  try { slotMap = parseLobby(lobbyText); }
  catch (e) { slotMap = {}; }

  try { rankMap = parseResult(resultText); }
  catch (e) { rankMap = {}; }

  if (Object.keys(slotMap).length === 0) {
    toast('⚠️ No slot numbers found in lobby text. Try editing the Raw OCR and Re-Parse.');
    return;
  }

  const data = crossReference(slotMap, rankMap);
  const allSlots = Object.keys(data).map(Number).sort((a, b) => a - b);
  const ROWS = 6;

  const b1 = [], b2 = [], b3 = [], b4 = [], b5 = [];
  let complete = 0, missing = 0;

  for (const s of allSlots) {
    const d = data[s];
    const ok = d.rank !== '""';
    if (ok) complete++; else missing++;

    b1.push(s);
    b2.push(d.rank);
    b3.push(d.teamKills);

    for (let r = 0; r < ROWS; r++) {
      b4.push(r < d.players.length ? d.players[r] : '""');
      b5.push(r < d.playerKills.length ? d.playerKills[r] : '""');
    }
  }

  $('b1').value = b1.join('\n');
  $('b2').value = b2.join('\n');
  $('b3').value = b3.join('\n');
  $('b4').value = b4.join('\n');
  $('b5').value = b5.join('\n');

  const s = stamp();
  $('outputStamp').textContent = `📅 ${s}`;
  $('summary').textContent = `📊 ${s}  |  ${allSlots.length} slots processed  ·  Blocks 1–3: ${allSlots.length} lines  ·  Blocks 4–5: ${allSlots.length * ROWS} lines  ·  ${complete} complete  ·  ${missing} missing`;

  $('outputCard').style.display = 'block';
  $('outputCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════ COPY BUTTONS ══════════════════════════
document.querySelectorAll('.btn-copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.target;
    const ta = $(id);
    const val = ta.value;
    navigator.clipboard.writeText(val).then(() => {
      btn.textContent = '✓ Copied!';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1800);
    }).catch(() => {
      ta.select(); document.execCommand('copy');
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
    });
  });
});

// ═══════════════════════════════ RESET ════════════════════════════════
$('resetBtn').addEventListener('click', () => {
  state.files.forEach(x => URL.revokeObjectURL(x.url));
  state.files.length = 0;
  state.ocrResults.length = 0;
  $('previewArea').innerHTML = '';
  $('fileCounter').textContent = '';
  $('dropZone').classList.remove('has-files', 'over');
  $('outputCard').style.display = 'none';
  $('rawCard').style.display = 'none';
  $('progressCard').style.display = 'none';
  updateProcessBtn();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ═══════════════════════════════ PROGRESS ═════════════════════════════
function setProgress(pct, label) {
  $('progressFill').style.width = pct + '%';
  $('progressSub').textContent = pct + '%';
  $('progressLabel').textContent = label;
}

// ═══════════════════════════════ TOAST ════════════════════════════════
function toast(msg, type = 'error') {
  const el = $('toast');
  el.textContent = (type === 'ok' ? '✅ ' : '⚠️ ') + msg;
  el.style.background = type === 'ok' ? 'rgba(0,229,200,0.12)' : 'rgba(255,70,70,0.12)';
  el.style.borderColor = type === 'ok' ? 'rgba(0,229,200,0.4)' : 'rgba(255,70,70,0.4)';
  el.style.color = type === 'ok' ? '#00e5c8' : '#ff9090';
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}
