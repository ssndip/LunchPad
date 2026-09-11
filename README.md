# LunchPad - Smart Canteen Management System

LunchPad is a professional, self-service canteen management solution featuring a high-speed ordering Kiosk and a comprehensive Administrative Dashboard. It is designed to be lightweight, secure, and extremely easy to deploy.

![LunchPad Banner](https://img.shields.io/badge/LunchPad-v1.3.0-blue?style=for-the-badge)
![Built with React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)
![Powered by Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)

---

## 🚀 Key Features

### 🏢 Manager Dashboard
- **Dynamic Menu Management**: Real-time updates for items, categories, and availability.
- **Card & RFID System**: Manage user balances, RFID tags, and security PINs.
- **Comprehensive Analytics**: Visual summaries of revenue, popular items, and daily trends.
- **A4 Reporting**: Generate professional, printable PDF/Paper reports from history filters.
- **Localization**: Full support for English and Bulgarian (extensible).

### 🖥️ User Kiosk
- **RFID Ordering**: Fast, contact-less ordering via RFID cards.
- **Mobile-First Design**: Fully responsive UI that can be installed as a PWA.
- **Real-time Sync**: Updates instantly when the manager changes the menu.
- **Secure Identification**: Optional PIN protection for sensitive accounts.

---

## 🐳 Deployment via Docker (Recommended)

LunchPad is fully containerized. You can deploy the entire stack (Frontend, Backend, Database) in minutes.

### 1. Prerequisites
- [Docker](https://docs.docker.com/get-docker/) installed on your system.
- [Docker Compose](https://docs.docker.com/compose/install/) (included in Docker Desktop).

### 2. Quick Start
Clone the repository and run:

```bash
docker compose up --build -d
```

The application will be available at: **[http://localhost:3400](http://localhost:3400)**

### 3. Environment Configuration
Configuration lives in `.env`, which `docker-compose.yml` reads via `env_file`. It is gitignored, so secrets stay out of the repository:

```bash
cp .env.example .env
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|" .env
```

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ADMIN_PIN` | Dashboard login, until an admin sets a PIN in Settings. | `0000` |
| `JWT_SECRET` | Signs dashboard sessions. Anyone who knows it can mint an admin token without the PIN, so generate a fresh one per deployment. | none — required |
| `TZ` | The canteen's timezone. Decides when the kiosk window opens and when the daily summary rolls over. | `Europe/Sofia` |
| `TRUST_PROXY` | Which peers may set `X-Forwarded-For`, which decides `req.ip` — what the admin whitelist and both rate limiters key off. | `loopback, uniquelocal` |
| `PORT` | The port on which the container will listen. | `3400` |

`.env.example` documents the rest, including the two escape hatches (`ENABLE_TEST_BYPASS`, `DISABLE_ADMIN_WHITELIST`) that must stay unset in production.

The dashboard login is restricted to the local network by the admin IP whitelist. Leaving `ADMIN_PIN` at `0000` is only safe while that holds.

### 4. Persistence
All data (cards, orders, menu) is stored in a SQLite database located at `data/lunchpad.db`. This directory is mounted as a Docker volume to ensure your data survives container restarts. The container writes a daily snapshot to `data/backups/` and keeps the latest 7.

Those snapshots sit on the same disk as the database they protect. `scripts/backup-offbox.sh` copies the newest one to another device, verifies it opens and passes `integrity_check` first, and exits non-zero if the snapshot is missing or stale — so a dead backup timer is noticed. Run it daily from cron:

```
30 3 * * * /path/to/lunchpad/scripts/backup-offbox.sh >/dev/null 2>&1
```

Set `LUNCHPAD_BACKUP_DEST` for the local target and `LUNCHPAD_BACKUP_REMOTE` (an `rsync` target such as `user@host:/srv/lunchpad`) to also push a copy off the machine.

To restore, pick a snapshot in **Settings → Backups**. The server swaps the database file and exits; `restart: always` brings it back within about ten seconds.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Zustand, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, WebSockets.
- **Database**: SQLite.
- **Infrastructure**: Docker.

## 📖 Documentation
Detailed documentation for developers and administrators can be found in the [**/docs**](./docs/INDEX.md) directory.

---

Built with ❤️ for better dining experiences.
