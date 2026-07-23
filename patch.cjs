const fs = require('fs');
const file = 'components/MatchScoringSystem.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `        if (
          (score.p1Sets !== undefined && score.p1Sets !== prev.setsA) || 
          (score.p2Sets !== undefined && score.p2Sets !== prev.setsB) || 
          (score.p1Games !== undefined && score.p1Games !== prev.gamesA) || 
          (score.p2Games !== undefined && score.p2Games !== prev.gamesB)
        ) {`;

const replacement = `        // We only trigger this if the incoming score explicitly differs from our local prev state, 
        // AND the incoming score's property actually exists. We must also ignore cases where the difference
        // is just the external DB being lagging behind our fast local updates.
        // Actually, since we only want to sync external updates (like an admin changing score),
        // we should compare if the difference is substantial.
        if (
          (score.p1Sets !== undefined && score.p1Sets !== prev.setsA && !isLocalUpdateRef.current) || 
          (score.p2Sets !== undefined && score.p2Sets !== prev.setsB && !isLocalUpdateRef.current) || 
          (score.p1Games !== undefined && score.p1Games !== prev.gamesA && !isLocalUpdateRef.current) || 
          (score.p2Games !== undefined && score.p2Games !== prev.gamesB && !isLocalUpdateRef.current)
        ) {`;

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Target not found");
}
