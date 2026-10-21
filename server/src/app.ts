import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

import { config } from './config';
import { pool } from './db';
import postRoutes from './routes/posts';
import authRoutes from './routes/auth';
import categoryRoutes from './routes/categories';
import uploadRoutes from './routes/upload';
import { apiLimiter } from './middleware/rateLimit';
import './types';

const app = express();

// Number of proxies in front of the app, so req.ip (and the rate limiter)
// sees the real client. Never `true` on a public deployment.
if (config.trustProxy > 0) {
    app.set('trust proxy', config.trustProxy);
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

app.get('/', (_req: Request, res: Response) => {
    res.json({ message: 'CampusHub API' });
});

app.get('/api/health', async (_req: Request, res: Response) => {
    try {
        await pool.query('SELECT 1');
        res.json({ success: true, status: 'ok', database: 'connected' });
    } catch {
        res.status(503).json({ success: false, status: 'degraded', database: 'unreachable' });
    }
});

app.use('/api', apiLimiter);
app.use('/api/posts', postRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req: Request, res: Response) => {
    res.status(404).json({ success: false, error: `${req.method} ${req.url} not found` });
});

interface HttpError extends Error {
    statusCode?: number;
}

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    const status = err.statusCode || 500;
    res.status(status).json({
        success: false,
        error: status >= 500 ? 'Internal Server Error' : err.message || 'Request failed',
    });
});

export default app;
