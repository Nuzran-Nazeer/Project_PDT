# Project_PDT

Performance & Development Tracker — a web app for running appraisal (PAR) cycles, 360 feedback and development plans.

MERN stack: Node · Express · MongoDB (Atlas) · React · Vite · Tailwind.

## Running locally

You need two terminals — the server and the client run separately.

### Server

```
cd server
npm install
cp .env.example .env   # then fill in real values — ask a teammate for MONGO_URI
npm run dev
```

Runs on `http://localhost:5000` (or whatever `PORT` is set to in `.env`).

### Client

```
cd client
npm install
npm run dev
```

Runs on `http://localhost:5173` by default — Vite will print the actual URL.

## Project structure

- `server/` — Express API. Layered as `routes` → `controllers` → `services` → `models`, with `middleware` and `validators` alongside.
- `client/` — React app (Vite + Tailwind).

See `Docs/` (one level up, in the `PPPM` folder) for the full design record — architecture, data model, and decisions.
