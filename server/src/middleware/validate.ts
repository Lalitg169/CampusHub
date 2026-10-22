import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { z } from 'zod';

/** Turns express-validator failures into a consistent 400 response. */
export function validate(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const list = errors.array();
        res.status(400).json({ success: false, error: list[0].msg, errors: list });
        return;
    }
    next();
}

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

export default validate;
