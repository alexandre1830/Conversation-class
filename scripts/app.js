const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const NOTES_KEY   = 'heyTeacher:notes';
const REVIEWS_KEY = 'heyTeacher:reviews';

/* ─── Notes storage (localStorage) ──────────────────────────── */

function loadAllNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}'); }
  catch { return {}; }
}

function saveAllNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function setNote(qId, text) {
  const all = loadAllNotes();
  if (text && text.trim()) all[qId] = text;
  else delete all[qId];
  saveAllNotes(all);
}

function getNote(qId) {
  return loadAllNotes()[qId] || '';
}

function clearLevelNotes(questions) {
  const all = loadAllNotes();
  questions.forEach(q => delete all[q.id]);
  saveAllNotes(all);
}

/* ─── Review-flag storage ───────────────────────────────────── */

function loadAllReviews() {
  try { return JSON.parse(localStorage.getItem(REVIEWS_KEY) || '{}'); }
  catch { return {}; }
}

function saveAllReviews(reviews) {
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
}

function setReview(qId, marked) {
  const all = loadAllReviews();
  if (marked) all[qId] = true;
  else delete all[qId];
  saveAllReviews(all);
}

function getReview(qId) {
  return !!loadAllReviews()[qId];
}

function clearLevelReviews(questions) {
  const all = loadAllReviews();
  questions.forEach(q => delete all[q.id]);
  saveAllReviews(all);
}

/* ─── Data Loading ──────────────────────────────────────────── */

async function loadData() {
  try {
    const res = await fetch('json/questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    document.body.innerHTML = `
      <div style="
        display:flex; flex-direction:column; align-items:center;
        justify-content:center; height:100vh; gap:16px;
        font-family:Outfit,system-ui,sans-serif; color:#8095b6;
        text-align:center; padding:28px;
      ">
        <div style="font-size:2.5rem">⚠️</div>
        <div style="font-size:1.15rem; font-weight:700; color:#fff;">
          Could not load questions.json
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

/* ══════════════════════════════════════════════════════════════
   LANDING PAGE
══════════════════════════════════════════════════════════════ */

function renderLanding(data) {
  const grid = document.getElementById('levels-grid');
  if (!grid) return;

  LEVEL_ORDER.forEach((level, i) => {
    const ld = data.levels[level];
    const firstSentence =
      ld.description.match(/^[^.!?]+[.!?]/)?.[0] ?? ld.description;

    const card = document.createElement('li');
    card.className = 'level-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Level ${level} – ${ld.name}`);

    card.innerHTML = `
      <div class="lc-code">${level}</div>
      <div class="lc-name">${ld.name}</div>
      <div class="lc-desc">${firstSentence}</div>
      <div class="lc-arrow" aria-hidden="true">
        Start
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </div>
    `;

    card.style.opacity = '0';
    card.style.transform = 'translateY(22px)';
    card.style.transition = `
      opacity   0.55s cubic-bezier(0.22,1,0.36,1) ${80 + i * 80}ms,
      transform 0.55s cubic-bezier(0.22,1,0.36,1) ${80 + i * 80}ms,
      background 0.25s ease,
      border-color 0.25s ease,
      box-shadow 0.30s ease
    `;

    function navigate() {
      card.classList.add('exiting');
      setTimeout(() => {
        window.location.href = `cards.html?level=${encodeURIComponent(level)}`;
      }, 260);
    }

    card.addEventListener('click', navigate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(); }
    });

    grid.appendChild(card);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }));
  });
}

/* ══════════════════════════════════════════════════════════════
   PDF EXPORT
══════════════════════════════════════════════════════════════ */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

