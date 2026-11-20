-- Shadow database of `prisma migrate dev` (SHADOW_DATABASE_URL in .env.example).
-- It runs only when the data volume is created; to run it again: `docker compose down -v`, then `up -d`.
CREATE DATABASE my_service_api_shadow;
