# Drag And Drop Resume

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Save Chrome Local State For MCP Playwright

Use this when you want Playwright MCP runs to reuse your persisted Zustand state from localStorage:

- `resume-storage`
- `resume-ui`

1. Start your app in one terminal:

```bash
npm run dev
```

1. In another terminal, run:

```bash
npm run auth:save-state
```

1. A Chrome window opens at your app URL. The script reads those localStorage keys and writes them into the storage state file.
1. If keys are not found, you can interact/login in that window, then press Enter to retry key capture.

This writes storage state to `playwright/.auth/storage-state.json`.

## Feedback Email Setup

The floating feedback form submits to `POST /api/feedback` and sends mail to `bhandarideepakdev@gmail.com`.

Set these environment variables where the app runs:

- `FEEDBACK_SMTP_HOST`
- `FEEDBACK_SMTP_PORT`
- `FEEDBACK_SMTP_USER`
- `FEEDBACK_SMTP_PASS`
- `FEEDBACK_FROM` (optional, defaults to `FEEDBACK_SMTP_USER`)

Example `.env.local`:

```bash
FEEDBACK_SMTP_HOST=smtp.gmail.com
FEEDBACK_SMTP_PORT=587
FEEDBACK_SMTP_USER=your-smtp-user@gmail.com
FEEDBACK_SMTP_PASS=your-app-password
FEEDBACK_FROM=your-smtp-user@gmail.com
```

Where to get these values:

- Gmail (recommended for personal use):
  - `FEEDBACK_SMTP_HOST`: `smtp.gmail.com`
  - `FEEDBACK_SMTP_PORT`: `587` (TLS) or `465` (SSL)
  - `FEEDBACK_SMTP_USER`: your full Gmail address
  - `FEEDBACK_SMTP_PASS`: a Google App Password (Google Account -> Security -> 2-Step Verification -> App passwords)
  - `FEEDBACK_FROM`: usually the same as `FEEDBACK_SMTP_USER`
- Other providers (SendGrid, Mailgun, Zoho, Outlook, etc.):
  - Use the SMTP host/port and credentials from your provider's SMTP settings page.

For production deploy with GitHub Actions, add the same keys in:

- Repository Settings -> Secrets and variables -> Actions -> New repository secret

### SMTP Health Check Endpoint

Use this to verify SMTP login/connectivity without sending an email:

- `GET /api/health/smtp`

Optional protection:

- Set `HEALTHCHECK_TOKEN` and send header `x-healthcheck-token: <token>`

Example curl:

```bash
curl -H "x-healthcheck-token: your-token" https://your-domain/api/health/smtp
```

## Google Analytics Setup

Set this variable to enable Google Analytics:

- `NEXT_PUBLIC_GA_ID` (example: `G-XXXXXXXXXX`)

Local development:

```bash
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

GitHub Actions deploy:

- Add `NEXT_PUBLIC_GA_ID` under Repository Settings -> Secrets and variables -> Actions.

### Reuse your existing Chrome profile (optional)

If you want to load from your machine's current Chrome profile while capturing state:

```bash
CHROME_USER_DATA_DIR="$HOME/.config/google-chrome" npm run auth:save-state
```

This is the recommended command when your existing browser already has the right `resume-storage` and `resume-ui` values.

### Point MCP Playwright to this state

Use the same state file path when starting or configuring Playwright MCP so browser contexts are created with:

`playwright/.auth/storage-state.json`
