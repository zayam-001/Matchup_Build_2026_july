const fs = require('fs');
const file = 'components/MatchScoringSystem.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (
          score.p1Sets !== prev.setsA || 
          score.p2Sets !== prev.setsB || 
          score.p1Games !== prev.gamesA || 
          score.p2Games !== prev.gamesB
        ) {
          return {
            server: (score.server as PlayerId) || 'p1',
            pointsA: isAmericano ? externalPointsA : (score.rawPointsA ?? prev.pointsA),
            pointsB: isAmericano ? externalPointsB : (score.rawPointsB ?? prev.pointsB),
            gamesA: score.p1Games || 0,
            gamesB: score.p2Games || 0,
            setsA: score.p1Sets || 0,
            setsB: score.p2Sets || 0,
            goldenPoint: score.goldenPoint || false,
            isTiebreak: score.isTiebreak || false,
            setScoresA: score.p1SetScores || [],
            setScoresB: score.p2SetScores || [],
          };
        }`;

const replacement = `        if (
          (score.p1Sets !== undefined && score.p1Sets !== prev.setsA) || 
          (score.p2Sets !== undefined && score.p2Sets !== prev.setsB) || 
          (score.p1Games !== undefined && score.p1Games !== prev.gamesA) || 
          (score.p2Games !== undefined && score.p2Games !== prev.gamesB)
        ) {
          return {
            server: (score.server as PlayerId) || 'p1',
            pointsA: isAmericano ? externalPointsA : (score.rawPointsA ?? prev.pointsA),
            pointsB: isAmericano ? externalPointsB : (score.rawPointsB ?? prev.pointsB),
            gamesA: score.p1Games ?? 0,
            gamesB: score.p2Games ?? 0,
            setsA: score.p1Sets ?? 0,
            setsB: score.p2Sets ?? 0,
            goldenPoint: score.goldenPoint || false,
            isTiebreak: score.isTiebreak || false,
            setScoresA: score.p1SetScores || [],
            setScoresB: score.p2SetScores || [],
          };
        }`;

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Target not found");
}
