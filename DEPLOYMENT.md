# Synth World — IONOS Deployment Guide

## What you're deploying

- **`apps/api`** — Express + MariaDB backend (Node.js, port 4000)
- **`apps/web`** — React/Vite frontend (static files served by Apache/Nginx)

---

## Step 1 — Run the database schema

Connect to your IONOS MariaDB from your local machine (or IONOS phpMyAdmin):

```bash
mysql -h db5020048592.hosting-data.io -u dbu5375573 -p dbs15459646 < schema.sql
```

Or paste the contents of `schema.sql` into phpMyAdmin → SQL tab.

---

## Step 2 — Deploy the API (Node.js)

IONOS VPS / Managed Node.js hosting:

```bash
# On your server — clone or upload the repo
git clone https://github.com/MythRoll/synth-world.git
cd synth-world

# Install root workspace dependencies
npm install

# Create the API .env file
cp apps/api/.env.example apps/api/.env
nano apps/api/.env   # fill in your real values
```

**Set your `.env` values:**

```
DB_HOST=db5020048592.hosting-data.io
DB_PORT=3306
DB_NAME=dbs15459646
DB_USER=dbu5375573
DB_PASSWORD=CfmyB6ixHhR7@hQ
PORT=4000
JWT_SECRET=some-very-long-random-string-here
JWT_EXPIRY=7d
```

**Generate a secure JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Start the API with PM2 (recommended):**
```bash
npm install -g pm2
cd apps/api && npm install
pm2 start src/server.js --name synth-api
pm2 save
pm2 startup   # makes it restart on server reboot
```

**Or without PM2:**
```bash
cd apps/api && npm install && npm start
```

---

## Step 3 — Build and deploy the frontend

```bash
# From repo root
# Create web .env
echo "VITE_API_BASE_URL=https://yourdomain.com" > apps/web/.env.production

# Build
npm run build   # outputs to apps/web/dist/
```

Upload the `apps/web/dist/` folder to your IONOS web root (public_html or similar).

---

## Step 4 — Apache config for the frontend (SPA routing)

Create a `.htaccess` in your web root:

```apache
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

---

## Step 5 — Reverse proxy the API (Apache)

In your Apache VirtualHost config (or `.htaccess` if allowed):

```apache
ProxyRequests Off
ProxyPass /api http://localhost:4000/api
ProxyPassReverse /api http://localhost:4000/api
```

This makes `https://yourdomain.com/api/*` forward to Node.js on port 4000.

---

## Step 6 — Set CORS correctly

In `apps/api/src/server.js`, tighten the CORS origin once you know your domain:

```js
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true,
}));
```

---

## Step 7 — Verify it's working

```bash
# Health check
curl https://yourdomain.com/api/health
# Expected: {"ok":true,"service":"synth-world-api"}

# Test auth
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
# Expected: {"token":"...","user":{"id":"...","email":"test@example.com"}}
```

---

## Admin setup

After registering your admin account, insert a row into the `admins` table:

```sql
INSERT INTO admins (id, user_id)
SELECT UUID(), id FROM users WHERE email = 'djbrookman@googlemail.com';
```

---

## Quick troubleshoot

| Symptom | Fix |
|---|---|
| `Error: Access denied for user` | Check DB_USER/DB_PASSWORD in `.env` |
| `ECONNREFUSED` on DB | Check DB_HOST and that IONOS allows remote connections |
| Frontend shows blank page | Check `VITE_API_BASE_URL` in web `.env.production` |
| CORS errors in browser | Tighten / fix the `cors()` origin in `server.js` |
| 401 on protected routes | JWT_SECRET mismatch between old and new tokens — re-login |
