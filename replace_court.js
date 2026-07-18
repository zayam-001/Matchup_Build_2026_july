const fs = require('fs');
let code = fs.readFileSync('components/AdminDashboard.tsx', 'utf8');

const target = `                        <div>
                            <label className="block text-xs font-bold text-content-muted uppercase tracking-widest mb-2">Court</label>
                            <div className="w-full bg-surface-dark border border-white/5 rounded-xl p-3 text-content-muted">
                                {editingMatch.court || 'Court TBD (Referee Assignment)'}
                            </div>
                        </div>`;

const replacement = `                        <Input label="Court" value={editingMatch.court || ""} onChange={(v: string) => setEditingMatch({...editingMatch, court: v})} placeholder="Court TBD (Referee Assignment)" />`;

code = code.split(target).join(replacement);
fs.writeFileSync('components/AdminDashboard.tsx', code);
