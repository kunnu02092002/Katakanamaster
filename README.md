# Katakana Master

Katakana learning app with spaced repetition, local persistence, and Supabase cloud sync.

## Run With Docker

1. Ensure your Supabase keys exist in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=your_supabase_publishable_key
```

2. Build and run the container:

```bash
docker compose --env-file .env.local up --build
```

3. Open the app:

```text
http://localhost:8080
```

## Stop Container

```bash
docker compose down
```

## Rebuild After Code Changes

```bash
docker compose --env-file .env.local up --build
```