async function exportPDF(level, levelName, questions) {
  const lib = window.jspdf;
  if (!lib || !lib.jsPDF) {
    alert('PDF library is still loading. Please try again in a moment.');
    return;
  }

  const all     = loadAllNotes();
  const reviews = loadAllReviews();
  const answered = questions
    .map((q, i) => ({ q, num: i + 1, note: all[q.id], review: !!reviews[q.id] }))
    .filter(x => (x.note && x.note.trim()) || x.review);

  if (answered.length === 0) {
    alert('Nothing to export yet.\nWrite a note or mark a question for review first.');
    return;
  }

  const reviewTotal = answered.filter(a => a.review).length;

  // Try to load the school logo (optional — silently skipped if missing)
  let logo = null;
  try { logo = await loadImage('images/logo2.png'); }
  catch { /* no logo, continue without */ }

  const { jsPDF } = lib;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 50;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;

  // ── Logo (top right) ──
  if (logo) {
    const logoH = 56;
    const logoW = logoH * (logo.width / logo.height);
    doc.addImage(logo, 'PNG', pageW - margin - logoW, margin - 6, logoW, logoH);
  }

  let y = margin + 10;

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(3, 45, 111);
  doc.text('Hey, Teacher!', margin, y);
  y += 22;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(70, 70, 70);
  doc.text(`${level} — ${levelName}`, margin, y);
  y += 16;

  doc.setFontSize(10);
  doc.setTextColor(140, 140, 140);
  const dateStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  let summary = `${dateStr} · ${answered.length} question${answered.length > 1 ? 's' : ''} answered`;
  if (reviewTotal > 0) {
    summary += ` · ${reviewTotal} flagged for review`;
  }
  doc.text(summary, margin, y);
  y += 22;

  // Divider
  doc.setDrawColor(166, 4, 4);
  doc.setLineWidth(1.6);
  doc.line(margin, y, pageW - margin, y);
  y += 26;

  // ── Questions + answers ──
  const badgeW       = 26;
  const badgeH       = 16;
  const reviewBadgeW = 70;

  answered.forEach(({ q, num, note, review }) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    // Reserve right-side space when a review badge will be drawn
    const qWrapW = contentW - 36 - (review ? reviewBadgeW + 10 : 0);
    const qLines = doc.splitTextToSize(q.question, qWrapW);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const noteText = (note && note.trim()) ? note : '— No answer recorded —';
    const noteLines = doc.splitTextToSize(noteText, contentW - 18);

    const blockH = qLines.length * 14 + 8 + noteLines.length * 13.5 + 22;

    if (y + blockH > pageH - margin - 20) {
      doc.addPage();
      y = margin + 10;
    }

    const badgeCenterY = y - 4;
    const badgeTop     = badgeCenterY - badgeH / 2;

    // Q number badge
    doc.setFillColor(166, 4, 4);
    doc.roundedRect(margin, badgeTop, badgeW, badgeH, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(`Q${num}`, margin + badgeW / 2, badgeCenterY, {
      align: 'center',
      baseline: 'middle'
    });

    // FOR REVIEW badge (right side, same line as Q badge)
    if (review) {
      const rX = pageW - margin - reviewBadgeW;
      doc.setFillColor(209, 129, 128);
      doc.roundedRect(rX, badgeTop, reviewBadgeW, badgeH, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('FOR REVIEW', rX + reviewBadgeW / 2, badgeCenterY, {
        align: 'center',
        baseline: 'middle'
      });
    }

    // Question text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(20, 20, 20);
    doc.text(qLines, margin + 36, y);
    y += qLines.length * 14 + 8;

    // Notes (or placeholder for review-only entries)
    doc.setFont('helvetica', review && !(note && note.trim()) ? 'italic' : 'normal');
    doc.setFontSize(11);
    doc.setTextColor(review && !(note && note.trim()) ? 140 : 55,
                     review && !(note && note.trim()) ? 140 : 55,
                     review && !(note && note.trim()) ? 140 : 55);
    doc.text(noteLines, margin + 18, y);
    y += noteLines.length * 13.5 + 22;

    // Subtle rose vertical accent on the left for review items
    if (review) {
      doc.setDrawColor(209, 129, 128);
      doc.setLineWidth(2);
      doc.line(margin - 10, badgeTop - 1, margin - 10, y - 18);
    }
  });

  // ── Page footer with numbers ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(160, 160, 160);
    doc.text('Hey, Teacher!', margin, pageH - 25);
    doc.text(`Page ${i} of ${pageCount}`, pageW - margin, pageH - 25, { align: 'right' });
  }

  const safeDate = new Date().toISOString().slice(0, 10);
  doc.save(`hey-teacher-${level}-${safeDate}.pdf`);
}

/* ══════════════════════════════════════════════════════════════
   CARDS PAGE
══════════════════════════════════════════════════════════════ */

