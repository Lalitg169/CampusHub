import express, { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { get, isUniqueViolation } from '../db';
import { requireAuth, signToken } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { authLimiter } from '../middleware/rateLimit';
import { UserRow } from '../types';

const router = express.Router();

// bcryptjs is pure JavaScript, so its *Sync calls hold the event loop for the
// whole hash. The async versions let other requests in between.
const BCRYPT_ROUNDS = 10;

type PublicUser = Pick<UserRow, 'id' | 'name' | 'email' | 'role'>;

const registerSchema = z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
    email: z.string().trim().toLowerCase().pipe(z.email('Please enter a valid email.')),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(72),
});

const loginSchema = z.object({
    email: z.string().trim().min(1, 'Email is required.'),
    password: z.string().min(1, 'Password is required.'),
});

// POST /api/auth/register
router.post('/register', authLimiter, parseBody(registerSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, email, password } = req.body as z.infer<typeof registerSchema>;
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        const user = await get<PublicUser>(
            `INSERT INTO users (name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, name, email, role`,
            [name, email, hash]
        );

        return res.status(201).json({ success: true, token: signToken(user!), user });
    } catch (err) {
        if (isUniqueViolation(err)) {
            return res.status(409).json({ success: false, error: 'An account with that email already exists.' });
        }
        next(err);
    }
});

// POST /api/auth/login
router.post('/login', authLimiter, parseBody(loginSchema), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body as z.infer<typeof loginSchema>;
        const user = await get<UserRow>(
            'SELECT id, name, email, role, password_hash FROM users WHERE lower(email) = lower($1)',
            [email]
        );

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ success: false, error: 'Invalid email or password.' });
        }

        const { password_hash: _, ...publicUser } = user;
        return res.json({ success: true, token: signToken(user), user: publicUser });
    } catch (err) {
        next(err);
    }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = await get<PublicUser>('SELECT id, name, email, role FROM users WHERE id = $1', [req.user!.id]);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found.' });
        }
        return res.json({ success: true, user });
    } catch (err) {
        next(err);
    }
});

export default router;
