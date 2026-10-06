# Performance & Development Tracker

Performance & Development Tracker (PDT) is a web application for managing staff performance appraisal (PAR) cycles, colleague feedback and development plans. Employees complete assessments and track agreed actions, supervisors review their teams, and HR manages the appraisal process.

## Hosted application

The application is available at [project-pdt.vercel.app](https://project-pdt.vercel.app/). The client and server are hosted separately on Vercel, with the React client connecting to the Express API.

## Features

- Appraisal cycles with staged transitions, publication and cancellation.
- Self-assessments, assigned colleague feedback and supervisor reviews.
- Colleague reviewer selection, supervisor list confirmation and HR decisions.
- Summary checks before publication, followed by employee result acknowledgement.
- Development plans with actions, progress notes and check-ins.
- Improvement plans with HR approval, outcome recording and escalation handling.
- Employee records, organisational units, dated memberships, HR coverage and project assignments.
- Role-specific dashboards, monitoring flags, audit trails and company reports.
- Light and dark themes, a collapsible sidebar and mobile navigation.

Reviewer confidentiality is central to the application. Ordinary feedback views do not expose reviewer identities. Identity reveals require authorised HR access and a written reason, and are recorded in the audit trail. The server enforces HR coverage and reporting-line restrictions independently of what the interface displays.

## Technology

| Layer          | Stack                                                  |
| -------------- | ------------------------------------------------------ |
| Frontend       | React, React Router, Vite, Tailwind CSS                |
| Backend        | Node.js, Express, Mongoose                             |
| Database       | MongoDB Atlas                                          |
| Authentication | JSON Web Tokens and bcrypt                             |
| Validation     | Yup on the client and request validators on the server |
| Browser tests  | Playwright                                             |

## Running locally

Install Node.js and npm, and have access to a configured MongoDB database. Run the server and client in separate terminals from the repository root.

### Server

```sh
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and set:

- `MONGO_URI`: the MongoDB connection string, including the intended database name.
- `JWT_SECRET`: the secret used to sign authentication tokens.
- `JWT_EXPIRES_IN`: the token lifetime.
- `PORT`: the API port, defaulting to `5000`.
- `CLIENT_URL`: the frontend address, normally `http://localhost:5173`.

```sh
npm run dev
```

The API runs at `http://localhost:5000/api` with the default configuration.

### Client

```sh
cd client
npm install
```

Copy `client/.env.example` to `client/.env`. Set `VITE_API_URL` to the API address, normally `http://localhost:5000/api`.

```sh
npm run dev
```

Vite prints the frontend address, normally `http://localhost:5173`. If the port changes, update the server's `CLIENT_URL` to match.

There is no public registration endpoint. Sign in with an existing account or activate an account invited by HR. An empty database needs an initial account provisioned separately.

## Project structure

```text
client/
  src/
    components/   Shared layout, forms and workflow components
    hooks/        Authentication, cycle and team hooks
    pages/        Dashboards and workflow screens
    services/     API calls
    utils/        Navigation metadata, labels and formatting
server/
  src/
    routes/       API endpoints
    controllers/  Request and response handling
    services/     Business rules and access checks
    models/       Mongoose models
    middleware/   Authentication, authorisation and identity protection
    validators/   Request validation
tests/
  pages/          Playwright page objects
  tests/          Browser tests
```

## Checks

Frontend lint and production build:

```sh
cd client
npm run lint
npm run build
```

Backend lint, formatting and application load check:

```sh
cd server
npm test
```

Browser tests require the test configuration described in `tests/.env.example`. The Playwright configuration starts a separate API and frontend and targets the `qa` database.

```sh
cd tests
npm install
npx playwright install chromium
npm test
```
