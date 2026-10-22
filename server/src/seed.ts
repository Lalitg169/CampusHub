import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, all, get, run } from './db';

/**
 * Sample data for local development.
 *
 *   npm run seed                  # clubs, events, users and 50 posts
 *   npm run seed -- --posts=100000  # bigger post table
 *   npm run seed -- --fresh       # truncate first
 */

const arg = (name: string, fallback: number): number => {
    const match = process.argv.find((a) => a.startsWith(`--${name}=`));
    return match ? Number(match.split('=')[1]) : fallback;
};

const POSTS = arg('posts', 50);
const FRESH = process.argv.includes('--fresh');
const BATCH = 1000;

const PEOPLE = [
    'Aarav Sharma', 'Diya Patel', 'Vihaan Gupta', 'Ananya Iyer', 'Arjun Reddy', 'Ishita Verma',
    'Kabir Singh', 'Meera Nair', 'Rohan Das', 'Saanvi Joshi', 'Aditya Rao', 'Priya Menon',
];

const CLUBS = [
    { name: 'Coding Club', slug: 'coding', description: 'Contests, hack nights and workshops on whatever we are building this month.' },
    { name: 'Robotics Club', slug: 'robotics', description: 'Line followers, drones and a lot of soldering.' },
    { name: 'Music Society', slug: 'music', description: 'Jams, open mics and the annual fest band.' },
    { name: 'Drama Club', slug: 'drama', description: 'Street plays, stage productions and improv evenings.' },
];

const EVENTS = [
    { club: 'coding', title: 'Intro to Git workshop', venue: 'Lab 3, CS Block', inDays: 3, hour: 16, capacity: 40 },
    { club: 'coding', title: 'Hack night', venue: 'Seminar Hall', inDays: 10, hour: 18, capacity: 60 },
    { club: 'robotics', title: 'Line follower build session', venue: 'Workshop, Mech Block', inDays: 5, hour: 14, capacity: 20 },
    { club: 'music', title: 'Open mic', venue: 'Amphitheatre', inDays: 7, hour: 17, capacity: 100 },
    { club: 'drama', title: 'Improv evening', venue: 'Auditorium', inDays: 12, hour: 18, capacity: 3 },
];

const CATEGORIES = ['Technology', 'Databases', 'Frontend', 'DevOps', 'Career', 'Security', 'Finance', 'Language'];

const NOUNS = ['index', 'query', 'cache', 'schema', 'migration', 'pipeline', 'container', 'cluster', 'token', 'session', 'pointer', 'buffer', 'thread', 'socket', 'compiler', 'runtime', 'daemon', 'replica', 'shard', 'transaction', 'deadlock', 'checksum', 'gateway', 'payload', 'latency', 'throughput', 'namespace', 'closure', 'promise', 'stream'];
const VERBS = ['scaling', 'debugging', 'profiling', 'refactoring', 'benchmarking', 'migrating', 'caching', 'testing', 'deploying', 'monitoring', 'optimising', 'securing'];
const ADJS = ['distributed', 'immutable', 'concurrent', 'idempotent', 'atomic', 'lazy', 'eventual', 'strict', 'nested', 'ephemeral', 'durable', 'partial'];
const FILLER = ['the', 'a', 'when', 'because', 'after', 'before', 'while', 'through', 'without', 'against', 'across', 'between', 'during', 'under', 'within'];

let seed = 42;
const rand = (): number => {
    // Deterministic LCG so a given --posts value always produces the same corpus.
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
};
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

const title = (): string => {
    const shape = Math.floor(rand() * 3);
    if (shape === 0) return `${pick(VERBS)} ${pick(ADJS)} ${pick(NOUNS)}s in production`;
    if (shape === 1) return `Why your ${pick(NOUNS)} is ${pick(ADJS)}`;
    return `A practical guide to ${pick(ADJS)} ${pick(NOUNS)}s`;
};

const sentence = (): string => {
    const len = 8 + Math.floor(rand() * 12);
    const words = Array.from({ length: len }, () => pick([...NOUNS, ...VERBS, ...ADJS, ...FILLER]));
    return `${words.join(' ').replace(/^./, (c) => c.toUpperCase())}.`;
};

const body = (): string => {
    const paras = 2 + Math.floor(rand() * 4);
    return Array.from({ length: paras }, () => Array.from({ length: 3 + Math.floor(rand() * 4) }, sentence).join(' ')).join('\n\n');
};

