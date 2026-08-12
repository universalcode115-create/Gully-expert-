# GullyExpert

GullyExpert is a hyper-local home-services marketplace that connects customers with nearby service partners. The application includes customer and service-partner roles, provider discovery, service storefronts, job requests, partner availability, job completion, and verified reviews.

## Independent architecture

This repository is designed to run without Manus OAuth, Manus APIs, Manus storage, or Manus-only frontend runtime code. Authentication is first-party email/password authentication using `scrypt` password hashing, signed JWT sessions, and an HTTP-only cookie. The backend is an Express server with tRPC, the frontend is React with Vite, and persistence uses MySQL through Drizzle ORM.

| Layer | Technology | Owner-controlled configuration |
|---|---|---|
| Frontend | React, Vite, Tailwind CSS | Source code in `client/` |
| Backend | Node.js, Express, tRPC | Source code in `server/` |
| Authentication | Local email/password, `scrypt`, JWT | `JWT_SECRET` in your own environment |
| Database | MySQL or compatible TiDB | `DATABASE_URL` in your own environment |
| ORM and migrations | Drizzle ORM and Drizzle Kit | `drizzle/` |
| Hosting | Any Node.js host or your own VPS | `PORT`, reverse proxy, and domain |
| Images | URL fields in partner profiles | Use your own storage/CDN URLs |

## Main features

- Public landing page with service categories and how-it-works content.
- Customer and Service Partner role selection during registration.
- Local email/password registration, login, logout, and session restoration.
- Provider discovery by category, text location, and browser coordinates.
- Dedicated provider profile route with photo URL, verification state, rating data, experience, base price, portfolio URLs, and contact actions.
- Service-partner onboarding and storefront editing.
- Customer job posting and partner request management.
- Partner online/offline availability toggle.
- Job completion flow and review submission only for eligible completed jobs.
- No fabricated ratings, reviews, or verification claims; trust signals are data-backed.

## Repository map

| Path | Purpose |
|---|---|
| `client/src/App.tsx` | Application routes and top-level providers |
| `client/src/pages/Home.tsx` | Public marketplace, auth dialog, discovery, job posting, and dashboards |
| `client/src/pages/ProviderProfile.tsx` | Dedicated provider profile route |
| `client/src/components/` | Reusable UI and layout components |
| `client/src/main.tsx` | React and tRPC client bootstrap |
| `client/src/index.css` | Theme, typography, responsive styles, and motion |
| `server/auth.ts` | Password hashing, JWT session creation, verification, and cookies |
| `server/db.ts` | Drizzle queries for users, partners, services, jobs, and reviews |
| `server/routers.ts` | Typed tRPC authentication and marketplace procedures |
| `server/_core/context.ts` | Reads the local session cookie or bearer token |
| `server/_core/index.ts` | Express server and production static-file serving |
| `drizzle/schema.ts` | MySQL schema and TypeScript database types |
| `drizzle/*.sql` | Committed database migrations |
| `docs/environment.example` | Safe environment-variable template with placeholders |
| `scripts/seed-services.mjs` | Idempotent default service-catalog seed command |
| `.github/workflows/ci.yml` | GitHub Actions check, test, and build workflow |

## Requirements

Install Node.js 22 or newer, pnpm 10, Git, and MySQL 8 or a compatible MySQL/TiDB service. A production server should also use a reverse proxy such as Nginx and HTTPS.

## Step 1: Put the project in GitHub

From the project management panel, export the current project through **Settings → GitHub**, or download the project files and push them manually. For a manual push, create an empty private repository on GitHub and run:

```bash
git init
git branch -M main
git add .
git commit -m "Initial independent GullyExpert marketplace"
git remote add origin https://github.com/YOUR_USERNAME/gully-expert.git
git push -u origin main
```

Replace `YOUR_USERNAME` and the repository name with your own values. Do not commit `.env`, database dumps, private keys, or production credentials.

## Step 2: Configure a local database

Create a MySQL database and user. One example for a local MySQL installation is:

