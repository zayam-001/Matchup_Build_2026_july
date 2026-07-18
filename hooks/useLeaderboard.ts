import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../services/storage';

export interface LeaderboardTeam {
  id: string;
  name: string;
  gwp: number;
  wins: number;
  titles: number;
}

export const useLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardTeam[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoadingLeaderboard(false);
      return;
    }

    const q = query(collection(db, 'teams'));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let teams = snapshot.docs.map(doc => {
        const data = doc.data();
        const gamesWon = data.gamesWon || 0;
        const gamesPlayed = data.gamesPlayed || 0;
        
        // Fallback to matches if games aren't tracked
        const matchesWon = data.wins || data.matchesWon || 0;
        const matchesPlayed = data.matchesPlayed || 0;

        let gwp = 0;
        if (gamesPlayed > 0) {
          gwp = (gamesWon / gamesPlayed) * 100;
        } else if (matchesPlayed > 0) {
          gwp = (matchesWon / matchesPlayed) * 100;
        }

        return {
          id: doc.id,
          name: data.name || 'Unknown Team',
          gwp: gwp,
          wins: gamesWon || matchesWon,
          titles: data.titles || 0
        };
      });

      if (teams.length > 0) {
        // Sort by GWP descending
        teams.sort((a, b) => b.gwp - a.gwp);
        setLeaderboard(teams.slice(0, 5));
        setLoadingLeaderboard(false);
      } else {
        // Fallback to quickplay sessions
        try {
          const [qp1, qp2] = await Promise.all([
            getDocs(collection(db, 'quickplaySessions')),
            getDocs(collection(db, 'quickSessions'))
          ]);

          const playerStats = new Map<string, {name: string, won: number, played: number}>();

          const processSession = (docData: any) => {
            const players = docData.players || [];
            const playerIds = docData.playerIds || [];
            const matches = docData.matches || [];

            matches.forEach((m: any) => {
              // Usually status 'COMPLETED' or 2
              if (m.status === 'COMPLETED' || m.status === 2 || m.winner) {
                const t1Idx = m.team1Players || [];
                const t2Idx = m.team2Players || [];

                t1Idx.forEach((idx: number) => {
                  const pid = playerIds[idx];
                  const pObj = players[idx];
                  if (!pid || !pObj) return;

                  if (!playerStats.has(pid)) {
                    playerStats.set(pid, { name: pObj.fullName || pObj.name || 'Unknown', won: 0, played: 0 });
                  }
                  const st = playerStats.get(pid)!;
                  st.played += 1;
                  if (m.winner === 1) st.won += 1;
                });

                t2Idx.forEach((idx: number) => {
                  const pid = playerIds[idx];
                  const pObj = players[idx];
                  if (!pid || !pObj) return;

                  if (!playerStats.has(pid)) {
                    playerStats.set(pid, { name: pObj.fullName || pObj.name || 'Unknown', won: 0, played: 0 });
                  }
                  const st = playerStats.get(pid)!;
                  st.played += 1;
                  if (m.winner === 2) st.won += 1;
                });
              }
            });
          };

          qp1.forEach(doc => processSession(doc.data()));
          qp2.forEach(doc => processSession(doc.data()));

          const arr: LeaderboardTeam[] = [];
          playerStats.forEach((st, id) => {
            if (st.played > 0) {
              arr.push({ id, name: st.name, gwp: (st.won / st.played) * 100, wins: st.won, titles: 0 });
            }
          });

          arr.sort((a, b) => b.gwp - a.gwp);
          setLeaderboard(arr.slice(0, 5));
        } catch (e) {
          console.error("Error fetching fallback quickplay leaderboard:", e);
        } finally {
          setLoadingLeaderboard(false);
        }
      }
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
      setLoadingLeaderboard(false);
    });

    return () => unsubscribe();
  }, []);

  return { leaderboard, loadingLeaderboard };
};
