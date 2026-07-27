# Development & Deployment

This document outlines how to set up, run, and maintain the LunchPad codebase.

## Local Setup (Docker)

The project is fully containerized. To start the entire stack:

```bash
docker compose up --build -d
```

- **Port**: The application runs on port `3400` (mapped to `80` inside the container).
- **Volumes**: The SQLite database is persisted in the `data/` directory.

## Environment Variables

The system uses defaults for development, but these should be configured via `docker-compose.yml` for production:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `ADMIN_PIN` | PIN code for dashboard access | `0000` |
| `JWT_SECRET` | Secret key for token signing | `your-secret-key-change-me` |
| `PORT` | Backend server port | `3400` |

## Localization

Translations are managed in `src/translations.ts`. To add a new language:
1.  Define the translation keys in the `translations` object.
2.  Add the language code to the `Language` type.
3.  The UI will automatically include the new language in the settings dropdown if configured.

## Project Structure

- `/src/components`: UI components organized by feature (Kiosk, Manager).
- `/src/store`: Zustand state management and slices.
- `/src/hooks`: Custom React hooks for translations, sync, and responsiveness.
- `/server.ts`: Main Express server and WebSocket logic.
- `/server/routes`: API endpoint definitions.
- `/docs`: Project documentation.
