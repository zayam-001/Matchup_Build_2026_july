import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """              <div className="bg-surface-panel p-6 rounded-xl mb-6 mt-4 flex flex-col md:flex-row justify-between items-center gap-6 border border-white/5 shadow-lg">
                  <div className="flex flex-col gap-2 w-full md:w-auto">
                      <div className="flex items-center gap-2">
                          <Database size={20} className="text-brand" />
                          <span className="text-white font-bold text-lg">Match Points Balance</span>
                      </div>
                      <div className="flex items-end gap-3">
                          <span className="text-4xl font-mono font-bold text-white tracking-tight">{dashboardCredits ? dashboardCredits.matchCreditsRemaining : '...'}</span>
                          <span className="text-content-secondary mb-1">/ {dashboardCredits ? ((dashboardCredits.matchCreditsRemaining || 0) + (dashboardCredits.matchCreditsUsed || 0)) : '...'} Allotted</span>
                      </div>
                      <button className="text-xs font-bold text-brand hover:text-brand-light mt-1 self-start flex items-center gap-1 transition-colors">
                          <ArrowUpRight size={14} /> Top up (Coming soon)
                      </button>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                      <button onClick={() => setIsCreating(true)} className="w-full sm:w-auto bg-brand hover:bg-brand-light text-content-inverse px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20 hover:scale-105">
                          <Plus size={20} /> Add a Tournament
                      </button>
                      <button onClick={() => setIsCloning(true)} className="w-full sm:w-auto bg-surface-elevated hover:bg-white/10 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all border border-white/10 hover:border-white/20">
                          <Copy size={20} /> Clone a Tournament
                      </button>
                  </div>
              </div>"""

replacement = """              <div className="flex flex-col lg:flex-row gap-6 mb-8 mt-4">
                  {/* The "Match Pass" Card */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand/20 via-surface-panel to-surface-ground border border-brand/20 shadow-2xl p-6 sm:p-8 flex-1 isolate group">
                      {/* Animated gradient background / glow */}
                      <div className="absolute inset-0 bg-brand/5 opacity-50 group-hover:opacity-100 transition-opacity duration-700"></div>
                      <div className="absolute -top-32 -right-32 w-64 h-64 bg-brand/20 blur-[100px] rounded-full group-hover:bg-brand/30 transition-colors duration-1000"></div>
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-brand/0 via-brand to-brand/0 opacity-30 group-hover:opacity-70 transition-opacity duration-700"></div>
                      
                      {/* Subtle Grid Pattern overlay */}
                      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>

                      <div className="relative z-10 flex flex-col h-full justify-between gap-8">
                          <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                  <div className="p-3 bg-brand/10 border border-brand/20 rounded-xl text-brand shadow-[0_0_15px_rgba(var(--brand),0.2)]">
                                      <Activity size={28} className="animate-pulse" />
                                  </div>
                                  <div>
                                      <h3 className="text-white font-black text-xl tracking-wider uppercase drop-shadow-md">Match Pass</h3>
                                      <p className="text-xs text-brand font-bold tracking-widest font-mono mt-0.5">ELITE ORGANIZER</p>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-content-muted tracking-widest uppercase mb-1 justify-end">
                                      <Database size={12} />
                                      Available Points
                                  </div>
                                  <div className="text-5xl font-mono font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] group-hover:text-brand-light transition-colors duration-500">
                                      {dashboardCredits ? dashboardCredits.matchCreditsRemaining : '...'}
                                  </div>
                              </div>
                          </div>
                          
                          <div className="flex items-end justify-between border-t border-white/10 pt-5">
                              <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] text-content-muted font-bold tracking-widest uppercase">Total Allotted Balance</span>
                                  <span className="text-content-secondary font-mono text-sm tracking-wide">
                                      {dashboardCredits ? ((dashboardCredits.matchCreditsRemaining || 0) + (dashboardCredits.matchCreditsUsed || 0)) : '...'} PTS
                                  </span>
                              </div>
                              
                              <button className="text-xs font-bold bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all border border-white/10 group-hover:border-brand/30 shadow-sm active:scale-95">
                                  <ArrowUpRight size={16} className="text-brand" /> Top up (Coming soon)
                              </button>
                          </div>
                      </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-4 justify-center">
                      <button onClick={() => setIsCreating(true)} className="flex-1 lg:flex-none lg:w-64 bg-brand hover:bg-brand-light text-content-inverse px-6 py-5 rounded-2xl font-bold flex items-center justify-center gap-4 transition-all shadow-[0_0_20px_rgba(var(--brand),0.3)] hover:scale-[1.02] active:scale-[0.98]">
                          <Plus size={24} />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-lg">Add Tournament</span>
                              <span className="text-[11px] font-medium opacity-80 uppercase tracking-widest mt-0.5">Start from scratch</span>
                          </div>
                      </button>
                      <button onClick={() => setIsCloning(true)} className="flex-1 lg:flex-none lg:w-64 bg-surface-elevated hover:bg-white/10 text-white px-6 py-5 rounded-2xl font-bold flex items-center justify-center gap-4 transition-all border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                          <Copy size={24} className="text-content-muted" />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-lg">Clone Tournament</span>
                              <span className="text-[11px] text-content-muted font-medium uppercase tracking-widest mt-0.5">Duplicate format & teams</span>
                          </div>
                      </button>
                  </div>
              </div>"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
