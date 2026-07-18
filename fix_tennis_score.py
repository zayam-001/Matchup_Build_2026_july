import os

file_path = 'components/MatchScoringSystem.tsx'
with open(file_path, 'r') as f:
    code = f.read()

target = """    if (pA >= 3 && pB >= 3) {
      if (pA === pB) return { a: goldenPoint ? "SP" : "40", b: goldenPoint ? "SP" : "40", label: goldenPoint ? "Star Point" : "Deuce", isDeuce: !goldenPoint, advTeam: null };
      if (!goldenPoint) {
        if (pA > pB) return { a: "Ad", b: "40", label: "Advantage A", isDeuce: false, advTeam: 'A' };
        if (pB > pA) return { a: "40", b: "Ad", label: "Advantage B", isDeuce: false, advTeam: 'B' };
      }
    }
    return { a: sequence[pA] || "0", b: sequence[pB] || "0", label: "", isDeuce: false, advTeam: null };"""

replacement = """    if (pA >= 3 && pB >= 3) {
      if (pA === pB) return { a: goldenPoint ? "SP" : "40", b: goldenPoint ? "SP" : "40", label: goldenPoint ? "Star Point" : "Deuce", isDeuce: !goldenPoint, advTeam: null };
      
      if (pA > pB) return { a: "Ad", b: "40", label: "Advantage A", isDeuce: false, advTeam: 'A' };
      if (pB > pA) return { a: "40", b: "Ad", label: "Advantage B", isDeuce: false, advTeam: 'B' };
    }
    return { a: sequence[pA] || "0", b: sequence[pB] || "0", label: "", isDeuce: false, advTeam: null };"""

if target in code:
    code = code.replace(target, replacement)
    with open(file_path, 'w') as f:
        f.write(code)
    print("Fixed tennis score logic")
else:
    print("Target not found")
