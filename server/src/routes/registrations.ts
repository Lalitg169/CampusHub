import express, { Request, Response, NextFunction } from 'express';
import { PoolClient } from 'pg';
import { get, withTransaction, isUniqueViolation } from '../db';
import { requireAuth } from '../middleware/auth';

// mounted at /api/events/:id/registration — the signed-in user's own registration
const router = express.Router({ mergeParams: true });

router.use(requireAuth, (req: Request, res: Response, next: NextFunction) => {
    if (!/^\d+$/.test(String(req.params.id))) {
        res.status(404).json({ success: false, error: 'Event not found.' });
        return;
    }
    next();
});

// position is 1-based and only set while waitlisted
const REGISTRATION_SELECT = `
    SELECT r.id, r.event_id, r.status, r.checked_in_at, r.created_at,
           CASE WHEN r.status = 'waitlisted' THEN (
               SELECT count(*)::int + 1 FROM registrations w
                WHERE w.event_id = r.event_id AND w.status = 'waitlisted'
                  AND (w.created_at, w.id) < (r.created_at, r.id)
           ) END AS position
      FROM registrations r
     WHERE r.event_id = $1 AND r.user_id = $2
`;

// Locks the event row until the transaction ends, so every registration or cancel
// for this event runs one after another. Other events aren't affected.
async function lockEvent(client: PoolClient, eventId: number) {
    const { rows } = await client.query<{ capacity: number; starts_at: Date }>(
        'SELECT capacity, starts_at FROM events WHERE id = $1 FOR UPDATE',
        [eventId]
    );
    return rows[0];
}

type Outcome = { status: number; error: string } | null;

// GET /api/events/:id/registration
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const registration = await get(REGISTRATION_SELECT, [req.params.id, req.user!.id]);
        res.json({ success: true, registration: registration ?? null });
    } catch (err) {
        next(err);
    }
});

// POST /api/events/:id/registration — a seat if one is free, otherwise the waitlist
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = Number(req.params.id);
        const outcome = await withTransaction<Outcome>(async (client) => {
            const event = await lockEvent(client, eventId);
            if (!event) return { status: 404, error: 'Event not found.' };
            if (event.starts_at <= new Date()) return { status: 400, error: 'This event has already started.' };

            // safe to count now: nobody else can change this event's seats until we commit
            const taken = await client.query<{ count: number }>(
                `SELECT count(*)::int AS count FROM registrations WHERE event_id = $1 AND status = 'confirmed'`,
                [eventId]
            );
            const status = taken.rows[0].count < event.capacity ? 'confirmed' : 'waitlisted';

            // someone who cancelled earlier gets their row back, at the end of the queue
            const saved = await client.query(
                `INSERT INTO registrations (event_id, user_id, status) VALUES ($1, $2, $3)
                 ON CONFLICT (event_id, user_id) DO UPDATE
                    SET status = EXCLUDED.status, created_at = NOW(), updated_at = NOW()
                  WHERE registrations.status = 'cancelled'
                 RETURNING id`,
                [eventId, req.user!.id, status]
            );
            if (saved.rowCount === 0) return { status: 409, error: 'You are already registered for this event.' };
            return null;
        });
        if (outcome) {
            return res.status(outcome.status).json({ success: false, error: outcome.error });
        }

        const registration = await get(REGISTRATION_SELECT, [eventId, req.user!.id]);
        res.status(201).json({ success: true, registration });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ success: false, error: 'You are already registered for this event.' });
        }
        next(err);
    }
});

// DELETE /api/events/:id/registration — cancel, and hand the seat to the next person waiting
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = Number(req.params.id);
        const outcome = await withTransaction<Outcome>(async (client) => {
            const event = await lockEvent(client, eventId);
            if (!event) return { status: 404, error: 'Event not found.' };
            if (event.starts_at <= new Date()) return { status: 400, error: 'This event has already started.' };

            const cancelled = await client.query<{ previous: string }>(
                `UPDATE registrations r
                    SET status = 'cancelled', updated_at = NOW()
                   FROM registrations old
                  WHERE old.id = r.id AND r.event_id = $1 AND r.user_id = $2 AND r.status <> 'cancelled'
                 RETURNING old.status AS previous`,
                [eventId, req.user!.id]
            );
            if (cancelled.rowCount === 0) return { status: 404, error: 'You are not registered for this event.' };

            // same transaction, so the freed seat can't be taken by a new sign-up first
            if (cancelled.rows[0].previous === 'confirmed') {
                await client.query(
                    `UPDATE registrations SET status = 'confirmed', updated_at = NOW()
                      WHERE id = (
                          SELECT id FROM registrations
                           WHERE event_id = $1 AND status = 'waitlisted'
                           ORDER BY created_at, id
                           LIMIT 1
                      )`,
                    [eventId]
                );
            }
            return null;
        });
        if (outcome) {
            return res.status(outcome.status).json({ success: false, error: outcome.error });
        }

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
