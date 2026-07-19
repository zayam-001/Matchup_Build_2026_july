import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/storage';
import { Card } from './ui/Card';
import { ChevronLeft, Trophy, Target, Activity, Users, User, Filter, Film } from 'lucide-react';
import { Tournament, RegistrationStatus, TournamentFormat, MatchStatus } from '../types';
import { Top10Banner } from './Top10Banner';

interface TournamentAnalyticsProps {
    tournamentId: string;
    onBack: () => void;
}

export const TournamentAnalytics: React.FC<TournamentAnalyticsProps> = ({ tournamentId, onBack }) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [matches, setMatches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [showTop10Banner, setShowTop10Banner] = useState(false);
    const [autoGenerateGif, setAutoGenerateGif] = useState(false);

    useEffect(() => {
        if (!tournamentId) return;

        // Subscribe to tournament doc
        const unsubTournament = onSnapshot(doc(db, 'tournaments', tournamentId), (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.data() as Tournament;
                setTournament(data);
                if (data.isMultiCategory && !selectedCategoryId && data.categories?.length) {
                    setSelectedCategoryId(data.categories[0].id);
                }
            }
        });

        // Subscribe to matches subcollection
        const unsubMatches = onSnapshot(collection(db, 'tournaments', tournamentId, 'matches'), (snapshot) => {
            const matchesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setMatches(matchesData);
            setLoading(false);
        });

        return () => {
            unsubTournament();
            unsubMatches();
        };
    }, [tournamentId]);

    const computeAnalytics = () => {
        if (!tournament) return [];

        const teamsList = (tournament.teams || []).filter(t => !selectedCategoryId || t.categoryId === selectedCategoryId);
        const category = tournament.categories?.find(c => c.id === selectedCategoryId);
        const activeFormat = category?.format || tournament.format;
        const isAmericanoFormat = activeFormat === 'AMERICANO' || activeFormat === 'MEXICANO';

        const statsMap: Record<string, any> = {};

        // coupling: load/initialize players and teams directly from standings source-of-truth records!
        teamsList.forEach(t => {
            if (isAmericanoFormat) {
                // In Americano/Mexicano, standings contains individual player statistics already computed (either via match calculations or manual modifications)
                const pts = t.points || t.pointsScored || 0;
                statsMap[t.id] = {
                    id: t.id,
                    name: t.name,
                    pointsScored: pts,
                    matchesPlayed: t.matchesPlayed || 0,
                    wins: t.wins || 0
                };
            } else {
                // In regular formats: teams consist of player1 & player2
                if (t.player1) {
                    const p1Id = t.player1.id || t.player1.name;
                    statsMap[p1Id] = {
                        id: p1Id,
                        name: t.player1.name,
                        pointsScored: t.gamesWon ? (t.gamesWon * 4) : 0,
                        matchesPlayed: t.matchesPlayed || 0,
                        wins: t.wins || 0
                    };
                }
                if (t.player2) {
                    const p2Id = t.player2.id || t.player2.name;
                    statsMap[p2Id] = {
                        id: p2Id,
                        name: t.player2.name,
                        pointsScored: t.gamesWon ? (t.gamesWon * 4) : 0,
                        matchesPlayed: t.matchesPlayed || 0,
                        wins: t.wins || 0
                    };
                }
                statsMap[`team_${t.id}`] = {
                    id: t.id,
                    name: t.name,
                    isTeam: true,
                    gamesWon: t.gamesWon || 0,
                    gamesPlayed: (t.gamesWon || 0) + (t.gamesLost || 0),
                    matchesPlayed: t.matchesPlayed || 0,
                    wins: t.wins || 0
                };
            }
        });

        // Supplement player analytics with individual shot event points (e.g. tracking who got the winners/aces in live scorematching) 
        // if matches contain live click event histories to differentiate teammate performance.
        const filteredMatches = matches.filter(m => 
            (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') && 
            (!selectedCategoryId || m.categoryId === selectedCategoryId)
        );

        filteredMatches.forEach(m => {
            const t1 = teamsList.find(t => t.id === m.team1Id);
            const t2 = teamsList.find(t => t.id === m.team2Id);
            if (!t1 || !t2) return;

            // Only add granular history shot points if the match score has real-time tracked history events
            if (m.score?.history && Array.isArray(m.score.history) && m.score.history.length > 0) {
                // Reset initial points for these players to start from 0 and build purely from their personal winners/aces
                m.score.history.forEach((ev: string) => {
                    if (ev.includes('|')) {
                        const [teamToken, _, playerIdxStr] = ev.split('|');
                        const pIdx = parseInt(playerIdxStr);
                        if (teamToken === 'T1' && t1) {
                            const p = pIdx === 1 ? t1.player1 : t1.player2;
                            if (p && statsMap[p.id || p.name]) {
                                // First clear the bulk team-based points to build precision player stats
                                if (!statsMap[p.id || p.name]._hasReset) {
                                    statsMap[p.id || p.name].pointsScored = 0;
                                    statsMap[p.id || p.name]._hasReset = true;
                                }
                                statsMap[p.id || p.name].pointsScored += 1;
                            }
                        } else if (teamToken === 'T2' && t2) {
                            const p = pIdx === 1 ? t2.player1 : t2.player2;
                            if (p && statsMap[p.id || p.name]) {
                                if (!statsMap[p.id || p.name]._hasReset) {
                                    statsMap[p.id || p.name].pointsScored = 0;
                                    statsMap[p.id || p.name]._hasReset = true;
                                }
                                statsMap[p.id || p.name].pointsScored += 1;
                            }
                        }
                    }
                });
            }
        });

        return Object.values(statsMap).map((s: any) => {
            if (s.isTeam) {
                const gwp = s.gamesPlayed > 0 ? ((s.gamesWon / s.gamesPlayed) * 100).toFixed(1) : "0";
                return { ...s, statValue: gwp + '%', type: 'Game Win %', rawValue: parseFloat(gwp) };
            }
            return { ...s, statValue: s.pointsScored + ' pts', type: 'Total Points', rawValue: s.pointsScored };
        }).sort((a, b) => b.rawValue - a.rawValue);
    };

    const analyticsData = computeAnalytics();
    const categories = tournament?.categories || [];

    if (loading) return <div className="text-white text-center py-20">Loading statistics...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pt-28 md:pt-36 px-4 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="h-12 w-12 flex items-center justify-center rounded-2xl bg-surface-dark border border-white/10 text-content-secondary hover:text-white hover:border-primary transition-all"><ChevronLeft size={24}/></button>
                    <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase">Tournament Stats</h1>
                    <p className="text-content-secondary font-medium">{tournament?.name} Analytics</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {tournament?.isMultiCategory && categories.length > 0 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                            <Filter size={16} className="text-brand flex-shrink-0" />
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id)}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                                        selectedCategoryId === cat.id 
                                        ? 'bg-brand text-content-inverse shadow-lg shadow-brand/20' 
                                        : 'bg-surface-elevated text-content-muted hover:text-white'
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={() => {
                            setAutoGenerateGif(false);
                            setShowTop10Banner(true);
                        }}
                        className="h-12 px-5 flex items-center justify-center gap-2 rounded-2xl bg-surface-dark border border-white/10 text-content-secondary hover:text-white hover:border-primary transition-all cursor-pointer font-bold text-xs uppercase tracking-wider"
                    >
                        <Trophy size={16} className="mb-0.5" /> Export Banner (PNG)
                    </button>

                    <button
                        onClick={() => {
                            setAutoGenerateGif(true);
                            setShowTop10Banner(true);
                        }}
                        className="h-12 px-6 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-amber-950 font-black text-xs uppercase tracking-wider transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
                    >
                        <Film size={16} className="mb-0.5" /> Generate Top 5 GIF
                    </button>
                </div>
            </div>

            <div className="bg-card-dark border border-primary/10 rounded-3xl p-6 md:p-8 flex flex-col relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />
                <div className="relative z-10 overflow-x-auto">
                    <table className="w-full text-left text-sm text-content-secondary">
                        <thead className="bg-surface-dark text-xs uppercase text-white font-bold h-12 border-b border-primary/10">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-xl text-content-muted">Rank</th>
                                <th className="px-6 py-4">Player / Team</th>
                                <th className="px-6 py-4">Metric</th>
                                <th className="px-6 py-4 rounded-tr-xl">Performance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analyticsData.map((a, i) => (
                                <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-surface-elevated transition-colors">
                                    <td className="px-6 py-5 font-black text-content-muted text-lg">{i + 1}</td>
                                    <td className="px-6 py-5 font-bold text-white text-base">
                                        <div className="flex items-center gap-2">
                                            {a.isTeam ? <Users size={16} className="text-content-muted" /> : <User size={16} className="text-content-muted" />}
                                            {a.name}
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <span className="text-content-secondary font-bold text-[10px] bg-surface-dark border border-white/5 px-3 py-1 rounded-full uppercase tracking-wider">{a.type}</span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-brand font-bold text-lg">{a.statValue}</span>
                                            {a.isTeam && (
                                                <div className="flex-1 h-1.5 w-24 bg-surface-dark rounded-full hidden md:block">
                                                    <div className="h-full bg-brand rounded-full" style={{ width: a.statValue }}></div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {analyticsData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center py-20 text-content-muted font-medium">
                                        <Activity size={48} className="mx-auto mb-4 opacity-20" />
                                        No metrics recorded for this selection yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showTop10Banner && (
                <Top10Banner 
                    players={analyticsData.filter(a => !a.isTeam)}
                    tournamentName={tournament?.name || 'Tournament'}
                    categoryName={tournament?.categories?.find(c => c.id === selectedCategoryId)?.name}
                    matches={matches}
                    autoGenerateGif={autoGenerateGif}
                    onClose={() => {
                        setShowTop10Banner(false);
                        setAutoGenerateGif(false);
                    }}
                />
            )}
        </div>
    );
}

export default TournamentAnalytics;
