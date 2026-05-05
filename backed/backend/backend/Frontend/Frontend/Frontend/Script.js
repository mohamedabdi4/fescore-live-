const socket = io();
let currentUserEmail = localStorage.getItem('fescore_email') || 'user_' + Date.now() + '@fescore.com';
if (!localStorage.getItem('fescore_email')) localStorage.setItem('fescore_email', currentUserEmail);

// Check premium status
async function checkPremium() {
  try {
    const res = await fetch(`/api/check-premium/${encodeURIComponent(currentUserEmail)}`);
    const data = await res.json();
    if (data.premium) {
      document.querySelectorAll('.premium-btn').forEach(btn => btn.remove());
      localStorage.setItem('fescore_premium', 'true');
    }
  } catch(e) { console.log(e); }
}
checkPremium();

// Render matches
function renderMatches(matches) {
  const container = document.getElementById('matchesList');
  if (!container) return;
  container.innerHTML = '';
  matches.forEach(m => {
    const homeScore = (m.homeScore !== undefined && m.homeScore !== null) ? m.homeScore : '?';
    const awayScore = (m.awayScore !== undefined && m.awayScore !== null) ? m.awayScore : '?';
    let statusText = '';
    if (m.status === 'LIVE') statusText = `🔴 LIVE ${m.minute}'`;
    else if (m.status === '1ST_HALF') statusText = `🟡 1ST HALF ${m.minute}'`;
    else if (m.status === '2ND_HALF') statusText = `🟢 2ND HALF ${m.minute}'`;
    else if (m.status === 'TODAY') statusText = `📅 ${new Date(m.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    else statusText = m.status;
    const card = document.createElement('div');
    card.className = 'match-card';
    card.innerHTML = `
      <div class="match-header"><span>${m.league}</span><span class="${m.status==='LIVE'?'live-status':''}">${statusText}</span></div>
      <div class="match-teams"><div class="team home">${m.homeTeam}</div><div class="score">${homeScore} - ${awayScore}</div><div class="team away">${m.awayTeam}</div></div>
    `;
    container.appendChild(card);
  });
}

// Standings
async function showStandings(leagueId = 'EPL') {
  const res = await fetch(`/api/standings/${leagueId}`);
  const data = await res.json();
  if (!data.table) return;
  let html = `<h3>🏆 ${data.leagueName}</h3><table class="standings-table"><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th>Pts</th></tr>`;
  data.table.forEach(row => {
    html += `<tr><td>${row.position}</td><td>${row.team}</td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td><b>${row.points}</b></td></tr>`;
  });
  html += `</table><div style="margin-top:15px"><button id="switchEPL" class="btn-main" style="width:auto;padding:8px 16px;">EPL</button> <button id="switchLALIGA" class="btn-main" style="width:auto;padding:8px 16px;">LaLiga</button></div>`;
  document.getElementById('standingsPanel').innerHTML = html;
  document.getElementById('switchEPL')?.addEventListener('click', () => showStandings('EPL'));
  document.getElementById('switchLALIGA')?.addEventListener('click', () => showStandings('LALIGA'));
}

// Navigation
document.getElementById('tableBtn')?.addEventListener('click', () => {
  document.getElementById('matchesList').style.display = 'none';
  document.getElementById('standingsPanel').style.display = 'block';
  showStandings('EPL');
});
document.getElementById('premiumBtn')?.addEventListener('click', () => {
  if (localStorage.getItem('fescore_premium') === 'true') alert('Waxaad hore u heshay premium!');
  else document.getElementById('paymentForm').style.display = 'block';
});
document.getElementById('submitPayment')?.addEventListener('click', async () => {
  const txnId = document.getElementById('txnId').value;
  if (!txnId) return alert('Fadlan geli Transaction ID');
  await fetch('/api/submit-payment', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email: currentUserEmail, txnId }) });
  alert('Waad soo gudbisay. Waxaan kuu xaqiijin doonnaa premium marka lacagta la helo.');
  document.getElementById('paymentForm').style.display = 'none';
});

// Socket events
socket.on('liveScores', (matches) => {
  if (document.getElementById('matchesList').style.display !== 'none') renderMatches(matches);
});
socket.on('goalAlert', (data) => {
  const toast = document.getElementById('goalToast');
  toast.innerText = `⚽ GOAL! ${data.match.homeTeam} ${data.match.homeScore} - ${data.match.awayScore} ${data.match.awayTeam}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4000);
});

// Initial load
fetch('/api/matches').then(res=>res.json()).then(matches=>renderMatches(matches));
