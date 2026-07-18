import React, { useState } from "react";
import { Trophy, ChevronRight, MapPin, Users, ClipboardList, Zap, Database, Megaphone, ArrowRight } from "lucide-react";
import { SportCarousel3D } from "./SportCarousel3D";
import RadialOrbitalTimeline from "./ui/radial-orbital-timeline";
import { useLeaderboard } from "../hooks/useLeaderboard";
import { useTournaments } from "../hooks/useTournaments";

const organizerFeatures = [
  {
    id: 1,
    title: "Tournament Builder",
    date: "Flexible",
    content: "Create and manage tournaments with automated bracket generation (round robin, single/double elimination).",
    category: "Organiser",
    icon: Trophy,
    relatedIds: [2, 3],
    status: "completed" as const,
  },
  {
    id: 2,
    title: "Real-Time Scoring",
    date: "Live",
    content: "Update match scores live from any device, instantly pushed to all spectators.",
    category: "Organiser",
    icon: Zap,
    relatedIds: [1, 5],
    status: "completed" as const,
  },
  {
    id: 3,
    title: "Court Management",
    date: "Efficient",
    content: "Assign matches to courts, manage scheduling and time slots.",
    category: "Organiser",
    icon: MapPin,
    relatedIds: [1, 4],
    status: "completed" as const,
  },
  {
    id: 4,
    title: "Team & Roster Control",
    date: "Streamlined",
    content: "Register teams, manage player rosters and handle substitutions.",
    category: "Organiser",
    icon: Users,
    relatedIds: [3, 5],
    status: "completed" as const,
  },
  {
    id: 5,
    title: "Results & Analytics",
    date: "Insights",
    content: "Post-tournament breakdowns, match history, and performance reports.",
    category: "Organiser",
    icon: Database,
    relatedIds: [2, 4],
    status: "completed" as const,
  },
  {
    id: 6,
    title: "Announcements",
    date: "Instant",
    content: "Broadcast updates, schedule changes, and alerts to all participants instantly.",
    category: "Organiser",
    icon: Megaphone,
    relatedIds: [1, 5],
    status: "completed" as const,
  },
];

const playerFeatures = [
  {
    id: 1,
    title: "Tournament Discovery",
    date: "Global",
    content: "Browse and register for upcoming padel tournaments near you.",
    category: "Player",
    icon: MapPin,
    relatedIds: [2, 4],
    status: "completed" as const,
  },
  {
    id: 2,
    title: "Live Match Tracking",
    date: "Real-time",
    content: "Follow your match score and your opponents' scores in real time.",
    category: "Player",
    icon: Zap,
    relatedIds: [1, 5],
    status: "completed" as const,
  },
  {
    id: 3,
    title: "Personal Stats",
    date: "Analytics",
    content: "Track your GWP, win rate, games played, and performance trends over time.",
    category: "Player",
    icon: Database,
    relatedIds: [4, 5],
    status: "completed" as const,
  },
  {
    id: 4,
    title: "Team Profile",
    date: "Hub",
    content: "View your team roster, match history, and standing in current tournaments.",
    category: "Player",
    icon: Users,
    relatedIds: [1, 3],
    status: "completed" as const,
  },
  {
    id: 5,
    title: "Leaderboard Standing",
    date: "Ranking",
    content: "See exactly where you rank against every other team in real time.",
    category: "Player",
    icon: Trophy,
    relatedIds: [2, 3],
    status: "completed" as const,
  },
  {
    id: 6,
    title: "Match Notifications",
    date: "Alerts",
    content: "Get alerts for upcoming matches, score updates, and tournament results.",
    category: "Player",
    icon: Megaphone,
    relatedIds: [2, 4],
    status: "completed" as const,
  },
];

