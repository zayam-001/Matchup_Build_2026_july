const fs = require('fs');
const lines = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n');

const replacement = `        {/* Spectator Hero Header */}
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
        </div>`;

// Splice lines 190 to 279
lines.splice(190, 89, replacement);

fs.writeFileSync('components/LiveScoreboard.tsx', lines.join('\n'));
console.log("Success4");
