# CampusHub

College clubs post updates and run events; students follow along and sign up.

Work in progress. `server/` is an Express + TypeScript API on PostgreSQL, `client/` is a React + TypeScript app built with Vite.

## Running locally

Needs Node 20+ and either Docker or a local Postgres. The database listens on host port **5433** so it doesn't clash with a Postgres already on 5432.

```bash
# database
npm --prefix server run db:up          # docker, or: ./scripts/dev-db.sh start

# api on :5000
cd server
npm install
cp .env.example .env                   # set JWT_SECRET (openssl rand -hex 32)
npm run db:migrate
npm run seed
npm run dev

# client on :5173 (another terminal)
cd client
npm install
npm run dev
```

Seed accounts all use the password `password123`: `admin@campushub.local` (college admin), `aarav@campushub.local` (Coding Club admin), `meera@campushub.local` (student).

## Server scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | API in watch mode |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run typecheck` | Type check only |
| `npm run db:up` / `db:down` / `db:reset` | Postgres container |
| `npm run db:migrate` | Apply pending `migrations/*.sql` |
| `npm run seed` | Sample users, clubs, events and posts (`-- --fresh` to truncate first) |
