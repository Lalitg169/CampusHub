import express, { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db';
import { requireAuth } from '../middleware/auth';
import { requireClubAdmin } from '../middleware/roles';
import { parseBody } from '../middleware/validate';

// mounted at /api/clubs/:id/posts
const router = express.Router({ mergeParams: true });

router.use((req: Request, res: Response, next: NextFunction) => {
    if (!/^\d+$/.test(String(req.params.id))) {
        res.status(404).json({ success: false, error: 'Club not found.' });
        return;
    }
    next();
});

const PAGE_SIZE = 20;

const postSchema = z.object({
    title: z.string().trim().min(3, 'Title is too short.').max(200),
    content: z.string().trim().min(1, 'Write something first.').max(10000),
});

const POST_SELECT = `
    SELECT p.id, p.club_id, p.title, p.content, p.created_at, u.name AS author
      FROM posts p
      LEFT JOIN users u ON u.id = p.author_id
`;

// GET /api/clubs/:id/posts?page=1
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const page = Math.max(1, Number(req.query.page) || 1);
        const posts = await all(
            `${POST_SELECT} WHERE p.club_id = $1 ORDER BY p.created_at DESC, p.id DESC LIMIT $2 OFFSET $3`,
            [req.params.id, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        );
        res.json({ success: true, page, posts });
    } catch (err) {
        next(err);
    }
});

// POST /api/clubs/:id/posts
router.post(
    '/',
    requireAuth,
    requireClubAdmin(),
    parseBody(postSchema),
    async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { title, content } = req.body as z.infer<typeof postSchema>;
            const created = await get<{ id: number }>(
                'INSERT INTO posts (club_id, author_id, title, content) VALUES ($1, $2, $3, $4) RETURNING id',
                [req.params.id, req.user!.id, title, content]
            );
            const post = await get(`${POST_SELECT} WHERE p.id = $1`, [created!.id]);
            res.status(201).json({ success: true, post });
        } catch (err) {
            next(err);
        }
    }
);

// DELETE /api/clubs/:id/posts/:postId
router.delete('/:postId', requireAuth, requireClubAdmin(), async (req: Request, res: Response, next: NextFunction) => {
    try {
        // club_id in the WHERE so an admin of one club can't delete another club's post
        const deleted = await run('DELETE FROM posts WHERE id = $1 AND club_id = $2', [
            Number(req.params.postId) || 0,
            req.params.id,
        ]);
        if (deleted === 0) {
            return res.status(404).json({ success: false, error: 'Post not found.' });
        }
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
