# ClientDesk

White-label client portal for agencies. Manage projects, deliverables, invoices, files, and messaging — and give each client a branded login where they can track progress, review designs, pay invoices, and chat.

## Features

- **Multi-tenant agencies** — each agency sees only its own data (enforced by Supabase RLS)
- **Client portal** — branded login page, project dashboard, invoice payments, file downloads, real-time messaging
- **Visual proofing** — upload deliverables (images & PDFs), clients drop pins with feedback, threaded replies, approve/request-changes workflow
- **Invoicing** — create invoices with line items and GST, send via email, collect payment through Stripe Checkout
- **File vault** — upload files with lock controls (approval-gated or payment-gated), private storage with signed-URL downloads
- **Kanban tasks** — per-project task board with optional client visibility
- **Stripe Connect** — agencies connect their own Stripe account to receive payments directly
- **AI summaries** — one-click project/conversation summaries via any OpenAI-compatible API
- **Real-time** — messages, tasks, files, pins, and notifications update live via Supabase Realtime
- **Email notifications** — transactional email via Resend (invoice sent, client invited, etc.)

## Stack

| Layer | Tech |
|-------|------|
| Framework | SvelteKit 5 (Svelte 5 runes) |
| Database | Supabase (Postgres + Auth + Storage + Realtime) |
| Styling | Tailwind CSS with Material Design 3 tokens |
| Payments | Stripe Checkout + Stripe Connect |
| Email | Resend |
| AI | Any OpenAI-compatible chat-completions API |
| Hosting | Vercel (adapter-vercel) |

## Deploy Guide (~15 minutes)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the SQL Editor, run **`supabase/schema.sql`** to create all tables, RLS policies, and functions.
3. *(Optional)* Run **`supabase/seed.sql`** to populate demo data.
4. Create a **Storage bucket** called `ClientDeskBucket` (Settings → Storage → New bucket). Make it **private** (not public).
5. Copy your **Project URL**, **anon key**, and **service_role key** from Settings → API.

### 2. Set up Auth

1. In Supabase → Authentication → URL Configuration, set the **Site URL** to your deploy URL (e.g. `https://your-app.vercel.app`).
2. Add redirect URLs: `https://your-app.vercel.app/**` (or `http://localhost:5173/**` for local dev).
3. Enable the **Email** provider (enabled by default).

### 3. Set up Stripe

1. Create a [Stripe](https://stripe.com) account and get your **Secret key** and **Publishable key** from the Developers dashboard.
2. Set up a webhook endpoint pointing to `https://your-app.vercel.app/api/stripe/webhook` with events:
   - `checkout.session.completed`
3. Copy the **Webhook signing secret** (`whsec_...`).
4. *(Optional)* For Stripe Connect (agencies receive payments directly), create a Connect platform and copy the **Client ID** (`ca_...`).

### 4. Set up Resend

1. Create a [Resend](https://resend.com) account and get your API key.
2. Verify a sending domain (or use the sandbox `onboarding@resend.dev` for testing).
3. Set `EMAIL_FROM_ADDRESS` to your verified sender (e.g. `notifications@yourdomain.com`).

### 5. AI provider (optional)

Summaries work with any OpenAI-compatible endpoint. Set `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL`. Leave all three blank to disable the feature.

### 6. Environment variables

Copy `.env.example` to `.env` and fill in every value:

```sh
cp .env.example .env
```

### 7. Deploy to Vercel

```sh
npm install
npm run build          # verify it builds cleanly
npx vercel             # first deploy — follow the prompts
npx vercel deploy --prod
```

Set the same environment variables in Vercel → Project Settings → Environment Variables.

### 8. First login

1. Visit your deploy URL and sign up.
2. The sign-up flow creates your agency and links your auth user as the admin.
3. Add clients, create projects, and invite clients to the portal from the client detail page.

## Local Development

```sh
npm install
npm run dev            # starts at http://localhost:5173
```

## Project Structure

```
src/
├── lib/
│   ├── components/    # Svelte components (ProofingCanvas, headers, etc.)
│   ├── server/        # Server-only modules (supabase admin, stripe, email, auth)
│   └── ...            # Stores, helpers, types
├── routes/
│   ├── api/           # Server endpoints (auth, stripe, email, AI, files)
│   ├── client/        # Client portal pages
│   └── ...            # Agency-side pages (dashboard, projects, invoices, etc.)
supabase/
├── schema.sql         # Full database schema (run on a fresh project)
└── seed.sql           # Demo data
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **"Invalid API key"** on page load | Check `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` are correct and not swapped. |
| **RLS errors / empty data** | Make sure you ran the full `schema.sql`. If you ran an older version, re-run it — policies use `CREATE ... IF NOT EXISTS` and `DROP POLICY IF EXISTS` so it's safe to re-run. |
| **Stripe webhook 400** | Verify `STRIPE_WEBHOOK_SECRET` matches the signing secret for the correct endpoint URL. In local dev, use `stripe listen --forward-to localhost:5173/api/stripe/webhook`. |
| **Emails not sending** | Check `RESEND_API_KEY` and that `EMAIL_FROM_ADDRESS` uses a verified domain. The Resend sandbox only sends to the account owner's email. |
| **AI summaries return 503** | All three `AI_*` env vars must be set. Verify the base URL ends with `/v1` and the API key is valid. |
| **Files return 403 / broken images** | The storage bucket must be named exactly `ClientDeskBucket`. Verify it exists and the authenticated-upload and authenticated-select policies are in place (schema.sql creates them). |
| **Build fails on Vercel** | Make sure all env vars are set in Vercel project settings. The build needs `PUBLIC_*` vars at build time. |
| **Client portal login not working** | Clients must be invited from the client detail page — this creates their auth user and `client_users` row. Direct sign-up does not create a portal login. |

## License

See [LICENSE.md](LICENSE.md).
