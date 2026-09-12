const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/* ─── Activity registry ─────────────────────────────────────────
   To add a new activity: register it here, create its page and
   its JSON file (with a "levels" object keyed by CEFR level, each
   level having "name" and "description").
──────────────────────────────────────────────────────────────── */

const ACTIVITIES = {
  conversation: {
    id: 'conversation',
    title: 'Conversation Cards',
    kicker: 'Speaking',
    description: 'Flip numbered cards to reveal discussion questions, take notes on answers and flag points to review.',
    dataUrl: 'json/questions.json',
    levelUrl: level => `cards.html?level=${encodeURIComponent(level)}`,
    levelMeta: ld => `${ld.questions.length} questions`,
    totalMeta: data => {
      const total = LEVEL_ORDER.reduce((sum, l) => sum + data.levels[l].questions.length, 0);
      return `${LEVEL_ORDER.length} levels · ${total} questions`;
    },
    visual: `
      <div class="ac-stack" aria-hidden="true">
        <span class="ac-stack-card back">12</span>
        <span class="ac-stack-card mid">7</span>
        <span class="ac-stack-card front">
          <span class="ac-stack-line"></span>
          <span class="ac-stack-line short"></span>
          <span class="ac-stack-tag"></span>
        </span>
      </div>`
  }
};

/* ─── Helpers ───────────────────────────────────────────────── */

// Deterministic hashing + PRNG, so generated puzzles look the same for everyone
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstSentence(text) {
  return text.match(/^[^.!?]+[.!?]/)?.[0] ?? text;
}

/* ─── Data Loading ──────────────────────────────────────────── */

async function loadJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    const fileName = url.split('/').pop();
    document.body.innerHTML = `
      <div style="
        display:flex; flex-direction:column; align-items:center;
        justify-content:center; height:100vh; gap:16px;
        font-family:Outfit,system-ui,sans-serif; color:#8095b6;
        text-align:center; padding:28px;
      ">
        <div style="font-size:2.5rem">⚠️</div>
        <div style="font-size:1.15rem; font-weight:700; color:#fff;">
          Could not load ${escapeHTML(fileName)}
        </div>
        <div style="font-size:0.88rem; max-width:420px; line-height:1.7; color:rgba(255,255,255,0.45);">
          This app requires an HTTP server. Open the folder in
          <strong style="color:#8095b6">VS Code</strong> and click
          <em>Go Live</em>, or run
          <code style="background:rgba(255,255,255,0.08);padding:2px 9px;border-radius:5px;font-size:0.85rem">
            npx serve .
          </code>
          in this directory.
        </div>
      </div>`;
    throw err;
  }
}

/* ─── Page transitions ──────────────────────────────────────── */

// Staggered entrance used by menu and level cards
function revealStaggered(el, i, baseDelay = 80) {
  const delay = baseDelay + i * 80;
  el.style.opacity = '0';
  el.style.transform = 'translateY(22px)';
  el.style.transition = `
    opacity   0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms,
    transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms,
    background 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.30s ease
  `;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    // Hand transform back to the stylesheet (hover effects) once revealed
    setTimeout(() => {
      el.style.transform = '';
      el.style.transition = '';
    }, delay + 600);
  }));
}

// Plays the exit animation on a link card before following it.
// Modified clicks (new tab, etc.) keep the browser default.
function attachExitNavigation(link) {
  link.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    link.classList.add('exiting');
    setTimeout(() => { window.location.href = link.href; }, 260);
  });
}

// Pages restored from the back/forward cache would keep the exit state
window.addEventListener('pageshow', (e) => {
  if (e.persisted) {
    document.querySelectorAll('.exiting').forEach(el => el.classList.remove('exiting'));
  }
});
