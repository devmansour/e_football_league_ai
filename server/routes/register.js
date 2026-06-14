const express = require('express');
const router  = express.Router();
const Team    = require('../models/Team');

const MAX_TEAMS = 32;

// GET — check registration status
router.get('/status', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    res.json({ count, max: MAX_TEAMS, open: count < MAX_TEAMS });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST — register a team
router.post('/', async (req, res) => {
  try {
    const count = await Team.countDocuments();
    if (count >= MAX_TEAMS) {
      return res.status(400).json({ error: 'Registration is closed. 32 teams reached.' });
    }

    const { playerName, teamName, favPlayer, phone } = req.body;
    if (!playerName || !teamName || !favPlayer || !phone) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    // Check duplicate team name
    const exists = await Team.findOne({ teamName: new RegExp(`^${teamName}$`, 'i') });
    if (exists) {
      return res.status(400).json({ error: 'Team name already registered.' });
    }

    const team = new Team({ playerName, teamName, favPlayer, phone });
    await team.save();

    const newCount = await Team.countDocuments();
    res.json({ success: true, count: newCount, max: MAX_TEAMS });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET — all teams (for admin)
router.get('/all', async (req, res) => {
  try {
    const teams = await Team.find().sort({ registeredAt: 1 });
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
