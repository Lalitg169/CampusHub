import express, { Request, Response, NextFunction } from 'express';
import { get, run, isUniqueViolation } from '../db';
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

async function loadEvent(eventId: number) {
    return get<{ capacity: number; starts_at: Date }>('SELECT capacity, starts_at FROM events WHERE id = $1', [eventId]);
}

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
        const event = await loadEvent(eventId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }
        if (event.starts_at <= new Date()) {
            return res.status(400).json({ success: false, error: 'This event has already started.' });
        }

        const taken = await get<{ count: number }>(
            `SELECT count(*)::int AS count FROM registrations WHERE event_id = $1 AND status = 'confirmed'`,
            [eventId]
        );
        const status = taken!.count < event.capacity ? 'confirmed' : 'waitlisted';

        // someone who cancelled earlier gets their row back, at the end of the queue
        const saved = await get(
            `INSERT INTO registrations (event_id, user_id, status) VALUES ($1, $2, $3)
             ON CONFLICT (event_id, user_id) DO UPDATE
                SET status = EXCLUDED.status, created_at = NOW(), updated_at = NOW()
              WHERE registrations.status = 'cancelled'
             RETURNING id`,
            [eventId, req.user!.id, status]
        );
        if (!saved) {
            return res.status(409).json({ success: false, error: 'You are already registered for this event.' });
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
        const event = await loadEvent(eventId);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }
        if (event.starts_at <= new Date()) {
            return res.status(400).json({ success: false, error: 'This event has already started.' });
        }

        const cancelled = await get<{ previous: string }>(
            `UPDATE registrations r
                SET status = 'cancelled', updated_at = NOW()
               FROM registrations old
              WHERE old.id = r.id AND r.event_id = $1 AND r.user_id = $2 AND r.status <> 'cancelled'
             RETURNING old.status AS previous`,
            [eventId, req.user!.id]
        );
        if (!cancelled) {
            return res.status(404).json({ success: false, error: 'You are not registered for this event.' });
        }

        if (cancelled.previous === 'confirmed') {
            await run(
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

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
