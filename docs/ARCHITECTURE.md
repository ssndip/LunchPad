# Architecture & Design

LunchPad follows a decoupled client-server architecture, optimized for local network performance and resilience.

## Frontend Architecture

The frontend is built as a single-page application (SPA) that switches between `Kiosk` and `Manager` modes.

### State Management (Zustand)
We use a centralized store divided into specialized slices:
- `authSlice`: Handles login state and JWT tokens.
- `menuSlice`: Manages menu items and categories.
- `orderSlice`: Handles active cart state and success/error feedback.
- `uiSlice`: Controls active tabs, navigation, and global modal states.
- `settingsSlice`: System-wide configurations (Test mode, Kiosk status, etc.).

### Synchronization
The `useSyncState` hook ensures that the frontend remains in sync with the backend. It uses a combination of:
1.  **Initial Fetch**: Pulls the complete state on load.
2.  **WebSocket Updates**: Receives real-time events for menu changes or kiosk status toggles.

## Backend Architecture

The backend is a Node.js server that serves both as an API provider and a WebSocket host.

### Persistence
- Data is stored in a SQLite database (`data/lunchpad.db`).
- The schema includes `cards`, `orders`, `menu_items`, and `settings`.

### Security
- **Admin PIN**: Access to the Manager dashboard is protected by a configurable PIN (default: `0000`).
- **JWT**: Successful login generates a JSON Web Token stored in `sessionStorage`.
- **RFID Validation**: Orders require a valid RFID card present in the database unless `Test Mode` is enabled.

## Network Flow

1.  **Client** requests `/?view=manager`.
2.  **Server** validates JWT or prompts for PIN.
3.  **Client** fetches menu and card data.
4.  **Admin** makes a change (e.g., adds a menu item).
5.  **Server** updates SQLite and broadcasts a WebSocket message to all connected clients.
6.  **Kiosk** receives the update and refreshes the menu UI instantly.
