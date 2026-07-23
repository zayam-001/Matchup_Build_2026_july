import re

with open("services/storage.ts", "r") as f:
    content = f.read()

# Fix 1: updatedMatches
content = content.replace(
    'const updatedMatches = advanceBracket(allMatches, match, winnerId, winnerName || "TBD");',
    'allMatches = advanceBracket(allMatches, match, winnerId, winnerName || "TBD");'
)
content = content.replace(
    'updatedMatches.forEach(m => {',
    'allMatches.forEach(m => {'
)
content = content.replace(
    'const updatedTeams = calculateStats(t.teams, updatedMatches, t.format);',
    'const updatedTeams = calculateStats(t.teams, allMatches, t.format);'
)

# Fix 2: sets: sets
content = content.replace('sets: sets // Keep as legacy field too just in case', '')

# Fix 3: mId -> d.id
content = content.replace(
    'const globalMatchRef = doc(db, "matches", d.id);\n                        batch.set(globalMatchRef, { ...updatePayload, tournamentId: tId, id: mId }, { merge: true });',
    'const globalMatchRef = doc(db, "matches", d.id);\n                        batch.set(globalMatchRef, { ...updatePayload, tournamentId: tId, id: d.id }, { merge: true });'
)

with open("services/storage.ts", "w") as f:
    f.write(content)

