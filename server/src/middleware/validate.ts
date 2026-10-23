import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function parseBody(schema: z.ZodType) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({ success: false, error: result.error.issues[0].message });
            return;
        }
        req.body = result.data;
        next();
    };
}
