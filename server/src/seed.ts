import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, all, get, run } from './db';

/**
 * Sample data for local development.
 *
 *   npm run seed            # users, clubs, events and a few posts
 *   npm run seed -- --fresh # truncate first
 */

const FRESH = process.argv.includes('--fresh');

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

const POSTS = [
    { club: 'coding', title: 'Welcome back!', content: 'First meetup of the semester is this Friday. Bring a laptop, we will set up Git and pick projects for the term.', daysAgo: 9 },
    { club: 'coding', title: 'Contest results', content: 'Congrats to everyone who took part in the weekend contest. Solutions are up on the club drive.', daysAgo: 2 },
    { club: 'robotics', title: 'Workshop kits are in', content: 'The new motor driver kits arrived. First come, first served at the build session.', daysAgo: 4 },
    { club: 'music', title: 'Open mic sign-ups', content: 'Want to perform at the open mic? Register for the event and tell us what you will play.', daysAgo: 3 },
    { club: 'drama', title: 'Auditions next week', content: 'We are casting for the winter production. Improv evening is a good warm-up, seats are limited.', daysAgo: 1 },
];

async function main(): Promise<void> {
    if (FRESH) {
        console.log('Truncating existing data…');
        await run(
            'TRUNCATE certificates, tickets, registrations, events, posts, club_members, clubs, users RESTART IDENTITY CASCADE'
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
        `INSERT INTO users (username, name, email, role, password_hash)
         SELECT u, n, u || '@campushub.local', r, $1
           FROM unnest($2::text[], $3::text[], $4::text[]) AS x(u, n, r)
         ON CONFLICT (username) DO NOTHING`,
        [password, accounts.map((a) => a.username), accounts.map((a) => a.name), accounts.map((a) => a.role)]
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

    for (const p of POSTS) {
        const exists = await get('SELECT 1 FROM posts WHERE club_id = $1 AND title = $2', [clubId.get(p.club), p.title]);
        if (exists) continue;
        await run(
            `INSERT INTO posts (club_id, author_id, title, content, created_at)
             SELECT m.club_id, m.user_id, $2, $3, NOW() - make_interval(days => $4)
               FROM club_members m
              WHERE m.club_id = $1 AND m.role = 'admin'
              LIMIT 1`,
            [clubId.get(p.club), p.title, p.content, p.daysAgo]
        );
    }

    console.log(`${accounts.length} users, ${CLUBS.length} clubs, ${EVENTS.length} events, ${POSTS.length} posts.`);
    console.log('Log in as admin@, aarav@ (club admin) or meera@ (student) campushub.local, password password123');
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
