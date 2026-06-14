const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  playerName: { type: String, required: true, trim: true },
  teamName:   { type: String, required: true, trim: true },
  favPlayer:  { type: String, required: true, trim: true },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Team', teamSchema);

