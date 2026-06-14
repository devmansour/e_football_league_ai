const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  round:      { type: Number, required: true },  // 1=R32, 2=R16, 3=QF, 4=SF, 5=Final
  matchNumber:{ type: Number, required: true },
  teamA:      { type: String, required: true },
  teamB:      { type: String, required: true },
  scoreA:     { type: Number, default: null },
  scoreB:     { type: Number, default: null },
  winner:     { type: String, default: null },
  status:     { type: String, enum: ['pending', 'completed'], default: 'pending' }
});

module.exports = mongoose.model('Match', matchSchema);

