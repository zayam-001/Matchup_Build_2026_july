import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """                        <div>
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Court</label>
                            <div className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-content-muted">
                                {editingMatch.court || 'Court TBD (Referee Assignment)'}
                            </div>
                        </div>"""

replacement = """                        <Input label="Court" value={editingMatch.court || ""} onChange={(v: string) => setEditingMatch({...editingMatch, court: v})} placeholder="Court TBD (Referee Assignment)" />"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
