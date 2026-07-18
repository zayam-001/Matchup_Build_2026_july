import { writeBatch, doc, collection, serverTimestamp, increment, getDoc } from 'firebase/firestore';
import { db } from './storage';

/**
 * The Data Cascade: Records a point (e.g. a Smash) and fans out the update.
 */
export const recordAtomicPoint = async (
  matchId: string,
  tournamentId: string,
  currentSet: number,
  scoringTeam: 'A' | 'B',
  scoringPlayerId: string,
  shotType: string,
  newScoreA: number,
  newScoreB: number,
  refereeId: string
) => {
  if (!db) {
    console.warn('⚠️ Firestore is not configured or is running in mock mode. Skipping recordAtomicPoint.');
    return;
  }

  const batch = writeBatch(db);

  // 1. Atomic event (append-only)
  const eventsRef = collection(db, `matches/${matchId}/events`);
  const eventDocRef = doc(eventsRef);
  batch.set(eventDocRef, {
    type: 'point',
    scoringTeam,
    scoringPlayerId,
    shotType,
    setNum: currentSet,
    scoreAfter: { A: newScoreA, B: newScoreB },
    refereeId,
    timestamp: serverTimestamp(),
  });

  // 2. Live match score
  // We do not perform concurrent updates to the match document here to avoid race conditions with updateMatchScore.
  // Instead, updateMatchScore handles the definitive real-time state writes on every point.

  // 3. Player stat increment (only if registered player exists)
  if (scoringPlayerId && scoringPlayerId !== 'unknown' && scoringPlayerId !== 'p1' && scoringPlayerId !== 'p2' && scoringPlayerId !== 'p3' && scoringPlayerId !== 'p4') {
    try {
      const playerDocRef = doc(db, `players/${scoringPlayerId}`);
      const playerSnap = await getDoc(playerDocRef);
      if (playerSnap.exists()) {
        const playerUpdates: any = {
          'stats.totalPointsWon': increment(1),
        };
        if (shotType === 'smash') playerUpdates['stats.totalSmashes'] = increment(1);
        if (shotType === 'vibora') playerUpdates['stats.totalViboras'] = increment(1);
        
        batch.update(playerDocRef, playerUpdates);
      }
    } catch (e) {
      console.warn("Failed to update player stats atomically:", e);
    }
  }

  // 4. Commit batch
  await batch.commit();
};
