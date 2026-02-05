# Payment Integration Setup Guide

This system supports **two payment methods** with automatic SMS OTP delivery:

1. **M-Pesa (Daraja API)** - Direct Kenyan mobile payments via Till Number
2. **Paystack** - Cards, bank transfers, and multiple payment channels

Both payment methods automatically trigger SMS OTP delivery via Africa's Talking after successful payment.

## Choosing a Payment Method

### M-Pesa Direct (Recommended for Kenya)
- **Pros**: Lower fees for M-Pesa transactions, STK Push UX, direct Till integration
- **Cons**: Kenya-only, requires Till Number application
- **Best for**: Local Kenyan customers

### Paystack (Multi-channel)
- **Pros**: Cards, bank transfers, USSD, international expansion, easier setup
- **Cons**: Higher fees for M-Pesa (goes through Paystack gateway)
- **Best for**: International customers, card payments, multiple channels

### Using Both (Recommended)
You can enable both payment methods and let users choose their preferred option. The backend handles both seamlessly with separate endpoints.

---

## Part 1: M-Pesa Daraja Setup

### Prerequisites

1. **Safaricom Daraja Developer Account**
   - Register at [https://developer.safaricom.co.ke/](https://developer.safaricom.co.ke/)
   - Create an app to get Consumer Key and Consumer Secret

2. **Till Number (Buy Goods)**
   - Apply for a Till Number through M-Pesa for Business
   - Website: [https://m-pesaforbusiness.co.ke](https://m-pesaforbusiness.co.ke)
   - Email: M-PESABusiness@safaricom.co.ke

3. **Africa's Talking Account**
   - Register at [https://africastalking.com/](https://africastalking.com/)
   - Get API Key and Username
   - Apply for Sender ID approval (for production)

## Step 1: Create Daraja App

1. Log in to [Safaricom Daraja Portal](https://developer.safaricom.co.ke/)
2. Navigate to "My Apps" and click "Create New App"
3. Select "Lipa Na M-Pesa Online" (STK Push) API
4. Note down:
   - Consumer Key
   - Consumer Secret
   - Passkey (from the Lipa Na M-Pesa Online credentials)

## Step 2: Configure Till Number

1. Register your Till Number with Daraja
2. Configure callback URL:
   - Production: `https://yourdomain.com/api/payments/mpesa/callback`
   - Sandbox: Use ngrok or similar for testing

3. Note: For Till Numbers, use transaction type **CustomerBuyGoodsOnline**

## Step 3: M-Pesa Environment Configuration

Add M-Pesa configuration to `.env` file:

```env
# Daraja API (M-Pesa)
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
DARAJA_PASSKEY=your_passkey_here
DARAJA_SHORTCODE=174379  # Your Till Number
DARAJA_CALLBACK_URL=https://yourdomain.com/api/payments/mpesa/callback
DARAJA_ENVIRONMENT=sandbox  # or 'production'
```

---

## Part 2: Paystack Setup

### Prerequisites

1. **Paystack Account**
   - Register at [https://paystack.com/](https://paystack.com/)
   - Complete business verification

2. **API Keys**
   - Get Public Key and Secret Key from dashboard
   - Get Webhook Secret from settings

### Step 1: Create Paystack Account

1. Sign up at [https://dashboard.paystack.com/signup](https://dashboard.paystack.com/signup)
2. Complete KYC verification (required for live mode)
3. Navigate to Settings → API Keys

### Step 2: Configure Webhook

1. Go to Settings → Webhooks
2. Add webhook URL: `https://yourdomain.com/api/payments/paystack/webhook`
3. Copy the Webhook Secret

### Step 3: Paystack Environment Configuration

Add Paystack configuration to `.env` file:

```env
# Paystack Configuration
PAYSTACK_BASE_URL=https://api.paystack.co
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key
PAYSTACK_SECRET_KEY=sk_test_your_secret_key
PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret
PAYSTACK_CALLBACK_URL=http://localhost:3000/api/payments/paystack/callback
PAYSTACK_ENVIRONMENT=test  # or 'live'
```

---

## Part 3: Africa's Talking SMS Setup

### Prerequisites

1. **Africa's Talking Account**
   - Register at [https://africastalking.com/](https://africastalking.com/)
   - Top up account (production)

2. **Sender ID**
   - Apply for sender ID approval (production only)
   - Use default sender ID in sandbox

### Configuration

Add to `.env` file:

```env
# Africa's Talking SMS
AT_API_KEY=your_africastalking_api_key
AT_USERNAME=sandbox  # or your production username
AT_SENDER_ID=WATERKIOSK  # Your approved sender ID
AT_ENVIRONMENT=sandbox  # or 'production'
AT_ENQUEUE=false
AT_MAX_RETRIES=3
AT_RETRY_DELAY=2000
```

---

## Part 4: Water Pricing & General Configuration

Add to `.env` file:

```env
# Water Pricing
PRICE_PER_LITER=5
CURRENCY=KES
MIN_AMOUNT=5
MAX_AMOUNT=70000
ROUNDING_STRATEGY=nearest

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=water_station
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# Redis (Optional)
REDIS_URL=redis://localhost:6379
```

## Step 4: Database Setup

Run the database migration:

```bash
pnpm run migrate
```

This will create:
- `mpesa_transactions` table for M-Pesa payments
- `otps` table for OTP management
- Required indexes and triggers

## Step 5: Testing Both Payment Methods

### A. M-Pesa Testing

**Daraja Sandbox Setup**:
1. Use sandbox credentials from your Daraja app
2. Test Till Number: `174379`
3. Test phone number: `254708374149` (any Safaricom number works in sandbox)

**Test M-Pesa Flow**:

```bash
# 1. Get payment preview
curl -X POST http://localhost:3000/api/payments/preview \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'

# 2. Initiate STK Push
curl -X POST http://localhost:3000/api/payments/mpesa/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254712345678",
    "amount": 50
  }'

# 3. Enter PIN on your phone (sandbox or real)

# 4. Check transaction status (universal endpoint)
curl http://localhost:3000/api/payments/status/WS-1234567890-ABCD

# 5. Query M-Pesa directly
curl http://localhost:3000/api/payments/mpesa/query/WS-1234567890-ABCD
```

### B. Paystack Testing

**Paystack Test Mode**:
1. Use test API keys (start with `pk_test_` and `sk_test_`)
2. Use test cards from [Paystack docs](https://paystack.com/docs/payments/test-payments/)
3. Test card: `4084 0840 8408 4081` (Visa - Success)

**Test Paystack Flow**:

```bash
# 1. Get payment preview (same endpoint as M-Pesa)
curl -X POST http://localhost:3000/api/payments/preview \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'

# 2. Initialize Paystack payment
curl -X POST http://localhost:3000/api/payments/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "amount": 50,
    "phoneNumber": "254712345678"
  }'

# Response contains authorizationUrl - redirect user to this URL
# User completes payment on Paystack checkout page

# 3. After payment, verify transaction
curl http://localhost:3000/api/payments/paystack/verify/WS-1234567890-ABCD

# 4. Check status (universal endpoint - checks both tables)
curl http://localhost:3000/api/payments/status/WS-1234567890-ABCD
```

### C. Africa's Talking SMS Sandbox

1. Username: `sandbox`
2. Test phone numbers must be added in your sandbox dashboard
3. SMS are not actually delivered in sandbox mode - check application logs

**Expected SMS Flow**:
- After successful M-Pesa payment → OTP SMS sent automatically
- After successful Paystack payment → OTP SMS sent automatically

## Step 6: Production Deployment

### Pre-Production Checklist

- [ ] Obtain production Consumer Key and Secret
- [ ] Register production Till Number
- [ ] Configure production callback URL (must be HTTPS)
- [ ] Get Africa's Talking production credentials
- [ ] Apply for and get Sender ID approved
- [ ] Update all environment variables to production values
- [ ] Test callback URL is accessible from Safaricom servers
- [ ] Set up SSL certificate for your domain
- [ ] Configure firewall to allow Safaricom IPs (if needed)

### Switching to Production

1. Update `.env`:
   ```env
   DARAJA_ENVIRONMENT=production
   AT_ENVIRONMENT=production
   NODE_ENV=production
   ```

2. Use production credentials:
   - Production Consumer Key/Secret
   - Production Till Number
   - Production Passkey

3. Update callback URL to production domain (HTTPS required)

4. Restart the server:
   ```bash
   pnpm start
   ```

## API Endpoints

### Payment Preview
```http
POST /api/payments/preview
Content-Type: application/json

{
  "amount": 50
}
```

### Initiate Payment
```http
POST /api/payments/mpesa/initiate
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 50,
  "metadata": {}
}
```

### M-Pesa Callback
```http
POST /api/payments/mpesa/callback
Content-Type: application/json

(Automatically called by Safaricom)
```

### Check Status
```http
GET /api/payments/status/:transactionReference
```

### Query M-Pesa
```http
GET /api/payments/mpesa/query/:transactionReference
```

## Troubleshooting

### Common Issues

**Issue**: STK Push not received
- Check phone number format (254XXXXXXXXX)
- Verify Till Number is correct
- Check Daraja app is active
- Ensure phone has network connectivity

**Issue**: Callback not received
- Verify callback URL is accessible publicly
- Check firewall settings
- Ensure HTTPS is configured (production)
- Check Daraja app configuration

**Issue**: SMS not delivered
- Verify Africa's Talking credentials
- Check sender ID is approved (production)
- Verify phone number format (+254XXXXXXXXX)
- Check account balance

**Issue**: "Invalid access token"
- Credentials may be incorrect
- Token cache may be stale (clears automatically)
- Check DARAJA_ENVIRONMENT matches your credentials

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
LOG_FORMAT=json
```

Check logs for:
- `daraja_oauth_request` - OAuth token requests
- `daraja_stkpush_request` - STK Push requests
- `mpesa_callback_received` - Callback receipts
- `sms_send_request` - SMS sending attempts

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use HTTPS in production** - Required for callbacks
3. **Validate callback signatures** - Already implemented
4. **Rate limit endpoints** - Already configured
5. **Monitor for suspicious activity** - Check logs regularly
6. **Rotate credentials periodically** - Update Consumer Keys regularly
7. **Secure database** - Use strong passwords, SSL connections
8. **Backup regularly** - Database and transaction records

## Support

- **Daraja Support**: [https://developer.safaricom.co.ke/support](https://developer.safaricom.co.ke/support)
- **Africa's Talking Support**: [https://help.africastalking.com](https://help.africastalking.com)
- **M-Pesa Business**: M-PESABusiness@safaricom.co.ke

## Resources

- [Daraja API Documentation](https://developer.safaricom.co.ke/Documentation)
- [STK Push Guide](https://developer.safaricom.co.ke/docs#lipa-na-m-pesa-online-payment)
- [Africa's Talking SMS Docs](https://developers.africastalking.com/docs/sms/overview)
- [Till Number Application Guide](https://m-pesaforbusiness.co.ke)
