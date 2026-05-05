require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(helmet());
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60*1000, max: 100 });
app.use('/api/', limiter);

// Serve static frontend files
let frontendPath = path.join(__dirname, '../frontend');
if (!fs.existsSync(frontendPath)) frontendPath = path.join(__dirname, 'frontend');
if (!fs.existsSync(frontendPath)) frontendPath = path.join(__dirname, '../public');
console.log(`📁 Serving frontend from: ${frontendPath}`);
app.use(express.static(frontendPath));

// Data paths
const dataPath = path.join(__dirname, '../data');
let matches = [];
try { matches = JSON.parse(fs.readFileSync(path.join(dataPath, 'matches.json'), 'utf8')); } catch(e) { matches = []; }
let premiums = {};
try { premiums = JSON.parse(fs.readFileSync(path.join(dataPath, 'premiums.json'), 'utf8')); } catch(e) { premiums = {}; }
let standings = [];
try { standings = JSON.parse(fs.readFileSync(path.join(dataPath, 'standings.json'), 'utf8')); } catch(e) { standings = []; }
let pendingPayments = [];

// API routes
app.get('/api/matches', (req, res) => res.json(matches));
app.get('/api/standings/:leagueId', (req, res) => {
  const league = standings.find(s => s.leagueId === req.params.leagueId);
  res.json(league || {});
});
app.post('/api/submit-payment', (req, res) => {
  const { email, txnId } = req.body;
  if (!email || !txnId) return res.status(400).json({ error: 'Missing fields' });
  pendingPayments.push({ email, txnId, date: new Date() });
  res.json({ ok: true });
});
app.get('/api/check-premium/:email', (req, res) => {
  res.json({ premium: premiums[req.params.email] === true });
});
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) res.json({ token: 'dummy-token' });
  else res.status(401).json({ error: 'Unauthorized' });
});
app.get('/api/admin/pending', (req, res) => {
  if (req.headers.authorization !== 'Bearer dummy-token') return res.status(401).json({ error: 'Unauthorized' });
  res.json(pendingPayments);
});
app.post('/api/admin/approve', (req, res) => {
  if (req.headers.authorization !== 'Bearer dummy-token') return res.status(401).json({ error: 'Unauthorized' });
  const { email } = req.body;
  premiums[email] = true;
  fs.writeFileSync(path.join(dataPath, 'premiums.json'), JSON.stringify(premiums, null, 2));
  pendingPayments = pendingPayments.filter(p => p.email !== email);
  res.json({ ok: true });
});

// Live simulation
setInterval(() => {
  let changed = false;
  matches = matches.map(m => {
    if (m.status === 'LIVE' || m.status === '1ST_HALF' || m.status === '2ND_HALF') {
      if (Math.random() > 0.7) {
        m.homeScore += Math.random() > 0.8 ? 1 : 0;
        m.awayScore += Math.random() > 0.8 ? 1 : 0;
        changed = true;
        io.emit('goalAlert', { match: m });
      }
      if (m.minute < 90) m.minute++;
      else if (m.status === '2ND_HALF') m.status = 'FT';
    }
    return m;
  });
  if (changed) {
    fs.writeFileSync(path.join(dataPath, 'matches.json'), JSON.stringify(matches, null, 2));
    io.emit('liveScores', matches);
  }
}, 30000);

io.on('connection', (socket) => {
  socket.emit('liveScores', matches);
});

// Catch-all route (prevents 404)
app.get('*', (req, res) => {
  const indexPath = path.join(frontendPath, 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.status(404).send('Frontend missing: upload index.html to frontend/ folder');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Fescore backend running on port ${PORT}`));
