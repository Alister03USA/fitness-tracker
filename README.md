# MoveCircle

MoveCircle is a mobile-first fitness and nutrition tracker built with React, Vite, and Supabase. It combines daily calorie and macro tracking with exercise logging, progress history, social features, group chat, and optional push reminders in one installable web app.

## What it does

- Email authentication, password recovery, and remember-me session handling
- Daily dashboard for calories, protein, carbohydrates, fat, steps, and workouts
- Manual meal logging with macro and nutrition details
- Food lookup through a Supabase Edge Function
- Food photo identification through LogMeal and a Supabase Edge Function
- Exercise logging with step goals, workout duration, and calories burned
- Food history with calendar and progress views
- Profile settings for goals, weight tracking, avatar uploads, and reminders
- Social feed with posts, likes, comments, friend requests, and notifications
- Direct and group chat with image uploads
- Realtime updates for daily data, notifications, feed activity, and messaging
- Progressive Web App assets and optional Web Push reminders

## Tech stack

- React 19
- Vite 8
- Supabase Auth, PostgreSQL, Realtime, Storage, and Edge Functions
- `lucide-react` for icons
- `vite-plugin-pwa` for PWA support
- Oxlint for linting
- Vercel for frontend hosting

## Requirements

- Node.js 18 or newer
- npm
- A Supabase project
- Optional: LogMeal and USDA FoodData Central credentials for food services
- Optional: Web Push VAPID keys for reminders when the app is closed

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```text
   VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open the local URL printed by Vite, usually `http://localhost:5173`.

The `.env.local` file is ignored by Git. Never commit service-role keys, provider API keys, VAPID private keys, or other secrets.

## Supabase setup

The frontend expects a Supabase database containing the application tables used by the components, including profiles, logs, daily steps, workouts, reminder settings, weight logs, posts, friendships, notifications, groups, group members, messages, group messages, likes, and comments. Configure Row Level Security policies so users can access only the records they are authorized to view or change.

The repository includes the Web Push migration at:

```text
supabase/migrations/20260729113500_web_push_reminders.sql
```

Apply it with the Supabase CLI:

```bash
supabase db push
```

The app also uses an `avatars` Storage bucket for profile and chat images. Configure the bucket and its policies in Supabase before testing avatar or image uploads.

## Edge Functions and food services

The following functions are included in `supabase/functions`:

- `food-lookup` — searches food and nutrition data
- `food-photo-identify` — sends food images to LogMeal for identification
- `push-config` — provides the public Web Push configuration to the client
- `send-reminders` — sends scheduled Web Push reminder notifications

Deploy them with:

```bash
supabase functions deploy food-lookup
supabase functions deploy food-photo-identify
supabase functions deploy push-config
supabase functions deploy send-reminders
```

Set provider credentials as Supabase secrets, never as frontend variables:

```bash
supabase secrets set LOGMEAL_API_TOKEN=your_logmeal_key
supabase secrets set USDA_FDC_API_KEY=your_usda_key
```

## Web Push reminders

Web Push reminders require VAPID keys and the Web Push migration. Generate keys with:

```bash
npx web-push generate-vapid-keys
```

Set the resulting values in Supabase:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_SUBJECT=mailto:your_email@example.com
```

Schedule `send-reminders` every five minutes using Supabase scheduling or an equivalent scheduled HTTP request:

```text
*/5 * * * *
```

Before Web Push is configured, the in-app reminder can still display while the app is open in a browser tab. Full notifications while the browser is closed require the service worker, push subscription, deployed Edge Function, secrets, and scheduler described above.

## Available commands

```bash
npm run dev       # Start the Vite development server
npm run build     # Create a production build in dist/
npm run preview   # Preview the production build locally
npm run lint      # Run Oxlint
```

Run the checks before committing:

```bash
npm run lint
npm run build
```

## Deployment

MoveCircle can be deployed to Vercel as a standard Vite application.

Set these frontend environment variables in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Use `npm run build` as the build command and `dist` as the output directory. Keep LogMeal, USDA, Supabase service-role, and VAPID private credentials in Supabase or the appropriate server-side secret store; do not add them to Vercel frontend environment variables.

For the complete publishing sequence, including Supabase secrets, migrations, Edge Function deployment, scheduling, and phone testing, see [PUBLISHING.md](PUBLISHING.md).

## Project structure

```text
.
├── public/                 # PWA icons, service worker support, and static assets
├── src/
│   ├── components/         # Auth, dashboard, logging, social, chat, and profile UI
│   ├── lib/                # Notifications, food services, image processing, and helpers
│   ├── App.jsx             # Session state, navigation, daily data, and realtime wiring
│   ├── App.css             # Application component styles
│   ├── index.css           # Global styles and design tokens
│   └── supabaseClient.js   # Supabase client and session storage configuration
├── supabase/
│   ├── functions/          # Supabase Edge Functions
│   └── migrations/         # Database migrations
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## Security notes

- Only the Supabase anonymous client key belongs in the browser.
- Keep Supabase service-role keys and third-party API credentials server-side.
- Validate Row Level Security policies before exposing a deployment to users.
- Treat uploaded images and notification subscriptions as user data and apply appropriate Storage and database policies.
- Do not commit `.env.local` or any file containing credentials.

## Mobile and PWA testing

For an iPhone test, open the deployed Vercel URL in Safari and choose **Share → Add to Home Screen**. Test sign-in, meal logging, food search, photo scanning, meal deletion, dashboard totals, exercise logging, profile updates, and reminders from the installed app.
