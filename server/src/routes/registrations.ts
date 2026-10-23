import express, { Request, Response, NextFunction } from 'express';
import { get, isUniqueViolation } from '../db';
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

const REGISTRATION_SELECT = `
    SELECT id, event_id, status, checked_in_at, created_at
      FROM registrations
     WHERE event_id = $1 AND user_id = $2
`;

// GET /api/events/:id/registration
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const registration = await get(REGISTRATION_SELECT, [req.params.id, req.user!.id]);
        res.json({ success: true, registration: registration ?? null });
    } catch (err) {
        next(err);
    }
});

// POST /api/events/:id/registration
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const eventId = Number(req.params.id);
        const event = await get<{ capacity: number; starts_at: Date }>(
            'SELECT capacity, starts_at FROM events WHERE id = $1',
            [eventId]
        );
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
        if (taken!.count >= event.capacity) {
            return res.status(409).json({ success: false, error: 'Sorry, this event is full.' });
        }

        await get(
            `INSERT INTO registrations (event_id, user_id, status) VALUES ($1, $2, 'confirmed')`,
            [eventId, req.user!.id]
        );
        const registration = await get(REGISTRATION_SELECT, [eventId, req.user!.id]);
        res.status(201).json({ success: true, registration });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ success: false, error: 'You are already registered for this event.' });
        }
        next(err);
    }
});

export default router;
