import { runTransaction, doc, collection, serverTimestamp, increment } from 'firebase/firestore';
import { db } from './storage';

/**
 * Recalculate standings based on completed match result.
 * This is a simplified stub. In a real implementation you would calculate
 * Points, Games Won/Lost based on tournament rules.
 */
function recalculateStandings(standingsData: any, matchData: any) {
  // Logic to compute updated GWP, points, etc.
  // ...
  return { ...standingsData, updatedAt: serverTimestamp() };
}

/**
 * Complete a match, update bracket/standings, and increment referee metrics atomically.
 */
export const completeMatchAndAdvance = async (
  matchId: string, 
  tournamentId: string, 
  winnerId: string, 
  refereeId: string,
  standingDocId?: string
) => {
  if (!db) {
    console.warn('⚠️ Firestore is not configured or is running in mock mode. Skipping atomic match completion.');
    return;
  }

  const matchRef = doc(db, `matches/${matchId}`);
  const matchStubRef = doc(db, `tournaments/${tournamentId}/matches/${matchId}`);
  const standingRef = standingDocId ? doc(db, `tournaments/${tournamentId}/standings/${standingDocId}`) : null;

  try {
    await runTransaction(db, async (txn) => {
      const tournamentRef = doc(db, `tournaments/${tournamentId}`);

      // 1. All reads at the absolute beginning, executed sequentially to avoid async/promise scheduling issues
      const matchDoc = await txn.get(matchRef);
      const stubDoc = await txn.get(matchStubRef);
      const standingDoc = standingRef ? await txn.get(standingRef) : null;

      // 2. All writes after the reads are done
      // Process Standings if applicable (e.g., Round Robin)
      if (standingRef && standingDoc && standingDoc.exists() && matchDoc.exists()) {
         const newStandings = recalculateStandings(standingDoc.data(), matchDoc.data());
         txn.set(standingRef, newStandings); // full replace
      }

      // Update global match
      if (matchDoc.exists()) {
        txn.update(matchRef, {
          status: 'COMPLETED',
          winnerId: winnerId,
          winnerTeamId: winnerId,
          endedAt: serverTimestamp(),
        });
      } else {
        txn.set(matchRef, {
          status: 'COMPLETED',
          winnerId: winnerId,
          winnerTeamId: winnerId,
          endedAt: serverTimestamp(),
          id: matchId,
          tournamentId: tournamentId
        }, { merge: true });
      }

      // Update tournament stub
      if (stubDoc.exists()) {
        txn.update(matchStubRef, {
          status: 'COMPLETED',
          winnerId: winnerId,
          winnerTeamId: winnerId,
        });
      } else {
        txn.set(matchStubRef, {
          status: 'COMPLETED',
          winnerId: winnerId,
          winnerTeamId: winnerId,
          id: matchId,
          tournamentId: tournamentId
        }, { merge: true });
      }

      // Update referee completed count atomically (only if not default mock ID)
      if (refereeId && refereeId !== 'currentReferee' && refereeId !== 'undefined') {
        txn.set(doc(db, `referees/${refereeId}`), {
          completedMatchCount: increment(1),
          lastMatchAt: serverTimestamp(),
        }, { merge: true });
      }

      // Update tournament global metrics
      txn.set(tournamentRef, {
        completedMatchCount: increment(1)
      }, { merge: true });
    });
  } catch (error) {
    console.error('Error during completeMatchAndAdvance transaction:', error);
    throw error;
  }
};
