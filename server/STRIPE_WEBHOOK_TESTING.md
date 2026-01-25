# Stripe Webhook Testing Guide

This guide shows how to test Stripe webhooks locally using the Stripe CLI.

---

## 1. Install Stripe CLI

### macOS (Homebrew)
```bash
brew install stripe/stripe-cli/stripe
```

### Windows (Scoop)
```bash
scoop install stripe
```

### Linux / Manual
Download from [Stripe CLI releases](https://github.com/stripe/stripe-cli/releases).

### Verify Installation
```bash
stripe --version
```

---

## 2. Login to Stripe CLI

```bash
stripe login
```

This will open a browser tab to authenticate. After successful login, you'll get a **restricted API key** stored locally (not your secret key).

---

## 3. Forward Webhooks to Local Server

In a new terminal, run:

```bash
stripe listen --forward-to localhost:8787/api/stripe-webhook
```

This command:
- Listens for Stripe events on your account.
- Forwards them to your local server at `/api/stripe-webhook`.
- Prints a **Webhook signing secret** (starts with `whsec_`).
- Copy this secret and add it to your `.env`:
  ```
  STRIPE_WEBHOOK_SECRET=whsec_...
  ```

Keep this terminal open while testing.

---

## 4. Trigger Test Events

In another terminal, create a test payment:

```bash
stripe trigger payment_intent.succeeded
```

This will:
- Simulate a successful payment on Stripe's test system.
- Send the event to your `/api/stripe-webhook` endpoint.
- Your server will log: `Payment succeeded recorded <id>`.
- The event will be saved to `server/payments.json`.

---

## 5. Test Real Payment Flow

1. Ensure server is running:
   ```bash
   cd server
   npm start
   ```

2. Ensure `stripe listen` is forwarding to `localhost:8787/api/stripe-webhook`.

3. Open billing.html in a browser (or via local server):
   ```bash
   python -m http.server 8000
   # then navigate to http://localhost:8000/billing.html
   ```

4. Login as a test user and try upgrading to Premium with a VISA card.

5. Use Stripe test card **`4242 4242 4242 4242`** with:
   - Expiry: any future date (e.g., 12/26)
   - CVC: any 3 digits
   - Name: your test name

6. Submit the form.

7. Check:
   - Browser: success message should appear.
   - Server console: `Webhook signature verification...` or `Payment succeeded recorded <id>`.
   - `server/payments.json`: should contain a record with provider `stripe`.

---

## 6. Test Different Scenarios

### Test Decline
Use test card **`4000 0000 0000 0002`** to simulate a declined payment.

### Test 3D Secure
Use **`4000 0025 0000 3155`** to trigger 3D Secure authentication.

### Explore More Test Cards
See [Stripe Testing Cards](https://stripe.com/docs/testing).

---

## 7. Webhook Events Reference

Your server listens for `payment_intent.succeeded`. Other useful events:

| Event | Triggered When |
|-------|---|
| `payment_intent.succeeded` | Payment confirmed (what we handle). |
| `payment_intent.payment_failed` | Payment declined. |
| `charge.refunded` | User requests refund. |
| `customer.subscription.created` | Recurring subscription starts. |

To listen for other events, update the webhook event selection in [Stripe Dashboard Webhooks](https://dashboard.stripe.com/webhooks).

---

## 8. Production Webhook Setup

For live deployments:

1. **Deploy your server** to a host (Vercel, Heroku, AWS, etc.) with a public HTTPS URL.

2. **Add webhook endpoint in Stripe Dashboard**:
   - Go to [Webhooks](https://dashboard.stripe.com/webhooks).
   - Click **"Add an endpoint"**.
   - URL: `https://yourdomain.com/api/stripe-webhook`.
   - Events: select `payment_intent.succeeded`.
   - Copy **Signing secret** → add to production `.env`.

3. **Use live API keys** (starting with `pk_live_` and `sk_live_`, not `pk_test_` / `sk_test_`).

4. **No more `stripe listen`** — Stripe will send events directly to your server.

---

## 9. Troubleshooting

### "Webhook signature verification failed"
- Ensure `STRIPE_WEBHOOK_SECRET` in `.env` matches the secret from `stripe listen`.
- Restart server after updating `.env`.

### "stripe: command not found"
- Stripe CLI not installed. See step 1.
- Or, it's not in your PATH. Reinstall or check installation location.

### Events not received
- Ensure `stripe listen` terminal is still running.
- Check if `/api/stripe-webhook` endpoint exists and is accessible.
- Check server console for errors.

### "Cannot POST /api/stripe-webhook"
- Ensure `express.raw()` middleware is set up in `server/index.js` for the webhook route.
- Webhook signature verification requires raw body, not JSON parsed.

---

## 10. Monitoring Webhooks

Check all webhook deliveries in [Stripe Dashboard Webhooks](https://dashboard.stripe.com/webhooks):
- Click on your endpoint URL.
- View "Events" to see delivery status (success/failed/pending).
- Retry failed deliveries manually.

---

For more:
- [Stripe CLI Docs](https://stripe.com/docs/stripe-cli)
- [Webhook Testing](https://stripe.com/docs/webhooks/test)
