const fs = require('fs');
let code = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8');

const target = `{/* Category Tabs for Spectator */}
        {activeTournament.isMultiCategory && activeTournament.categories && activeTournament.categories.length > 0 && (
            <div className="max-w-7xl mx-auto px-4 mb-6">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {activeTournament.categories.map((cat: any) => (
                        <button
                            key={cat.id}
                            onClick={() => handleSelectCategory(cat.id)}
                            className={\`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all
                                \${selectedCategoryId === cat.id 
                                 ? 'bg-[#4D78FF] text-white shadow-[0_0_15px_rgba(77,120,255,0.4)]' 
                                 : 'bg-[#111111] text-[#9CA3AF] hover:text-white border border-white/5'}\`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            </div>
        )}`;

const replacement = `{/* Category Tabs for Spectator */}
        {activeTournament.isMultiCategory && activeTournament.categories && activeTournament.categories.length > 0 && (
            <div className="max-w-7xl mx-auto px-4 mb-6">
                <div className="flex flex-wrap items-center justify-start gap-2">
                    {activeTournament.categories.map((cat: any) => {
                        const hasLiveMatch = tournamentMatches?.some((m: any) => m.categoryId === cat.id && m.status === MatchStatus.IN_PROGRESS);
                        return (
                        <button
                            key={cat.id}
                            onClick={() => handleSelectCategory(cat.id)}
                            className={\`relative px-5 py-2.5 rounded-lg text-sm font-black uppercase tracking-widest transition-all
                                \${selectedCategoryId === cat.id 
                                 ? 'bg-white text-black shadow-lg' 
                                 : 'bg-[#2A2A2A] text-white hover:bg-[#333333]'}\`}
                        >
                            {cat.name}
                            {hasLiveMatch && selectedCategoryId !== cat.id && (
                                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
                            )}
                        </button>
                    )})}
                </div>
            </div>
        )}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('components/LiveScoreboard.tsx', code);
  console.log("Success");
} else {
  console.log("Target not found");
}
