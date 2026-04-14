# 🍱 LunchPad Project Summary

LunchPad is a full-stack, enterprise-grade lunch kiosk and management system designed for local workplace environments. It facilitates automated menu parsing, RFID-based ordering, and comprehensive administrative oversight.

---

## 🚀 Core Mission
To streamline the daily lunch ordering workflow by providing:
1.  **A frictionless Kiosk interface** for workers to place orders using RFID cards.
2.  **A powerful Admin Dashboard** for kitchen managers to curate menus, manage accounts, and analyze distribution fees.
3.  **Real-time synchronization** across all devices to ensure menu availability and order statuses are always up-to-date.

---

## 🛠 Technical Stack

### **Frontend**
- **Framework**: React 19 (TypeScript)
- **Bundler**: Vite
- **State Management**: Zustand (Centralized store in `src/store/useStore.ts`)
- **Styling**: Vanilla CSS + Tailwind CSS (for layout and utilities)
- **Animations**: Framer Motion (smooth transitions and status feedback)
- **Icons**: Lucide-React
- **Real-time**: Native WebSockets via custom hook `useWebSocket.ts`.

### **Backend**
- **Runtime**: Node.js
- **Server**: Express (Modular architecture with routes and controllers)
- **Database**: SQLite provided by `better-sqlite3`
- **Authentication**: JWT-based auth for administrative tasks, with bcrypt-hashed PIN verification.
- **Communication**: WebSocket server (`ws`) for broadcasting state changes (Menu updates, status toggles).

### **Infrastructure**
- **Environment**: Docker & Docker Compose setup for consistent deployment.
- **Tools**: `tsx` for running TypeScript server-side without a build step in dev.

---

## 🏗 System Architecture & Design Patterns

### **Real-Time State Broadcast**
The system uses a "Broadcast on Mutation" pattern. Whenever an administrator updates the menu or toggles kiosk settings:
1.  The server updates the SQLite database.
2.  The server immediately broadcasts a message (e.g., `MENU_UPDATE`, `STATUS_UPDATE`) to all connected WebSocket clients.
3.  Clients update their local Zustand store, triggering instant UI updates across all kiosks and admin panels.

### **Modular UI**
- **Kiosk Mode**: A simplified, high-contrast UI optimized for terminal/tablet interaction.
- **Manager Mode**: A multi-tab dashboard (Menu, Orders, History, Cards, Settings, Analytics) for full system control.

---

## 📊 Database Schema (SQLite)

### **`cards`**
Tracks user accounts and balances.
- `rfid` (TEXT, PK): Unique identifier from RFID tags.
- `ownerName` (TEXT): Name of the cardholder.
- `balance` (REAL): Current owed balance (negative or zero usually indicating debt).
- `isAdmin` (INTEGER): Flag for administrative access level (0/1).
- `lastUpdated` (TEXT): ISO timestamp of the last activity.

### **`menu`**
Stores the daily available items.
- `id` (INTEGER, PK): Item identifier.
- `name` (TEXT): Name of the dish.
- `description` (TEXT): Description or ingredients.
- `price` (REAL): Base price of the item.
- `category` (TEXT): Grouping (e.g., Soups, Main Dish, Dessert).
- `available` (INTEGER): Boolean flag for availability.
- **Advanced Logic Side-Dish Support**:
    - `requiresSideChoice` (INTEGER): If true, prompts for a side selection.
    - `sideChoices` (TEXT/JSON): List of permitted side dish names.
    - `hasIncludedSide` (INTEGER): If true, indicates the side is included in the price.

### **`orders`**
Historical log of all placed orders.
- `id` (TEXT, PK): Unique order GUID.
- `rfid` (TEXT): Card used for the order.
- `items` (TEXT/JSON): Stringified array of items + selected side dishes.
- `totalPrice` (REAL): Calculated cost at time of order.
- `timestamp` (TEXT): ISO date/time of placement.
- `status` (TEXT): e.g., 'completed', 'cancelled'.

### **`daily_summaries`**
Aggregated sales data for fast analytics queries.
- `date` (TEXT, PK): Year-Month-Day format.
- `totalSales` (REAL): Aggregate calculated price.
- `orderCount` (INTEGER): Count of total orders per day.

---

## ✨ Key Features & Business Logic

### **1. Advanced Menu Parsing**
The admin dashboard includes a "Paste Menu" utility (`src/utils/advancedMenuParser.ts`) that uses regular expressions to parse raw, messy text tables. It identifies:
- Dates.
- Item names.
- Prices (e.g., `1.80€`, `2.50 лв`).
- Weights (e.g., `300гр`).
- Packaging/Box fees (`кутийка`).
- Cascading defaults (Category-level prices applying to items below them).

### **2. Kiosk Control & Timing**
- **Manual Toggle**: Admin can manually Open/Close the kiosk at any time.
- **Auto-Timing**: Configurable "Open At" and "Close At" settings to automate kiosk availability.
- **Global Network Access**: A security feature that allows the admin to toggle CORS and WebSocket restrictions, locking access to the local network or exposing it globally.

### **3. Multi-Language (i18n)**
The project is fully localized in **English (en)** and **Bulgarian (bg)**, with a dictionary-based system in `src/translations.ts`.

### **4. Side-Dish Logic**
A sophisticated selection flow where certain items (like Main Dishes) can trigger a modal requiring the user to pick a side dish from a list of available options, with support for "Included Side" flags.

---

## 📂 Directory Structure

```bash
├── server/             # Express backend logic
│   ├── controllers/    # Route handlers (Menu, Actions, Settings)
│   ├── middleware/     # Auth and security checks
│   ├── routes/         # Express router definitions
│   ├── db.ts           # SQLite initialization & schemas
│   └── config.ts       # Global settings & Auth config
├── src/                # React frontend logic
│   ├── components/     # UI Components (Kiosk/Manager split)
│   ├── hooks/          # Custom hooks (WS, RFID Scanner)
│   ├── store/          # Zustand store & selectors
│   ├── utils/          # Parsers and formatting helpers
│   ├── api.ts          # Centralized network layer
│   └── main.tsx        # Entry point
├── data/               # Persistent SQLite database storage
└── docs/               # Project documentation
```

---

## 🤖 AI-Assisted Development (@deepseek)

This project is actively maintained and evolved using **@deepseek** as the primary local MCP bridge for coding. 
- **Primary Role**: Local Coding & Implementation Bridge (feature building, refactoring, logic implementation).
- **Workflow**: The bridge allows for modular code updates, specific function rewrites, and rapid iteration using the DeepSeek-Coder-v2 model.
- **Deprecated Roles**: Past associations with "Code Review" or "Performance Testing" are **outdated**. DeepSeek is prioritized as an implementation engine for this repository.

---

*Generated by Antigravity using @deepseek as the local MCP bridge.*
