/*
  Helper to mint a short-lived JWT for local testing.
  Usage:
    JWT_SECRET=dev-secret tsx scripts/mint-dev-jwt.ts --user tester --minutes 10
*/
import jwt from 'jsonwebtoken';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = val;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const secret = process.env.JWT_SECRET || 'dev-fallback-jwt-secret-change-in-production';
const userId = args.user || 'tester';
const email = args.email || 'tester@example.com';
const minutes = Number(args.minutes || '5');

const token = jwt.sign(
  {
    userId,
    email,
    isAdmin: false,
    permissions: ['api_access'],
  },
  secret,
  { expiresIn: `${minutes}m` }
);

console.log(token);
