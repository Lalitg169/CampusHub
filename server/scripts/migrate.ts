import fs from 'fs';
import path from 'path';
import { pool } from '../src/db';

const dir = path.join(__dirname, '..', 'migrations');

async function main(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name        TEXT PRIMARY KEY,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const done = new Set((await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    const pending = files.filter((f) => !done.has(f));

    if (pending.length === 0) {
        console.log('Nothing to migrate.');
        return;
    }

    for (const file of pending) {
        const sql = fs.readFileSync(path.join(dir, file), 'utf8');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(sql);
            await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            await client.query('COMMIT');
            console.log(`applied ${file}`);
        } catch (err) {
            await client.query('ROLLBACK');
            console.error(`failed on ${file}`);
            throw err;
        } finally {
            client.release();
        }
    }
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