export const PublicLanding: React.FC<{ onNavigate: (tab: string) => void }> = ({
  onNavigate,
}) => {
  const { leaderboard, loadingLeaderboard } = useLeaderboard();
  const { tournaments, loadingTournaments } = useTournaments();
  const [currentTournamentIndex, setCurrentTournamentIndex] = useState(0);
  const [featureTab, setFeatureTab] = useState<"organizer" | "player">("player");

  const [formState, setFormState] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Form submitted: ", formState);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setFormState({ name: '', email: '', message: '' });
  };

  const news = [
    { id: 1, title: "National Padel League Announced", category: "Update", excerpt: "The long awaited national league is finally here. Find o..." },
    { id: 2, title: "Top 5 Padel Rackets of 2025", category: "Padel", excerpt: "Looking to upgrade your gear? We review the top..." },
    { id: 3, title: "Islamabad Aces win the Winter Cup", category: "Tournament", excerpt: "A thrilling final match comes to an end with the Aces..." }
  ];
  const loadingNews = false;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 flex flex-col pt-28 md:pt-36 pb-32">
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-8">
        {/* HERO SECTION */}
        <div className="col-span-1 md:col-span-7 flex flex-col justify-center p-8 bg-transparent">
          <span className="text-accent uppercase tracking-widest text-sm font-bold mb-4">A COMPLETE TOURNAMENT PLATFORM</span>
          <h1 className="text-5xl md:text-7xl font-black leading-[0.9] text-white tracking-tight mb-8">
            COMPETE.<br/> DOMINATE.<br/> WIN.
          </h1>
          <p className="text-content-secondary text-lg mb-8 max-w-lg">
            Pakistan's first padel tournament management platform. Real-time scoring, live leaderboards, and professional brackets.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-4">
            <button 
              onClick={() => onNavigate("auth")} 
              className="bg-primary hover:bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg shadow-[0_4px_14px_0_rgba(77,120,255,0.39)] transition-all"
            >
              Start Competing
            </button>
            <button 
              onClick={() => onNavigate("live")} 
              className="bg-transparent text-accent px-8 py-4 rounded-xl font-bold text-lg border-2 border-accent/80 hover:bg-accent/10 transition-all"
            >
              Watch Live
            </button>
          </div>
        </div>

        {/* 3D SCROLLER SECTION */}
        <div className="col-span-1 md:col-span-5 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)] rounded-2xl border border-primary/10 overflow-hidden min-h-[400px]">
          <SportCarousel3D />
        </div>
      </div>

      <div className="flex flex-col gap-4 md:gap-8">
        {/* PLATFORM FEATURES (Orbital Map) */}
        <div className="w-full bg-card-dark border border-primary/10 rounded-2xl p-4 sm:p-6 md:p-8 relative flex flex-col">
          <span className="text-accent uppercase tracking-[0.1em] text-xs font-extrabold mb-4 text-center block">PLATFORM FEATURES</span>
          <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-2 text-white text-center tracking-tight leading-tight">
            One Platform. Every Tournament Need.<br className="hidden md:block" /> Covered.
          </h3>
          <p className="text-gray-400 text-center mb-6 md:mb-8 text-sm max-w-lg mx-auto">Click the nodes to explore the interconnected Matchup infrastructure.</p>
          
          <div className="flex justify-center mb-8 relative z-50 pointer-events-auto">
            <div className="bg-[#111] p-1 rounded-xl flex gap-1 border border-white/5">
              <button 
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${featureTab === "organizer" ? "bg-primary text-white shadow-md" : "text-gray-400 hover:text-white"}`}
                onClick={() => setFeatureTab("organizer")}
              >
                For Organisers
              </button>
              <button 
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${featureTab === "player" ? "bg-accent text-white shadow-md" : "text-gray-400 hover:text-white"}`}
                onClick={() => setFeatureTab("player")}
              >
                For Players
              </button>
            </div>
          </div>
          
          <div className="relative">
             <RadialOrbitalTimeline timelineData={featureTab === 'organizer' ? organizerFeatures : playerFeatures} themeMode={featureTab} />
          </div>
        </div>

        {/* Row 3: Live Leaderboard & Upcoming Tournaments */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* LEADERBOARD SECTION */}
          <div className="col-span-1 md:col-span-8 bg-transparent flex flex-col pt-0 md:pt-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 text-white gap-4">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter m-0 leading-tight">
                Top Ranked<br/>Players
              </h2>
              <button 
                onClick={() => onNavigate('leaderboard')}
                className="inline-flex items-center gap-2.5 px-6 py-3 border border-white/15 rounded bg-transparent text-sm font-bold tracking-widest uppercase text-white hover:border-primary hover:text-primary transition-all cursor-pointer group whitespace-nowrap self-start sm:self-auto mb-1"
              >
                Full Leaderboard
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform duration-250 group-hover:translate-x-1">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2px]">
              {loadingLeaderboard ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-surface-dark animate-pulse rounded" />
                ))
              ) : leaderboard.length > 0 ? leaderboard.slice(0, 4).map((team, index) => {
                const stylesList = [
                  {
                    bg: "bg-[linear-gradient(160deg,#0D2340_0%,#142D52_40%,#0A1D38_100%)]",
                    rankLabel: "text-[#00E5FF]",
                    accentColor: "text-[#00E5FF]",
                    overlay: "bg-[linear-gradient(160deg,rgba(0,229,255,0.08)_0%,transparent_60%)] border-[#00E5FF]/20",
                    topLine: "bg-[linear-gradient(90deg,#00E5FF,transparent)]"
                  },
                  {
                    bg: "bg-[linear-gradient(160deg,#1E0D30_0%,#2D1248_40%,#180A28_100%)]",
                    rankLabel: "text-[#00E5FF]", // The template had this as accent again
                    accentColor: "text-[#00E5FF]",
                    overlay: "bg-[linear-gradient(160deg,rgba(155,109,255,0.06)_0%,transparent_60%)] border-[#9B6DFF]/15",
                    topLine: "bg-[linear-gradient(90deg,#9B6DFF,transparent)]"
                  },
                  {
                    bg: "bg-[linear-gradient(160deg,#0D1F0A_0%,#143015_40%,#0A1808_100%)]",
                    rankLabel: "text-[#FFD600]",
                    accentColor: "text-[#FFD600]",
                    overlay: "bg-[linear-gradient(160deg,rgba(0,200,83,0.06)_0%,transparent_60%)] border-[#00C853]/15",
                    topLine: "bg-[linear-gradient(90deg,#00C853,transparent)]"
                  },
                  {
                    bg: "bg-[linear-gradient(160deg,#201508_0%,#30200C_40%,#18100A_100%)]",
                    rankLabel: "text-[#CD7F32]",
                    accentColor: "text-[#CD7F32]",
                    overlay: "bg-[linear-gradient(160deg,rgba(255,140,0,0.06)_0%,transparent_60%)] border-[#FF8C00]/15",
                    topLine: "bg-[linear-gradient(90deg,#FF8C00,transparent)]"
                  }
                ];
                
                const style = stylesList[index] || stylesList[3];
                const rankNumber = index + 1;

                return (
                  <div key={team.id} className="relative aspect-[3/4] overflow-hidden cursor-pointer rounded bg-black group w-full text-white shadow-xl" style={{animation: 'slide-up 0.6s ease both', animationDelay: `${index * 0.08}s`}}>
                    <div className={`absolute inset-0 ${style.bg}`}></div>
                    <div className={`absolute top-0 left-0 right-0 h-[2px] transform scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 ${style.topLine}`}></div>
                    
                    <div className="absolute top-4 right-5 text-6xl sm:text-7xl leading-none text-white/[0.05] font-black not-italic select-none pointer-events-none">
                      {rankNumber}
                    </div>
                    
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24">
                      <div className="w-full h-full rounded-full bg-white/[0.05] border border-white/10 flex items-center justify-center text-3xl sm:text-4xl transition-all duration-300 ease-out group-hover:scale-110 shadow-lg backdrop-blur-sm">
                        🎾
                      </div>
                    </div>
                    
                    <div className={`absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none border rounded group-hover:opacity-100 ${style.overlay}`}></div>
                    
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col justify-end">
                      <div className={`text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 ${style.rankLabel}`}>
                        #{rankNumber} Pakistan
                      </div>
                      <div className="text-xl sm:text-2xl tracking-tight leading-none mb-1 uppercase truncate w-full font-black">
                        {team.name}
                      </div>
                      <div className="text-[10px] sm:text-xs text-content-muted font-medium tracking-wide truncate w-full">
                        Padel — Player
                      </div>
                      
                      <div className="flex gap-2 sm:gap-4 mt-3 pt-3 border-t border-white/10">
                        <div className="flex flex-col gap-1">
                          <div className={`text-base sm:text-lg tracking-tight leading-none font-bold ${style.accentColor}`}>
                            {team.wins || 0}
                          </div>
                          <div className="text-[9px] font-bold tracking-widest uppercase text-content-muted">
                            Wins
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-base sm:text-lg tracking-tight leading-none font-bold text-[#FFD600]">
                            {team.titles || 0}
                          </div>
                          <div className="text-[9px] font-bold tracking-widest uppercase text-content-muted">
                            Titles
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="text-base sm:text-lg tracking-tight leading-none font-bold text-accent-success">
                            {team.gwp ? team.gwp.toFixed(0) : 0}%
                          </div>
                          <div className="text-[9px] font-bold tracking-widest uppercase text-content-muted">
                            Win Rate
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-gray-500 text-sm py-4 text-center col-span-2 lg:col-span-4 bg-white/5 rounded-lg border border-white/10">No ranked players yet.</div>
              )}
            </div>
          </div>

          {/* TOURNAMENTS SECTION */}
          <div className="col-span-1 md:col-span-4 bg-gradient-to-br from-card-dark to-black border border-primary/10 rounded-2xl p-6 flex flex-col items-start relative group shadow-xl hover:shadow-[0_0_30px_rgba(77,120,255,0.15)] transition-shadow">
            <div className="flex justify-between items-center w-full mb-6">
              <div className="text-accent text-xs font-extrabold tracking-[0.1em] uppercase">Upcoming</div>
              {tournaments.length > 1 && (
                <div className="flex gap-2">
                  <button onClick={() => setCurrentTournamentIndex(prev => (prev === 0 ? tournaments.length - 1 : prev - 1))} className="text-gray-500 hover:text-white transition-colors border-none bg-transparent">
                    &lt;
                  </button>
                  <button onClick={() => setCurrentTournamentIndex(prev => (prev + 1) % tournaments.length)} className="text-gray-500 hover:text-white transition-colors border-none bg-transparent">
                    &gt;
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex-grow flex flex-col justify-center w-full">
              {loadingTournaments ? (
                <div className="h-32 w-full bg-surface-dark animate-pulse rounded-lg" />
              ) : tournaments.length > 0 ? (
                <>
                  <div className="text-xs text-accent font-bold mb-1">
                     {new Date(tournaments[currentTournamentIndex].date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()}
                  </div>
                  <h4 className="text-xl font-bold leading-tight mb-2 text-white">{tournaments[currentTournamentIndex].name}</h4>
                  <div className="text-xs text-gray-500 mb-6 flex items-center gap-1">
                     <MapPin size={12} className="text-[#E03A6A]" /> {tournaments[currentTournamentIndex].venue}
                  </div>
                  
                  <div className="px-3 py-1 border border-green-500/50 text-green-500 rounded-md text-[10px] font-extrabold inline-block tracking-wide uppercase bg-green-500/10 self-start">
                    Registering Now
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-sm">No upcoming tournaments.</div>
              )}
            </div>

            <button 
              onClick={() => {
                const t = tournaments[currentTournamentIndex];
                if (t) {
                  onNavigate(`register/${t.slug || t.id}`);
                } else {
                  onNavigate('register');
                }
              }}
              className="w-full mt-6 bg-surface-dark hover:bg-neutral-800 border border-white/5 py-3 rounded-xl text-white text-xs font-bold transition-colors text-center flex items-center justify-center gap-2 group-hover:border-primary/30"
            >
              View Details <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Row 4: News & Contact */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* LATEST NEWS */}
          <div className="col-span-1 md:col-span-12 bg-card-dark border border-primary/10 rounded-2xl p-6 relative">
            <div className="text-accent text-xs font-extrabold tracking-[0.1em] mb-6 uppercase flex justify-between items-center">
              Latest News
              <button onClick={() => onNavigate('news')} className="text-primary hover:underline bg-transparent border-none">See all</button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {loadingNews ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-40 bg-surface-dark animate-pulse rounded-xl" />
                ))
              ) : news.map((article) => (
                <button onClick={() => onNavigate(`news/${article.id}`)} key={article.id} className="group flex flex-col bg-surface-dark border border-white/5 rounded-xl overflow-hidden hover:border-primary/50 transition-all shadow-md text-left">
                  <div className="h-32 w-full bg-neutral-800 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity mix-blend-overlay"></div>
                    <Trophy className="w-8 h-8 text-white/20" />
                  </div>
                  <div className="p-4 flex-grow flex flex-col">
                    <span className="text-[10px] text-accent font-bold mb-2 uppercase">{article.category}</span>
                    <h5 className="font-bold text-sm text-white leading-tight mb-2 line-clamp-2">{article.title}</h5>
                    <p className="text-xs text-gray-400 line-clamp-2 mt-auto">{article.excerpt}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
