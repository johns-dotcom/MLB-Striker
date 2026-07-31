# MLB Striker

A mobile app for placing **basket / batch trades** on Kalshi's MLB game markets.
Build markets into a basket, then "strike" — fire them all at once.

> ⚠️ **Real money.** Kalshi is a CFTC-regulated exchange. This app places live
> orders. It is configured to run against Kalshi's **demo environment** by default
> (`KALSHI_ENV=demo`). Do not switch to `prod` until every flow has been verified
> against demo.

## Architecture

```
┌──────────────┐     HTTPS + bearer      ┌───────────────┐   signed API   ┌────────┐
│  mobile/     │ ─────────────────────▶  │  backend/     │ ─────────────▶ │ Kalshi │
│  Expo / RN   │                         │  Fastify (TS) │                │ (demo) │
│  (your phone)│ ◀─────────────────────  │  Railway      │ ◀───────────── │        │
└──────────────┘                         └──────┬────────┘                └────────┘
                                                │
                                          ┌─────▼──────┐
                                          │ Neon (PG)  │  baskets / order log
                                          └────────────┘
```

**Why a backend?** Kalshi API keys must never live on-device. The backend holds
the RSA API key, signs requests, brokers batch orders, and logs baskets. The app
only ever talks to the backend with a bearer token.

## Layout

- `backend/` — Fastify + TypeScript API. Kalshi client (RSA-PSS signing), markets,
  batch orders, portfolio. Neon Postgres for basket/order logging.
- `mobile/` — Expo / React Native app. Browse MLB markets → build basket → strike.

## Quick start

### Backend
```bash
cd backend
cp .env.example .env      # fill in Kalshi demo key + DATABASE_URL
npm install
npm run dev               # http://localhost:8080
```

### Mobile
```bash
cd mobile
cp .env.example .env      # point EXPO_PUBLIC_API_URL at the backend
npm install
npm run start             # scan the QR code with Expo Go on your phone
```

## Getting Kalshi demo credentials

1. Sign in at <https://demo.kalshi.co> (separate demo account from production).
2. Profile → **API Keys** → create a key.
3. You get an **API Key ID** and download an **RSA private key** (`.pem`). Put the
   key ID in `KALSHI_API_KEY_ID` and the PEM contents in `KALSHI_PRIVATE_KEY`
   (newlines escaped as `\n`, or base64 — the client accepts both).

See `backend/.env.example` for all variables.