```sql
CREATE DATABASE gullyexpert CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'gullyexpert'@'localhost' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON gullyexpert.* TO 'gullyexpert'@'localhost';
FLUSH PRIVILEGES;
```

Copy the safe template and edit it with your own values:

```bash
cp docs/environment.example .env
```

At minimum, set `DATABASE_URL` and replace `JWT_SECRET` with a long random value. Generate one with:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Step 3: Install, migrate, and run locally

```bash
corepack enable
pnpm install
pnpm db:migrate
pnpm db:seed-services
pnpm check
pnpm test
pnpm dev
```

`pnpm db:seed-services` is idempotent. It inserts or refreshes the six default service categories—Plumber, Electrician, Home Salon, Tutor, AC Repair, and Carpenter—without creating users, partners, ratings, or reviews. Open `http://localhost:3000`. Registration is local and does not redirect to an external OAuth provider. Choose **Customer** or **Service Partner** explicitly in the registration form.

For a production build:

```bash
pnpm build
NODE_ENV=production pnpm start
```

The server listens on `process.env.PORT`; it does not hardcode a production port.

## Step 4: Database workflow for future schema changes

Edit `drizzle/schema.ts`, generate a migration, review the generated SQL, and apply it to the database:

```bash
pnpm db:generate
pnpm db:migrate
```

Keep generated migration files under `drizzle/` in GitHub. Run migrations against a backup or staging database first when modifying an existing production database. Never use destructive SQL casually because database data is not recoverable by the application.

## Step 5: Deploy on your own Ubuntu VPS

Create an Ubuntu VPS with a domain name pointing to its public IP. Install Node.js 22, Git, and pnpm, then clone the repository:

```bash
sudo apt update
sudo apt install -y git nginx mysql-client
# Install Node.js 22 using your preferred official Node.js setup method.
# Then enable the package manager:
corepack enable
corepack prepare pnpm@10.4.1 --activate

git clone https://github.com/YOUR_USERNAME/gully-expert.git /var/www/gully-expert
cd /var/www/gully-expert
cp docs/environment.example .env
nano .env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm db:seed-services
pnpm build
```

Use a process manager so the Node process restarts after a reboot. For example, with PM2:

```bash
pnpm add --global pm2
pm2 start dist/index.js --name gullyexpert --update-env
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup` with `sudo` when prompted. The application should remain behind Nginx rather than exposing the Node port directly to the public internet.

Example Nginx site configuration:

```nginx
server {
    listen 80;
    server_name example.com www.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

After verifying the HTTP site, enable HTTPS with Certbot and update `APP_ORIGIN` to your HTTPS domain. The local session cookie automatically becomes secure when the request is HTTPS or carries `X-Forwarded-Proto: https`.

## Step 6: GitHub Actions

Every push and pull request runs TypeScript checking, Vitest, and the production build through `.github/workflows/ci.yml`. This workflow does not need production secrets because it validates the code structure and build. Add deployment secrets only if you later choose automated VPS deployment.

## Security checklist

Use a unique strong `JWT_SECRET` in every environment. Keep `.env` outside Git history. Use HTTPS in production, restrict MySQL to the application server or private network, use a separate database user with only required privileges, back up the database, and rotate credentials if they are ever exposed. Add rate limiting, email verification, password reset, and an external transactional email provider before opening registration to a large public audience.

## Current image-storage behavior

Partner profile photos and past-work images are stored as URL strings in the database. This keeps the independent starter deployment simple. For production uploads, connect the app to your own S3-compatible provider such as Cloudflare R2, AWS S3, or Backblaze B2 and add a server upload route that validates MIME type, file size, ownership, and access permissions. Do not store image bytes in MySQL.

## What is intentionally not included

There is no Manus OAuth callback, Manus storage proxy, Manus analytics script, Manus built-in API call, or Manus-only debug runtime in the independent application path. Existing product data in a managed environment is not automatically copied into a new GitHub/VPS database; export and migrate data separately if you need to preserve it.
