import { Request, Response, NextFunction } from 'express';
import { get } from '../db';
import { Role } from '../types';

/** Use after requireAuth. Checks the global role carried in the token. */
export function requireRole(...roles: Role[]) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).json({ success: false, error: 'You do not have permission to do that.' });
            return;
        }
        next();
    };
}

export async function isClubAdmin(userId: number, clubId: number): Promise<boolean> {
    const row = await get(
        `SELECT 1 FROM club_members WHERE club_id = $1 AND user_id = $2 AND role = 'admin'`,
        [clubId, userId]
    );
    return row !== undefined;
}

// The token's role can be stale, so club rights are always read from the db.
// College admins can manage every club.
export function requireClubAdmin(param = 'id') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const clubId = Number(req.params[param]);
            if (req.user?.role === 'college_admin' || (req.user && (await isClubAdmin(req.user.id, clubId)))) {
                next();
                return;
            }
            res.status(403).json({ success: false, error: 'Only admins of this club can do that.' });
        } catch (err) {
            next(err);
        }
    };
}
