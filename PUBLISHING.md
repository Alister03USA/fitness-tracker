# Publishing MoveCircle

## 1. Supabase secrets

Set provider API keys in Supabase, not in Vercel or any frontend env file.

```bash
supabase secrets set LOGMEAL_API_TOKEN=your_logmeal_key
supabase secrets set USDA_FDC_API_KEY=your_usda_key
```

Generate VAPID keys for Web Push:

```bash
npx web-push generate-vapid-keys
```

Set the Web Push secrets in Supabase:

```bash
supabase secrets set VAPID_PUBLIC_KEY=your_public_key
supabase secrets set VAPID_PRIVATE_KEY=your_private_key
supabase secrets set VAPID_SUBJECT=mailto:your_email@example.com
```

## 2. Database migration

Apply the Web Push migration:

```bash
supabase db push
```

If you are not using the Supabase CLI, paste this file into the Supabase SQL
Editor and run it:

```text
supabase/migrations/20260729113500_web_push_reminders.sql
```

## 3. Deploy Supabase Edge Functions

```bash
supabase functions deploy food-photo-identify
supabase functions deploy food-lookup
supabase functions deploy push-config
supabase functions deploy send-reminders
```

## 4. Schedule reminders

Schedule `send-reminders` to run every 5 minutes in Supabase. In the Supabase
Dashboard, use Edge Functions scheduling or a scheduled HTTP call to invoke:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders
```

Use a 5-minute cron schedule:

```text
*/5 * * * *
```

## 5. Vercel environment variables

Add only these frontend variables in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not add `LOGMEAL_API_TOKEN`, `USDA_FDC_API_KEY`, `VITE_LOGMEAL_API_TOKEN`,
`VITE_USDA_FDC_API_KEY`, `VAPID_PUBLIC_KEY`, or `VAPID_PRIVATE_KEY` to Vercel.

## 6. Build command

Use the default Vite settings:

```bash
npm run build
```

Vercel output directory:

```text
dist
```

## 7. Phone test

Open the deployed Vercel URL in Safari on iPhone, then use:

```text
Share -> Add to Home Screen
```

After installing, test sign in, meal logging, photo scan, USDA search, delete
meal, dashboard calorie totals, and saving a reminder from the installed Home
Screen app.
