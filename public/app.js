// ── STATE ──
let adminCredentials = null;

// ── PANEL SWITCHING ──
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${name}`).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(name)) b.classList.add('active');
  });
  if (name === 'fixtures') loadFixtures();
  if (name === 'admin' && adminCredentials) loadAdminDashboard();
}

// ── STATUS BAR ──
async function updateStatus() {
  try {
    const res  = await fetch('/api/register/status');
    const data = await res.json();
    const bar  = document.getElementById('statusText');
    if (data.count >= data.max) {
      bar.textContent = `✅ All 32 teams registered — Tournament underway!`;
      bar.style.color = 'var(--green)';
    } else {
      bar.textContent = `👥 ${data.count} / ${data.max} teams registered`;
      bar.style.color = 'var(--gold)';
    }
    const closed = data.count >= data.max;
    document.getElementById('reg-form-wrap').style.display  = closed ? 'none' : 'block';
    document.getElementById('reg-closed-msg').style.display = closed ? 'block' : 'none';
  } catch {
    document.getElementById('statusText').textContent = 'Could not load status.';
  }
}

// ── REGISTER ──
async function registerTeam() {
  const playerName = document.getElementById('playerName').value.trim();
  const teamName   = document.getElementById('teamName').value.trim();
  const favPlayer  = document.getElementById('favPlayer').value.trim();
  const phone      = document.getElementById('phone').value.trim();
  const errEl      = document.getElementById('reg-error');
  const sucEl      = document.getElementById('reg-success');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!playerName || !teamName || !favPlayer || !phone) {
    errEl.textContent   = '⚠️ Please fill in all fields.';
    errEl.style.display = 'block';
    return;
  }

  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, teamName, favPlayer, phone })
    });
    const data = await res.json();

    if (!res.ok) {
      errEl.textContent   = `❌ ${data.error}`;
      errEl.style.display = 'block';
      return;
    }

    sucEl.textContent   = `✅ ${teamName} registered! (${data.count}/${data.max} teams)`;
    sucEl.style.display = 'block';
    document.getElementById('playerName').value = '';
    document.getElementById('teamName').value   = '';
    document.getElementById('favPlayer').value  = '';
    document.getElementById('phone').value       = '';

    await updateStatus();
    if (data.count >= data.max) await triggerFixtureGeneration();
  } catch {
    errEl.textContent   = '❌ Server error. Please try again.';
    errEl.style.display = 'block';
  }
}

// ── TRIGGER FIXTURE GENERATION ──
async function triggerFixtureGeneration() {
  try { await fetch('/api/fixtures/generate', { method: 'POST' }); } catch {}
}

// ── FIXTURES & BRACKET ──
const ROUND_NAMES = { 1: 'Round of 32', 2: 'Round of 16', 3: 'Quarter-Finals', 4: 'Semi-Finals', 5: 'Final' };

async function loadFixtures() {
  const bracket  = document.getElementById('bracket-container');
  const waiting  = document.getElementById('fixtures-waiting');
  const loading  = document.getElementById('fixtures-loading');
  const history  = document.getElementById('history-section');

  bracket.innerHTML   = '';
  waiting.style.display  = 'none';
  loading.style.display  = 'none';
  history.style.display  = 'none';

  try {
    const res  = await fetch('/api/fixtures');
    const data = await res.json();

    if (data.teamCount < 32) {
      waiting.style.display = 'block';
      waiting.textContent   = `⏳ ${data.teamCount}/32 teams registered. Fixtures generate automatically once full.`;
      return;
    }

    const rounds = Object.keys(data.fixtures);
    if (rounds.length === 0) {
      loading.style.display = 'block';
      await triggerFixtureGeneration();
      setTimeout(loadFixtures, 2000);
      return;
    }

    renderBracket(data.fixtures);
    renderHistory(data.fixtures);
  } catch {
    bracket.innerHTML = '<p style="color:var(--danger)">❌ Failed to load fixtures.</p>';
  }
}

function renderBracket(fixtures) {
  const container = document.getElementById('bracket-container');
  const tree      = document.createElement('div');
  tree.className  = 'bracket-tree';

  const roundKeys = Object.keys(fixtures);

  roundKeys.forEach((roundName, ri) => {
    const matches = fixtures[roundName];

    // Round column
    const col = document.createElement('div');
    col.className = 'bracket-round';

    const title = document.createElement('div');
    title.className   = 'bracket-round-title';
    title.textContent = roundName;
    col.appendChild(title);

    const matchesWrap = document.createElement('div');
    matchesWrap.className = 'bracket-matches';

    matches.forEach(match => {
      const card = document.createElement('div');
      card.className = 'bracket-match';

      const winnerA = match.winner === match.teamA;
      const winnerB = match.winner === match.teamB;

      card.innerHTML = `
        <div class="bracket-team ${winnerA ? 'winner' : ''}">
          <span>${match.teamA || '?'}</span>
          ${match.status === 'completed' ? `<span class="bracket-score">${match.scoreA}</span>` : ''}
        </div>
        <div class="bracket-team ${winnerB ? 'winner' : ''}">
          <span>${match.teamB || '?'}</span>
          ${match.status === 'completed' ? `<span class="bracket-score">${match.scoreB}</span>` : ''}
        </div>
      `;
      matchesWrap.appendChild(card);
    });

    col.appendChild(matchesWrap);
    tree.appendChild(col);

    // Add connector between rounds (not after last)
    if (ri < roundKeys.length - 1) {
      const conn = document.createElement('div');
      conn.className = 'bracket-connector';
      tree.appendChild(conn);
    }
  });

  container.appendChild(tree);
}

function renderHistory(fixtures) {
  const section   = document.getElementById('history-section');
  const container = document.getElementById('history-container');
  container.innerHTML = '';

  let hasCompleted = false;

  Object.entries(fixtures).forEach(([roundName, matches]) => {
    const completed = matches.filter(m => m.status === 'completed');
    if (!completed.length) return;

    hasCompleted = true;

    const label = document.createElement('div');
    label.className   = 'history-round-label';
    label.textContent = roundName;
    container.appendChild(label);

    completed.forEach(match => {
      const winnerA = match.winner === match.teamA;
      const winnerB = match.winner === match.teamB;
      const row = document.createElement('div');
      row.className = 'history-match';
      row.innerHTML = `
        <span class="history-team ${winnerA ? 'winner' : ''}">${match.teamA}</span>
        <span class="history-score">${match.scoreA} – ${match.scoreB}</span>
        <span class="history-team right ${winnerB ? 'winner' : ''}">${match.teamB}</span>
      `;
      container.appendChild(row);
    });
  });

  if (hasCompleted) section.style.display = 'block';
}

// ── CHAMPION REVEAL ──
function showChampion(name) {
  document.getElementById('champion-name').textContent = name;
  document.getElementById('champion-overlay').style.display = 'flex';
  launchConfetti();
}

function closeChampion() {
  document.getElementById('champion-overlay').style.display = 'none';
  document.getElementById('confetti-container').innerHTML = '';
}

function launchConfetti() {
  const container = document.getElementById('confetti-container');
  container.innerHTML = '';
  const colors = ['#f0c040', '#00e676', '#ff5252', '#40c4ff', '#fff', '#ff9800'];

  for (let i = 0; i < 120; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left             = `${Math.random() * 100}%`;
    piece.style.background       = colors[Math.floor(Math.random() * colors.length)];
    piece.style.width            = `${6 + Math.random() * 8}px`;
    piece.style.height           = `${6 + Math.random() * 8}px`;
    piece.style.borderRadius     = Math.random() > 0.5 ? '50%' : '2px';
    piece.style.animationDuration= `${2 + Math.random() * 3}s`;
    piece.style.animationDelay   = `${Math.random() * 2}s`;
    container.appendChild(piece);
  }
}

// ── ADMIN LOGIN ──
async function adminLogin() {
  const username = document.getElementById('adminUser').value.trim();
  const password = document.getElementById('adminPass').value;
  const errEl    = document.getElementById('login-error');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (!res.ok) { errEl.style.display = 'block'; return; }

    adminCredentials = { username, password };
    document.getElementById('admin-login').style.display     = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    loadAdminDashboard();
  } catch {
    errEl.textContent   = 'Server error.';
    errEl.style.display = 'block';
  }
}

function adminLogout() {
  adminCredentials = null;
  document.getElementById('admin-login').style.display     = 'block';
  document.getElementById('admin-dashboard').style.display = 'none';
  document.getElementById('adminUser').value = '';
  document.getElementById('adminPass').value = '';
}

// ── ADMIN DASHBOARD ──
async function loadAdminDashboard() {
  if (!adminCredentials) return;

  try {
    const res  = await fetch('/api/admin/matches', {
      headers: {
        'x-admin-user': adminCredentials.username,
        'x-admin-pass': adminCredentials.password
      }
    });
    const data = await res.json();

    renderTeamsList(data.teams, data.matches.length > 0);
    renderAdminMatches(data.matches);
  } catch {
    document.getElementById('teams-list').innerHTML    = '<p style="color:var(--danger)">Failed to load data.</p>';
    document.getElementById('admin-matches').innerHTML = '';
  }
}

function renderTeamsList(teams, fixturesExist) {
  const el = document.getElementById('teams-list');
  if (!teams.length) { el.innerHTML = '<p style="color:var(--sub)">No teams registered yet.</p>'; return; }

  el.innerHTML = teams.map((t, i) => `
    <div class="team-row" id="team-row-${t._id}">
      <span class="team-num">#${i + 1}</span>
      <div class="team-info">
        <strong>${t.teamName}</strong>
        <span>${t.playerName} · ⭐ ${t.favPlayer}</span>
        <span style="color:var(--green);font-size:0.75rem">📱 ${t.phone}</span>
      </div>
      ${!fixturesExist ? `<button class="btn-delete-team" onclick="deleteTeam('${t._id}', '${t.teamName}')">🗑️</button>` : ''}
    </div>
  `).join('');
}

function renderAdminMatches(matches) {
  const el          = document.getElementById('admin-matches');
  const resetSection= document.getElementById('reset-section');
  const pending     = matches.filter(m => m.status === 'pending');

  if (!matches.length) {
    el.innerHTML = '<p style="color:var(--sub)">No fixtures generated yet.</p>';
    resetSection.style.display = 'none';
    return;
  }

  // Check if tournament is complete (final match done)
  const finalMatch = matches.find(m => m.round === 5 && m.status === 'completed');
  if (finalMatch) {
    el.innerHTML = `
      <div class="alert alert-success">
        🏆 Tournament complete! Champion: <strong>${finalMatch.winner}</strong>
        <br><br>
        <button class="btn-submit-result" onclick="showChampion('${finalMatch.winner}')">🎉 Show Champion Reveal</button>
      </div>
    `;
    resetSection.style.display = 'block';
    return;
  }

  resetSection.style.display = 'none';

  if (!pending.length) {
    el.innerHTML = '<p style="color:var(--sub)">Generating next round...</p>';
    setTimeout(loadAdminDashboard, 1500);
    return;
  }

  el.innerHTML = pending.map(match => `
    <div class="admin-match-card" id="match-${match._id}">
      <div class="admin-match-header">
        <span>${ROUND_NAMES[match.round] || 'Round ' + match.round} · Match ${match.matchNumber}</span>
      </div>
      <div class="admin-match-teams">${match.teamA} <span style="color:var(--sub)">vs</span> ${match.teamB}</div>
      <div class="score-inputs">
        <input class="score-input" type="number" min="0" id="scoreA-${match._id}" placeholder="0" />
        <span style="color:var(--sub);font-weight:700">–</span>
        <input class="score-input" type="number" min="0" id="scoreB-${match._id}" placeholder="0" />
        <button class="btn-submit-result" onclick="submitResult('${match._id}', '${match.teamA}', '${match.teamB}')">
          ✓ Submit
        </button>
      </div>
    </div>
  `).join('');
}

// ── SUBMIT RESULT ──
async function submitResult(matchId, teamA, teamB) {
  const scoreA = parseInt(document.getElementById(`scoreA-${matchId}`).value);
  const scoreB = parseInt(document.getElementById(`scoreB-${matchId}`).value);

  if (isNaN(scoreA) || isNaN(scoreB)) { alert('Please enter both scores.'); return; }
  if (scoreA === scoreB) { alert('No draws allowed! One team must have a higher score.'); return; }

  try {
    const res  = await fetch('/api/admin/result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-user': adminCredentials.username,
        'x-admin-pass': adminCredentials.password
      },
      body: JSON.stringify({ matchId, scoreA, scoreB })
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    const card = document.getElementById(`match-${matchId}`);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>${teamA} ${scoreA} – ${scoreB} ${teamB}</span>
        <span class="completed-badge">✅ ${data.winner} wins</span>
      </div>
    `;

    // Check if this was the final
    if (data.isFinal) {
      setTimeout(() => {
        showChampion(data.winner);
        loadAdminDashboard();
      }, 800);
    } else if (data.nextRoundGenerated) {
      setTimeout(() => { loadAdminDashboard(); loadFixtures(); }, 800);
    }
  } catch {
    alert('Server error. Try again.');
  }
}

// ── DELETE TEAM ──
async function deleteTeam(teamId, teamName) {
  if (!confirm(`Remove "${teamName}" from the tournament?`)) return;

  try {
    const res  = await fetch(`/api/admin/team/${teamId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-user': adminCredentials.username,
        'x-admin-pass': adminCredentials.password
      }
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    const row = document.getElementById(`team-row-${teamId}`);
    if (row) row.remove();
    updateStatus();
  } catch {
    alert('Server error. Try again.');
  }
}

// ── RESET TOURNAMENT ──
async function resetTournament() {
  if (!confirm('⚠️ This will permanently delete ALL teams and matches. Are you sure?')) return;
  if (!confirm('Final confirmation — complete reset?')) return;

  try {
    const res  = await fetch('/api/admin/reset', {
      method: 'DELETE',
      headers: {
        'x-admin-user': adminCredentials.username,
        'x-admin-pass': adminCredentials.password
      }
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    alert('✅ Tournament reset successfully!');
    adminLogout();
    updateStatus();
  } catch {
    alert('Server error. Try again.');
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  setInterval(updateStatus, 30000);
});
