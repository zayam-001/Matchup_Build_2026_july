const fs = require('fs');
const lines = fs.readFileSync('components/LiveScoreboard.tsx', 'utf8').split('\n');

const replacement = `            {/* Horizontal Floating Tabs */}
            <div className="flex flex-row justify-center bg-black p-1.5 rounded-full border border-white/5 gap-1 mb-8 w-full md:max-w-fit mx-auto relative z-20 overflow-x-auto whitespace-nowrap scrollbar-none">
                <button 
                    onClick={() => setActiveArenaTab('live')}
                    className={\`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 \${activeArenaTab === 'live' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}\`}
                >
                    <Activity className={\`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 \${activeArenaTab === 'live' ? 'animate-pulse' : ''}\`} /> 
                    <span>Live</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('schedule')}
                    className={\`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 \${activeArenaTab === 'schedule' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}\`}
                >
                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Schedule</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('results')}
                    className={\`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 \${activeArenaTab === 'results' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}\`}
                >
                    <Check className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Results</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('standings')}
                    className={\`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 \${activeArenaTab === 'standings' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}\`}
                >
                    <Trophy className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Standings</span>
                </button>
                <button 
                    onClick={() => setActiveArenaTab('timelines')}
                    className={\`flex-1 sm:flex-none py-2.5 px-5 rounded-full font-bold uppercase tracking-widest text-[10px] md:text-xs transition-all flex flex-row items-center justify-center gap-2 \${activeArenaTab === 'timelines' ? 'bg-white text-black' : 'text-white hover:text-gray-300'}\`}
                >
                    <History className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> 
                    <span>Timelines</span>
                </button>
            </div>`;

// Splice lines 306 to 341
lines.splice(306, 36, replacement);

fs.writeFileSync('components/LiveScoreboard.tsx', lines.join('\n'));
console.log("Success3");
