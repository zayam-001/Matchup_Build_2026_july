import os

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

target = """                      <div className="flex items-end gap-3">
                          <span className="text-4xl font-mono font-bold text-white tracking-tight">42</span>
                          <span className="text-content-secondary mb-1">/ 100 Allotted</span>
                      </div>"""

replacement = """                      <div className="flex items-end gap-3">
                          <span className="text-4xl font-mono font-bold text-white tracking-tight">{dashboardCredits ? dashboardCredits.matchCreditsRemaining : '...'}</span>
                          <span className="text-content-secondary mb-1">/ {dashboardCredits ? ((dashboardCredits.matchCreditsRemaining || 0) + (dashboardCredits.matchCreditsUsed || 0)) : '...'} Allotted</span>
                      </div>"""

code = code.replace(target, replacement)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)
