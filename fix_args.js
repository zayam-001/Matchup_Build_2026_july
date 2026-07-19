const fs = require('fs');
let code = fs.readFileSync('services/storage.ts', 'utf8');

code = code.replace(/export const updateMatchDetails = async \(\.\.\.args: any\[\]\)/g, 'export const updateMatchDetails = async (tId: any, mId: any, updates: any, ...args: any[])');
code = code.replace(/export const deleteKnockoutMatchCascade = async \(\.\.\.args: any\[\]\)/g, 'export const deleteKnockoutMatchCascade = async (tId: any, mId: any, ...args: any[])');
code = code.replace(/export const deleteTournament = async \(\.\.\.args: any\[\]\)/g, 'export const deleteTournament = async (tId: any, ...args: any[])');
code = code.replace(/export const updateTournament = async \(\.\.\.args: any\[\]\)/g, 'export const updateTournament = async (tId: any, data: any, ...args: any[])');
code = code.replace(/export const replaceTeamInTournament = async \(\.\.\.args: any\[\]\)/g, 'export const replaceTeamInTournament = async (tId: any, oldTeamId: any, newTeam: any, ...args: any[])');

fs.writeFileSync('services/storage.ts', code);
