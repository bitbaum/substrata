import { Pool } from 'pg';
const globalDb = globalThis as typeof globalThis & { substrataPool?: Pool; accountsPool?: Pool };

/**
 * Accounts get their own small pool, so a page's session read never queues
 * behind long research queries for one of the five shared connections, and a
 * query that stops answering is cancelled by the server instead of holding its
 * connection forever.
 */
export function accountsDatabase() {
  if (!process.env.DATABASE_URL) throw new Error('Substrata database not configured');
  return (globalDb.accountsPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
    query_timeout: 6000,
  }));
}
export function database() {
  if (!process.env.DATABASE_URL) throw new Error('Substrata database not configured');
  return (globalDb.substrataPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
