import os
import re

with open('components/AdminDashboard.tsx', 'r') as f:
    code = f.read()

# Helper function
helper_func = """
// Helper to get all courts assigned to a tournament or its categories
const getAllTournamentCourts = (tournament: Tournament): string[] => {
    const allCourts = new Set<string>();
    if (tournament.courts) {
        if (typeof tournament.courts === 'string') {
            allCourts.add(tournament.courts);
        } else if (Array.isArray(tournament.courts)) {
            tournament.courts.forEach(c => allCourts.add(c));
        }
    }
    if (tournament.categories) {
        tournament.categories.forEach(cat => {
            if (cat.courts) {
                if (typeof cat.courts === 'string') {
                    allCourts.add(cat.courts as string);
                } else if (Array.isArray(cat.courts)) {
                    cat.courts.forEach(c => allCourts.add(c));
                }
            }
        });
    }
    return Array.from(allCourts);
};
"""

if "getAllTournamentCourts" not in code:
    code = code.replace("const AdminDashboard = ", helper_func + "\nconst AdminDashboard = ")
    code = code.replace("export const AdminDashboard", helper_func + "\nexport const AdminDashboard")

target1 = """                                {(tournament.courts || []).map((c: string, i: number) => ("""
replacement1 = """                                {getAllTournamentCourts(tournament).map((c: string, i: number) => ("""
code = code.replace(target1, replacement1)

with open('components/AdminDashboard.tsx', 'w') as f:
    f.write(code)

