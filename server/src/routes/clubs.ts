import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { all, get, withTransaction, isUniqueViolation } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireRole, requireClubAdmin } from '../middleware/roles';
import { parseBody } from '../middleware/validate';

const router = express.Router();

router.param('id', (_req: Request, res: Response, next: NextFunction, value: string) => {
    if (!/^\d+$/.test(value)) {
        res.status(404).json({ success: false, error: 'Club not found.' });
        return;
    }
    next();
});

router.param('userId', (_req: Request, res: Response, next: NextFunction, value: string) => {
    if (!/^\d+$/.test(value)) {
        res.status(404).json({ success: false, error: 'User not found.' });
        return;
    }
    next();
});

const slugify = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

const createSchema = z.object({
    name: z.string().trim().min(2, 'Club name is too short.').max(100),
    description: z.string().trim().max(2000).default(''),
});

const updateSchema = z.object({
    description: z.string().trim().max(2000),
});

const adminSchema = z.object({
    email: z.string().trim().min(1, 'Email is required.'),
});

const CLUB_SELECT = `
    SELECT c.id, c.name, c.slug, c.description, c.created_at,
           COALESCE(
               json_agg(json_build_object('id', u.id, 'name', u.name) ORDER BY u.name)
                   FILTER (WHERE u.id IS NOT NULL),
               '[]'
           ) AS admins
      FROM clubs c
      LEFT JOIN club_members m ON m.club_id = c.id AND m.role = 'admin'
      LEFT JOIN users u ON u.id = m.user_id
`;

// GET /api/clubs
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const clubs = await all(`${CLUB_SELECT} GROUP BY c.id ORDER BY c.name`);
        res.json({ success: true, clubs });
    } catch (err) {
        next(err);
    }
});

// POST /api/clubs (college admin)
router.post(
    '/',
    requireAuth,
    requireRole('college_admin'),
    parseBody(createSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { name, description } = req.body as z.infer<typeof createSchema>;
            const slug = slugify(name);
            if (!slug) {
                return res.status(400).json({ success: false, error: 'Club name needs letters or numbers.' });
            }
            const club = await get(
                'INSERT INTO clubs (name, slug, description) VALUES ($1, $2, $3) RETURNING id, name, slug, description',
                [name, slug, description]
            );
            res.status(201).json({ success: true, club: { ...club, admins: [] } });
        } catch (err) {
            if (isUniqueViolation(err)) {
                return res.status(409).json({ success: false, error: 'A club with that name already exists.' });
            }
            next(err);
        }
    }
);

// PUT /api/clubs/:id (admins of the club)
router.put(
    '/:id',
    requireAuth,
    requireClubAdmin(),
    parseBody(updateSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const club = await get(
                'UPDATE clubs SET description = $1 WHERE id = $2 RETURNING id, name, slug, description',
                [req.body.description, req.params.id]
            );
            if (!club) {
                return res.status(404).json({ success: false, error: 'Club not found.' });
            }
            res.json({ success: true, club });
        } catch (err) {
            next(err);
        }
    }
);

// POST /api/clubs/:id/admins { email } (college admin)
router.post(
    '/:id/admins',
    requireAuth,
    requireRole('college_admin'),
    parseBody(adminSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clubId = Number(req.params.id);
            const result = await withTransaction(async (client) => {
                const club = await client.query('SELECT id FROM clubs WHERE id = $1', [clubId]);
                if (club.rowCount === 0) return { status: 404, error: 'Club not found.' };

                const found = await client.query<{ id: number; name: string; role: string }>(
                    'SELECT id, name, role FROM users WHERE lower(email) = lower($1)',
                    [req.body.email]
                );
                const user = found.rows[0];
                if (!user) return { status: 404, error: 'No account with that email.' };

                await client.query(
                    `INSERT INTO club_members (club_id, user_id, role) VALUES ($1, $2, 'admin')
                     ON CONFLICT (club_id, user_id) DO UPDATE SET role = 'admin'`,
                    [clubId, user.id]
                );
                if (user.role === 'student') {
                    await client.query(`UPDATE users SET role = 'club_admin' WHERE id = $1`, [user.id]);
                }
                return { status: 200, admin: { id: user.id, name: user.name } };
            });

            if ('error' in result) {
                return res.status(result.status).json({ success: false, error: result.error });
            }
            res.json({ success: true, admin: result.admin });
        } catch (err) {
            next(err);
        }
    }
);

// DELETE /api/clubs/:id/admins/:userId (college admin)
router.delete(
    '/:id/admins/:userId',
    requireAuth,
    requireRole('college_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const clubId = Number(req.params.id);
            const userId = Number(req.params.userId);
            const removed = await withTransaction(async (client) => {
                const r = await client.query(
                    `UPDATE club_members SET role = 'member' WHERE club_id = $1 AND user_id = $2 AND role = 'admin'`,
                    [clubId, userId]
                );
                if (r.rowCount === 0) return false;

                // back to student once they no longer run any club
                await client.query(
                    `UPDATE users SET role = 'student'
                      WHERE id = $1 AND role = 'club_admin'
                        AND NOT EXISTS (SELECT 1 FROM club_members WHERE user_id = $1 AND role = 'admin')`,
                    [userId]
                );
                return true;
            });

            if (!removed) {
                return res.status(404).json({ success: false, error: 'That user is not an admin of this club.' });
            }
            res.json({ success: true });
        } catch (err) {
            next(err);
        }
    }
);

export default router;
