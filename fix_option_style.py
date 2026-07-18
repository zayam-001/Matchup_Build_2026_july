import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """                            <select
                                className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-white focus:border-brand outline-none"
                                value={editingMatch.court || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, court: e.target.value})}
                            >
                                <option value="">Court TBD (Referee Assignment)</option>
                                {(tournament.courts || []).map((c: string, i: number) => (
                                    <option key={i} value={c}>{c}</option>
                                ))}
                            </select>"""

replacement = """                            <select
                                className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-white focus:border-brand outline-none appearance-none"
                                style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                                value={editingMatch.court || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, court: e.target.value})}
                            >
                                <option value="" className="bg-[#1a1d24] text-white">Court TBD (Referee Assignment)</option>
                                {(tournament.courts || []).map((c: string, i: number) => (
                                    <option key={i} value={c} className="bg-[#1a1d24] text-white">{c}</option>
                                ))}
                            </select>
                            <div className="absolute right-4 top-[38px] pointer-events-none text-content-muted">
                                <ChevronDown size={16} />
                            </div>"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
