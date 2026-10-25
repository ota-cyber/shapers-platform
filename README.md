# shapers-platform

Team coordination platform for Global Shapers Inštitut: tasks, hours, meeting attendance, and an onboarding + tier dashboard that shows every member where they stand against their tier (Shapers GO!, Impact, Core).

Built at the Global Shapers hackathon, 24–25 October 2026.

- **Frontend:** [docs/FRONTEND.md](docs/FRONTEND.md) · task permissions: [docs/PERMISSIONS.md](docs/PERMISSIONS.md)
- **Backend API for the frontend:** [docs/BACKEND.md](docs/BACKEND.md)
- **Infrastructure and deploy from zero:** [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)

## Quick start (local)

```sh
supabase start
supabase db reset
eval "$(supabase status -o env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
SUPABASE_URL=$API_URL SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY DEMO_PASSWORD=shapers-demo node scripts/create-demo-users.mjs
SUPABASE_URL=$API_URL SUPABASE_ANON_KEY=$ANON_KEY SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY DEMO_PASSWORD=shapers-demo node scripts/smoke-test.mjs

npm install
NEXT_PUBLIC_SUPABASE_URL=$API_URL NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY npm run dev   # http://localhost:3000
```

Without the two `NEXT_PUBLIC_` variables the app runs on built-in demo data in the browser.

## Licence

MIT
