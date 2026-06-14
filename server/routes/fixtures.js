const express = require('express');
const router  = express.Router();
const Team    = require('../models/Team');
const Match   = require('../models/Match');

const ROUND_NAMES = { 1: 'Round of 32', 2: 'Round of 16', 3: 'Quarter-Finals', 4: 'Semi-Finals', 5: 'Final' };

// Shuffle array (Fisher-Yates)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Generate round 1 fixtures from registered teams
async function generateRound1() {
  const existing = await Match.findOne({ round: 1 });
  if (existing) return; // Already generated

  const teams = await Team.find().sort({ registeredAt: 1 });
  if (teams.length < 32) return;

  const shuffled = shuffle(teams.map(t => t.teamName));
  const matches  = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    matches.push({
      round: 1,
      matchNumber: Math.floor(i / 2) + 1,
      teamA: shuffled[i],
      teamB: shuffled[i + 1]
    });
  }

  await Match.insertMany(matches);
}

// Generate next round from winners of completed round
async function generateNextRound(completedRound) {
  const nextRound = completedRound + 1;
  if (nextRound > 5) return; // Tournament over

  const existing = await Match.findOne({ round: nextRound });
  if (existing) return; // Already generated

  const winners = await Match.find({ round: completedRound, status: 'completed' })
    .sort({ matchNumber: 1 });

  const winnerNames = winners.map(m => m.winner);
  const matches = [];

  for (let i = 0; i < winnerNames.length; i += 2) {
    matches.push({
      round: nextRound,
      matchNumber: Math.floor(i / 2) + 1,
      teamA: winnerNames[i],
      teamB: winnerNames[i + 1]
    });
  }

  await Match.insertMany(matches);
}

// GET — all fixtures grouped by round
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find().sort({ round: 1, matchNumber: 1 });
    const grouped = {};

    matches.forEach(m => {
      const key = ROUND_NAMES[m.round] || `Round ${m.round}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    });

    const teamCount = await Team.countDocuments();
    res.json({ fixtures: grouped, teamCount, maxTeams: 32 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST — trigger fixture generation (called after 32 teams register)
router.post('/generate', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    if (count < 32) {
      return res.status(400).json({ error: `Only ${count}/32 teams registered.` });
    }
    await generateRound1();
    res.json({ success: true, message: 'Round of 32 fixtures generated!' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, generateNextRound };
