AubieRET local server

This small Express server provides two main features for local development:

- `/api/assistant` — proxies queries to OpenAI (server-side) to keep your API key secret.
- `/api/create-payment-intent` — creates Stripe PaymentIntents for card payments.
- `/api/mobile-payment` — demo endpoint to record Airtel/TNM mobile payments (placeholder).

Setup

1. Copy `.env.example` to `.env` and fill in your keys.

2. Install dependencies and run:

```bash
cd server
npm install
npm start
```

Usage

- Assistant: POST JSON { "query": "your question" } to `/api/assistant`. Response: { reply }
- Stripe: POST JSON { "amount": 1000, "currency": "usd", "email": "user@example.com" } to `/api/create-payment-intent`.

Notes & Security

- This server is a demo. Validate and secure requests in production (authentication, rate limits, input sanitization).
- Store API keys in environment variables on your host.

MongoDB migration

- To enable MongoDB-backed storage set `MONGODB_URI` in your `.env` to your connection string.
- Install new dependencies in the `server` folder:

```bash
cd server
npm install
```

- To migrate existing file-based JSON data into MongoDB run:
```bash
MONGODB_URI="your-uri" node migrate_to_mongo.js
```

- MongoDB is required. The server will fail to start if `MONGODB_URI` is not set or the connection fails.
