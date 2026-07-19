import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { subscribeToTournaments, subscribeToStandings } from '../services/storage';
import { useLiveMatch } from '../hooks/useLiveMatch';
import { useTournamentDoc } from '../hooks/useTournamentDoc';
import { useTournamentMatches } from '../hooks/useTournamentMatches';
import { MatchStatus, Tournament, TournamentFormat, RoundRobinType, Team, Match, SponsorTier } from '../types';
import { ChevronRight, Play, Info, Trophy, History, Timer, MapPin, Award, X, Activity, ChevronDown, Users, Mic, DollarSign, Tv, Calendar, Check, LayoutGrid, List } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Card } from './ui/Card';
import { Logo } from './ui/Logo';
import { Badge } from './ui/Badge';
import { getEffectiveEvents } from '../services/scoreEngine';
import { MatchResultCard } from './MatchResultCard';
import { TeamDetailsOverlay } from './TeamDetailsOverlay';
import { motion } from 'motion/react';

const getMatchTimestamp = (m: any): number => {
  const time = m.scheduledTime || m.scheduledAt;
  if (!time) return 0;
  if (typeof time === 'string' || typeof time === 'number') {
    const parsed = new Date(time).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }
  if (time.toDate && typeof time.toDate === 'function') {
    return time.toDate().getTime();
  }
  if (typeof time.seconds === 'number') {
    return time.seconds * 1000;
  }
  return 0;
};

const formatFullTime = (time: any) => {
  if (!time) return 'TBA';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'TBA';
    }
    if (isNaN(date.getTime())) return 'TBA';
    return date.toLocaleString([], { year: '2-digit', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'TBA';
  }
};

const formatTimeOnly = (time: any) => {
  if (!time) return 'TBA';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'TBA';
    }
    if (isNaN(date.getTime())) return 'TBA';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return 'TBA';
  }
};

