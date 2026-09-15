import { Pool } from 'pg';
const globalDb = globalThis as typeof globalThis & { substrataPool?: Pool };
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('Substrata database not configured');
  return (globalDb.substrataPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
