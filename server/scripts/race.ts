import { pool } from '../src/db';
import { signToken } from '../src/middleware/auth';
import { AuthUser } from '../src/types';

// Fires concurrent registrations (and then concurrent cancels) at a small
// throwaway event and checks the seat limit held. Needs the API running.
//   npm run race -- --capacity=3

const API = process.env.API_URL ?? 'http://localhost:5000/api';
const arg = (name: string, fallback: number) => {
    const m = process.argv.find((a) => a.startsWith(`--${name}=`));
    return m ? Number(m.split('=')[1]) : fallback;
};
const CAPACITY = arg('capacity', 3);

async function call(method: string, path: string, token: string) {
    const res = await fetch(`${API}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: (await res.json()) as { registration?: { status: string } } };
}

async function counts(eventId: number) {
    const { rows } = await pool.query<{ status: string; n: number }>(
        'SELECT status, count(*)::int AS n FROM registrations WHERE event_id = $1 GROUP BY status',
        [eventId]
    );
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    return { confirmed: by.confirmed ?? 0, waitlisted: by.waitlisted ?? 0 };
}

async function main() {
    const students = (await pool.query<AuthUser>(`SELECT id, name, role FROM users WHERE role = 'student' ORDER BY id`)).rows;
    if (students.length <= CAPACITY) throw new Error('need more students than seats, run the seed first');

    const club = await pool.query<{ id: number }>('SELECT id FROM clubs ORDER BY id LIMIT 1');
    const event = await pool.query<{ id: number }>(
        `INSERT INTO events (club_id, title, starts_at, capacity)
         VALUES ($1, 'race test', NOW() + interval '7 days', $2) RETURNING id`,
        [club.rows[0].id, CAPACITY]
    );
    const eventId = event.rows[0].id;
    const tokens = students.map((s) => signToken(s));
    let ok = true;

    try {
        console.log(`event #${eventId}, ${CAPACITY} seats, ${students.length} students registering at once`);
        const results = await Promise.all(tokens.map((t) => call('POST', `/events/${eventId}/registration`, t)));
        const said = results.filter((r) => r.body.registration?.status === 'confirmed').length;
        let db = await counts(eventId);
        console.log(`  api said confirmed: ${said}`);
        console.log(`  in db: ${db.confirmed} confirmed, ${db.waitlisted} waitlisted`);
        if (db.confirmed > CAPACITY) {
            console.log(`  OVERBOOKED by ${db.confirmed - CAPACITY}`);
            ok = false;
        }

        // everyone holding a seat cancels at the same moment; the waitlist should refill every seat
        const holders = (
            await pool.query<{ user_id: number }>(
                `SELECT user_id FROM registrations WHERE event_id = $1 AND status = 'confirmed'`,
                [eventId]
            )
        ).rows.map((r) => r.user_id);
        const waiting = db.waitlisted;
        await Promise.all(
            holders.map((id) => call('DELETE', `/events/${eventId}/registration`, tokens[students.findIndex((s) => s.id === id)]))
        );
        db = await counts(eventId);
        const expected = Math.min(CAPACITY, waiting);
        console.log(`${holders.length} seat holders cancel at once`);
        console.log(`  in db: ${db.confirmed} confirmed (expected ${expected}), ${db.waitlisted} waitlisted`);
        if (db.confirmed !== expected) ok = false;
    } finally {
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
    }

    console.log(ok ? 'OK, seat limit held' : 'FAILED');
    process.exitCode = ok ? 0 : 1;
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
