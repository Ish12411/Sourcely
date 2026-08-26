# Deploying

Verified before every export: `npm ci` then `npm run build` succeeds from a
clean copy of this folder with **no** environment variables and no
`node_modules`. A failed build on Vercel therefore means a platform or upload
problem, not missing config — a missing key surfaces at runtime with a clear
message instead.

## Deploy an update

The live project is **sourcely-app** on the team *Ish's projects*.

```
cd <this folder>
npx vercel --prod
```

Answer **Link to existing project → sourcely-app**. That ships to the existing
URL. Answering "no" creates a *new* project and a new URL, which is how you end
up with several half-configured copies.

## Environment variables

Set in the Vercel dashboard under **Settings → Environment Variables**, with
Production, Preview and Development all ticked. They are never read from a file
in this folder — `.vercelignore` keeps local env files out of the upload.

| Variable | Required | Notes |
| --- | --- | --- |
| `TAVILY_API_KEY` | yes | Search fails without it |
| `GEMINI_API_KEY` | yes | Answers fail without it |
| `SUPABASE_URL` | yes | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Server-side only. Never `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Same URL. Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | The `anon` key, **not** `service_role` |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.5-flash-lite` |
| `MAX_SOURCES` | no | Defaults to `8` |

Vercel does not apply new variables to a build that already exists. After
adding any, redeploy — it is a required step, not a refinement.

## Two settings that live outside this repo

**1. Supabase must allowlist the deployed domain.** Dashboard →
Authentication → URL Configuration:

- **Site URL**: the production URL
- **Redirect URLs**: add `https://<domain>/**`

The app builds its auth callback from `window.location.origin`, so it adapts to
any domain by itself — but Supabase rejects any redirect target not on this
list. This is the usual cause of "sign-in works locally, fails in production".

**2. Confirm email must be OFF.** Authentication → Providers → Email. Supabase's
built-in sender allows **2 emails per hour**; with confirmation on, the third
person to sign up in an hour is locked out. With it off, signup sends no email
at all and the cap never applies. Google sign-in sends no email either way.

Also check **Settings → Deployment Protection** in Vercel. While Vercel
Authentication is enabled, only members of the team can open the site — everyone
else is redirected to a Vercel login.

## Database

The `conversations` table and its `owner_id` column already exist. Any
deployment pointed at the same Supabase project needs no migration. The SQL is
in `README.md` if you ever start a fresh project.

## A better workflow than uploading folders

Connect the repository once — Vercel project → Settings → **Git** — and every
future change becomes:

```
git add -A
git commit -m "what changed"
git push
```

Vercel builds on push. No folder exports, no CLI, and no way to ship a stale
copy by accident.

## What is deliberately absent

`node_modules`, `.next` and `.env.local`. Vercel installs from
`package-lock.json` and builds on its own machines; secrets come from the
dashboard.
