import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """                  {/* Actions */}
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
                  </div>"""

replacement = """                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-3 sm:gap-4 justify-center">
                      <button onClick={() => setIsCreating(true)} className="flex-1 lg:flex-none lg:w-64 bg-brand hover:bg-brand-light text-content-inverse px-4 py-3 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-3 sm:gap-4 transition-all shadow-[0_0_20px_rgba(var(--brand),0.3)] hover:scale-[1.02] active:scale-[0.98]">
                          <Plus className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-base sm:text-lg">Add Tournament</span>
                              <span className="text-[9px] sm:text-[11px] font-medium opacity-80 uppercase tracking-widest mt-0.5">Start from scratch</span>
                          </div>
                      </button>
                      <button onClick={() => setIsCloning(true)} className="flex-1 lg:flex-none lg:w-64 bg-surface-elevated hover:bg-white/10 text-white px-4 py-3 sm:px-6 sm:py-5 rounded-xl sm:rounded-2xl font-bold flex items-center justify-center gap-3 sm:gap-4 transition-all border border-white/10 hover:border-white/20 hover:scale-[1.02] active:scale-[0.98]">
                          <Copy className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-content-muted" />
                          <div className="flex flex-col items-start text-left">
                              <span className="leading-tight text-base sm:text-lg">Clone Tournament</span>
                              <span className="text-[9px] sm:text-[11px] text-content-muted font-medium uppercase tracking-widest mt-0.5">Duplicate format & teams</span>
                          </div>
                      </button>
                  </div>"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
