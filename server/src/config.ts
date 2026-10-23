import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
    NODE_ENV: z.enum(['development', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: z.enum(['true', 'false']).optional(),
    PGPOOL_MAX: z.coerce.number().int().positive().default(10),
    JWT_SECRET: z.string().min(16, 'JWT_SECRET should be at least 16 characters'),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error('Invalid environment, check server/.env against .env.example:');
    for (const issue of parsed.error.issues) {
        console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
}

const env = parsed.data;

export const config = {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    databaseSsl: env.DATABASE_SSL,
    poolMax: env.PGPOOL_MAX,
    jwtSecret: env.JWT_SECRET,
    trustProxy: env.TRUST_PROXY,
    // comma separated, e.g. "http://localhost:5173,http://localhost:8080"
    clientOrigins: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
};
