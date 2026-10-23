import { Pool, PoolClient, QueryResultRow } from 'pg';
import { config } from './config';

// Hosted Postgres (Neon, Supabase, Render) serves a certificate that is not in
// Node's default trust store, so verification is relaxed for those.
function sslConfig(): false | { rejectUnauthorized: boolean } {
    if (config.databaseSsl === 'false') return false;
    const requestedInUrl = /[?&]sslmode=require/.test(config.databaseUrl);
    if (config.databaseSsl === 'true' || requestedInUrl) return { rejectUnauthorized: false };
    return false;
}

export const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: sslConfig(),
    max: config.poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

// A dropped idle connection emits on the pool, not on any query. Without a
// listener Node treats it as an unhandled 'error' event and exits.
pool.on('error', (err) => {
    console.error('Unexpected idle client error', err);
});

/** Run a query and return every row. */
export async function all<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await pool.query<T>(sql, params);
    return result.rows;
}

/** Run a query and return the first row, or undefined when there is none. */
export async function get<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    const result = await pool.query<T>(sql, params);
    return result.rows[0];
}

/** Run a statement and return the number of affected rows. */
export async function run(sql: string, params: unknown[] = []): Promise<number> {
    const result = await pool.query(sql, params);
    return result.rowCount ?? 0;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

/** Postgres unique-violation error code. */
export const UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: unknown): boolean {
    return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}
