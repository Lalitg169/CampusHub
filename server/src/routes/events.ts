import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { isClubAdmin } from '../middleware/roles';
import { parseBody } from '../middleware/validate';
import { AuthUser } from '../types';

const router = express.Router();

router.param('id', (_req: Request, res: Response, next: NextFunction, value: string) => {
    if (!/^\d+$/.test(value)) {
        res.status(404).json({ success: false, error: 'Event not found.' });
        return;
    }
    next();
});

const datetime = z.iso.datetime({ offset: true, message: 'Use a full date and time.' });

const eventFields = {
    title: z.string().trim().min(3, 'Title is too short.').max(200),
    description: z.string().trim().max(5000).default(''),
    venue: z.string().trim().max(200).default(''),
    startsAt: datetime,
    endsAt: datetime.nullable().optional(),
    capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.').max(5000),
};

const endsAfterStart = (e: { startsAt: string; endsAt?: string | null }) =>
    !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt);

const createSchema = z
    .object({ clubId: z.coerce.number().int().positive(), ...eventFields })
    .refine(endsAfterStart, { message: 'The event must end after it starts.' })
    .refine((e) => new Date(e.startsAt) > new Date(), { message: 'The event has to be in the future.' });

const updateSchema = z.object(eventFields).refine(endsAfterStart, { message: 'The event must end after it starts.' });

const EVENT_SELECT = `
    SELECT e.id, e.club_id, e.title, e.description, e.venue, e.starts_at, e.ends_at, e.capacity,
           c.name AS club_name, c.slug AS club_slug,
           (SELECT count(*)::int FROM registrations r
             WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed
      FROM events e
      JOIN clubs c ON c.id = e.club_id
`;

async function canManage(user: AuthUser | undefined, clubId: number): Promise<boolean> {
    if (!user) return false;
    return user.role === 'college_admin' || isClubAdmin(user.id, clubId);
}

// GET /api/events?club=coding&when=upcoming|past
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const past = req.query.when === 'past';
        const params: unknown[] = [];
        let where = past ? 'e.starts_at < NOW()' : 'e.starts_at >= NOW()';
        if (typeof req.query.club === 'string') {
            params.push(req.query.club);
            where += ` AND c.slug = $${params.length}`;
        }
        const events = await all(
            `${EVENT_SELECT} WHERE ${where} ORDER BY e.starts_at ${past ? 'DESC' : 'ASC'} LIMIT 100`,
            params
        );
        res.json({ success: true, events });
    } catch (err) {
        next(err);
    }
});

// GET /api/events/:id
router.get('/:id', optionalAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const event = await get<{ club_id: number }>(`${EVENT_SELECT} WHERE e.id = $1`, [req.params.id]);
        if (!event) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }
        res.json({ success: true, event: { ...event, canManage: await canManage(req.user, event.club_id) } });
    } catch (err) {
        next(err);
    }
});

// POST /api/events
router.post('/', requireAuth, parseBody(createSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const e = req.body as z.infer<typeof createSchema>;
        if (!(await canManage(req.user, e.clubId))) {
            return res.status(403).json({ success: false, error: 'Only admins of this club can create events.' });
        }
        const created = await get<{ id: number }>(
            `INSERT INTO events (club_id, title, description, venue, starts_at, ends_at, capacity, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [e.clubId, e.title, e.description, e.venue, e.startsAt, e.endsAt ?? null, e.capacity, req.user!.id]
        );
        const event = await get(`${EVENT_SELECT} WHERE e.id = $1`, [created!.id]);
        res.status(201).json({ success: true, event });
    } catch (err) {
        next(err);
    }
});

// PUT /api/events/:id
router.put('/:id', requireAuth, parseBody(updateSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await get<{ club_id: number; confirmed: number }>(`${EVENT_SELECT} WHERE e.id = $1`, [
            req.params.id,
        ]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }
        if (!(await canManage(req.user, existing.club_id))) {
            return res.status(403).json({ success: false, error: 'Only admins of this club can edit events.' });
        }

        const e = req.body as z.infer<typeof updateSchema>;
        if (e.capacity < existing.confirmed) {
            return res.status(409).json({
                success: false,
                error: `${existing.confirmed} seats are already taken, capacity can't go below that.`,
            });
        }

        await run(
            `UPDATE events
                SET title = $1, description = $2, venue = $3, starts_at = $4, ends_at = $5, capacity = $6
              WHERE id = $7`,
            [e.title, e.description, e.venue, e.startsAt, e.endsAt ?? null, e.capacity, req.params.id]
        );
        const event = await get(`${EVENT_SELECT} WHERE e.id = $1`, [req.params.id]);
        res.json({ success: true, event });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/events/:id
router.delete('/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await get<{ club_id: number }>('SELECT club_id FROM events WHERE id = $1', [req.params.id]);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Event not found.' });
        }
        if (!(await canManage(req.user, existing.club_id))) {
            return res.status(403).json({ success: false, error: 'Only admins of this club can delete events.' });
        }
        await run('DELETE FROM events WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