async function main(): Promise<void> {
    if (FRESH) {
        console.log('Truncating existing data…');
        await run(
            `TRUNCATE certificates, tickets, registrations, events, club_members, clubs,
                      likes, comments, password_resets, posts, categories, users RESTART IDENTITY CASCADE`
        );
    }

    // One hash reused across seed users; real registration hashes per user.
    const password = bcrypt.hashSync('password123', 10);

    const accounts = [
        { username: 'admin', name: 'College Admin', role: 'college_admin' },
        ...PEOPLE.map((name, i) => ({
            username: name.split(' ')[0].toLowerCase(),
            name,
            role: i < CLUBS.length ? 'club_admin' : 'student',
        })),
    ];

    await run(
        `INSERT INTO users (username, name, email, role, password)
         SELECT u, n, u || '@campushub.local', r, $1
           FROM unnest($2::text[], $3::text[], $4::text[]) AS x(u, n, r)
         ON CONFLICT (username) DO NOTHING`,
        [password, accounts.map((a) => a.username), accounts.map((a) => a.name), accounts.map((a) => a.role)]
    );
    await run(
        `INSERT INTO categories (name) SELECT c FROM unnest($1::text[]) AS c ON CONFLICT (name) DO NOTHING`,
        [CATEGORIES]
    );
    await run(
        `INSERT INTO clubs (name, slug, description)
         SELECT n, s, d FROM unnest($1::text[], $2::text[], $3::text[]) AS x(n, s, d)
         ON CONFLICT (slug) DO NOTHING`,
        [CLUBS.map((c) => c.name), CLUBS.map((c) => c.slug), CLUBS.map((c) => c.description)]
    );

    // the first few people each run one club
    const admins = accounts.filter((a) => a.role === 'club_admin').map((a) => a.username);
    await run(
        `INSERT INTO club_members (club_id, user_id, role)
         SELECT c.id, u.id, 'admin'
           FROM unnest($1::text[], $2::text[]) AS x(slug, username)
           JOIN clubs c ON c.slug = x.slug
           JOIN users u ON u.username = x.username
         ON CONFLICT DO NOTHING`,
        [CLUBS.map((c) => c.slug), admins]
    );

    const clubs = await all<{ id: number; slug: string }>('SELECT id, slug FROM clubs ORDER BY id');
    const clubId = new Map(clubs.map((c) => [c.slug, c.id]));

    // event times are IST wall-clock, whatever timezone the db runs in
    for (const e of EVENTS) {
        const exists = await get('SELECT 1 FROM events WHERE club_id = $1 AND title = $2', [clubId.get(e.club), e.title]);
        if (exists) continue;
        await run(
            `INSERT INTO events (club_id, title, description, venue, starts_at, ends_at, capacity)
             VALUES ($1, $2, $3, $4,
                     (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + make_interval(days => $5, hours => $6)) AT TIME ZONE 'Asia/Kolkata',
                     (date_trunc('day', NOW() AT TIME ZONE 'Asia/Kolkata') + make_interval(days => $5, hours => $6 + 2)) AT TIME ZONE 'Asia/Kolkata',
                     $7)`,
            [clubId.get(e.club), e.title, `${e.title}. Open to all students.`, e.venue, e.inDays, e.hour, e.capacity]
        );
    }

    const userIds = (await all<{ id: number }>('SELECT id FROM users ORDER BY id')).map((r) => r.id);
    const categoryIds = (await all<{ id: number }>('SELECT id FROM categories ORDER BY id')).map((r) => r.id);
    const clubIds = clubs.map((c) => c.id);
    console.log(`${userIds.length} users, ${clubIds.length} clubs, ${EVENTS.length} events ready.`);

    const started = Date.now();
    let written = 0;

    while (written < POSTS) {
        const size = Math.min(BATCH, POSTS - written);
        const titles: string[] = [];
        const bodies: string[] = [];
        const cats: number[] = [];
        const owners: number[] = [];
        const postClubs: number[] = [];
        const ages: number[] = [];

        for (let i = 0; i < size; i++) {
            titles.push(title());
            bodies.push(body());
            cats.push(pick(categoryIds));
            owners.push(pick(userIds));
            postClubs.push(pick(clubIds));
            ages.push(Math.floor(rand() * 720));
        }

        await run(
            `INSERT INTO posts (title, content, category_id, user_id, club_id, created_at, updated_at)
             SELECT t, b, c, u, cl, NOW() - (age || ' days')::interval, NOW()
               FROM unnest($1::text[], $2::text[], $3::int[], $4::int[], $5::int[], $6::int[]) AS x(t, b, c, u, cl, age)`,
            [titles, bodies, cats, owners, postClubs, ages]
        );

        written += size;
        if (written % 10000 === 0 || written === POSTS) {
            console.log(`  ${written.toLocaleString()} / ${POSTS.toLocaleString()} posts`);
        }
    }

    // Engagement only on the newest slice, so small seeds still look alive.
    const recent = (await all<{ id: number }>('SELECT id FROM posts ORDER BY created_at DESC LIMIT 200')).map((r) => r.id);

    for (const postId of recent) {
        const commentCount = Math.floor(rand() * 4);
        for (let i = 0; i < commentCount; i++) {
            await run('INSERT INTO comments (post_id, user_id, content) VALUES ($1, $2, $3)', [
                postId,
                pick(userIds),
                sentence(),
            ]);
        }
        for (const userId of userIds) {
            if (rand() < 0.3) {
                await run('INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [postId, userId]);
            }
        }
    }

    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nSeeded ${POSTS.toLocaleString()} posts in ${seconds}s.`);
    console.log('Log in as admin, aarav (club admin) or meera (student), password password123');
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
