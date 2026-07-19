import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../services/storage';

export interface UpcomingTournament {
  id: string;
  slug?: string;
  name: string;
  date: string;
  venue: string;
  status: string;
}

export const useTournaments = () => {
  const [tournaments, setTournaments] = useState<UpcomingTournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoadingTournaments(false);
      return;
    }

    const q = query(
      collection(db, 'tournaments'),
      where('status', 'in', ['ACTIVE', 'COMPLETED'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTournaments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          slug: data.slug,
          name: data.name || 'Unnamed Tournament',
          date: data.registrationDeadline || data.createdAt || new Date().toISOString(),
          venue: data.venue || data.city || 'TBD',
          status: data.status || 'DRAFT'
        };
      });

      const now = new Date();
      // Filter upcoming (date > now) and sort by closest to now
      const upcoming = allTournaments
        .filter(t => new Date(t.date) > now && (t.status !== 'COMPLETED' && String(t.status).toUpperCase() !== 'FINISHED'))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // If no upcoming found via date, just grab active/draft ones
      if (upcoming.length === 0) {
        const active = allTournaments.filter(t => (t.status !== 'COMPLETED' && String(t.status).toUpperCase() !== 'FINISHED'));
        setTournaments(active.slice(0, 5));
      } else {
        setTournaments(upcoming.slice(0, 5));
      }

      setLoadingTournaments(false);
    }, (error) => {
      console.error("Error fetching tournaments:", error);
      setLoadingTournaments(false);
    });

    return () => unsubscribe();
  }, []);

  return { tournaments, loadingTournaments };
};
