const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error('Cannot find inline script in index.html');

const scriptPrefix = scriptMatch[1].split('// ==================== INIT ====================')[0];
const { TEAMS, RESULTS, predictMatch } = Function(`
${scriptPrefix}
return { TEAMS, RESULTS, predictMatch };
`)();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function outcomeFromPred(pred) {
  const pA = pred.teamA.winProb;
  const pD = pred.draw;
  const pB = pred.teamB.winProb;
  return pA > pB ? (pA > pD ? 'A' : 'D') : (pB > pD ? 'B' : 'D');
}

function outcomeFromScore(score) {
  const [a, b] = score.split('-').map(Number);
  return a > b ? 'A' : a < b ? 'B' : 'D';
}

const rows = [];
for (const [key, result] of Object.entries(RESULTS)) {
  const [a, b] = key.split('-');
  if (!TEAMS[a] || !TEAMS[b]) continue;

  const pred = predictMatch(a, b, '小组赛');
  const predOutcome = outcomeFromPred(pred);
  const actualOutcome = outcomeFromScore(result.score);

  rows.push({
    match: key,
    probabilities: {
      teamA: pred.teamA.winProb,
      draw: pred.draw,
      teamB: pred.teamB.winProb
    },
    predictedScore: pred.predictedScore,
    actualScore: result.score,
    predictedOutcome: predOutcome,
    actualOutcome,
    directionHit: predOutcome === actualOutcome,
    exactHit: pred.predictedScore === result.score,
    top3Hit: pred.topScores.some(s => s.score === result.score)
  });
}

const stats = {
  total: rows.length,
  direction: rows.filter(r => r.directionHit).length,
  exact: rows.filter(r => r.exactHit).length,
  top3: rows.filter(r => r.top3Hit).length,
  actualDraw: rows.filter(r => r.actualOutcome === 'D').length,
  predictedDraw: rows.filter(r => r.predictedOutcome === 'D').length
};

assert(!html.includes('summaryEl.textContent = `13/23`;'), 'Scoreboard summary must not hardcode 13/23');
assert(!html.includes('已校验 <strong style="color:var(--green)">23</strong> 场'), 'Scoreboard body must render total dynamically');
assert(!html.includes('胜负方向对 <strong style="color:var(--green)">13</strong> 场'), 'Scoreboard body must render direction hits dynamically');
assert(!html.includes("const predW = pa > pb ? 'A' : pa < pb ? 'B' : 'D';"), 'Scoreboard must not use score outcome as the direction metric');
assert(html.includes('pred.teamA.winProb'), 'Scoreboard must use probability outcome as the direction metric');
assert(html.includes('最后更新</span> 2026-07-06'), 'Footer last-updated date must match the current data refresh');
assert(html.includes('已收录全部 72 场小组赛真实比分'), 'Footer must show all 72 completed group-stage matches');
assert(html.includes('const MODEL_CONFIG'), 'Model constants should live in MODEL_CONFIG');
assert(html.includes('DRAW_SCORE_BOOST'), 'Draw score boost should be named and configurable');
assert(!fs.readFileSync(path.join(__dirname, '..', 'README.md'), 'utf8').includes('当前 5/12'), 'README must not show stale 5/12 record');
assert(stats.total > 0, 'Backtest should include completed matches');

console.log(JSON.stringify({ ok: true, stats, rows }, null, 2));
