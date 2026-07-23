const fs = require('fs');
const file = 'components/MatchScoringSystem.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    isLocalUpdateRef.current = true;
    setMatchState(nextState);
    setHistory(prev => [...prev, { stateBefore: matchState, timestamp: Date.now(), action: { teamToAward: pendingSetResult.team, type: 'point' } } as any, ...(startNext ? [{ stateBefore: nextState, timestamp: Date.now() + 1, action: { type: 'START_SET_NORMAL' } } as any] : [])]);
    setPendingSetResult(null);

    if (startNext) {
      setWorkflowPhase('SCORING');
    } else {
      setWorkflowPhase('WINNER_SELECTION');
    }`;

const replacement = `    isLocalUpdateRef.current = true;
    setMatchState(nextState);
    setHistory(prev => [...prev, { stateBefore: matchState, timestamp: Date.now(), action: { teamToAward: pendingSetResult.team, type: 'point' } } as any, ...(startNext ? [{ stateBefore: nextState, timestamp: Date.now() + 1, action: { type: 'START_SET_NORMAL' } } as any] : [])]);
    setPendingSetResult(null);

    // Give it a tiny tick for the state to settle before resetting the UI to scoring,
    // which prevents rapid re-renders from fighting with the external sync.
    setTimeout(() => {
        if (startNext) {
          setWorkflowPhase('SCORING');
        } else {
          setWorkflowPhase('WINNER_SELECTION');
        }
    }, 50);`;

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement));
  console.log("Patched successfully");
} else {
  console.log("Target not found");
}