const formatFullDateOnly = (time: any) => {
  if (!time) return 'Completed';
  try {
    let date: Date;
    if (typeof time === 'string' || typeof time === 'number') {
      date = new Date(time);
    } else if (time.toDate && typeof time.toDate === 'function') {
      date = time.toDate();
    } else if (typeof time.seconds === 'number') {
      date = new Date(time.seconds * 1000);
    } else if (time instanceof Date) {
      date = time;
    } else {
      return 'Completed';
    }
    if (isNaN(date.getTime())) return 'Completed';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch (e) {
    return 'Completed';
  }
};

export const LiveScoreboard: React.FC<{ initialTournamentId?: string, initialCategoryId?: string }> = ({ initialTournamentId, initialCategoryId }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(initialTournamentId || null);
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId || null);
  const [activeArenaTab, setActiveArenaTab] = useState<'live' | 'timelines' | 'standings' | 'results' | 'schedule'>('live');
  const [prevCategory, setPrevCategory] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<any | null>(null);

  // New Phase 2 Hooks
  const resolvedId = React.useMemo(() => {
    if (!selectedTournamentId) return null;
    if (tournaments.length === 0) return selectedTournamentId;
    const t = tournaments.find(x => x.id === selectedTournamentId || (x.slug && x.slug === selectedTournamentId) || x.name === selectedTournamentId);
    return t ? t.id : selectedTournamentId;
  }, [selectedTournamentId, tournaments]);

  const { tournament: activeTournament, loading: loadingTournament } = useTournamentDoc(resolvedId);
  const { matches: tournamentMatches, loading: loadingMatches } = useTournamentMatches(resolvedId);

  const updateUrl = (tournId: string | null, catId?: string | null) => {
    if (!tournId) {
       window.location.hash = 'live';
    } else {
       // get slug if possible
       const t = tournaments.find(x => x.id === tournId);
       const tId = t?.slug || tournId;
       if (catId) {
           window.location.hash = `live/${tId}/${catId}`;
       } else {
           window.location.hash = `live/${tId}`;
       }
    }
  };

  const handleSelectTournament = (id: string | null) => {
      setSelectedTournamentId(id);
      updateUrl(id, null);
  };

  const handleSelectCategory = (catId: string) => {
      setSelectedCategoryId(catId);
      updateUrl(selectedTournamentId, catId);
  };

  useEffect(() => {
    if (initialTournamentId !== undefined) setSelectedTournamentId(initialTournamentId);
  }, [initialTournamentId]);

  useEffect(() => {
    if (initialCategoryId !== undefined) setSelectedCategoryId(initialCategoryId);
  }, [initialCategoryId]);

  useEffect(() => {
    const unsubscribe = subscribeToTournaments((data: Tournament[]) => setTournaments(data));
    return () => unsubscribe();
  }, []);



  useEffect(() => {
    if (activeTournament) {
        if (activeTournament?.isMultiCategory && activeTournament?.categories && activeTournament.categories.length > 0 && !selectedCategoryId && !initialCategoryId) {
            const firstCatId = activeTournament.categories[0].id;
            setSelectedCategoryId(firstCatId);
            const tId = activeTournament.slug || activeTournament.id;
            window.location.hash = `live/${tId}/${firstCatId}`;
        }
    }
  }, [activeTournament, selectedCategoryId]);

  useEffect(() => {
    if (activeTournament && tournamentMatches) {
        const matchesForCat = activeTournament.isMultiCategory && selectedCategoryId
            ? tournamentMatches.filter((m: any) => m.categoryId === selectedCategoryId)
            : tournamentMatches || [];
        const liveMatchCount = matchesForCat.filter((m: any) => 
            (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE') && 
            !m.winnerTeamId
        ).length;
        
        if (selectedCategoryId !== prevCategory) {
            setPrevCategory(selectedCategoryId);
            if (liveMatchCount === 0) {
                setActiveArenaTab('standings');
            } else {
                setActiveArenaTab('live');
            }
        }
    }
  }, [activeTournament, tournamentMatches, selectedCategoryId, prevCategory]);

  if (!selectedTournamentId) return <TournamentList tournaments={tournaments} onSelect={handleSelectTournament} />;
  if (loadingTournament) return <div className="text-center p-10 text-gray-500">Loading...</div>;
  if (!activeTournament) return <div className="text-center p-10 text-gray-400">Tournament not found</div>;

  const matchesToDisplay = activeTournament.isMultiCategory && selectedCategoryId
        ? tournamentMatches.filter((m: any) => m.categoryId === selectedCategoryId)
        : tournamentMatches;

  const teamsToDisplay = activeTournament.isMultiCategory && selectedCategoryId
        ? (activeTournament.teams || []).filter((t: any) => t.categoryId === selectedCategoryId)
        : (activeTournament.teams || []);

  const liveMatches = matchesToDisplay.filter((m: any) => 
    (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE') && 
    !m.winnerTeamId
  );
  const completedMatches = matchesToDisplay
    .filter((m: any) => (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') || m.winnerTeamId)
    .sort((a: any, b: any) => getMatchTimestamp(b) - getMatchTimestamp(a));
  
  const upcomingMatches = matchesToDisplay
    .filter((m: any) => m.status === MatchStatus.SCHEDULED || !m.status || String(m.status).toUpperCase() === 'SCHEDULED')
    .sort((a: any, b: any) => getMatchTimestamp(a) - getMatchTimestamp(b));

  const latestFinished = completedMatches.length > 0 ? completedMatches[0] : null;

  // Process Sponsors
  const sponsors = activeTournament.sponsors || [];
  const titleSponsor = sponsors.find((s: any) => typeof s !== 'string' && s.tier === SponsorTier.TITLE);
  // Gold and Platinum get Live Match placement
  const premiumSponsors = sponsors.filter((s: any) => typeof s !== 'string' && (s.tier === SponsorTier.GOLD || s.tier === SponsorTier.PLATINUM || s.tier === SponsorTier.TITLE));
  // All non-title sponsors go to marquee (including legacy strings)
  const marqueeSponsors = sponsors.filter((s: any) => typeof s === 'string' || s.tier !== SponsorTier.TITLE);

  if (isBroadcastMode && activeTournament) {
      return <BroadcastMode tournament={activeTournament} onClose={() => setIsBroadcastMode(false)} />;
  }

  return (
    <div className="pb-20 pt-28 max-w-[1400px] mx-auto w-full animate-in fade-in duration-500 px-4 md:px-8">
        <style>{`
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .animate-marquee {
                display: inline-flex;
                animation: marquee 30s linear infinite;
            }
            .animate-marquee:hover {
                animation-play-state: paused;
            }
            
            /* Broadcast Animations */
            @keyframes slideUp {
                from { transform: translate(-50%, 100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            @keyframes slideRight {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .animate-slide-up {
                animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .animate-slide-in-right {
                animation: slideRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
        `}</style>

        {/* Navigation / Back */}
        <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-6 pb-2 flex justify-between items-center relative z-10">
            <button onClick={() => handleSelectTournament(null)} className="text-white hover:text-gray-300 flex items-center gap-2 transition-colors cursor-pointer border-none bg-transparent whitespace-nowrap text-sm font-bold uppercase tracking-widest">
                &larr; BACK TO DIRECTORY
            </button>
            <button onClick={() => setIsBroadcastMode(true)} className="bg-brand text-white px-3 py-2 md:px-4 md:py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-brand-hover transition-colors cursor-pointer border-none text-sm">
                <Tv size={18} />
                <span className="hidden sm:inline">Broadcast Mode</span>
                <span className="sm:hidden">Broadcast</span>
            </button>
        </div>

        {/* Spectator Header */}
        {/* Spectator Hero Header */}
        <div className="flex flex-col items-start justify-center pt-8 pb-16 px-4 md:px-8 max-w-7xl mx-auto w-full relative">
             <div className="flex items-center gap-3 mb-6">
                 <span className="bg-white/10 text-white px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                     Padel
                 </span>
                 <div className="flex items-center gap-1.5 text-cyan-400 text-[10px] font-black uppercase tracking-widest">
                     <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                     LIVE NOW
                 </div>
             </div>
             
             <h2 className="text-5xl md:text-7xl font-display text-white tracking-tight mb-4 uppercase">
                 {activeTournament.name}
             </h2>
             
             <p className="text-gray-400 max-w-2xl text-sm md:text-base mb-8 leading-relaxed">
                 {activeTournament.description || "The premier padel tournament of the season. Watch the top contenders battle it out in the ultimate showdown. High stakes, fierce competition."}
             </p>
             
             <div className="flex flex-wrap items-center gap-4">
                 <button className="bg-white text-black px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer border-none text-sm">
                     <Play size={18} fill="currentColor" />
                     <span>Watch Live</span>
                 </button>
                 <button className="bg-[#2A2A2A] text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-[#333333] transition-colors cursor-pointer border-none text-sm">
                     <Info size={18} />
                     <span>More Info</span>
                 </button>
             </div>
        </div>
        {/* Category Tabs for Spectator */}
        {activeTournament.isMultiCategory && activeTournament.categories && activeTournament.categories.length > 0 && (
            <div className="max-w-7xl mx-auto px-4 mb-6">
                <div className="flex flex-wrap items-center justify-start gap-2">
                    {activeTournament.categories.map((cat: any) => {
                        const hasLiveMatch = tournamentMatches?.some((m: any) => 
                            m.categoryId === cat.id && 
                            (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE') && 
                            !m.winnerTeamId
                        );
                        return (
                        <button
                            key={cat.id}
                            onClick={() => handleSelectCategory(cat.id)}
                            className={`relative px-5 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all
                                ${selectedCategoryId === cat.id 
                                 ? 'bg-white text-black shadow-lg' 
                                 : 'bg-[#2A2A2A] text-white hover:bg-[#333333]'}`}
                        >
                            {cat.name}
                            {hasLiveMatch && selectedCategoryId !== cat.id && (
                                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            )}
                        </button>
                    )})}
                </div>
            </div>
        )}

        {/* 5-Tab Arena Container */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 mb-16">
            {/* Horizontal Floating Tabs */}
            <div className="flex flex-row justify-center bg-black p-1.5 rounded-full border border-white/5 gap-1 mb-8 w-full md:max-w-fit mx-auto relative z-20 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button 
                    onClick={() => setActiveArenaTab('live')}
                    className={`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 ${activeArenaTab === 'live' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}`}
                >
                    <Activity className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 ${activeArenaTab === 'live' ? 'animate-pulse' : ''}`} /> 
                    <span>Live</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('schedule')}
                    className={`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 ${activeArenaTab === 'schedule' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}`}
                >
                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Schedule</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('results')}
                    className={`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 ${activeArenaTab === 'results' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}`}
                >
                    <Check className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Results</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('standings')}
                    className={`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 ${activeArenaTab === 'standings' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}`}
                >
                    <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Standings</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('timelines')}
                    className={`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 ${activeArenaTab === 'timelines' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}`}
                >
                    <History className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Timelines</span>
                </button>
            </div>

            <div className="bg-[#111111]/50 backdrop-blur-sm rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
                {/* Tab Content */}
                <div className="p-4 md:p-8 min-h-[500px]">
                    {activeArenaTab === 'live' && (
                        <div className="animate-in fade-in duration-500">
                            {liveMatches.length === 0 ? (
                                <div className="py-20 flex flex-col items-center justify-center text-center">
                                    <Timer size={48} className="text-[#9CA3AF] mb-4" />
                                    <p className="text-white text-xl font-black italic tracking-[0.15em] uppercase">No active matches</p>
                                    <p className="text-[#9CA3AF] text-sm uppercase tracking-widest font-bold mt-2">Waiting for the next serve...</p>
                                </div>
                            ) : (
                                <div className={`grid gap-6 ${liveMatches.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                    {liveMatches.map(m => (
                                        <LiveCard key={m.id} match={m} teams={activeTournament.teams || []} sponsors={premiumSponsors} tournament={activeTournament} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeArenaTab === 'schedule' && (
                        <div className="animate-in fade-in duration-500">
                            <SpectatorSchedule matches={matchesToDisplay} teams={activeTournament.teams || []} onSelectTab={setActiveArenaTab} />
                        </div>
                    )}

                    {activeArenaTab === 'results' && (
                        <div className="animate-in fade-in duration-500">
                            <SpectatorResults matches={matchesToDisplay} teams={activeTournament.teams || []} tournament={activeTournament} />
                        </div>
                    )}

                    {activeArenaTab === 'timelines' && (
                        <div className="animate-in fade-in duration-500">
                            {(() => {
                                const timelineMatches = matchesToDisplay.filter((m: any) => m.score?.history && m.score.history.length > 0);
                                if (timelineMatches.length === 0) {
                                    return (
                                        <div className="py-20 flex flex-col items-center justify-center text-center">
                                            <History size={48} className="text-[#9CA3AF] mb-4" />
                                            <p className="text-white text-xl font-black italic tracking-[0.15em] uppercase">No Action Log</p>
                                        </div>
                                    );
                                }
                                return <MatchTimelinesList matches={timelineMatches} teams={activeTournament.teams || []} />;
                            })()}
                        </div>
                    )}

                    {activeArenaTab === 'standings' && (
                        <div className="animate-in fade-in duration-500">
                            <StandingsTable 
                                tournament={activeTournament} 
                                tournamentId={activeTournament.id} 
                                categoryId={selectedCategoryId} 
                                initialTeams={teamsToDisplay} 
                                onTeamSelect={setSelectedTeam} 
                                matches={matchesToDisplay}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {selectedTeam && (
            <TeamDetailsOverlay 
                team={selectedTeam} 
                matches={matchesToDisplay} 
                teams={activeTournament.teams || []} 
                tournament={activeTournament}
                onClose={() => setSelectedTeam(null)} 
            />
        )}
    </div>
  );
};

// --- SUB-COMPONENTS ---

const BroadcastOverlay = ({ event }: { event: any }) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!event) {
            setVisible(false);
            return;
        }

        const now = Date.now();
        const timeSince = now - event.timestamp;
        if (timeSince < event.duration) {
            setVisible(true);
            const timer = setTimeout(() => setVisible(false), event.duration - timeSince);
            return () => clearTimeout(timer);
        } else {
            setVisible(false);
        }
    }, [event]);

    if (!visible || !event) return null;

    if (event.type === 'TOMBSTONE') {
        return (
            <div className="absolute bottom-0 left-1/2 z-50 animate-slide-up w-full px-4 md:w-auto md:px-0">
                <div className="bg-gradient-to-t from-black to-surface-ground text-white px-6 py-4 md:px-12 rounded-t-xl border-t-4 border-brand shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center min-w-full md:min-w-[300px]">
                    <div className="text-brand font-black uppercase tracking-[0.3em] text-[10px] md:text-xs mb-1">UPDATE</div>
                    <div className="text-2xl md:text-4xl font-black italic tracking-[0.15em]er uppercase text-center">{event.message}</div>
                    {event.subMessage && <div className="text-content-muted font-bold uppercase tracking-widest text-xs md:text-sm mt-1 text-center">{event.subMessage}</div>}
                </div>
            </div>
        );
    }

    if (event.type === 'VIOLATOR') {
        return (
            <div className="absolute top-20 right-0 z-50 animate-slide-in-right max-w-[90%] md:max-w-none">
                <div className="bg-brand text-content-inverse pl-6 pr-12 py-4 md:pl-8 md:pr-20 md:py-6 rounded-l-full shadow-[0_10px_40px_rgba(180,252,87,0.4)] relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 md:w-32 h-full bg-black/10 skew-x-12 translate-x-10 md:translate-x-16"></div>
                    <div className="relative z-10">
                        <div className="font-black uppercase tracking-[0.2em] text-[10px] md:text-xs text-content-inverse/70 mb-1">ATTENTION</div>
                        <div className="text-xl md:text-3xl font-black italic tracking-[0.15em]er uppercase">{event.message}</div>
                        {event.subMessage && <div className="text-content-inverse/80 font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1">{event.subMessage}</div>}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'MASCOT_HAPPY' || event.type === 'MASCOT_SAD') {
        const isHappy = event.type === 'MASCOT_HAPPY';
        return (
            <div className="absolute top-20 right-0 z-50 animate-slide-in-right max-w-[90%] md:max-w-none">
                <div className={`pl-4 pr-12 py-4 md:pl-6 md:pr-20 md:py-6 rounded-l-full shadow-2xl relative overflow-hidden flex items-center gap-4 md:gap-6 ${isHappy ? 'bg-[#b4fc57] text-[#0A0A0A]' : 'bg-[#1A1A1A] text-white border-y border-l border-white/20'}`}>
                    <div className="absolute top-0 right-0 w-32 h-full bg-black/10 skew-x-12 translate-x-16"></div>
                    
                    {/* Futuristic Mascot UI Component */}
                    <div className="relative z-10 bg-[#0A0A0A] shadow-inner rounded-full w-16 h-16 md:w-20 md:h-20 flex items-center justify-center shrink-0 border-[3px] md:border-4 border-white/20 overflow-hidden box-content">
                        <div className="flex flex-col items-center justify-center w-full h-full bg-[#111111]">
                           <div className={`w-10 h-10 md:w-12 md:h-12 rounded-[30%] flex flex-col items-center justify-center transition-all border-2 border-black/50 shadow-inner ${isHappy ? 'bg-[#b4fc57]' : 'bg-[#E65C31]'}`}>
                               <div className="flex gap-2">
                                   <div className={`w-2 h-2 md:w-2.5 md:h-2.5 bg-black rounded-full ${isHappy ? '' : 'skew-x-12'}`}></div>
                                   <div className={`w-2 h-2 md:w-2.5 md:h-2.5 bg-black rounded-full ${isHappy ? '' : '-skew-x-12'}`}></div>
                               </div>
                               {isHappy ? (
                                   <div className="w-5 h-2.5 border-b-[3px] border-black rounded-b-full mt-1.5"></div>
                               ) : (
                                   <div className="w-5 h-2 border-t-[3px] border-black rounded-t-full mt-1.5 translate-y-0.5"></div>
                               )}
                           </div>
                        </div>
                    </div>
                    
                    <div className="relative z-10 pr-2">
                        <div className={`font-black uppercase tracking-[0.2em] text-[10px] md:text-xs mb-1 ${isHappy ? 'text-black/50' : 'text-white/50'}`}>{isHappy ? 'SPECTACULAR!' : 'UNFORCED ERROR'}</div>
                        <div className={`text-xl md:text-3xl font-black italic tracking-[0.15em]er uppercase ${isHappy ? 'text-[#0A0A0A]' : 'text-white'}`}>{event.message}</div>
                        {event.subMessage && <div className={`font-bold uppercase tracking-widest text-[10px] md:text-xs mt-1 ${isHappy ? 'text-black/70' : 'text-[#E65C31]'}`}>{event.subMessage}</div>}
                    </div>
                </div>
            </div>
        );
    }

    if (event.type === 'SCORE_UPDATE') {
        // Subtle flash or specific animation handled in LiveCard, but we can add a global effect here if needed
        return null; 
    }

    return null;
};

const TournamentList = ({tournaments, onSelect}: any) => {
    const now = new Date();
    const isTournamentPassed = (t: Tournament) => {
        if (t.endDate && new Date(t.endDate) < now) {
            return true;
        }
        return (t.status === 'COMPLETED' || String(t.status).toUpperCase() === 'FINISHED') || t.status === 'RETIRED';
    };

    const liveTournaments = tournaments.filter((t: Tournament) => !isTournamentPassed(t));
    const completedTournaments = tournaments.filter((t: Tournament) => isTournamentPassed(t));

    return (
        <div className="min-h-screen pt-28 md:pt-32 pb-20 px-4">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-5xl mb-8 text-center md:text-left">Spectator Lobby</h1>
                
                {liveTournaments.length > 0 && (
                    <div className="mb-16">
                        <div className="flex items-center gap-3 mb-6 justify-center md:justify-start">
                            <div className="h-3 w-3 bg-[#E65C31] rounded-full animate-ping"></div>
                            <h2 className="text-base md:text-lg opacity-70 tracking-[0.2em]">Live Now</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {liveTournaments.map((t: Tournament) => (
                                <Card key={t.id} variant="panel" className="p-0 w-full hover:border-[#4D78FF] group transition-all overflow-hidden shadow-2xl cursor-pointer bg-[#111111]" onClick={() => onSelect(t.id)}>
                                    <div className="w-full h-36 md:h-44 overflow-hidden relative border-b border-white/5">
                                        {t.bannerUrl ? (
                                            <img src={t.bannerUrl} alt="Tournament Banner" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                        ) : (
                                            <div className="w-full h-full bg-gradient-to-br from-[#0A0A0A] to-[#1A1A1A]"></div>
                                        )}
                                        <div className="absolute top-3 left-3 bg-[#E65C31] text-white px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg">
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div> Live
                                        </div>
                                    </div>
                                    <div className="p-5">
                                        <h3 className="text-base md:text-lg mb-3 transition-colors truncate font-black tracking-[0.15em]">{t.name}</h3>
                                        
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-[#9CA3AF]">
                                                    <MapPin size={12} className="opacity-70 text-[#4D78FF]" /> 
                                                    <span className="text-[10px] font-bold uppercase tracking-widest truncate max-w-[150px]">
                                                        {t.venue || "Global Arena"}
                                                        {t.multipleVenues && t.venueIds && t.venueIds.length > 1 && ` + ${t.venueIds.length - 1} More`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-accent-success">
                                                    <Trophy size={11} className="opacity-80" />
                                                    <span className="text-[10px] font-black tracking-[0.15em] uppercase">
                                                        {t.currency === 'USD' ? '$' : 'Rs'} {(t.prizeMoney || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                                <div className="flex items-center gap-2 text-content-muted">
                                                    <Users size={11} className="opacity-60" />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px]">By {t.organizer || "Matchup Admin"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-brand bg-brand/10 px-2 py-1 rounded-md border border-brand/20">
                                                    <Users size={11} />
                                                    <span className="text-[11px] font-black italic tracking-[0.15em]er">{(t.teams || []).length} TEAMS</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}

                {completedTournaments.length > 0 && (
                    <div>
                        <h2 className="text-base opacity-60 tracking-[0.2em] mb-6 text-center md:text-left">Previous Tournaments</h2>
                        <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 pb-8 custom-scrollbar">
                            {completedTournaments.map((t: Tournament) => (
                                <Card key={t.id} variant="panel" className="shrink-0 w-[280px] md:w-[350px] snap-center p-0 hover:border-white/20 group transition-all overflow-hidden cursor-pointer grayscale hover:grayscale-0 bg-[#0A0A0A]" onClick={() => onSelect(t.id)}>
                                    <div className="w-full h-28 md:h-36 overflow-hidden relative border-b border-white/5">
                                        {t.bannerUrl ? (
                                            <img src={t.bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-surface-elevated"></div>
                                        )}
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                            <span className="bg-black/80 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">Completed</span>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-base opacity-90 mb-2 truncate font-black tracking-[0.15em]">{t.name}</h3>
                                        <div className="flex items-center justify-between gap-4 mb-3">
                                            <div className="flex items-center gap-2 text-content-muted/60">
                                                <MapPin size={10} />
                                                <span className="text-[9px] font-bold uppercase tracking-widest truncate max-w-[120px]">
                                                    {t.venue || 'Global Arena'}
                                                    {t.multipleVenues && t.venueIds && t.venueIds.length > 1 && ` + ${t.venueIds.length - 1}`}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-brand/60 bg-brand/5 px-1.5 py-0.5 rounded border border-brand/10">
                                                <Users size={10} />
                                                <span className="text-[9px] font-black italic">{(t.teams || []).length} TEAMS</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                            <span className="text-[8px] font-bold text-content-muted/40 uppercase tracking-widest">
                                                Org: {t.organizer || "Admin"}
                                            </span>
                                            <div className="flex items-center gap-1 text-accent-success/50">
                                                <Trophy size={10} />
                                                <span className="text-[9px] font-black">
                                                    {t.currency === 'USD' ? '$' : 'Rs'} {(t.prizeMoney || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                        <style>{`
                            .custom-scrollbar::-webkit-scrollbar {
                                height: 6px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: rgba(255,255,255,0.02);
                                border-radius: 4px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: rgba(255,255,255,0.1);
                                border-radius: 4px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: rgba(255,255,255,0.2);
                            }
                        `}</style>
                    </div>
                )}
            </div>
        </div>
    );
};

const LiveCard = ({ match: initialMatch, teams, sponsors, tournament }: any) => {
    // Phase 1 Real-time pattern: Subscribe to single global match doc
    const { matchData } = useLiveMatch(initialMatch.tournamentId, initialMatch.id);
    const match = matchData || initialMatch;

    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);

    // Pick a random premium sponsor to display on this card if available
    const featuredSponsor = sponsors && sponsors.length > 0 ? sponsors[Math.floor(Math.random() * sponsors.length)] : null;

    const [displayScore, setDisplayScore] = useState(match.score);
    const [flashOverlayTitle, setFlashOverlayTitle] = useState<string | null>(null);
    const [flashOverlaySubtitle, setFlashOverlaySubtitle] = useState<string | null>(null);
    const [lastHistoryLength, setLastHistoryLength] = useState(0);

    const effectiveHistory = getEffectiveEvents(match.score?.history || []);

    useEffect(() => {
        const isFinished = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED';
        if (isFinished) {
            setDisplayScore(match.score);
            return;
        }
        
        if (effectiveHistory.length > lastHistoryLength && lastHistoryLength > 0) {
            // New point added!
            const ev = effectiveHistory[effectiveHistory.length - 1];
            if (ev && (ev.startsWith('T1') || ev.startsWith('T2'))) {
                const parts = ev.split('|');
                const type = parts[0];
                const playerIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4];
                
                const team = type === 'T1' ? t1 : t2;
                const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
                const teamName = team?.name || type;
                let actionStr = "POINT WON";
                if (finisher === 'smash') actionStr = "SMASH WINNER";
                else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
                else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
                else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
                else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
                else if (finisher === 'net') actionStr = "NET ERROR";
                else if (finisher === 'glass') actionStr = "GLASS ERROR";
                else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
                else if (finisher === 'grill') actionStr = "GRILL ERROR";
                else if (tag === 'winner') actionStr = "WINNER";
                else if (tag === 'error') actionStr = "UNFORCED ERROR";
                
                setFlashOverlayTitle(actionStr);
                setFlashOverlaySubtitle(player || teamName);
                
                setTimeout(() => {
                    setFlashOverlayTitle(null);
                    setDisplayScore(match.score);
                }, 2000);
            } else {
                setDisplayScore(match.score);
            }
        } else {
            // Init or undo
            setDisplayScore(match.score);
        }
        setLastHistoryLength(effectiveHistory.length);
    }, [match.score, effectiveHistory.length]);

    const defaultScore = {
        p1Points: "0",
        p2Points: "0",
        p1Games: 0,
        p2Games: 0,
        p1Sets: 0,
        p2Sets: 0,
        p1SetScores: [] as number[],
        p2SetScores: [] as number[],
        currentSet: 1,
        isTiebreak: false,
        history: [] as string[],
        server: null,
        goldenPoint: false,
        _isSuperTiebreak: false,
    };
    const activeScore = displayScore || match.score || defaultScore;

    // Score Update Animation
    const [scoreFlash, setScoreFlash] = useState(false);
    useEffect(() => {
        if (match.activeBroadcastEvent?.type === 'SCORE_UPDATE') {
            const now = Date.now();
            if (now - match.activeBroadcastEvent.timestamp < 2000) {
                setScoreFlash(true);
                const t = setTimeout(() => setScoreFlash(false), 500);
                return () => clearTimeout(t);
            }
        }
    }, [match.activeBroadcastEvent]);

    const isT1Serving = activeScore?.server === 'p1' || activeScore?.server === 'p2';
    const isT2Serving = activeScore?.server === 'p3' || activeScore?.server === 'p4';
    const isTiebreak = activeScore?.isTiebreak;
    const isSuperTiebreak = activeScore?._isSuperTiebreak;
    const isStarPoint = activeScore?.goldenPoint;

    const recentEvents = effectiveHistory
        .filter((ev: string) => ev.startsWith('T1') || ev.startsWith('T2'))
        .slice(-3)
        .reverse()
        .map((ev: string) => {
            const parts = ev.split('|');
            const type = parts[0];
            const playerIdx = parseInt(parts[2] || "1");
            const tag = parts[3];
            const finisher = parts[4];
            
            const team = type === 'T1' ? t1 : t2;
            const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
            const teamName = team?.name || type;
            let actionStr = "Point Won";
            if (finisher === 'smash') actionStr = "SMASH WINNER";
            else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
            else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
            else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
            else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
            else if (finisher === 'net') actionStr = "NET ERROR";
            else if (finisher === 'glass') actionStr = "GLASS ERROR";
            else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
            else if (finisher === 'grill') actionStr = "GRILL ERROR";
            else if (tag === 'winner') actionStr = "WINNER";
            else if (tag === 'error') actionStr = "UNFORCED ERROR";
            
            return `${player || teamName} - ${actionStr}`;
        });

    // Determine state priority: Star Point > Super Tiebreak > Tiebreak > Normal
    const state = isStarPoint ? 'STAR_POINT' : isSuperTiebreak ? 'SUPER_TIEBREAK' : isTiebreak ? 'TIEBREAK' : 'NORMAL';

    let cardClasses = "";
    let glowClasses = "";
    let svgStrokes = "";
    let statusText = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') ? 'COMPLETED' : match.roundName || 'FINAL';
    let uiColor = { primary: '#00E5FF', bg: '#0D1520', stroke: 'rgba(0,229,255,' };
    
    switch (state) {
        case 'STAR_POINT':
            cardClasses = "bg-gradient-to-br from-[#1F1705] to-[#2B2005] border-[1.5px] border-[#FBBF24]/60 animate-[starPointShimmer_2s_linear_infinite]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.3)_0%,transparent_65%)] animate-[glowPulseFast_1s_ease-in-out_infinite]";
            svgStrokes = "rgba(251,191,36,";
            statusText = "★ STAR POINT";
            uiColor = { primary: '#FBBF24', bg: '#1F1705', stroke: 'rgba(251,191,36,' };
            break;
        case 'SUPER_TIEBREAK':
            cardClasses = "bg-gradient-to-br from-[#1F0A0A] to-[#2B0A0A] border-[1.5px] border-[#EF4444]/60 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.3)_0%,transparent_65%)] animate-[superPulse_0.8s_ease-in-out_infinite]";
            svgStrokes = "rgba(239,68,68,";
            statusText = "SUPER TIEBREAK";
            uiColor = { primary: '#EF4444', bg: '#1F0A0A', stroke: 'rgba(239,68,68,' };
            break;
        case 'TIEBREAK':
            // Brand color is orange #E65C31
            cardClasses = "bg-[#1A0A05] border border-[#E65C31]/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(230,92,49,0.03)_10px,rgba(230,92,49,0.03)_20px)] animate-[panBackground_20s_linear_infinite]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(230,92,49,0.25)_0%,transparent_65%)] animate-[glowPulse_1.5s_ease-in-out_infinite]";
            svgStrokes = "rgba(230,92,49,";
            statusText = "TIEBREAK";
            uiColor = { primary: '#E65C31', bg: '#1A0A05', stroke: 'rgba(230,92,49,' };
            break;
        default:
            cardClasses = "bg-[#0D1520] border-white/[0.07]";
            glowClasses = "bg-[radial-gradient(ellipse_at_center,rgba(0,229,255,0.15)_0%,transparent_65%)] animate-[glowPulse_3s_ease-in-out_infinite]";
            svgStrokes = "rgba(0,229,255,";
            uiColor = { primary: '#00E5FF', bg: '#0D1520', stroke: 'rgba(0,229,255,' };
            break;
    }

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1P1Name = getFirstName(t1?.player1?.name);
    const t1P2Name = getFirstName(t1?.player2?.name);
    const t2P1Name = getFirstName(t2?.player1?.name);
    const t2P2Name = getFirstName(t2?.player2?.name);

    const t1DisplayName = [t1P1Name, t1P2Name].filter(Boolean).join(' & ') || t1?.name || match.team1Name || 'TBA';
    const t2DisplayName = [t2P1Name, t2P2Name].filter(Boolean).join(' & ') || t2?.name || match.team2Name || 'TBA';

    return (
        <div className={`w-full max-w-[520px] mx-auto rounded-[16px] overflow-hidden relative p-[24px_24px_24px_26px] font-sans group transition-all duration-300 ${cardClasses} ${scoreFlash ? 'scale-[1.02]' : ''}`}>
            {flashOverlayTitle && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none p-4 w-full h-full bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`relative w-full w-max-[100%] px-4 sm:px-6 py-4 sm:py-6 rounded-2xl sm:rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center overflow-hidden animate-in zoom-in-75 duration-300
                        ${flashOverlayTitle.includes('ERROR') || flashOverlayTitle.includes('FAULT') ? 'bg-gradient-to-br from-[#c2411e] via-[#E65C31] to-[#c2411e] border-b-4 border-[#ff7a52]' : 'bg-gradient-to-br from-[#2b5ae6] via-[#4D78FF] to-[#2b5ae6] border-b-4 border-[#7b9dff]'}`}>
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[bg-pan_3s_linear_infinite]"></div>
                        <span className="font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs text-white/90 mb-1 z-10 drop-shadow-md text-center">{flashOverlaySubtitle}</span>
                        <span className="font-black text-white italic text-3xl sm:text-4xl leading-tight tracking-[0.15em]er uppercase z-10 drop-shadow-lg text-center break-words max-w-full px-2">
                           {flashOverlayTitle}
                        </span>
                    </div>
                </div>
            )}
            {match.activeBroadcastEvent && (
                <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <BroadcastOverlay event={match.activeBroadcastEvent} />
                </div>
            )}

            {/* Court grid lines */}
            <svg className="absolute top-0 right-0 w-[55%] h-full opacity-[0.12] pointer-events-none" viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="10" y="10" width="280" height="180" stroke="white" strokeWidth="1.5"/>
                <line x1="150" y1="10" x2="150" y2="190" stroke="white" strokeWidth="1"/>
                <line x1="10" y1="65"  x2="290" y2="65"  stroke="white" strokeWidth="0.7"/>
                <line x1="10" y1="135" x2="290" y2="135" stroke="white" strokeWidth="0.7"/>
                <line x1="55"  y1="10" x2="55"  y2="190" stroke="white" strokeWidth="0.7"/>
                <line x1="245" y1="10" x2="245" y2="190" stroke="white" strokeWidth="0.7"/>
                <circle cx="150" cy="100" r="22" stroke="white" strokeWidth="1"/>
                <line x1="10" y1="100" x2="290" y2="100" stroke="white" strokeWidth="2"/>
            </svg>

            {/* Glow */}
            <div className={`absolute -top-[60px] -right-[40px] w-[220px] h-[220px] pointer-events-none ${glowClasses}`}></div>

            {/* Live Tag */}
            <div className={`inline-flex items-center gap-[7px] px-[13px] py-[5px] rounded-full font-sans text-[11px] font-bold tracking-[2.5px] uppercase mb-[18px] w-fit relative z-10 ${
                state === 'NORMAL' ? 'bg-[#FF3246]/15 border border-[#FF3246]/40 text-[#FF3D57]' :
                `bg-[${uiColor.primary}]/15 border border-[${uiColor.primary}]/40 text-[${uiColor.primary}]`
            }`} style={{ color: state !== 'NORMAL' ? uiColor.primary : undefined, borderColor: state !== 'NORMAL' ? `${uiColor.primary}80` : undefined, backgroundColor: state !== 'NORMAL' ? `${uiColor.primary}25` : undefined }}>
                <div className={`w-[6px] h-[6px] rounded-full shrink-0 animate-[blink_1s_ease-in-out_infinite]`} style={{ backgroundColor: state !== 'NORMAL' ? uiColor.primary : '#FF3D57' }}></div>
                {state !== 'NORMAL' ? 'LIVE • ' : ''}{statusText}
            </div>

            {/* Match Title & Serve Indicators */}
            <div className="font-display text-[34px] tracking-[1.5px] leading-[1.0] text-[#EDF1F7] uppercase mb-[10px] relative z-10 max-w-[58%]">
                <div className="flex items-center gap-2">
                    {t1DisplayName} 
                    {isT1Serving && <div className="w-2.5 h-2.5 rounded-full bg-[#E65C31] shadow-[0_0_8px_#E65C31] animate-pulse" title="Serving" />}
                </div>
                <span className="text-[20px] text-[#6B7A8D] mx-1">vs</span><br/>
                <div className="flex items-center gap-2">
                    {t2DisplayName}
                    {isT2Serving && <div className="w-2.5 h-2.5 rounded-full bg-[#E65C31] shadow-[0_0_8px_#E65C31] animate-pulse" title="Serving" />}
                </div>
            </div>

            {/* Venue */}
            <div className="flex items-center gap-[6px] text-[12px] text-[#6B7A8D] font-normal mb-[20px] relative z-10 w-full truncate">
                <span className="text-[13px] shrink-0">🏟</span>
                <span className="truncate">{tournament?.name || match.tournamentName || 'Tournament'} • {tournament?.venue || 'Venue TBD'}</span>
            </div>

            {/* Score Row */}
            <div className="relative w-full">
                <div className={`flex items-center gap-[12px] relative z-10 flex-wrap transition-all duration-300 ${flashOverlayTitle ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                    <div className={`w-[52px] h-[52px] rounded-[10px] flex items-center justify-center font-display text-[32px] tracking-[1px] leading-none transition-transform duration-200 ${scoreFlash && activeScore.p1Points !== '0' ? 'scale-[1.18]' : ''}`}
                         style={{ ...{
                             backgroundColor: activeScore.p1Games >= activeScore.p2Games ? `${uiColor.stroke}0.12)` : 'rgba(255,255,255,0.05)',
                             borderColor: activeScore.p1Games >= activeScore.p2Games ? `${uiColor.stroke}0.3)` : 'rgba(255,255,255,0.1)',
                             borderWidth: '1.5px',
                             color: activeScore.p1Games >= activeScore.p2Games ? uiColor.primary : '#8A9AB0'
                         }} }>
                        {activeScore.p1Points === "0" ? "00" : activeScore.p1Points}
                    </div>
                    <div className="font-display text-[22px] text-[#3A4A5A] tracking-normal mb-1">—</div>
                    <div className={`w-[52px] h-[52px] rounded-[10px] flex items-center justify-center font-display text-[32px] tracking-[1px] leading-none transition-transform duration-200 ${scoreFlash && activeScore.p2Points !== '0' ? 'scale-[1.18]' : ''}`}
                         style={{ ...{
                            backgroundColor: activeScore.p2Games >= activeScore.p1Games ? `${uiColor.stroke}0.12)` : 'rgba(255,255,255,0.05)',
                            borderColor: activeScore.p2Games >= activeScore.p1Games ? `${uiColor.stroke}0.3)` : 'rgba(255,255,255,0.1)',
                            borderWidth: '1.5px',
                            color: activeScore.p2Games >= activeScore.p1Games ? uiColor.primary : '#8A9AB0'
                        }} }>
                        {activeScore.p2Points === "0" ? "00" : activeScore.p2Points}
                    </div>
                    
                    <div className="flex items-center gap-[12px] ml-2">
                        <div className="flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold tracking-widest text-[#6B7A8D] uppercase mb-1">Gms</span>
                            <div className="font-display text-[20px] text-white leading-none bg-[#1A2533] px-3 py-1 rounded">
                                {activeScore.p1Games} - {activeScore.p2Games}
                            </div>
                        </div>
                        {(activeScore.p1SetScores?.length > 0) && (
                            <div className="flex gap-1 ml-1 opacity-70">
                                {activeScore.p1SetScores.map((s: number, i: number) => (
                                    <div key={i} className="flex flex-col items-center justify-center border-l border-white/5 pl-2 ml-1">
                                        <span className="text-[9px] font-bold tracking-widest text-[#4A5A6A] uppercase mb-1">S{i+1}</span>
                                        <span className="font-display text-[16px] text-[#8A9AB0] leading-none">
                                            {s}-{activeScore.p2SetScores[i]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Racket SVG */}
            <div className={`absolute right-[20px] top-1/2 -translate-y-1/2 z-20 hidden sm:block ${state === 'NORMAL' ? 'animate-[racketFloat_5s_ease-in-out_infinite]' : 'animate-[intenseShake_0.5s_ease-in-out_infinite]'}`}>
                <svg width="110" height="150" viewBox="0 0 110 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="49" y="118" width="13" height="30" rx="4" fill="#111D2A" opacity="0.95"/>
                    <rect x="51" y="121" width="9" height="3" rx="1.5" fill="rgba(255,255,255,0.12)"/>
                    <rect x="51" y="127" width="9" height="3" rx="1.5" fill="rgba(255,255,255,0.12)"/>
                    <rect x="51" y="133" width="9" height="3" rx="1.5" fill="rgba(255,255,255,0.12)"/>
                    <rect x="51" y="139" width="9" height="3" rx="1.5" fill="rgba(255,255,255,0.12)"/>
                    <path d="M43 115 L49 100 L61 100 L67 115 Z" fill={`${uiColor.stroke}0.55)`}/>
                    <ellipse cx="55" cy="56" rx="42" ry="52" fill={uiColor.bg} stroke={uiColor.primary} strokeWidth="2.5"/>
                    <ellipse cx="55" cy="56" rx="34" ry="44" fill="none" stroke={`${uiColor.stroke}0.25)`} strokeWidth="1.2"/>
                    <line x1="18" y1="22" x2="92" y2="22" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="14" y1="32" x2="96" y2="32" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="13" y1="42" x2="97" y2="42" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="13" y1="52" x2="97" y2="52" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="13" y1="62" x2="97" y2="62" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="13" y1="72" x2="97" y2="72" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="14" y1="82" x2="96" y2="82" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="18" y1="92" x2="92" y2="92" stroke={`${uiColor.stroke}0.4)`} strokeWidth="0.8"/>
                    <line x1="28" y1="8"  x2="28" y2="103" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="37" y1="5"  x2="37" y2="104" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="46" y1="4"  x2="46" y2="105" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="55" y1="4"  x2="55" y2="105" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="64" y1="4"  x2="64" y2="105" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="73" y1="5"  x2="73" y2="104" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <line x1="82" y1="8"  x2="82" y2="103" stroke={`${uiColor.stroke}0.3)`} strokeWidth="0.8"/>
                    <circle cx="42" cy="44" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="55" cy="40" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="68" cy="44" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="48" cy="57" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="62" cy="57" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="55" cy="70" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="42" cy="70" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <circle cx="68" cy="70" r="4" fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.1)" strokeWidth="0.6"/>
                    <ellipse cx="36" cy="36" rx="12" ry="18" fill="url(#glare_1)" opacity="0.25" transform="rotate(-15 36 36)"/>
                    <defs>
                        <radialGradient id="glare_1" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="white"/>
                        <stop offset="100%" stopColor="white" stopOpacity="0"/>
                        </radialGradient>
                    </defs>
                </svg>
            </div>

            {featuredSponsor && (
                <div className="absolute top-[24px] right-[26px] z-30 opacity-40 hover:opacity-100 transition-opacity">
                    <img src={featuredSponsor.logo} className="h-6 object-contain" />
                </div>
            )}
            
            {/* Bottom Ticker/Highlights */}
            {recentEvents.length > 0 && (
                <div className="mt-5 pt-3 border-t border-white/5 relative z-10 w-full overflow-hidden opacity-90">
                    <div className="flex items-center gap-3 w-full">
                        <span className="text-[9px] md:text-[10px] font-black uppercase text-[#E65C31] tracking-[0.2em] shrink-0">Live Flash</span>
                        <div className="flex-1 overflow-hidden relative fade-edges">
                             <div className="flex animate-marquee whitespace-nowrap items-center text-[10px] md:text-[11px] font-black italic uppercase text-white/50 tracking-widest w-[200%]">
                                <div className="flex shrink-0">
                                   {recentEvents.map((evt: string, j: number) => (
                                        <React.Fragment key={`orig-${j}`}>
                                            <span className="mx-6 text-white opacity-90">{evt}</span>
                                            <span className="w-1 h-1 bg-[#4D78FF] rounded-full"></span>
                                        </React.Fragment>
                                   ))}
                                </div>
                                <div className="flex shrink-0">
                                   {recentEvents.map((evt: string, j: number) => (
                                        <React.Fragment key={`clone-${j}`}>
                                            <span className="mx-6 text-white opacity-90">{evt}</span>
                                            <span className="w-1 h-1 bg-[#4D78FF] rounded-full"></span>
                                        </React.Fragment>
                                   ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
            
            <style>{`
                @keyframes glowPulse {
                    0%,100% { opacity: 0.7; transform: scale(1); }
                    50%      { opacity: 1;   transform: scale(1.08); }
                }
                @keyframes glowPulseFast {
                    0%,100% { opacity: 0.8; transform: scale(1); }
                    50%      { opacity: 1;   transform: scale(1.15); }
                }
                @keyframes superPulse {
                    0%,100% { box-shadow: inset 0 0 20px rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); }
                    50%      { box-shadow: inset 0 0 60px rgba(239,68,68,0.6); border-color: rgba(239,68,68,1); }
                }
                @keyframes starPointShimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                @keyframes panBackground {
                    from { background-position: 0 0; }
                    to { background-position: 100% 100%; }
                }
                @keyframes intenseShake {
                    0%, 100% { transform: translateY(-50%) rotate(-5deg); }
                    25% { transform: translateY(calc(-50% - 2px)) rotate(-4deg); }
                    75% { transform: translateY(calc(-50% + 2px)) rotate(-6deg); }
                }
                @keyframes blink {
                    0%,100% { opacity: 1; }
                    50%      { opacity: 0.2; }
                }
                @keyframes racketFloat {
                    0%,100% { transform: translateY(-50%) rotate(-5deg); }
                    50%      { transform: translateY(calc(-50% - 8px)) rotate(-3deg); }
                }
            `}</style>
        </div>
    )
};

const MatchTimelinesList = ({ matches, teams }: { matches: Match[], teams: Team[] }) => {
    const [selectedCourt, setSelectedCourt] = useState<string>('ALL');

    const courts = Array.from(new Set(matches.map(m => m.court)));

    const filteredMatches = selectedCourt === 'ALL' ? matches : matches.filter(m => m.court === selectedCourt);

    const allHistory: any[] = [];
    filteredMatches.forEach(m => {
        if (m.score?.history) {
            const effectiveSet = new Set(getEffectiveEvents(m.score.history));
            const startTimeEvent = m.score.history.find(e => e.includes('|'));
            const startTime = startTimeEvent ? parseInt(startTimeEvent.split('|')[1] || "0") : 0;
            const t1 = teams.find(t => t.id === m.team1Id);
            const t2 = teams.find(t => t.id === m.team2Id);

            m.score.history.forEach((ev, idx) => {
                const parts = ev.split('|');
                const type = parts[0];
                const ts = parseInt(parts[1] || "0");
                const playerIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4]; // NEW

                if (type === 'UNDO' || type === 'REMOVE') return;

                let message = "";
                let teamName = "";
                const isUndone = !effectiveSet.has(ev);

                if (type === 'START_SET_NORMAL' || type === 'START_SET_SUPER') {
                    message = `Set begins`;
                } else if (type === 'T1' || type === 'T2') {
                    const team = type === 'T1' ? t1 : t2;
                    const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
                    teamName = team?.name || type;
                    let actionStr = "Point won";
                    if (finisher === 'smash') {
                        actionStr = "Smashed";
                    } else if (tag === 'winner') {
                        actionStr = "Winner";
                    } else if (tag === 'error') {
                        actionStr = "Unforced error";
                    }
                    message = `${actionStr} by ${player || teamName}`;
                } else {
                    return;
                }

                allHistory.push({
                    id: `${m.id}-${idx}-${ts}`,
                    ts,
                    startTime,
                    court: m.court,
                    message,
                    isUndone,
                    type,
                    tag
                });
            });
        }
    });

    allHistory.sort((a, b) => b.ts - a.ts);

    const formatTime = (ts: number, startTime: number) => {
        if (!startTime || !ts) return "00:00";
        let diff = Math.floor((ts - startTime) / 1000);
        if (diff < 0) diff = 0;
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 p-6">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white tracking-[0.15em]">Action Log</h3>
                <div className="relative w-40">
                    <select 
                        value={selectedCourt}
                        onChange={(e) => setSelectedCourt(e.target.value)}
                        className="w-full appearance-none bg-[#111111] border border-white/10 text-white text-[10px] md:text-xs font-black uppercase tracking-wider py-2 pl-4 pr-10 rounded-xl outline-none focus:border-[#4D78FF] cursor-pointer"
                    >
                        <option value="ALL">All Courts</option>
                        {courts.map((c, i) => (
                            <option key={i} value={c}>{c}</option>
                        ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
                </div>
            </div>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {allHistory.length === 0 ? (
                    <div className="text-center text-[#9CA3AF] py-10 font-bold uppercase tracking-widest text-xs">No events recorded yet.</div>
                ) : (
                    allHistory.map(item => (
                        <div key={item.id} className={`flex items-start gap-4 p-4 rounded-xl border ${item.isUndone ? 'bg-red-500/10 border-red-500/20 opacity-60' : 'bg-[#111111] border-white/5 hover:border-white/10'}`}>
                            <div className={`text-sm font-bold w-12 pt-0.5 font-mono ${item.isUndone ? 'text-red-400/50 line-through' : 'text-[#4D78FF]'}`}>
                                {formatTime(item.ts, item.startTime)}
                            </div>
                            <div className="flex-1">
                                <div className="text-[10px] text-[#9CA3AF] font-black uppercase tracking-widest mb-1">{item.court}</div>
                                <p className={`text-sm font-bold ${item.isUndone ? 'text-content-muted line-through' : 'text-white'}`}>{item.message}</p>
                                {item.isUndone && <p className="text-[10px] text-red-400 font-bold mt-1 uppercase tracking-widest">Score Undone</p>}
                            </div>
                            {!item.isUndone && (
                                <div className="shrink-0 h-8 w-8 rounded-full bg-[#0A0A0A] flex items-center justify-center border border-white/10">
                                    {item.type.startsWith('START') ? <Timer size={14} className="text-[#9CA3AF]" /> : 
                                     item.tag?.toUpperCase() === 'ERROR' ? <X size={14} className="text-[#E65C31]" /> :
                                     <Trophy size={14} className="text-[#4D78FF]" />}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.02);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    );
};

const RecentMatchSummary = ({ match, teams }: any) => {
    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);
    const isT1Winner = match.winnerTeamId === t1?.id;

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1DisplayName = [getFirstName(t1?.player1?.name), getFirstName(t1?.player2?.name)].filter(Boolean).join(' & ') || t1?.name || match.team1Name || 'TBA';
    const t2DisplayName = [getFirstName(t2?.player1?.name), getFirstName(t2?.player2?.name)].filter(Boolean).join(' & ') || t2?.name || match.team2Name || 'TBA';

    const isAmericanoMatch = match.roundName?.toLowerCase().includes("americano") || (match.score && (match.score.americanoTargetPoints !== undefined || match.score.americanoMode !== undefined));

    return (
        <Card variant="panel" className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 flex-1">
                <div className="flex flex-col items-center min-w-[80px]">
                    <div className={`text-2xl font-black ${isT1Winner ? 'text-[#E65C31]' : 'text-content-muted'}`}>{isT1Winner ? 'WIN' : 'LOST'}</div>
                    <div className="text-xs text-content-muted font-bold uppercase tracking-widest">{match.roundName}</div>
                </div>
                <div>
                    <div className={`text-xl font-black ${isT1Winner ? 'text-white' : 'text-content-muted'}`}>{t1DisplayName}</div>
                    <div className="text-xs text-content-muted font-bold uppercase">vs</div>
                    <div className={`text-xl font-black ${!isT1Winner ? 'text-white' : 'text-content-muted'}`}>{t2DisplayName}</div>
                </div>
            </div>

            <div className="flex gap-4 items-center">
                <div className="flex gap-2">
                    {match.score.p1SetScores.map((s: number, i: number) => (
                        <div key={i} className="flex flex-col items-center bg-black/30 rounded-xl px-4 py-3 border border-white/5">
                            <span className="text-[10px] text-content-muted font-black mb-1">{isAmericanoMatch ? 'PTS' : `S${i+1}`}</span>
                            <div className="flex flex-col text-lg font-black leading-tight font-mono">
                                <span className={s > match.score.p2SetScores[i] ? 'text-white' : 'text-content-muted'}>{s}</span>
                                <span className={match.score.p2SetScores[i] > s ? 'text-white' : 'text-content-muted'}>{match.score.p2SetScores[i]}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="bg-brand/10 text-brand p-4 rounded-2xl border border-brand/20">
                    <Award size={32} />
                </div>
            </div>
        </Card>
    );
};



const StandingsTable = ({ tournamentId, categoryId, initialTeams, onTeamSelect, tournament, matches = [] }: { tournamentId: string, categoryId: string | null, initialTeams: any[], onTeamSelect?: (team: any) => void, tournament?: any, matches?: any[] }) => {
    const filterAccepted = (teams: any[]) => {
        return (teams || []).filter((t: any) => t.status === 'ACCEPTED' || t.status === 'accepted');
    };

    const [standings, setStandings] = useState<any[]>(filterAccepted(initialTeams));

    const activeCategoryObj = tournament?.categories?.find((c: any) => c.id === categoryId);
    const categoryName = activeCategoryObj?.name || '';

    useEffect(() => {
        if (!tournamentId) return;
        const unsub = subscribeToStandings(tournamentId, categoryId, (data) => {
            if (data && data.length > 0) {
                setStandings(filterAccepted(data));
            } else {
                setStandings([]);
            }
        });
        return () => unsub();
    }, [tournamentId, categoryId]);

    const groups = standings.reduce((acc: any, team: any) => {
        const gid = team.groupId || 'A';
        if (!acc[gid]) acc[gid] = [];
        acc[gid].push(team);
        return acc;
    }, {});

    const groupKeys = Object.keys(groups).sort();
    const isAmericano = tournament?.format === 'AMERICANO' || tournament?.format === 'MEXICANO';

    return (
        <div className="space-y-8 w-full max-w-full">
            {groupKeys.map(gId => (
                <div key={gId} className="animate-in slide-in-from-right duration-700 w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white/[0.02] p-3 rounded-2xl border border-white/5">
                        <h3 className="text-[#4D78FF] font-black text-sm uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#4D78FF] animate-pulse" />
                            {isAmericano ? "LEADERBOARD" : `GROUP ${gId} STANDINGS`}
                        </h3>
                    </div>
                    <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden w-full">
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left font-mono min-w-[700px]">
                                <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                    <tr>
                                        <th className="px-4 md:px-6 py-4 text-left">TEAM</th>
                                        <th className="px-2 md:px-4 py-4 text-center" title="Matches Won">M.W</th>
                                        <th className="px-2 md:px-4 py-4 text-center" title="Matches Lost">M.L</th>
                                        <th className="px-2 md:px-4 py-4 text-center" title="Games Won">G.W</th>
                                        <th className="px-2 md:px-4 py-4 text-center" title="Games Lost">G.L</th>
                                        <th className="px-4 md:px-6 py-4 text-center text-[#4D78FF]" title="Game Win Percentage">GWP</th>
                                        <th className="px-4 md:px-6 py-4 text-right text-[#4D78FF]" title="Points">PTS</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {(groups[gId] || []).sort((a: any, b: any) => {
                                        // 1st rule: Points (PTS) descending (highest first)
                                        const ptsA = a.points || 0;
                                        const ptsB = b.points || 0;
                                        if (ptsB !== ptsA) {
                                            return ptsB - ptsA;
                                        }
                                        
                                        // 2nd rule: Game Win Percentage (GWP) descending (highest first)
                                        const gwpA = a.gwp || 0;
                                        const gwpB = b.gwp || 0;
                                        if (gwpB !== gwpA) {
                                            return gwpB - gwpA;
                                        }

                                        // 3rd flow: Matches Won (Wins) descending
                                        const winsA = a.wins || 0;
                                        const winsB = b.wins || 0;
                                        if (winsB !== winsA) {
                                            return winsB - winsA;
                                        }

                                        // 4th flow: Games Won (GW) descending
                                        const gwA = a.gamesWon || 0;
                                        const gwB = b.gamesWon || 0;
                                        if (gwB !== gwA) {
                                            return gwB - gwA;
                                        }

                                        // Fallback: Games Lost (GL) ascending (fewer games lost is better)
                                        const glA = a.gamesLost || 0;
                                        const glB = b.gamesLost || 0;
                                        return glA - glB;
                                    }).map((s: any, i: number) => {
                                        const isTop2 = i < 2;
                                        return (
                                            <tr 
                                                key={s.id} 
                                                onClick={() => onTeamSelect && onTeamSelect(s)}
                                                className={`hover:bg-white/[0.03] transition-colors group ${onTeamSelect ? 'cursor-pointer' : ''}`}
                                            >
                                                <td className="px-4 md:px-6 py-4 flex items-center gap-3 md:gap-4 relative">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isTop2 ? 'bg-[#4D78FF] text-white' : 'bg-white/10 text-gray-400'}`}>
                                                        {i + 1}
                                                    </span>
                                                    <span className="font-black tracking-[0.15em] text-sm md:text-base truncate max-w-[180px] sm:max-w-[260px] md:max-w-none text-white">
                                                        {s.name || 'TBA'}
                                                    </span>
                                                    {onTeamSelect && <ChevronRight size={16} className="text-[#9CA3AF] opacity-50 group-hover:translate-x-1 group-hover:opacity-100 group-hover:text-white transition-all shrink-0 ml-1" />}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#10B981] font-bold text-sm">
                                                    {s.wins || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#EF4444] font-bold text-sm">
                                                    {s.losses || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#8A9AB0] text-sm font-medium">
                                                    {s.gamesWon || 0}
                                                </td>
                                                <td className="px-2 md:px-4 py-4 text-center text-[#8A9AB0] text-sm font-medium">
                                                    {s.gamesLost || 0}
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-center text-white text-sm font-semibold">
                                                    {(s.gwp || 0).toFixed(1)}%
                                                </td>
                                                <td className="px-4 md:px-6 py-4 text-right text-[#4D78FF] font-black text-base md:text-lg">
                                                    {s.points || 0}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            ))}

        </div>
    );
};

const ScheduleRow = ({ match, teams }: any) => {
    const t1Obj = teams.find((t: any) => t.id === match.team1Id);
    const t2Obj = teams.find((t: any) => t.id === match.team2Id);
    
    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1DisplayName = [getFirstName(t1Obj?.player1?.name), getFirstName(t1Obj?.player2?.name)].filter(Boolean).join(' & ') || t1Obj?.name || match.team1Name || 'TBD';
    const t2DisplayName = [getFirstName(t2Obj?.player1?.name), getFirstName(t2Obj?.player2?.name)].filter(Boolean).join(' & ') || t2Obj?.name || match.team2Name || 'TBD';

    return (
        <Card variant="panel" className="p-6 flex justify-between items-center hover:bg-white/[0.02] transition-colors group">
            <div className="flex items-center gap-6">
                <div className="h-12 w-12 rounded-xl bg-black/20 flex flex-col items-center justify-center border border-white/5">
                    <span className="text-[10px] text-content-muted font-black uppercase">Start</span>
                    <span className="text-white font-black text-sm">{formatTimeOnly(match.scheduledTime)}</span>
                </div>
                <div>
                    <div className="text-accent-info text-[10px] font-black uppercase mb-1 tracking-wider">{match.roundName}</div>
                    <div className="text-white font-black text-lg group-hover:text-accent-info-light transition-colors">
                        {t1DisplayName} <span className="text-content-muted text-sm px-2 font-normal italic">vs</span> {t2DisplayName}
                    </div>
                </div>
            </div>
            <div className="text-right">
                <div className="bg-accent-info/10 text-accent-info px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-accent-info/20">
                    {match.court}
                </div>
            </div>
        </Card>
    )
};

const BroadcastMode = ({ tournament, onClose }: { tournament: Tournament, onClose: () => void }) => {
    const { matches: globalMatches } = useTournamentMatches(tournament.id);
    const [selectedMatchId, setSelectedMatchId] = useState<string | 'ALL'>('ALL');
    const liveMatches = globalMatches.filter(m => 
        (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'LIVE') && 
        !m.winnerTeamId
    );
    
    // Realtime Watchers Simulation
    const baseWatchers = Math.max(800, (liveMatches.length * 400) + Math.floor(Math.random() * 500));
    const [watchers, setWatchers] = useState(baseWatchers);

    useEffect(() => {
        const interval = setInterval(() => {
            setWatchers(prev => {
                const shift = Math.floor(Math.random() * 7) - 3; // -3 to +3
                return Math.max(10, prev + shift);
            });
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    // Auto-select 'ALL' if no matches, else respect user choice or default to 'ALL'
    useEffect(() => {
        if (!selectedMatchId && liveMatches.length > 0) {
            setSelectedMatchId('ALL');
        }
    }, [liveMatches, selectedMatchId]);

    const activeMatch = selectedMatchId !== 'ALL' ? liveMatches.find(m => m.id === selectedMatchId) : null;
    const t1 = activeMatch ? tournament.teams.find(t => t.id === activeMatch.team1Id) : null;
    const t2 = activeMatch ? tournament.teams.find(t => t.id === activeMatch.team2Id) : null;

    return createPortal(
        <div className="fixed inset-0 z-[11000] bg-[#020617] text-white flex flex-col font-sans selection:bg-brand/30">
            {/* Top Bar */}
            <div className="h-16 md:h-24 border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 shrink-0 relative z-50">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                    >
                        <X size={20} className="text-content-muted group-hover:text-white" />
                    </button>
                    <div className="h-8 w-px bg-white/10 hidden sm:block" />
                    <div className="hidden sm:block">
                        <div className="text-[10px] font-black text-brand tracking-[0.2em] uppercase mb-0.5 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                           Live Multi-Court Broadcast
                        </div>
                        <h1 className="text-lg font-black italic tracking-[0.15em] truncate max-w-[200px] md:max-w-md">{tournament.name}</h1>
                    </div>
                </div>

                {/* Match Selector (Tabs instead of Dropdown for TV accessibility) */}
                <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto py-1.5 px-2 bg-white/5 border border-white/10 rounded-2xl mx-4 max-w-lg z-50">
                    <button
                        onClick={() => setSelectedMatchId('ALL')}
                        className={`px-3.5 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-xl transition-all border shrink-0 cursor-pointer ${
                            selectedMatchId === 'ALL'
                                ? 'bg-brand text-[#020617] border-brand shadow-md shadow-brand/10 font-black'
                                : 'bg-surface-dark text-content-secondary border-white/5 hover:text-white hover:border-white/10'
                        }`}
                    >
                        Auto (All)
                    </button>
                    {liveMatches.map((m, idx) => {
                        const isSelected = selectedMatchId === m.id;
                        const courtName = m.court || `Court ${idx + 1}`;
                        return (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMatchId(m.id)}
                                className={`px-3.5 py-2 text-[10px] md:text-xs font-black uppercase tracking-wider rounded-xl transition-all border shrink-0 cursor-pointer ${
                                    isSelected
                                        ? 'bg-brand text-[#020617] border-brand shadow-md shadow-brand/10 font-black'
                                        : 'bg-surface-dark text-content-secondary border-white/5 hover:text-white hover:border-white/10'
                                }`}
                            >
                                {courtName}
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden lg:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-content-muted uppercase tracking-widest">Global Watchers</span>
                        <span className="text-sm font-black text-white">{watchers.toLocaleString()}</span>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                        <Activity size={20} />
                    </div>
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex-1 overflow-hidden relative p-4 md:p-8">
                {selectedMatchId === 'ALL' && liveMatches.length > 0 ? (
                    <div className={`h-full grid gap-4 overflow-y-auto pb-20 md:pb-0 md:gap-8 ${liveMatches.length === 1 ? 'grid-cols-1 place-items-center' : liveMatches.length === 2 ? 'grid-cols-1 lg:grid-cols-2 place-items-center' : liveMatches.length <= 4 ? 'grid-cols-1 sm:grid-cols-2 max-w-6xl mx-auto' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {liveMatches.map(m => (
                            <div key={m.id} className="w-full flex flex-col justify-center items-center py-4 md:py-0">
                                <span className="mb-4 text-brand font-black uppercase tracking-widest text-xs border border-brand/30 bg-brand/10 px-3 py-1 rounded-full">{tournament.venue || 'Main Arena'}</span>
                                <div className="w-full max-w-xl mx-auto">
                                    <BroadcastMatchCard match={m} teams={tournament.teams} compact={true} categories={tournament.categories} tournament={tournament} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : activeMatch ? (
                    <div className="h-full flex flex-col md:grid md:grid-cols-4">
                        {/* Main Match Focus (3 Cols) */}
                        <div className="md:col-span-3 h-full flex flex-col overflow-y-auto">
                            <div className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto w-full py-4 md:py-0">
                                <BroadcastMatchCard match={activeMatch} teams={tournament.teams} categories={tournament.categories} tournament={tournament} />
                                
                                {/* Lower Third Sponsor / Info */}
                                <div className="mt-4 md:mt-8 w-full max-w-4xl animate-in slide-in-from-bottom duration-1000 px-4 md:px-0 hidden sm:block">
                                    <div className="bg-gradient-to-r from-transparent via-brand/10 to-transparent p-px">
                                        <div className="bg-[#020617]/50 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="bg-surface-elevated p-4 rounded-xl border border-white/10">
                                                    <Logo size={40} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xl font-black text-white italic tracking-[0.15em]">{activeMatch.roundName}</h4>
                                                    <p className="text-xs text-content-muted font-bold uppercase tracking-widest">Current Session • Verified Scoring</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-8">
                                               {tournament.sponsors?.slice(0, 2).map((s: any, i: number) => (
                                                  <div key={i} className="flex flex-col items-center">
                                                     <span className="text-[8px] font-bold text-content-muted uppercase tracking-[0.2em] mb-2">Partner</span>
                                                     <img src={typeof s === 'string' ? s : s.logo} className="h-8 md:h-10 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-crosshair" />
                                                  </div>
                                               ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Side Stats Panel (1 Col) - Hidden on mobile if not scrolled? */}
                        <div className="md:col-span-1 border-l border-white/5 bg-surface-ground/30 backdrop-blur-sm p-6 overflow-y-auto hidden md:block">
                            <h3 className="text-xs font-black text-white tracking-[0.2em] uppercase mb-6 flex items-center gap-2">
                                <History size={14} className="text-brand" />
                                Action Log
                            </h3>
                            <div className="space-y-4">
                                {activeMatch.score?.history?.slice(-8).reverse().map((ev: any, i: number) => {
                                    const parts = ev.split('|');
                                    const type = parts[0];
                                    const ts = parseInt(parts[1] || "0");
                                    const pIdx = parseInt(parts[2] || "1");
                                    const tag = parts[3]; // WINNER or ERROR

                                    if (type === 'UNDO') return null;

                                    let msg = type === 'T1' ? 'Team A Scored' : type === 'T2' ? 'Team B Scored' : 'Session Event';
                                    if (type === 'T1' || type === 'T2') {
                                        const team = type === 'T1' ? t1 : t2; // Note: t1 and t2 need to be acquired
                                        const player = pIdx === 1 ? team?.player1?.name : team?.player2?.name;
                                        if (player) {
                                            msg = `Point won by ${player}`;
                                        }
                                        if (tag === 'WINNER') msg += ' (WINNER)';
                                        if (tag === 'ERROR') msg += ' (ERROR)';
                                    }

                                    return (
                                        <motion.div 
                                            initial={{ opacity: 0, x: 20 }} 
                                            animate={{ opacity: 1, x: 0 }}
                                            key={i} 
                                            className={`p-4 rounded-xl border transition-colors ${tag === 'WINNER' ? 'bg-[#b4fc57]/10 border-[#b4fc57]/30' : tag === 'ERROR' ? 'bg-[#E65C31]/10 border-[#E65C31]/30' : 'bg-white/5 border-white/5 hover:border-brand/20'}`}
                                        >
                                            <div className={`text-[10px] font-mono mb-1 ${tag === 'WINNER' ? 'text-[#b4fc57]' : tag === 'ERROR' ? 'text-[#E65C31]' : 'text-brand'}`}>
                                                {new Date(ts).toLocaleTimeString([], {minute:'2-digit', second:'2-digit'})}
                                            </div>
                                            <p className={`text-xs font-bold leading-relaxed ${tag ? 'text-white' : 'text-content-secondary'}`}>
                                                {msg}
                                            </p>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <Activity size={40} className="text-content-muted" />
                        </div>
                        <h2 className="text-3xl font-black text-white italic mb-2">TUNING IN...</h2>
                        <p className="text-content-secondary max-w-sm">Watching all courts for active play. Matches will appear here as soon as they start.</p>
                    </div>
                )}
            </div>
            
            {/* Bottom Ticker */}
            <div className="h-10 md:h-12 bg-brand text-content-inverse flex items-center overflow-hidden shrink-0">
                <div className="whitespace-nowrap animate-marquee flex items-center font-black text-xs md:text-sm uppercase italic tracking-wider">
                   {Array.from({length: 10}).map((_, i) => (
                      <div key={i} className="flex items-center">
                         <span className="mx-8">{tournament.name} • LIVE FROM {tournament.venue || 'THE ARENA'}</span>
                         <span className="w-1.5 h-1.5 rounded-full bg-content-inverse/30" />
                      </div>
                   ))}
                </div>
            </div>
        </div>,
        document.body
    );
};

const BroadcastMatchCard = ({ match: initialMatch, teams, compact, categories, tournament }: any) => {
    // Phase 1 Real-time pattern: Subscribe to single global match doc for live broadcast
    const { matchData } = useLiveMatch(initialMatch.tournamentId, initialMatch.id);
    const match = matchData || initialMatch;

    const t1 = teams.find((t: any) => t.id === match.team1Id);
    const t2 = teams.find((t: any) => t.id === match.team2Id);
    const category = categories?.find((c: any) => c.id === match.categoryId);
    const catName = category?.name || 'General';

    const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
    const t1P1Name = getFirstName(t1?.player1?.name);
    const t1P2Name = getFirstName(t1?.player2?.name);
    const t2P1Name = getFirstName(t2?.player1?.name);
    const t2P2Name = getFirstName(t2?.player2?.name);

    const t1DisplayName = [t1P1Name, t1P2Name].filter(Boolean).join(' & ') || t1?.name || match.team1Name || 'TBA';
    const t2DisplayName = [t2P1Name, t2P2Name].filter(Boolean).join(' & ') || t2?.name || match.team2Name || 'TBA';

    const [displayScore, setDisplayScore] = useState(match.score);
    const [flashOverlayTitle, setFlashOverlayTitle] = useState<string | null>(null);
    const [flashOverlaySubtitle, setFlashOverlaySubtitle] = useState<string | null>(null);
    const [lastHistoryLength, setLastHistoryLength] = useState(0);

    const effectiveHistory = getEffectiveEvents(match.score?.history || []);

    useEffect(() => {
        const isFinished = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') || String(match.status).toUpperCase() === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED';
        if (isFinished) {
            setDisplayScore(match.score);
            return;
        }
        
        if (effectiveHistory.length > lastHistoryLength && lastHistoryLength > 0) {
            // New point added!
            const ev = effectiveHistory[effectiveHistory.length - 1];
            if (ev && (ev.startsWith('T1') || ev.startsWith('T2'))) {
                const parts = ev.split('|');
                const type = parts[0];
                const playerIdx = parseInt(parts[2] || "1");
                const tag = parts[3];
                const finisher = parts[4];
                
                const team = type === 'T1' ? t1 : t2;
                const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
                const teamName = team?.name || type;
                let actionStr = "POINT WON";
                if (finisher === 'smash') actionStr = "SMASH WINNER";
                else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
                else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
                else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
                else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
                else if (finisher === 'net') actionStr = "NET ERROR";
                else if (finisher === 'glass') actionStr = "GLASS ERROR";
                else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
                else if (finisher === 'grill') actionStr = "GRILL ERROR";
                else if (tag === 'winner') actionStr = "WINNER";
                else if (tag === 'error') actionStr = "UNFORCED ERROR";
                
                setFlashOverlayTitle(actionStr);
                setFlashOverlaySubtitle(player || teamName);
                
                setTimeout(() => {
                    setFlashOverlayTitle(null);
                    setDisplayScore(match.score);
                }, 2000);
            } else {
                setDisplayScore(match.score);
            }
        } else {
            // Init or undo
            setDisplayScore(match.score);
        }
        setLastHistoryLength(effectiveHistory.length);
    }, [match.score, effectiveHistory.length]);

    const defaultScore = {
        p1Points: "0",
        p2Points: "0",
        p1Games: 0,
        p2Games: 0,
        p1Sets: 0,
        p2Sets: 0,
        p1SetScores: [] as number[],
        p2SetScores: [] as number[],
        currentSet: 1,
        isTiebreak: false,
        history: [] as string[],
        server: null,
        goldenPoint: false,
        _isSuperTiebreak: false,
    };
    const activeScore = displayScore || match.score || defaultScore;

    const isT1Serving = activeScore?.server === 'p1' || activeScore?.server === 'p2';
    const isT2Serving = activeScore?.server === 'p3' || activeScore?.server === 'p4';

    const isTiebreak = activeScore?.isTiebreak;
    const isSuperTiebreak = activeScore?._isSuperTiebreak;
    const isStarPoint = activeScore?.goldenPoint;

    const state = isStarPoint ? 'STAR_POINT' : isSuperTiebreak ? 'SUPER_TIEBREAK' : isTiebreak ? 'TIEBREAK' : 'NORMAL';

    let cardClasses = "";
    let statusText = (match.status === 'COMPLETED' || String(match.status).toUpperCase() === 'FINISHED') ? 'COMPLETED' : match.roundName || 'FINAL';
    
    switch (state) {
        case 'STAR_POINT':
            cardClasses = "bg-gradient-to-br from-[#1F1705] to-[#2B2005] border-[1.5px] border-[#FBBF24]/60 animate-[starPointShimmer_2s_linear_infinite]";
            statusText = "★ STAR POINT";
            break;
        case 'SUPER_TIEBREAK':
            cardClasses = "bg-gradient-to-br from-[#1F0A0A] to-[#2B0A0A] border-[1.5px] border-[#EF4444]/60 shadow-[inset_0_0_20px_rgba(239,68,68,0.2)]";
            statusText = "SUPER TIEBREAK";
            break;
        case 'TIEBREAK':
            cardClasses = "bg-[#1A0A05] border border-[#E65C31]/50 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(230,92,49,0.03)_10px,rgba(230,92,49,0.03)_20px)] animate-[panBackground_20s_linear_infinite]";
            statusText = "TIEBREAK";
            break;
        default:
            cardClasses = "bg-[#1e293b] border-white/5";
            break;
    }

    // Score Update Animation
    const [scoreFlash, setScoreFlash] = useState(false);
    useEffect(() => {
        if (match.activeBroadcastEvent?.type === 'SCORE_UPDATE') {
            const now = Date.now();
            if (now - match.activeBroadcastEvent.timestamp < 2000) {
                setScoreFlash(true);
                const t = setTimeout(() => setScoreFlash(false), 500);
                return () => clearTimeout(t);
            }
        }
    }, [match.activeBroadcastEvent]);

    const recentEvents = effectiveHistory
        .filter((ev: string) => ev.startsWith('T1') || ev.startsWith('T2'))
        .slice(-5)
        .reverse()
        .map((ev: string) => {
            const parts = ev.split('|');
            const type = parts[0];
            const playerIdx = parseInt(parts[2] || "1");
            const tag = parts[3];
            const finisher = parts[4];
            
            const team = type === 'T1' ? t1 : t2;
            const player = playerIdx === 1 ? team?.player1?.name : team?.player2?.name;
            const teamName = team?.name || type;
            let actionStr = "Point Won";
            if (finisher === 'smash') actionStr = "SMASH WINNER";
            else if (finisher === 'vibora') actionStr = "VIBORA WINNER";
            else if (finisher === 'drop' || finisher === 'drop shot') actionStr = "DROP SHOT WINNER";
            else if (finisher === 'bandeja') actionStr = "BANDEJA WINNER";
            else if (finisher === 'volley') actionStr = "VOLLEY WINNER";
            else if (finisher === 'net') actionStr = "NET ERROR";
            else if (finisher === 'glass') actionStr = "GLASS ERROR";
            else if (finisher === 'double fault') actionStr = "DOUBLE FAULT";
            else if (finisher === 'grill') actionStr = "GRILL ERROR";
            else if (tag === 'winner') actionStr = "WINNER";
            else if (tag === 'error') actionStr = "UNFORCED ERROR";
            
            return `${player || teamName} - ${actionStr}`;
        });

    return (
        <div className={`rounded-[32px] p-6 md:p-8 relative overflow-hidden transition-all duration-300 w-full ${cardClasses} ${scoreFlash ? 'scale-[1.02] ring-4 ring-brand/50' : ''}`}>
            {/* Elegant full-card Flash Overlay */}
            {flashOverlayTitle && (
                <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center pointer-events-none p-4 w-full h-full bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className={`relative w-full w-max-[100%] px-6 sm:px-8 py-6 sm:py-8 rounded-2xl sm:rounded-3xl shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center overflow-hidden animate-in zoom-in-75 duration-300
                        ${flashOverlayTitle.includes('ERROR') || flashOverlayTitle.includes('FAULT') ? 'bg-gradient-to-br from-[#c2411e] via-[#E65C31] to-[#c2411e] border-b-4 border-[#ff7a52]' : 'bg-gradient-to-br from-[#2b5ae6] via-[#4D78FF] to-[#2b5ae6] border-b-4 border-[#7b9dff]'}`}>
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-[bg-pan_3s_linear_infinite]"></div>
                        <span className="font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs text-white/90 mb-1 z-10 drop-shadow-md text-center">{flashOverlaySubtitle}</span>
                        <span className="font-black text-white italic text-4xl sm:text-6xl leading-none md:leading-tight tracking-[0.15em]er uppercase z-10 drop-shadow-lg text-center break-words max-w-full px-2">
                           {flashOverlayTitle}
                        </span>
                    </div>
                </div>
            )}
            
            {/* Broadcast Overlay Integration */}
            {match.activeBroadcastEvent && !compact && (
                <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                    <BroadcastOverlay event={match.activeBroadcastEvent} />
                </div>
            )}

            <div className="text-center mb-6 md:mb-8 relative z-10 flex flex-col items-center gap-1">
                <span className={`${state === 'NORMAL' ? 'text-[#38bdf8]' : 'text-white'} text-[10px] md:text-sm font-black uppercase tracking-[0.3em]`}>
                   {state !== 'NORMAL' && <span className="animate-pulse mr-1">LIVE • </span>}
                   {catName} • {statusText} • {tournament?.venue || 'Venue TBD'}
                </span>
            </div>

            <div className={`flex justify-between items-center relative z-10 ${compact ? 'gap-2' : 'gap-2 md:gap-4'}`}>
                {/* Team 1 */}
                <div className="flex flex-col items-center w-1/3">
                    <div className={`${compact ? 'w-12 h-12 md:w-16 md:h-16 text-xl md:text-2xl' : 'w-16 h-16 md:w-24 md:h-24 text-3xl md:text-4xl'} shrink-0 rounded-full bg-[#1d4ed8] relative flex items-center justify-center font-black mb-2 md:mb-4 shadow-xl`}>
                        {t1DisplayName.charAt(0).toUpperCase()}
                        {isT1Serving && <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#E65C31] shadow-[0_0_12px_#E65C31] animate-[pulse_1s_ease-in-out_infinite] border-2 border-surface-dark" title="Serving" />}
                    </div>
                    <h3 className={`font-bold text-center leading-tight truncate w-full px-1 ${compact ? 'text-xs md:text-sm' : 'text-base md:text-xl'}`}>{t1?.name || t1DisplayName}</h3>
                    {(t1?.player1?.name || t1?.player2?.name) && (
                        <div className={`text-content-muted text-center leading-tight truncate w-full px-1 mt-1 ${compact ? 'text-[9px] md:text-[10px]' : 'text-[10px] md:text-xs'}`}>
                            {t1.player1?.name} {t1.player2?.name ? ` & ${t1.player2.name}` : ''}
                        </div>
                    )}
                </div>

                {/* Score */}
                <div className="flex flex-col items-center w-1/3 relative flex-1">
                    <div className={`flex flex-col items-center transition-all duration-300 ${flashOverlayTitle ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                        {scoreFlash && <div className="absolute inset-0 bg-brand/20 blur-xl animate-pulse rounded-full z-0"></div>}
                        
                        {/* Game Score (Points) */}
                        <div className={`${compact ? 'text-4xl md:text-5xl lg:text-6xl' : 'text-5xl sm:text-6xl md:text-7xl lg:text-8xl'} font-black tracking-[0.15em]er flex items-center gap-2 md:gap-4 transform transition-transform duration-200 relative z-10 ${scoreFlash ? 'scale-110' : ''}`}>
                            <span>{activeScore.p1Points === "0" ? "00" : activeScore.p1Points}</span>
                            <span className="text-white/30">-</span>
                            <span>{activeScore.p2Points === "0" ? "00" : activeScore.p2Points}</span>
                        </div>

                        {/* Sets & Games */}
                        <div className="mt-2 md:mt-4 flex flex-col items-center gap-1 md:gap-2 relative z-10">
                            <div className="flex gap-2">
                                <div className="flex flex-col items-center px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                                    <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold">Games</span>
                                    <span className="text-white text-xs md:text-base font-black">{activeScore.p1Games} - {activeScore.p2Games}</span>
                                </div>
                                <div className="flex flex-col items-center px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                                    <span className="text-[10px] md:text-xs text-gray-500 uppercase tracking-widest font-bold">Sets</span>
                                    <span className="text-white text-xs md:text-base font-black">{activeScore.p1Sets} - {activeScore.p2Sets}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team 2 */}
                <div className="flex flex-col items-center w-1/3">
                    <div className={`${compact ? 'w-12 h-12 md:w-16 md:h-16 text-xl md:text-2xl' : 'w-16 h-16 md:w-24 md:h-24 text-3xl md:text-4xl'} shrink-0 rounded-full bg-[#0ea5e9] relative flex items-center justify-center font-black mb-2 md:mb-4 shadow-xl`}>
                        {t2DisplayName.charAt(0).toUpperCase()}
                        {isT2Serving && <div className="absolute -bottom-1 -right-1 w-4 h-4 md:w-5 md:h-5 rounded-full bg-[#E65C31] shadow-[0_0_12px_#E65C31] animate-[pulse_1s_ease-in-out_infinite] border-2 border-surface-dark" title="Serving" />}
                    </div>
                    <h3 className={`font-bold text-center leading-tight truncate w-full px-1 ${compact ? 'text-xs md:text-sm' : 'text-base md:text-xl'}`}>{t2?.name || t2DisplayName}</h3>
                    {(t2?.player1?.name || t2?.player2?.name) && (
                        <div className={`text-content-muted text-center leading-tight truncate w-full px-1 mt-1 ${compact ? 'text-[9px] md:text-[10px]' : 'text-[10px] md:text-xs'}`}>
                            {t2.player1?.name} {t2.player2?.name ? ` & ${t2.player2.name}` : ''}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Ticker/Highlights */}
            {recentEvents.length > 0 && !compact && (
                <div className="mt-6 md:mt-8 pt-4 md:pt-6 border-t border-white/5 relative z-10 w-full overflow-hidden">
                    <div className="flex items-center gap-3 w-full">
                        <span className="text-[9px] md:text-[11px] font-black uppercase text-[#E65C31] tracking-widest shrink-0 bg-[#E65C31]/10 px-2 flex items-center justify-center py-1 rounded">Flash Updates</span>
                        <div className="flex-1 overflow-hidden relative fade-edges">
                             <div className="flex animate-marquee whitespace-nowrap items-center text-xs md:text-sm font-black italic uppercase text-content-muted tracking-wider w-[200%]">
                                <div className="flex shrink-0">
                                   {recentEvents.map((evt: string, j: number) => (
                                        <React.Fragment key={`orig-${j}`}>
                                            <span className="mx-6 text-white opacity-90">{evt}</span>
                                            <span className="w-1.5 h-1.5 bg-[#4D78FF] rounded-full"></span>
                                        </React.Fragment>
                                   ))}
                                </div>
                                <div className="flex shrink-0">
                                   {recentEvents.map((evt: string, j: number) => (
                                        <React.Fragment key={`clone-${j}`}>
                                            <span className="mx-6 text-white opacity-90">{evt}</span>
                                            <span className="w-1.5 h-1.5 bg-[#4D78FF] rounded-full"></span>
                                        </React.Fragment>
                                   ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SpectatorResults = ({ matches, teams, tournament }: { matches: Match[]; teams: Team[]; tournament?: any }) => {
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
    const [activeStageTab, setActiveStageTab] = useState<'all' | 'knockout' | 'group'>('all');
    const filteredMatches = matches.filter(m => (m.status === MatchStatus.COMPLETED || String(m.status).toUpperCase() === 'FINISHED') || String(m.status).toUpperCase() === 'COMPLETED');

    const isGroupMatch = (m: Match) => {
        const stage = m.stage?.toUpperCase();
        if (stage === 'GROUP') return true;
        if (m.roundName && m.roundName.toUpperCase().includes('GROUP')) return true;
        return false;
    };

    const isKnockoutMatch = (m: Match) => {
        return !isGroupMatch(m);
    };

    const groupMatches = filteredMatches.filter(isGroupMatch);
    const playoffMatches = filteredMatches.filter(isKnockoutMatch);
    
    const playoffByRound: Record<string, Match[]> = {};
    playoffMatches.forEach(m => {
        const key = m.roundName || `Round ${m.round}`;
        if (!playoffByRound[key]) playoffByRound[key] = [];
        playoffByRound[key].push(m);
    });
    
    // Sort ascending by round (Round of 12 / Round 1 first, then Round of 8, Semis, Finals)
    const playoffRounds = Object.entries(playoffByRound).sort((a, b) => {
        const roundA = a[1][0]?.round || 0;
        const roundB = b[1][0]?.round || 0;
        return roundA - roundB; 
    });

    const getGroupIdentifier = (m: Match) => {
        let g = m.group;
        if (!g && m.roundName && m.roundName.startsWith('Group ')) {
            g = m.roundName.replace('Group ', '');
            g = g.replace(' (Reverse)', '').trim();
        }
        return g || 'A';
    };

    const groupMatchesByGroup: Record<string, Match[]> = {};
    groupMatches.forEach(m => {
        const key = `Group ${getGroupIdentifier(m)}`;
        if (!groupMatchesByGroup[key]) groupMatchesByGroup[key] = [];
        groupMatchesByGroup[key].push(m);
    });
    
    // Sort group rounds ascending by Group name, and sort matches inside them chronologically ascending (earliest first)
    const groupRounds = Object.entries(groupMatchesByGroup)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, sectionMatches]) => [key, [...sectionMatches].sort((ma, mb) => getMatchTimestamp(ma) - getMatchTimestamp(mb))] as const);

    const sortMatchesAscending = (matchesList: Match[]) => {
        return [...matchesList].sort((a, b) => {
            const isGroupA = isGroupMatch(a);
            const isGroupB = isGroupMatch(b);
            
            if (isGroupA && isGroupB) {
                // Group stage matches: Sort by group letter ascending (Group A, Group B...)
                const groupLetterA = getGroupIdentifier(a);
                const groupLetterB = getGroupIdentifier(b);
                const groupCompare = groupLetterA.localeCompare(groupLetterB);
                if (groupCompare !== 0) return groupCompare;
                
                // Same group: sort by scheduled time ascending
                const timeA = getMatchTimestamp(a);
                const timeB = getMatchTimestamp(b);
                return timeA - timeB;
            } else if (!isGroupA && !isGroupB) {
                // Knockout stage matches: Sort by round number ascending (Round 1, Round 2...)
                if (a.round !== b.round) {
                    return (a.round || 0) - (b.round || 0);
                }
                const timeA = getMatchTimestamp(a);
                const timeB = getMatchTimestamp(b);
                return timeA - timeB;
            }
            
            // If one is group and one is knockout, put Group stage matches first
            return isGroupA ? -1 : 1;
        });
    };

    const ExpandableSection = ({ title, sectionMatches, defaultExpanded = false }: { title: string, sectionMatches: Match[], defaultExpanded?: boolean }) => {
        const [expanded, setExpanded] = useState(defaultExpanded);
        
        return (
            <div className="mb-4 overflow-hidden rounded-2xl shadow-xl">
               <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 md:px-6 bg-[#4D78FF] font-black text-xl text-white transition-colors hover:bg-blue-600">
                   <div className="flex items-center gap-3">
                       <span className="tracking-[0.15em] italic uppercase">{title}</span>
                       <span className="text-[10px] sm:text-xs font-bold text-[#4D78FF] bg-white px-2 py-0.5 rounded-full shadow">{sectionMatches.length} matches</span>
                   </div>
                   <ChevronDown size={24} className={`transform transition-transform text-white ${expanded ? 'rotate-180' : ''}`} />
               </button>
               {expanded && (
                   <div className="p-3 sm:p-5 bg-black/40 border-x border-b border-[#4D78FF]/20 rounded-b-2xl">
                       {sectionMatches.length === 0 ? (
                           <div className="text-content-muted text-sm italic py-4 text-center font-medium">No matches found for this stage yet.</div>
                       ) : (
                           <div className="space-y-4">
                               {sectionMatches.map((m: Match) => (
                                   <MatchResultCard key={m.id} match={m} teams={teams} tournament={tournament} />
                               ))}
                           </div>
                       )}
                   </div>
               )}
            </div>
        );
    };

    const ResultsTable = ({ title, icon, matchesToRender }: { title: string; icon: React.ReactNode; matchesToRender: Match[] }) => {
        if (matchesToRender.length === 0) return null;
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                    {icon}
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{title}</h4>
                    <span className="text-[10px] font-bold text-content-muted bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
                        {matchesToRender.length} {matchesToRender.length === 1 ? 'match' : 'matches'}
                    </span>
                </div>
                <div className="bg-[#0A0A0A] rounded-2xl border border-white/5 overflow-hidden w-full shadow-2xl">
                    <div className="overflow-x-auto w-full">
                        <table className="w-full text-left font-mono min-w-[800px]">
                            <thead className="bg-[#111111] text-[10px] text-content-muted font-black uppercase tracking-widest border-b border-white/10">
                                <tr>
                                    <th className="px-6 py-4">Stage / Round</th>
                                    <th className="px-6 py-4">Winner</th>
                                    <th className="px-6 py-4 text-center">Score</th>
                                    <th className="px-6 py-4">Opponent</th>
                                    <th className="px-6 py-4 text-center">Court</th>
                                    <th className="px-6 py-4 text-right">Completed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-xs text-white">
                                {sortMatchesAscending(matchesToRender).map((m) => {
                                    const t1 = teams.find(t => t.id === m.team1Id);
                                    const t2 = teams.find(t => t.id === m.team2Id);
                                    const isT1Winner = m.winnerTeamId === m.team1Id;
                                    
                                    const winner = isT1Winner ? t1 : t2;
                                    const loser = isT1Winner ? t2 : t1;
                                    
                                    const winnerName = winner?.name || (isT1Winner ? m.team1Name : m.team2Name) || 'TBA';
                                    const winnerPlayers = winner ? [winner.player1?.name, winner.player2?.name].filter(Boolean).join(' & ') : '';
                                    
                                    const loserName = loser?.name || (!isT1Winner ? m.team1Name : m.team2Name) || 'TBA';
                                    const loserPlayers = loser ? [loser.player1?.name, loser.player2?.name].filter(Boolean).join(' & ') : '';
                                    
                                    const p1SetScores = m.score?.p1SetScores || [];
                                    const p2SetScores = m.score?.p2SetScores || [];
                                    
                                    const isSingleGameFormat = (m.score?.p1Sets || 0) === 0 && (m.score?.p2Sets || 0) === 0 && ((m.score?.p1Games || 0) > 0 || (m.score?.p2Games || 0) > 0);
                                    
                                    return (
                                        <tr key={m.id} className="hover:bg-white/[0.02] transition-colors border-b border-white/5">
                                            <td className="px-6 py-4">
                                                <div className="text-white font-black text-xs uppercase tracking-wider">{m.roundName || 'Match'}</div>
                                                <div className="text-[9px] text-content-muted font-black uppercase tracking-widest mt-0.5">{m.stage || 'PLAYOFF'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Trophy size={14} className="text-amber-400 fill-amber-400 shrink-0" />
                                                    <span className="font-black text-sm text-white truncate max-w-[150px]">{winnerName}</span>
                                                </div>
                                                {winnerPlayers && (
                                                    <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[150px]">{winnerPlayers}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isSingleGameFormat ? (
                                                    <span className="inline-flex items-center bg-brand/10 border border-brand/20 text-brand px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                                        {isT1Winner ? `${m.score?.p1Games}-${m.score?.p2Games}` : `${m.score?.p2Games}-${m.score?.p1Games}`}
                                                    </span>
                                                ) : p1SetScores.length > 0 ? (
                                                    <div className="flex gap-1 justify-center">
                                                        {p1SetScores.map((s, i) => {
                                                            const winSet = isT1Winner ? s : p2SetScores[i];
                                                            const loseSet = isT1Winner ? p2SetScores[i] : s;
                                                            return (
                                                                <span key={i} className="inline-flex items-center bg-black/40 border border-white/10 text-white px-2 py-0.5 rounded text-xs font-mono font-bold">
                                                                    {winSet}-{loseSet}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center bg-[#4D78FF]/10 border border-[#4D78FF]/20 text-[#4D78FF] px-3 py-1 rounded-lg text-xs font-mono font-bold">
                                                        {isT1Winner ? `${m.score?.p1Sets || 0}-${m.score?.p2Sets || 0}` : `${m.score?.p2Sets || 0}-${m.score?.p1Sets || 0}`}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-xs text-gray-400 truncate max-w-[150px]">{loserName}</div>
                                                {loserPlayers && (
                                                    <div className="text-[10px] text-content-muted mt-0.5 truncate max-w-[150px]">{loserPlayers}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="bg-white/5 text-gray-300 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/5">
                                                    {m.court}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="text-gray-400 text-xs font-medium">
                                                    {formatFullDateOnly(m.scheduledTime)}
                                                </div>
                                                <div className="text-[9px] text-content-muted mt-0.5">
                                                    {m.scheduledTime ? formatTimeOnly(m.scheduledTime) : ''}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const matchesToDisplay = filteredMatches.filter(m => {
        if (activeStageTab === 'knockout') return isKnockoutMatch(m);
        if (activeStageTab === 'group') return isGroupMatch(m);
        return true;
    });

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                        <Trophy className="text-[#4D78FF]" size={24} /> Results Archive
                    </h3>
                    <p className="text-content-secondary text-sm">View completed match records and scores.</p>
                </div>
                {filteredMatches.length > 0 && (
                    <div className="flex bg-[#0D0D0D] border border-white/5 rounded-xl p-1 shrink-0 self-start sm:self-center">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'table'
                                    ? 'bg-[#4D78FF] text-white shadow-lg shadow-blue-500/10'
                                    : 'text-content-secondary hover:text-white'
                            }`}
                        >
                            <List size={14} /> Table View
                        </button>
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === 'cards'
                                    ? 'bg-[#4D78FF] text-white shadow-lg shadow-blue-500/10'
                                    : 'text-content-secondary hover:text-white'
                            }`}
                        >
                            <LayoutGrid size={14} /> Cards View
                        </button>
                    </div>
                )}
            </div>

            {filteredMatches.length > 0 && (
                <div className="flex flex-wrap gap-2 pb-2">
                    <button
                        onClick={() => setActiveStageTab('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'all'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        All Stages ({filteredMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveStageTab('knockout')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'knockout'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        🏆 Knockout Stage ({playoffMatches.length})
                    </button>
                    <button
                        onClick={() => setActiveStageTab('group')}
                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                            activeStageTab === 'group'
                                ? 'bg-[#4D78FF] text-white border-[#4D78FF] shadow-lg shadow-blue-500/10'
                                : 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10'
                        }`}
                    >
                        👥 Group Stage ({groupMatches.length})
                    </button>
                </div>
            )}

            {filteredMatches.length > 0 && viewMode === 'table' && (
                <div className="space-y-8">
                    {(activeStageTab === 'all' || activeStageTab === 'knockout') && playoffMatches.length > 0 && (
                        <ResultsTable 
                            title="Knockout & Playoff Stage Results" 
                            icon={<Trophy className="text-[#4D78FF]" size={16} />} 
                            matchesToRender={playoffMatches} 
                        />
                    )}
                    {(activeStageTab === 'all' || activeStageTab === 'group') && groupMatches.length > 0 && (
                        <ResultsTable 
                            title="Group Stage Results" 
                            icon={<Users className="text-[#4D78FF]" size={16} />} 
                            matchesToRender={groupMatches} 
                        />
                    )}
                </div>
            )}

            {filteredMatches.length > 0 && viewMode === 'cards' && (
                <div className="space-y-8">
                    {(activeStageTab === 'all' || activeStageTab === 'knockout') && playoffRounds.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Trophy className="text-[#4D78FF]" size={16} />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Knockout Stage</h4>
                            </div>
                            {playoffRounds.map(([roundName, matches], idx) => (
                                <ExpandableSection key={roundName} title={roundName} sectionMatches={[...matches].sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b))} defaultExpanded={idx === 0} />
                            ))}
                        </div>
                    )}

                    {(activeStageTab === 'all' || activeStageTab === 'group') && groupRounds.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 px-1">
                                <Users className="text-[#4D78FF]" size={16} />
                                <h4 className="text-sm font-black text-white uppercase tracking-widest">Group Stage</h4>
                            </div>
                            {groupRounds.map(([groupName, matches], idx) => (
                                <ExpandableSection key={groupName} title={groupName} sectionMatches={matches} defaultExpanded={playoffRounds.length === 0 && idx === 0} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {matchesToDisplay.length === 0 && filteredMatches.length > 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <History size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-[0.15em]">No Matches In This Stage</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        No completed matches are recorded for the selected stage.
                    </div>
                </div>
            )}

            {filteredMatches.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center bg-surface-panel rounded-2xl border border-white/5 border-dashed">
                    <History size={48} className="text-white/10 mb-4" />
                    <div className="text-lg font-bold text-white uppercase italic tracking-[0.15em]">No Results Yet</div>
                    <div className="text-content-muted text-sm mt-1 max-w-sm mx-auto">
                        Once matches are completed and scored, they will appear here grouped by stage.
                    </div>
                </div>
            )}
        </div>
    );
};

const SpectatorSchedule = ({ matches, teams, onSelectTab }: { matches: Match[]; teams: Team[]; onSelectTab: (tab: 'live' | 'timelines' | 'standings' | 'results' | 'schedule') => void }) => {
    // Upcoming matches are (status !== 'COMPLETED' && String(status).toUpperCase() !== 'FINISHED')
    const upcomingMatches = matches.filter(m => (m.status !== MatchStatus.COMPLETED && String(m.status).toUpperCase() !== 'FINISHED') && String(m.status).toUpperCase() !== 'COMPLETED');

    const getTeamName = (teamId: string, fallbackName?: string) => {
        const t = teams.find(team => team.id === teamId);
        const getFirstName = (name?: string) => name ? name.split(' ')[0] : '';
        return [getFirstName(t?.player1?.name), getFirstName(t?.player2?.name)].filter(Boolean).join(' & ') || t?.name || fallbackName || 'TBD';
    };

    const sortedAll = [...upcomingMatches].sort((a, b) => getMatchTimestamp(a) - getMatchTimestamp(b));
    const hasGroups = sortedAll.some(m => !!m.group || (m.roundName && m.roundName.startsWith('Group ')));

    const renderCard = (m: Match) => {
        const t1 = getTeamName(m.team1Id, m.team1Name);
        const t2 = getTeamName(m.team2Id, m.team2Name);
        const isLive = (m.status === MatchStatus.IN_PROGRESS || String(m.status).toUpperCase() === 'IN_PROGRESS' || String(m.status).toUpperCase() === 'LIVE') && !m.winnerTeamId;

        return (
            <Card 
                key={m.id} 
                variant="panel" 
                className={`p-4 flex flex-col md:flex-row justify-between items-center gap-4 transition-colors group ${isLive ? 'border-[#E65C31]/50 bg-[#E65C31]/5 hover:border-[#E65C31] cursor-pointer' : ''}`}
                onClick={() => {
                    if (isLive) {
                        onSelectTab('live');
                    }
                }}
            >
                <div className="flex-1 w-full text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <span className="text-brand text-xs font-bold uppercase tracking-wider">{m.roundName}</span>
                        {isLive && (
                            <span className="bg-[#E65C31] text-white text-[9px] font-black px-1.5 py-0.5 rounded animate-pulse">
                                LIVE NOW
                            </span>
                        )}
                    </div>
                    <div className="text-white font-medium text-lg flex items-center justify-center md:justify-start gap-3">
                        <span>{t1}</span>
                        <span className="text-content-muted text-sm">vs</span>
                        <span>{t2}</span>
                    </div>
                </div>
                <div className="flex items-center justify-between w-full md:w-auto gap-4 text-sm text-content-secondary">
                    <div className="flex items-center gap-2 flex-1 md:flex-initial justify-center md:justify-start font-mono">
                        <Calendar size={14}/> {formatFullTime(m.scheduledTime)}
                    </div>
                    <Badge variant="neutral" className="font-mono">{m.court}</Badge>
                    {isLive && (
                        <div className="text-[10px] text-brand uppercase font-black tracking-widest hidden md:block group-hover:underline">
                            Watch Live →
                        </div>
                    )}
                </div>
            </Card>
        );
    };

    if (upcomingMatches.length === 0) {
        return (
            <div className="text-center py-20 bg-[#0A0A0A] rounded-2xl border border-white/5">
                <Calendar size={48} className="text-white/10 mx-auto mb-4" />
                <p className="text-white font-black uppercase italic text-lg text-content-muted">No Upcoming Matches</p>
                <p className="text-content-muted text-sm mt-1">All matches have been completed for this category.</p>
            </div>
        );
    }

    if (!hasGroups) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                            <Calendar className="text-[#4D78FF]" size={24} /> Upcoming Match Schedule
                        </h3>
                        <p className="text-content-secondary text-sm">Follow the order of play and upcoming times.</p>
                    </div>
                </div>
                <div className="grid gap-3">
                    {sortedAll.map(m => renderCard(m))}
                </div>
            </div>
        );
    }

    const grouped = sortedAll.reduce((acc, m) => {
        let g = m.group;
        if (!g && m.roundName && m.roundName.startsWith('Group ')) {
            g = m.roundName.replace('Group ', '');
            g = g.replace(' (Reverse)', '');
        }
        g = g || 'Knockouts';
        if (!acc[g]) acc[g] = [];
        acc[g].push(m);
        return acc;
    }, {} as Record<string, Match[]>);

    const groupKeys = Object.keys(grouped).sort((a,b) => {
        if (a === 'Knockouts') return 1;
        if (b === 'Knockouts') return -1;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 italic uppercase tracking-[0.15em]">
                        <Calendar className="text-[#4D78FF]" size={24} /> Upcoming Match Schedule
                    </h3>
                    <p className="text-content-secondary text-sm">Follow the order of play and upcoming times.</p>
                </div>
            </div>

            {groupKeys.map(k => (
                <div key={k} className="mb-6">
                    <h4 className="text-xs font-black text-[#4D78FF] uppercase tracking-[0.2em] mb-3 border-b border-white/10 pb-2">
                        {k === 'Knockouts' ? 'Knockout Phase' : `Group ${k}`}
                    </h4>
                    <div className="grid gap-3">
                        {grouped[k].map(m => renderCard(m))}
                    </div>
                </div>
            ))}
        </div>
    );
};
