-- Extra databases of the local PostgreSQL. This runs only when the data volume is created; to run it again:
-- `docker compose down -v`, then `docker compose up -d`. To add them to a volume that already exists, run the
-- statements with `docker compose exec db psql -U user -d my_service_api`.

-- Shadow database of `prisma migrate dev` (SHADOW_DATABASE_URL in .env.example)
CREATE DATABASE my_service_api_shadow;

-- Database of `npm run test:integration` (TEST_DATABASE_URL in .env.example). The tests delete every row of
-- its tables, so its name must end with _test.
CREATE DATABASE my_service_api_test;
