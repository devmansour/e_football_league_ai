const express = require('express');
const router  = express.Router();
const Match   = require('../models/Match');
const Team    = require('../models/Team');
const auth    = require('../middleware/auth');
const { generateNextRound } = require('./fixtures');

// POST — admin login verify
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USER &&
    password === process.env.ADMIN_PASS
  ) {
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// POST — submit match result
router.post('/result', auth, async (req, res) => {
  try {
    const { matchId, scoreA, scoreB } = req.body;

    if (scoreA === undefined || scoreB === undefined) {
      return res.status(400).json({ error: 'Scores required.' });
    }
    if (scoreA === scoreB) {
      return res.status(400).json({ error: 'No draws allowed in knockout. One team must win.' });
    }

    const match = await Match.findById(matchId);
    if (!match) return res.status(404).json({ error: 'Match not found.' });
    if (match.status === 'completed') {
      return res.status(400).json({ error: 'Result already submitted.' });
    }

    match.scoreA  = scoreA;
    match.scoreB  = scoreB;
    match.winner  = scoreA > scoreB ? match.teamA : match.teamB;
    match.status  = 'completed';
    await match.save();

    // Check if all matches in this round are done
    const roundMatches    = await Match.find({ round: match.round });
    const allDone         = roundMatches.every(m => m.status === 'completed');

    if (allDone) {
      await generateNextRound(match.round);
    }

    res.json({ success: true, winner: match.winner, nextRoundGenerated: allDone });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET — all matches with results (admin view)
router.get('/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find().sort({ round: 1, matchNumber: 1 });
    const teams   = await Team.find().sort({ registeredAt: 1 });
    res.json({ matches, teams });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

