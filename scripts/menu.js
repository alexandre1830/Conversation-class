/* ══════════════════════════════════════════════════════════════
   ACTIVITY MENU (index.html)
══════════════════════════════════════════════════════════════ */

function renderActivityMenu() {
  const grid = document.getElementById('activities-grid');
  if (!grid) return;

  Object.values(ACTIVITIES).forEach((activity, i) => {
    const card = document.createElement('a');
    card.className = 'activity-card';
    card.href = `levels.html?activity=${encodeURIComponent(activity.id)}`;
    card.setAttribute('aria-label', `${activity.title} – ${activity.kicker}`);

    card.innerHTML = `
      <div class="ac-visual">${activity.visual}</div>
      <div class="ac-body">
        <div class="ac-kicker">${activity.kicker}</div>
        <div class="ac-title">${activity.title}</div>
        <p class="ac-desc">${activity.description}</p>
      </div>
      <div class="ac-footer">
        <span class="ac-meta">${LEVEL_ORDER[0]}–${LEVEL_ORDER[LEVEL_ORDER.length - 1]}</span>
        <span class="ac-open" aria-hidden="true">
          Open
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </span>
      </div>
    `;

    attachExitNavigation(card);
    grid.appendChild(card);
    revealStaggered(card, i, 120);

    // Content counts are a nice-to-have: fill them in if the data loads
    fetch(activity.dataUrl)
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => { card.querySelector('.ac-meta').textContent = activity.totalMeta(data); })
      .catch(() => {});
  });
}

/* ══════════════════════════════════════════════════════════════
   LEVEL SELECTION (levels.html?activity=…)
══════════════════════════════════════════════════════════════ */

function renderLevelSelect(activity, data) {
  const grid = document.getElementById('levels-grid');
  if (!grid) return;

  document.title = `Hey, Teacher! — ${activity.title}`;
  document.getElementById('activity-kicker').textContent = activity.kicker;
  document.getElementById('activity-title').textContent  = activity.title;

  LEVEL_ORDER.forEach((level, i) => {
    const ld = data.levels[level];
    if (!ld) return;

    const card = document.createElement('a');
    card.className = 'level-card';
    card.href = activity.levelUrl(level);
    card.setAttribute('aria-label', `Level ${level} – ${ld.name}`);

    card.innerHTML = `
      <span class="lc-meta">${activity.levelMeta(ld)}</span>
      <div class="lc-code">${level}</div>
      <div class="lc-name">${ld.name}</div>
      <div class="lc-desc">${firstSentence(ld.description)}</div>
      <div class="lc-arrow" aria-hidden="true">
        Start
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    `;

    attachExitNavigation(card);
    grid.appendChild(card);
    revealStaggered(card, i);
  });
}

/* ─── Init ──────────────────────────────────────────────────── */

(async () => {
  if (document.getElementById('activities-grid')) {
    renderActivityMenu();
    return;
  }

  if (document.getElementById('levels-grid')) {
    const id = getParam('activity');
    const activity = Object.hasOwn(ACTIVITIES, id) ? ACTIVITIES[id] : null;
    if (!activity) {
      window.location.replace('index.html');
      return;
    }
    const data = await loadJSON(activity.dataUrl);
    renderLevelSelect(activity, data);
  }
})();
