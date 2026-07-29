# Publishing MoveCircle

## 1. Supabase secrets

Set provider API keys in Supabase, not in Vercel or any frontend env file.

```bash
supabase secrets set LOGMEAL_API_TOKEN=your_logmeal_key
supabase secrets set USDA_FDC_API_KEY=your_usda_key
```

## 2. Deploy Supabase Edge Functions

```bash
supabase functions deploy food-photo-identify
supabase functions deploy food-lookup
```

## 3. Vercel environment variables

Add only these frontend variables in Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not add `LOGMEAL_API_TOKEN`, `USDA_FDC_API_KEY`, `VITE_LOGMEAL_API_TOKEN`,
or `VITE_USDA_FDC_API_KEY` to Vercel.

## 4. Build command

Use the default Vite settings:

```bash
npm run build
```

Vercel output directory:

```text
dist
```

## 5. Phone test

Open the deployed Vercel URL in Safari on iPhone, then use:

```text
Share -> Add to Home Screen
```

After installing, test sign in, meal logging, photo scan, USDA search, delete
meal, and dashboard calorie totals.
