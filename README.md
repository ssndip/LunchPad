# LunchPad - Smart Canteen Management System

LunchPad is a professional, self-service canteen management solution featuring a high-speed ordering Kiosk and a comprehensive Administrative Dashboard. It is designed to be lightweight, secure, and extremely easy to deploy.

![LunchPad Banner](https://img.shields.io/badge/LunchPad-v1.0.0-blue?style=for-the-badge)
![Built with React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)
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
You can customize the deployment by modifying the `environment` section in `docker-compose.yml`:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ADMIN_PIN` | The PIN used to access the manager dashboard. | `0000` |
| `JWT_SECRET` | Secret key for session security. **Change this for production!** | `secret` |
| `PORT` | The port on which the container will listen. | `3400` |

### 4. Persistence
All data (cards, orders, menu) is stored in a SQLite database located at `data/lunchpad.db`. This directory is mounted as a Docker volume to ensure your data survives container restarts.

---

## 🛠️ Technology Stack

- **Frontend**: React, Vite, Zustand, Tailwind CSS, Framer Motion.
- **Backend**: Node.js, Express, WebSockets.
- **Database**: SQLite.
- **Infrastructure**: Nginx, Docker.

## 📖 Documentation
Detailed documentation for developers and administrators can be found in the [**/docs**](./docs/INDEX.md) directory.

---

Built with ❤️ for better dining experiences.
