const fs = require('fs');
const lines = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n');

const replacement = `        {/* Category Tabs for Spectator */}
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

// Splice lines 279 to 297 (0-indexed, so 280 to 298)
lines.splice(279, 19, replacement);

fs.writeFileSync('components/LiveScoreboard.tsx', lines.join('\n'));
console.log("Success2");
