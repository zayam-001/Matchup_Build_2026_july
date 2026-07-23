import re

# Fix OBSOverlay.tsx
with open("components/OBSOverlay.tsx", "r") as f:
    obs = f.read()

obs = obs.replace(
    'const stingLine2Ref  = useRef<HTMLSpanElement>(null);',
    'const stingLine2Ref  = useRef<HTMLSpanElement>(null);\n  const cardRef = useRef<HTMLDivElement>(null);'
)
obs = obs.replace(
    '<div className={styles.obsCard}>',
    '<div className={styles.obsCard} ref={cardRef}>'
)

with open("components/OBSOverlay.tsx", "w") as f:
    f.write(obs)


# Fix storage.ts
with open("services/storage.ts", "r") as f:
    storage = f.read()

storage = storage.replace(
    'const updatedTeams = calculateStats(t.teams, allMatches, t.format);',
    'const updatedTeams = calculateStats(t.teams, updatedMatches, t.format);'
)
# Re-replace updatedMatches scope problem correctly
storage = storage.replace(
    'let allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));\n                    const match = allMatches.find(m => m.id === mId);',
    'let allMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));\n                    let updatedMatches = allMatches;\n                    const match = allMatches.find(m => m.id === mId);'
)
storage = storage.replace(
    'allMatches = advanceBracket(allMatches, match, winnerId, winnerName || "TBD");',
    'updatedMatches = advanceBracket(allMatches, match, winnerId, winnerName || "TBD");'
)
storage = storage.replace(
    'allMatches.forEach(m => {',
    'updatedMatches.forEach(m => {'
)

with open("services/storage.ts", "w") as f:
    f.write(storage)

