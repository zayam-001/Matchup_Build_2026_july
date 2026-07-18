import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """                        <Input label="Date & Time" type="datetime-local" value={editingMatch.scheduledTime.slice(0, 16)} onChange={(v: string) => setEditingMatch({...editingMatch, scheduledTime: v})} />
                        
                        <Input label="Court" value={editingMatch.court || ""} onChange={(v: string) => setEditingMatch({...editingMatch, court: v})} placeholder="Court TBD (Referee Assignment)" />"""

replacement = """                        <Input label="Date & Time" type="datetime-local" value={editingMatch.scheduledTime.slice(0, 16)} onChange={(v: string) => setEditingMatch({...editingMatch, scheduledTime: v})} />
                        
                        <div>
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Court</label>
                            <select
                                className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-white focus:border-brand outline-none"
                                value={editingMatch.court || ''}
                                onChange={(e) => setEditingMatch({...editingMatch, court: e.target.value})}
                            >
                                <option value="">Court TBD (Referee Assignment)</option>
                                {(tournament.courts || []).map((c: string, i: number) => (
                                    <option key={i} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
