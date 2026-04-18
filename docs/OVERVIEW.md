# Project Overview: LunchPad

LunchPad is a modern, high-performance canteen management system designed for speed, reliability, and ease of use. It provides a dual-interface experience: a user-facing **Kiosk** for ordering and an **Administrative Dashboard** for management.

## Core Features

- **RFID-Powered Ordering**: Users identify themselves via RFID cards for instant ordering.
- **Dynamic Menu Management**: Real-time menu updates with support for side dishes, tags, and categories.
- **Card Management**: Bulk import/export of cards, balance tracking, and PIN security.
- **Comprehensive Analytics**: Visual summaries of daily orders, revenue, and historical trends.
- **A4 Reporting**: Professional, printable history reports for administrative documentation.
- **Multilingual Support**: Built-in support for English and Bulgarian, with an extensible translation system.

## Technology Stack

### Frontend
- **Framework**: React 18 with Vite.
- **State Management**: Zustand (Slice-based architecture).
- **Animations**: Framer Motion for premium UI feel.
- **Icons**: Lucide-React.
- **Styling**: Tailwind CSS for responsive, modern design.

### Backend
- **Runtime**: Node.js with Express.
- **Database**: SQLite (local persistence).
- **Security**: JWT-based authentication for the Manager dashboard.
- **Communication**: WebSockets for real-time synchronization between clients and server.

### Infrastructure
- **Containerization**: Fully Dockerized for zero-dependency deployment.
- **Reverse Proxy**: Nginx (via Docker) for production serving.
