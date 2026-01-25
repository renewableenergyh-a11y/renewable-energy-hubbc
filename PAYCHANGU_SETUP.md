# Paychangu Payment Integration - Complete Setup Guide

## Overview
The payment system has been fully replaced with **Paychangu**, a real payment processor that handles:
- MTN Money
- Airtel Money  
- Card payments (Visa, MasterCard, etc.)

All payments are processed through Paychangu's secure API. No more mock payments.

## Backend Setup

### 1. Get Paychangu Credentials
1. Sign up at https://www.paychangu.com
2. Create an account and get verified
3. Go to your dashboard and find:
   - **Public Key** (starts with `pk_`)
   - **Private Key** (starts with `sk_`)

### 2. Update .env File
In `server/.env`, set:
```
PAYCHANGU_PUBLIC_KEY=your_public_key_here
PAYCHANGU_PRIVATE_KEY=your_private_key_here
SERVER_URL=https://yourdomain.com  # For webhooks
SITE_URL=https://yourdomain.com    # For redirects
```

### 3. Payment Endpoints

**POST /api/payment/initiate**
- Authenticaed user initiates payment
- Returns Paychangu redirect URL
- Request:
  ```json
  {
    "amount": 8,
    "currency": "USD",
    "paymentMethod": null
  }
  ```

**POST /api/paychangu/callback**
- Frontend redirect after payment attempt
- Verifies payment with Paychangu
- Activates premium if successful

**POST /webhook/paychangu**
- Server-to-server webhook from Paychangu
- Handles payment success notifications
- Automatically activates premium

### 4. Webhook Setup in Paychangu Dashboard
1. Go to Paychangu Settings > Webhooks
2. Add webhook URL:
   ```
   https://yourdomain.com/webhook/paychangu
   ```
3. Set events: `payment.success`, `payment.failed`

## Frontend Changes

### Billing Page
- Only shows Paychangu payment button
- No Stripe card elements
- No mock payment forms
- Redirects to Paychangu checkout page

### Payment Flow
1. User clicks "Pay Securely with Paychangu"
2. Backend initiates payment and returns Paychangu link
3. User is redirected to Paychangu checkout
4. After payment, user is redirected back to `billing.html?payment=success`
5. Frontend verifies payment status with backend
6. Premium is immediately activated

### NO Frontend Email Sending
- All payment confirmations handled by backend
- Frontend NEVER sends payment-related emails
- Backend sends confirmation emails when payment succeeds

## Security Notes

✅ **Real Payment Processing**
- All transactions go through Paychangu
- No fake payments stored locally
- Signature verification on webhooks

✅ **Backend Verification**
- Payment verified with Paychangu API before activating premium
- Double-check on webhook receive
- Prevents fraud

✅ **No PCI Compliance Issues**
- Card data never touches our servers
- Paychangu handles all payment data
- We only store payment reference IDs

## Testing

### Development Testing (Paychangu Sandbox)
1. Create test account at https://sandbox.paychangu.com
2. Use test cards provided by Paychangu
3. Set `PAYCHANGU_PUBLIC_KEY` and `PAYCHANGU_PRIVATE_KEY` to sandbox keys
4. Payments in sandbox don't actually charge

### Production
1. Switch to live Paychangu account
2. Update .env with live keys
3. All payments will be real

## Troubleshooting

### Payment Initiation Fails
- Check PAYCHANGU_PUBLIC_KEY and PAYCHANGU_PRIVATE_KEY in .env
- Ensure user is authenticated (token valid)
- Check server logs for API errors

### Callback Not Working
- Verify return URL is correct
- Check that user email matches in system
- Look for 404 errors in `/api/paychangu/callback`

### Webhook Not Triggering
- Verify webhook URL in Paychangu dashboard
- Check that SERVER_URL matches webhook URL
- Confirm signature verification (if enabled)

### Payment Succeeds But Premium Not Activated
- Check that user email is correct
- Verify users.json or MongoDB has the email
- Check server logs for activation errors
- Manually verify with `/api/auth/me` endpoint

## Migration from Stripe

All Stripe references have been removed:
- ✅ No more Stripe library imports
- ✅ No more Stripe webhook endpoints  
- ✅ No more Card.js element mounting
- ✅ No more mock Airtel/TNM forms
- ✅ No more frontend payment processing

The system is now **real, secure, and scalable**.
