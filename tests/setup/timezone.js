// Run every test in a zone west of UTC. A date read as UTC midnight and shown
// in local time slips to the day before only there, and CI runs in UTC, where
// that bug would pass unnoticed. Tests that need another zone set process.env.TZ
// themselves and restore this one afterwards.
import process from 'node:process';

process.env.TZ = 'America/Sao_Paulo';
