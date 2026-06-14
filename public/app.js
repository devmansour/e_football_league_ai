// ── STATE ──
let adminCredentials = null; // { username, password }
let fixtureInterval  = null;

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

    // Show/hide reg form
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
  const errEl      = document.getElementById('reg-error');
  const sucEl      = document.getElementById('reg-success');

  errEl.style.display = 'none';
  sucEl.style.display = 'none';

  if (!playerName || !teamName || !favPlayer) {
    errEl.textContent    = '⚠️ Please fill in all fields.';
    errEl.style.display  = 'block';
    return;
  }

  try {
    const res  = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerName, teamName, favPlayer })
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

    await updateStatus();

    // If 32 teams reached, auto-generate fixtures
    if (data.count >= data.max) {
      await triggerFixtureGeneration();
    }
  } catch {
    errEl.textContent   = '❌ Server error. Please try again.';
    errEl.style.display = 'block';
  }
}

// ── TRIGGER FIXTURE GENERATION ──
async function triggerFixtureGeneration() {
  try {
    await fetch('/api/fixtures/generate', { method: 'POST' });
  } catch {}
}

// ── FIXTURES ──
async function loadFixtures() {
  const container = document.getElementById('fixtures-container');
  const waiting   = document.getElementById('fixtures-waiting');
  const loading   = document.getElementById('fixtures-loading');

  container.innerHTML = '';
  waiting.style.display  = 'none';
  loading.style.display  = 'none';

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
      // Teams are 32 but fixtures not yet generated — show loading
      loading.style.display = 'flex';
      loading.style.flexDirection = 'column';
      loading.style.alignItems = 'center';
      // Try generating
      await triggerFixtureGeneration();
      setTimeout(loadFixtures, 2000);
      return;
    }

    rounds.forEach(roundName => {
      const title = document.createElement('div');
      title.className   = 'round-title';
      title.textContent = `🏆 ${roundName}`;
      container.appendChild(title);

      data.fixtures[roundName].forEach(match => {
        const card = document.createElement('div');
        card.className = 'match-card';

        const winnerA = match.winner === match.teamA;
        const winnerB = match.winner === match.teamB;
        const score   = match.status === 'completed'
          ? `${match.scoreA} – ${match.scoreB}`
          : 'vs';

        card.innerHTML = `
          <div class="match-team ${winnerA ? 'winner' : ''}">${match.teamA}</div>
          <div class="match-score">${score}</div>
          <div class="match-team right ${winnerB ? 'winner' : ''}">${match.teamB}</div>
        `;
        container.appendChild(card);
      });
    });

  } catch {
    container.innerHTML = '<p style="color:var(--danger)">❌ Failed to load fixtures.</p>';
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

    if (!res.ok) {
      errEl.style.display = 'block';
      return;
    }

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
      </div>
      ${!fixturesExist ? `<button class="btn-delete-team" onclick="deleteTeam('${t._id}', '${t.teamName}')">🗑️</button>` : ''}
    </div>
  `).join('');
}

function renderAdminMatches(matches) {
  const el = document.getElementById('admin-matches');
  const ROUND_NAMES = { 1: 'Round of 32', 2: 'Round of 16', 3: 'Quarter-Finals', 4: 'Semi-Finals', 5: 'Final' };

  const pending = matches.filter(m => m.status === 'pending');

  if (!matches.length) {
    el.innerHTML = '<p style="color:var(--sub)">No fixtures generated yet.</p>';
    return;
  }

  if (!pending.length && matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    if (lastMatch.round === 5 && lastMatch.status === 'completed') {
      el.innerHTML = `
        <div class="alert alert-success">
          🏆 Tournament complete! Winner: <strong>${lastMatch.winner}</strong>
        </div>
      `;
      return;
    }
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

async function submitResult(matchId, teamA, teamB) {
  const scoreA = parseInt(document.getElementById(`scoreA-${matchId}`).value);
  const scoreB = parseInt(document.getElementById(`scoreB-${matchId}`).value);

  if (isNaN(scoreA) || isNaN(scoreB)) {
    alert('Please enter both scores.');
    return;
  }
  if (scoreA === scoreB) {
    alert('No draws allowed! One team must have a higher score.');
    return;
  }

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

    // Replace card with completed badge
    const card = document.getElementById(`match-${matchId}`);
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>${teamA} ${scoreA} – ${scoreB} ${teamB}</span>
        <span class="completed-badge">✅ ${data.winner} wins</span>
      </div>
    `;

    if (data.nextRoundGenerated) {
      setTimeout(() => {
        loadAdminDashboard();
        loadFixtures();
      }, 800);
    }
  } catch {
    alert('Server error. Try again.');
  }
}

// ── INIT ──
document.addEventListener('DOMContentLoaded', () => {
  updateStatus();
  setInterval(updateStatus, 30000); // refresh every 30s
});

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

    if (!res.ok) {
      alert(data.error);
      return;
    }

    // Remove row from DOM instantly
    const row = document.getElementById(`team-row-${teamId}`);
    if (row) row.remove();

    // Update status bar
    updateStatus();
  } catch {
    alert('Server error. Try again.');
  }
}
