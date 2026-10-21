import { config } from './config';
import app from './app';
import { pool } from './db';

const server = app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`\n${signal} received, shutting down.`);
        server.close(() => {
            pool.end().finally(() => process.exit(0));
        });
    });
}
