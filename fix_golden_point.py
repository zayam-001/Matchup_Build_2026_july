import os

file_path = 'components/MatchScoringSystem.tsx'
with open(file_path, 'r') as f:
    code = f.read()

target = """      if (goldenPoint) {
        if (pA > 3) return 'A';
        if (pB > 3) return 'B';
      } else {"""

replacement = """      if (goldenPoint) {
        if (pA > 3 && pA > pB) return 'A';
        if (pB > 3 && pB > pA) return 'B';
      } else {"""

if target in code:
    code = code.replace(target, replacement)
    with open(file_path, 'w') as f:
        f.write(code)
    print("Fixed golden point logic")
else:
    print("Target not found")
