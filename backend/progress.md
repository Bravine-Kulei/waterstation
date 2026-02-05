## Water Station Backend — Progress

### What’s functional right now

#### **1) Core backend foundation**
- **Express API** bootstrapped with production-safe middleware:
  - `helmet`, `cors`, `express-rate-limit`
- **Centralized routing** under `API_PREFIX` (default: `/api`)
- **Centralized error handling**:
  - `AppError`, `asyncHandler`, `notFoundHandler`, `errorHandler`
- **Health check** endpoint:
  - `GET /api/health` returns service status (DB + Redis)

#### **2) Config layer (no hardcoded secrets)**
- Environment-driven configuration split into config modules:
  - `src/config/app.config.js`
  - `src/config/database.config.js`
  - `src/config/redis.config.js`
  - `src/config/paystack.config.js`
  - `src/config/otp.config.js`
  - `src/config/station.config.js`
- Startup validation:
  - `validateConfig()` runs on boot in `src/server.js`

#### **3) PostgreSQL + Redis connectivity**
- PostgreSQL connection via **`pg` Pool** (`src/config/database.js`)
- Redis client (`src/config/redis.js`) with:
  - reconnection strategy
  - **non-blocking startup** (server starts even if Redis is down)

#### **4) Paystack payments module (current payment gateway)**
Paystack integration is implemented using a controller → service structure with storage in PostgreSQL.

- **Initialize checkout**
  - `POST /api/payments/initialize`
  - Creates a transaction, then calls Paystack `/transaction/initialize`
  - Returns **`authorizationUrl`** for redirecting the customer

- **Verify a payment**
  - `GET /api/payments/verify/:transactionReference`
  - Calls Paystack `/transaction/verify/:reference`
  - Updates local transaction status accordingly

- **Transaction status**
  - `GET /api/payments/status/:transactionReference`
  - Returns current stored status (and updates to `expired` if applicable)

- **Webhook endpoint (server-to-server)**
  - `POST /api/payments/webhook`
  - Uses `express.raw({ type: 'application/json' })` and validates `X-Paystack-Signature`
  - Processes key events:
    - `charge.success` → marks transaction `completed`
    - `charge.failed` → marks transaction `failed`
    - `charge.dispute.create` → logged (no state change by default)

- **Callback (browser redirect) endpoint**
  - `GET /api/payments/callback`
  - Accepts Paystack redirect query params (`reference` / `trxref`)
  - Responds with a suggested verify URL (final confirmation should be via verify/webhook)

**Where to configure URLs**
- Callback URL to copy:
  - Local: `http://localhost:3000/api/payments/callback`
  - Prod: `https://your-domain.com/api/payments/callback`
- Webhook URL to copy:
  - Local: `http://localhost:3000/api/payments/webhook`
  - Prod: `https://your-domain.com/api/payments/webhook`

#### **5) OTP module (secure OTPs for dispensing)**
OTP functionality is implemented with hashing, DB persistence, and optional Redis caching.

- **OTP generation (customer-facing)**
  - `POST /api/otp/generate`
  - Generates **secure 6-digit** OTP using crypto, **hashes** before storage
  - Links OTP to:
    - `transactionReference`
    - `liters`
  - Enforces:
    - expiry (configurable)
    - max attempts (configurable; default 3)
    - one-time use
  - Caches active OTP in Redis (if Redis is available)

- **OTP verification (customer-facing)**
  - `POST /api/otp/verify`
  - Validates OTP, checks expiry, increments attempts, blocks at max attempts
  - Marks OTP as `used` on success and removes from Redis cache

- **OTP status**
  - `GET /api/otp/status/:transactionReference`

#### **6) Station OTP verification endpoints (dispensing stations)**
Endpoints specifically for dispensing stations to validate OTPs and authorize dispensing.

- **Verify OTP for dispensing**
  - `POST /api/stations/otp/verify`
  - Validates OTP + expiry + max attempts
  - Optionally **locks OTP to a station** (configurable)
  - Returns:
    - liters allowed
    - pulses allowed (`liters * STATION_PULSES_PER_LITER`)
  - Marks OTP as **`in_progress`** when accepted

- **Station OTP status**
  - `GET /api/stations/otp/status/:transactionReference?stationId=STATION001`

Docs:
- `STATION_OTP_API.md` describes request/response contracts and behaviors.

#### **7) Background expiration checks**
- Transactions expiration check runs periodically (`src/services/transactionTimeoutService.js`)
- OTP expiration check runs periodically (`src/services/otpExpirationService.js`)

### What still needs setup / attention

#### **Database permissions (migration blocker)**
`npm run migrate` currently fails on some environments with:
- `permission denied for schema public`

Fix: grant CREATE privileges on schema `public` to your DB user (or run migrations as a superuser).

#### **Station authentication**
Station endpoints are currently **public** (by design for now).
- Next hardening step: require station auth (shared secret / API key / mTLS / JWT, etc.)

#### **OTP lifecycle completion**
Stations mark OTP as `in_progress` on acceptance.
- Next step (recommended): an endpoint for stations to mark OTP as `used` after dispensing completes (to close the loop).

### Key files (quick map)
- **Server entry**: `src/server.js`
- **Routes**: `src/routes/`
  - `paymentRoutes.js`, `otpRoutes.js`, `stationRoutes.js`
- **Controllers**: `src/controllers/`
- **Services**: `src/services/`
- **Repositories**: `src/repositories/`
- **DB schemas**: `src/models/transactions.sql`, `src/models/otps.sql`
- **Configs**: `src/config/*.config.js`