function renderCards(data) {
  const params = new URLSearchParams(window.location.search);
  const rawLevel = params.get('level') ?? '';
  const level = LEVEL_ORDER.includes(rawLevel) ? rawLevel : 'A1';

  const ld = data.levels[level];
  const grid = document.getElementById('cards-grid');
  if (!grid) return;

  const badge = document.getElementById('level-badge');
  const name  = document.getElementById('level-name');
  if (badge) badge.textContent = level;
  if (name)  name.textContent  = ld.name;
  document.title = `Hey, Teacher! — ${level} · ${ld.name}`;

  const questions = ld.questions;
  const total = questions.length;
  const cardEls = [];

  /* ─── Spotlight elements ─────────────────────────────────── */
  const spotlight     = document.getElementById('spotlight');
  const spNum         = document.getElementById('spotlight-num');
  const spQ           = document.getElementById('spotlight-q');
  const spTag         = document.getElementById('spotlight-tag');
  const spClose       = document.getElementById('spotlight-close');
  const spPrev        = document.getElementById('spotlight-prev');
  const spNext        = document.getElementById('spotlight-next');
  const spTextarea    = document.getElementById('spotlight-textarea');
  const spSaved       = document.getElementById('spotlight-saved');
  const spReview      = document.getElementById('spotlight-review');
  const spReviewText  = spReview ? spReview.querySelector('.spotlight-review-text') : null;

  let currentIndex = -1;
  let saveTimer = null;
  let savedIndicatorTimer = null;

  function updateCounter() {
    const counter = document.getElementById('progress-counter');
    if (!counter) return;
    const flipped = document.querySelectorAll('.card.flipped').length;
    counter.textContent = `${flipped} / ${total}`;
    counter.classList.toggle('complete', flipped === total);
  }

  function markAsAsked(i) {
    const card = cardEls[i];
    if (!card.classList.contains('flipped')) {
      card.classList.add('flipped');
      card.setAttribute('aria-pressed', 'true');
      card.setAttribute('aria-label', `Card ${i + 1} (already asked): ${questions[i].question}`);
      updateCounter();
    }
  }

  function showSavedIndicator() {
    spSaved.classList.add('visible');
    clearTimeout(savedIndicatorTimer);
    savedIndicatorTimer = setTimeout(() => spSaved.classList.remove('visible'), 1400);
  }

  function commitCurrentNote() {
    if (currentIndex < 0) return;
    const qId = questions[currentIndex].id;
    setNote(qId, spTextarea.value);
  }

  function showQuestion(i, animate = true) {
    if (i < 0 || i >= total) return;

    // Save the previous question's note before switching
    commitCurrentNote();

    const q = questions[i];
    currentIndex = i;

    if (animate) {
      [spNum, spQ, spTag].forEach(el => {
        el.style.animation = 'none';
        void el.offsetWidth;
        el.style.animation = '';
      });
    }

    spNum.textContent = i + 1;
    spQ.textContent   = q.question;
    spTag.textContent = q.topic.replace(/_/g, ' ');

    // Load saved note
    spTextarea.value = getNote(q.id);
    spSaved.classList.remove('visible');

    // Reflect review state on toggle
    const isMarked = getReview(q.id);
    spReview.classList.toggle('active', isMarked);
    spReview.setAttribute('aria-pressed', String(isMarked));
    if (spReviewText) {
      spReviewText.textContent = isMarked ? 'Review' : 'Review';
    }

    spPrev.disabled = i === 0;
    spNext.disabled = i === total - 1;

    markAsAsked(i);
  }

  function openSpotlight(i) {
    showQuestion(i, false);
    spotlight.classList.add('active');
    spotlight.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeSpotlight() {
    commitCurrentNote();
    spotlight.classList.remove('active');
    spotlight.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentIndex = -1;
  }

  /* ─── Build cards ─────────────────────────────────────────── */
  questions.forEach((q, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Card ${i + 1} — click to reveal question`);
    card.setAttribute('aria-pressed', 'false');
    card.style.animationDelay = `${i * 32}ms`;

    const topicLabel = q.topic.replace(/_/g, ' ');

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-front" aria-hidden="true">
          <span class="card-num">${i + 1}</span>
          <span class="card-tap-hint">Tap to reveal</span>
        </div>
        <div class="card-back" aria-hidden="true">
          <span class="card-review-flag" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
              <path d="M5 21V4c0-.55.45-1 1-1h11l-2.5 4L17 11H6v10H5z"/>
            </svg>
          </span>
          <p class="card-q">${q.question}</p>
          <span class="card-tag">${topicLabel}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openSpotlight(i));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSpotlight(i); }
    });

    grid.appendChild(card);
    cardEls.push(card);
  });

  /* ─── Spotlight controls ─────────────────────────────────── */
  spClose.addEventListener('click', closeSpotlight);
  spPrev.addEventListener('click',  () => showQuestion(currentIndex - 1));
  spNext.addEventListener('click',  () => showQuestion(currentIndex + 1));

  /* ─── Review toggle ──────────────────────────────────────── */
  if (spReview) {
    spReview.addEventListener('click', () => {
      if (currentIndex < 0) return;
      const q = questions[currentIndex];
      const newState = !spReview.classList.contains('active');
      spReview.classList.toggle('active', newState);
      spReview.setAttribute('aria-pressed', String(newState));
      if (spReviewText) {
        spReviewText.textContent = newState ? 'Review' : 'Review';
      }
      setReview(q.id, newState);
      cardEls[currentIndex].classList.toggle('marked-review', newState);
    });
  }

  spotlight.addEventListener('click', (e) => {
    if (e.target === spotlight) closeSpotlight();
  });

  document.addEventListener('keydown', (e) => {
    if (!spotlight.classList.contains('active')) return;
    // Don't navigate on arrow keys while typing in textarea
    const typing = document.activeElement === spTextarea;
    if (e.key === 'Escape') {
      if (typing) spTextarea.blur();
      else closeSpotlight();
    } else if (!typing && e.key === 'ArrowRight' && currentIndex < total - 1) {
      showQuestion(currentIndex + 1);
    } else if (!typing && e.key === 'ArrowLeft' && currentIndex > 0) {
      showQuestion(currentIndex - 1);
    }
  });

  /* ─── Notes textarea: debounced auto-save ─────────────────── */
  spTextarea.addEventListener('input', () => {
    if (currentIndex < 0) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      commitCurrentNote();
      showSavedIndicator();
    }, 450);
  });

  spTextarea.addEventListener('blur', () => {
    clearTimeout(saveTimer);
    commitCurrentNote();
  });

  /* ─── Export PDF ──────────────────────────────────────────── */
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      // Make sure any pending note is saved before exporting
      commitCurrentNote();
      exportPDF(level, ld.name, questions);
    });
  }

  /* ─── Reset All — clears flips, notes AND reviews ────────── */
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const noteCount    = questions.filter(q => getNote(q.id)).length;
      const reviewCount  = questions.filter(q => getReview(q.id)).length;
      const flippedCount = document.querySelectorAll('.card.flipped').length;

      if (noteCount > 0 || flippedCount > 0 || reviewCount > 0) {
        const parts = [];
        if (flippedCount) parts.push(`${flippedCount} card${flippedCount > 1 ? 's' : ''}`);
        if (noteCount)    parts.push(`${noteCount} note${noteCount > 1 ? 's' : ''}`);
        if (reviewCount)  parts.push(`${reviewCount} review flag${reviewCount > 1 ? 's' : ''}`);
        const msg = `This will clear ${parts.join(', ')} for level ${level}.\n\nContinue?`;
        if (!confirm(msg)) return;
      }

      cardEls.forEach((c, i) => {
        c.classList.remove('flipped', 'marked-review');
        c.setAttribute('aria-pressed', 'false');
        c.setAttribute('aria-label', `Card ${i + 1} — click to reveal question`);
      });
      clearLevelNotes(questions);
      clearLevelReviews(questions);

      if (spotlight.classList.contains('active') && currentIndex >= 0) {
        spTextarea.value = '';
        spReview.classList.remove('active');
        spReview.setAttribute('aria-pressed', 'false');
        if (spReviewText) spReviewText.textContent = 'Mark for review';
      }
      updateCounter();
    });
  }

  /* ─── Restore flipped + review state from storage ────────── */
  questions.forEach((q, i) => {
    if (getNote(q.id)) {
      cardEls[i].classList.add('flipped');
      cardEls[i].setAttribute('aria-pressed', 'true');
    }
    if (getReview(q.id)) {
      cardEls[i].classList.add('marked-review');
    }
  });

  updateCounter();
}

/* ─── Init ──────────────────────────────────────────────────── */

(async () => {
  const data = await loadData();

  if (document.getElementById('levels-grid')) {
    renderLanding(data);
  } else if (document.getElementById('cards-grid')) {
    renderCards(data);
  }
})();
