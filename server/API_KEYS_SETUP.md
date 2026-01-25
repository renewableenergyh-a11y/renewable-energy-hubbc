# API Keys Setup Guide

This guide explains how to obtain API keys for OpenAI and Stripe, and how to configure them in your `.env` file.

---

## 1. OpenAI API Key

### Step 1: Create OpenAI Account
1. Go to [OpenAI Platform](https://platform.openai.com)
2. Click "Sign up" and create a new account (or sign in if you have one).
3. Verify your email.

### Step 2: Billing Setup (Required)
1. After sign-up, go to [Billing Overview](https://platform.openai.com/account/billing/overview).
2. Add a payment method (credit card).
3. Set up a usage limit to control costs.

### Step 3: Get API Key
1. Go to [API Keys page](https://platform.openai.com/account/api-keys).
2. Click **"Create new secret key"**.
3. Copy the key (it starts with `sk-`).
4. **Save it somewhere safe** — you won't be able to see it again.

### Step 4: Add to `.env`
```
OPENAI_API_KEY=sk-your-actual-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Cost Note**: `gpt-4o-mini` is low-cost (~$0.001 per 1K input tokens). Monitor usage at [Usage page](https://platform.openai.com/account/usage/overview).

---

## 2. Stripe Keys

### Step 1: Create Stripe Account
1. Go to [Stripe](https://stripe.com).
2. Click "Sign up" and create an account.
3. Verify email and complete identity verification.

### Step 2: Get API Keys
1. Go to [API Keys page](https://dashboard.stripe.com/apikeys).
2. You'll see two keys under **"Standard keys"**:
   - **Publishable key** (starts with `pk_test_...`): public, safe to share.
   - **Secret key** (starts with `sk_test_...`): **keep private**, use only on server.
3. Copy both keys.

### Step 3: Add to `.env`
```
STRIPE_SECRET_KEY=sk_test_your-secret-key-here
STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key-here
```

---

## 3. Stripe Webhook Secret (Optional, for Production)

Webhooks allow Stripe to notify your server when payments succeed. For local testing, skip this initially.

To set up webhooks for production:
1. Go to [Webhooks page](https://dashboard.stripe.com/webhooks).
2. Click **"Add an endpoint"**.
3. Enter your server URL: `https://yourdomain.com/api/stripe-webhook`.
4. Select events: `payment_intent.succeeded`.
5. Copy the **Signing secret** and add to `.env`:
```
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret-here
```

---

## 4. Complete `.env` File Example

```bash
# OpenAI
OPENAI_API_KEY=sk_YOUR_KEY
OPENAI_MODEL=gpt-4o-mini

# Stripe
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Server
PORT=8787
```

---

## 5. Testing

### Test OpenAI Key
```bash
cd server
npm start
# Then POST to http://localhost:8787/api/assistant with:
# { "query": "What is solar energy?", "userEmail": "test@example.com" }
```

### Test Stripe Key
Use [Stripe Test Cards](https://stripe.com/docs/testing):
- **Success**: `4242 4242 4242 4242` with any future expiry & CVC.
- **Decline**: `4000 0000 0000 0002`.

---

## 6. Security Notes

- **Never commit `.env`** to version control. Add `.env` to `.gitignore`.
- Regenerate keys if they're exposed.
- In production, use environment variables from your hosting provider (Vercel, Heroku, AWS, etc.), not a `.env` file.

---

## 7. Cost Estimates

| Service | Cost | Notes |
|---------|------|-------|
| OpenAI (gpt-4o-mini) | ~$0.15 per 1M tokens | Very low for text. [Pricing](https://openai.com/pricing/) |
| Stripe | 2.9% + $0.30 per transaction | Only on successful payments. [Pricing](https://stripe.com/pricing) |

---

## 8. Troubleshooting

**"OpenAI API key not configured"**
- Verify `.env` file exists in `server/` directory.
- Check key format: should start with `sk-`.
- Restart server after updating `.env`.

**"Stripe not configured"**
- Ensure both `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` are set.
- Use test keys (starting with `pk_test_` and `sk_test_`), not live keys.

**"Unauthorized" on /api/assistant**
- Ensure client sends `userEmail` or `token` in request body.
- Check browser console for network errors.

---

For more help:
- [OpenAI Docs](https://platform.openai.com/docs/)
- [Stripe Docs](https://stripe.com/docs)
