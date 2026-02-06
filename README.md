# Water Station - Dual Payment System

A complete water vending system with **dual payment integration** (M-Pesa + Paystack), SMS OTP delivery (Africa's Talking), and hardware integration for water dispensing.

## Features

- **Dual Payment Methods**: M-Pesa (Daraja API) + Paystack for maximum flexibility
- **M-Pesa STK Push**: Seamless mobile payments via Till Number
- **Paystack Integration**: Cards, bank transfers, and international payments
- **Smart Pricing**: Automatic amount-to-liters conversion (5 KES/liter)
- **OTP Security**: Secure one-time passwords with SMS delivery
- **Station Integration**: Hardware control via pulse calculation
- **Real-time Callbacks**: Automatic payment confirmation from both providers
- **SMS Notifications**: OTP delivery via Africa's Talking for both payment methods

## Project Structure

```
waterstation/
├── backend/          # Node.js Express API
│   ├── src/
│   │   ├── config/       # Configuration modules
│   │   ├── controllers/  # HTTP request handlers
│   │   ├── services/     # Business logic
│   │   ├── repositories/ # Database access
│   │   ├── models/       # Database schemas
│   │   ├── routes/       # API routes
│   │   ├── utils/        # Helper functions
│   │   └── middleware/   # Express middleware
│   └── PAYMENT_SETUP.md  # Payment integration guide
└── frontend/         # Frontend app (to be added)
```

## Quick Start

### Prerequisites

- Node.js 18+ with pnpm
- PostgreSQL 12+
- Redis (optional, for caching)
- **Payment Gateway Credentials** (choose one or both):
  - Daraja API credentials (for M-Pesa)
  - Paystack API keys (for cards/international)
- Africa's Talking API key (for SMS)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd waterstation/backend

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
pnpm run migrate

# Start development server
pnpm run dev

# Production
pnpm start
```

### Environment Setup

See [backend/PAYMENT_SETUP.md](backend/PAYMENT_SETUP.md) for detailed setup instructions.

Key environment variables:
```env
# Payment Method 1: M-Pesa (Daraja API)
DARAJA_CONSUMER_KEY=your_key
DARAJA_CONSUMER_SECRET=your_secret
DARAJA_PASSKEY=your_passkey
DARAJA_SHORTCODE=your_till_number

# Payment Method 2: Paystack
PAYSTACK_SECRET_KEY=sk_test_your_secret_key
PAYSTACK_WEBHOOK_SECRET=whsec_your_webhook_secret

# Africa's Talking SMS
AT_API_KEY=your_api_key
AT_USERNAME=your_username

# Pricing
PRICE_PER_LITER=5
CURRENCY=KES
```

## Payment Flow

### M-Pesa Flow (STK Push)
1. **User enters amount** → System calculates liters (e.g., 50 KES = 10L)
2. **User confirms** → STK Push sent to phone
3. **User enters PIN** → M-Pesa processes payment
4. **Payment succeeds** → System generates OTP
5. **OTP sent via SMS** → User receives OTP
6. **User presents OTP at station** → Station dispenses water

### Paystack Flow (Hosted Checkout)
1. **User enters amount** → System calculates liters
2. **User confirms** → Redirected to Paystack
3. **User pays** → Card/Bank/USSD payment
4. **Payment succeeds** → Webhook received
5. **System generates OTP** → OTP sent via SMS
6. **User presents OTP at station** → Station dispenses water

## API Endpoints

### Shared
- `POST /api/payments/preview` - Get amount → liters conversion
- `GET /api/payments/status/:ref` - Check payment status (both methods)

### M-Pesa (Daraja)
- `POST /api/payments/mpesa/initiate` - Start STK Push
- `POST /api/payments/mpesa/callback` - M-Pesa callback (internal)
- `GET /api/payments/mpesa/query/:ref` - Query from M-Pesa

### Paystack
- `POST /api/payments/paystack/initialize` - Start Paystack checkout
- `GET /api/payments/paystack/verify/:ref` - Verify payment
- `GET /api/payments/paystack/callback` - Paystack redirect (internal)
- `POST /api/payments/paystack/webhook` - Paystack webhook (internal)

### OTP
- `POST /api/otp/generate` - Generate OTP (manual)
- `GET /api/otp/status/:ref` - Check OTP status

### Station
- `POST /api/stations/otp/verify` - Verify OTP for dispensing
- `GET /api/stations/otp/status/:ref` - Station OTP status

### Health
- `GET /api/health` - System health check

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis (optional)
- **Payments**: 
  - Safaricom Daraja API (M-Pesa STK Push)
  - Paystack (Cards, Bank, USSD)
- **SMS**: Africa's Talking
- **Package Manager**: pnpm

## Security Features

- SHA-256 OTP hashing
- Constant-time OTP verification
- M-Pesa callback validation
- Paystack webhook signature verification
- Rate limiting (100 req/15min)
- Helmet.js security headers
- SQL injection prevention
- Attempt limiting (3 max)

## Documentation

- [Payment Setup Guide](backend/PAYMENT_SETUP.md) - M-Pesa & Paystack setup
- [API Documentation](backend/API_DOCUMENTATION.md) - Detailed API reference

## Development

```bash
# Run with hot reload
pnpm run dev

# Run database migrations
pnpm run migrate

# Production build
pnpm start
```

## Testing

### Sandbox Testing

**M-Pesa Sandbox**:
- Daraja Till: `174379`
- Test phone: `254712345678`

**Paystack Test Mode**:
- Use test API keys (pk_test_*, sk_test_*)
- Test card: `4084 0840 8408 4081`

**SMS Sandbox**:
- Africa's Talking: Username `sandbox`

### Test Flows

**M-Pesa Test**:
```bash
# 1. Preview
curl -X POST http://localhost:3000/api/payments/preview \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'

# 2. Initiate
curl -X POST http://localhost:3000/api/payments/mpesa/initiate \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "254712345678", "amount": 50}'
```

**Paystack Test**:
```bash
# 1. Preview
curl -X POST http://localhost:3000/api/payments/preview \
  -H "Content-Type: application/json" \
  -d '{"amount": 50}'

# 2. Initialize
curl -X POST http://localhost:3000/api/payments/paystack/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "amount": 50,
    "phoneNumber": "254712345678"
  }'
```

## Deployment

### Production Checklist

**M-Pesa**:
- [ ] Obtain production Daraja credentials
- [ ] Register production Till Number
- [ ] Configure HTTPS callback URL

**Paystack**:
- [ ] Complete business verification
- [ ] Get production API keys
- [ ] Configure webhook URL (HTTPS)

**Common**:
- [ ] Setup Africa's Talking production account
- [ ] Get SMS Sender ID approved
- [ ] Configure production database
- [ ] Setup Redis (recommended)
- [ ] Enable monitoring/logging
- [ ] Test both payment flows end-to-end

## License

ISC

## Support

For setup help, see [PAYMENT_SETUP.md](backend/PAYMENT_SETUP.md)

