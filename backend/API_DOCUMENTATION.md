# API Documentation

Complete API reference for the Water Station dual payment system (M-Pesa + Paystack).

## Base URL

```
Development: http://localhost:3000/api
Production: https://yourdomain.com/api
```

## Authentication

Currently, all endpoints are public. In production, implement authentication for:
- Payment initiation
- OTP generation
- Transaction status queries
- Station endpoints (station authentication)

## Payment Methods

This system supports **two payment methods**:
1. **M-Pesa (Daraja API)** - `/api/payments/mpesa/*`
2. **Paystack** - `/api/payments/paystack/*`

Both methods automatically generate and send OTP via SMS after successful payment.

## Payment Endpoints

### 1. Get Payment Preview

Calculate liters from amount with rounding.

**Endpoint**: `POST /api/payments/preview`

**Request Body**:
```json
{
  "amount": 52
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment preview generated",
  "data": {
    "requestedAmount": 52,
    "amount": 50,
    "liters": 10,
    "pricePerLiter": 5,
    "currency": "KES",
    "roundingStrategy": "nearest",
    "difference": -2
  }
}
```

**Errors**:
- `400` - Invalid amount or out of range

---

### 2. Initiate M-Pesa Payment

Start STK Push payment flow.

**Endpoint**: `POST /api/payments/mpesa/initiate`

**Request Body**:
```json
{
  "phoneNumber": "254712345678",
  "amount": 50,
  "metadata": {
    "customerName": "John Doe",
    "location": "Station 1"
  }
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "M-Pesa payment initiated. Please enter your PIN.",
  "data": {
    "success": true,
    "transactionReference": "WS-1707123456789-ABCD1234",
    "checkoutRequestId": "ws_CO_01022024123456789_254712345678",
    "amount": 50,
    "liters": 10,
    "phoneNumber": "254712345678",
    "status": "processing",
    "message": "Please enter your M-Pesa PIN"
  }
}
```

**Errors**:
- `400` - Invalid phone number or amount
- `500` - STK Push initiation failed

**Notes**:
- Phone number must be in format: 254XXXXXXXXX
- Amount will be rounded to nearest liter equivalent
- User receives STK Push prompt on their phone

---

### 3. M-Pesa Callback

**Internal endpoint** - Called by Safaricom Daraja API.

**Endpoint**: `POST /api/payments/mpesa/callback`

**Request Body** (from Daraja):
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-34620561-1",
      "CheckoutRequestID": "ws_CO_01022024123456789_254712345678",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 50
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ41HAY6Q"
          },
          {
            "Name": "TransactionDate",
            "Value": 20240201120000
          },
          {
            "Name": "PhoneNumber",
            "Value": 254712345678
          }
        ]
      }
    }
  }
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Callback processed successfully"
}
```

**Process**:
1. Validates callback data
2. Updates transaction status
3. Generates OTP if payment successful
4. Sends OTP via SMS
5. Returns 200 to M-Pesa

---

### 4. Get Transaction Status

Check payment status by transaction reference.

**Endpoint**: `GET /api/payments/status/:transactionReference`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": 123,
    "transactionReference": "WS-1707123456789-ABCD1234",
    "phoneNumber": "254712345678",
    "amount": 50,
    "liters": 10,
    "currency": "KES",
    "status": "completed",
    "checkoutRequestId": "ws_CO_01022024123456789_254712345678",
    "merchantRequestId": "29115-34620561-1",
    "mpesaReceiptNumber": "NLJ41HAY6Q",
    "transactionDate": "2024-02-01T12:00:00.000Z",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    "metadata": {},
    "createdAt": "2024-02-01T11:55:00.000Z",
    "updatedAt": "2024-02-01T12:00:05.000Z"
  }
}
```

**Status Values**:
- `pending` - Transaction created, awaiting STK Push
- `processing` - STK Push sent, awaiting user input
- `completed` - Payment successful
- `failed` - Payment failed
- `cancelled` - User cancelled
- `timeout` - No response within 30 minutes

**Errors**:
- `404` - Transaction not found

---

### 5. Query M-Pesa Directly

Query transaction status from Daraja API.

**Endpoint**: `GET /api/payments/mpesa/query/:transactionReference`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment status verified from M-Pesa",
  "data": {
    "transactionReference": "WS-1707123456789-ABCD1234",
    "status": "completed",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    ...
  }
}
```

**Errors**:
- `404` - Transaction not found
- `400` - No checkout request ID
- `500` - Query failed

---

## Paystack Payment Endpoints

### 6. Initialize Paystack Payment

Start Paystack checkout flow.

**Endpoint**: `POST /api/payments/paystack/initialize`

**Request Body**:
```json
{
  "email": "customer@example.com",
  "amount": 50,
  "phoneNumber": "254712345678",
  "currency": "NGN",
  "metadata": {}
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "Payment checkout initialized successfully. Redirect customer to authorizationUrl.",
  "data": {
    "transactionReference": "WS-1707123456789-ABCD1234",
    "authorizationUrl": "https://checkout.paystack.com/xxx",
    "accessCode": "xxx",
    "status": "processing",
    "expiresAt": "2024-02-02T12:00:00.000Z"
  }
}
```

**Notes**:
- Email is required for Paystack
- Phone number is optional but needed for SMS OTP
- Amount converted to liters (stored in metadata)
- User redirected to Paystack hosted page

---

### 7. Verify Paystack Payment

Verify payment status from Paystack API.

**Endpoint**: `GET /api/payments/paystack/verify/:transactionReference`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment verified successfully",
  "data": {
    "transactionReference": "WS-1707123456789-ABCD1234",
    "status": "completed",
    "amount": 50,
    "currency": "NGN",
    "paystackStatus": "success",
    "paystackChannel": "card",
    "paystackReceiptNumber": "PST123456",
    ...
  }
}
```

---

### 8. Paystack Callback

**Internal endpoint** - Browser redirect from Paystack.

**Endpoint**: `GET /api/payments/paystack/callback?reference=xxx`

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment callback received. Verify payment to confirm final status.",
  "data": {
    "reference": "WS-1707123456789-ABCD1234",
    "verifyUrl": "/api/payments/paystack/verify/WS-1707123456789-ABCD1234"
  }
}
```

---

### 9. Paystack Webhook

**Internal endpoint** - Called by Paystack server-to-server.

**Endpoint**: `POST /api/payments/paystack/webhook`

**Process**:
1. Validates webhook signature
2. Updates transaction status
3. Generates OTP automatically
4. Sends SMS if phone number provided
5. Returns 200 to Paystack

---

### 10. Get Transaction Status (Universal)

Check payment status for any transaction (M-Pesa or Paystack).

**Endpoint**: `GET /api/payments/status/:transactionReference`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "transactionReference": "WS-1707123456789-ABCD1234",
    "status": "completed",
    "amount": 50,
    "liters": 10,
    ...
  }
}
```

**Notes**:
- Checks M-Pesa table first, then Paystack table
- Returns unified format regardless of payment method

---

## OTP Endpoints

### 11. Generate OTP (Manual)

Manually generate OTP for a completed transaction.

**Endpoint**: `POST /api/otp/generate`

**Request Body**:
```json
{
  "transactionReference": "WS-1707123456789-ABCD1234",
  "liters": 10
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "message": "OTP generated successfully",
  "data": {
    "otp": "123456",
    "transactionReference": "WS-1707123456789-ABCD1234",
    "liters": 10,
    "expiresAt": "2024-02-01T12:10:00.000Z",
    "expiresInMinutes": 10
  }
}
```

**Errors**:
- `404` - Transaction not found
- `400` - Transaction not completed

**Notes**:
- OTP is only returned once
- OTP is hashed (SHA-256) in database
- Expires in 10 minutes (configurable)
- Max 3 verification attempts

---

### 12. Get OTP Status

Check OTP status for a transaction.

**Endpoint**: `GET /api/otp/status/:transactionReference`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "exists": true,
    "status": "active",
    "expiresAt": "2024-02-01T12:10:00.000Z",
    "attempts": 0,
    "maxAttempts": 3,
    "liters": 10,
    "remainingAttempts": 3
  }
}
```

**OTP Status Values**:
- `active` - OTP is valid and unused
- `in_progress` - Locked to a station, dispensing
- `used` - Already used successfully
- `expired` - Expired (time or manual)
- `blocked` - Too many failed attempts

---

## Station Endpoints

### 13. Verify OTP for Dispensing

Verify OTP and get dispensing instructions.

**Endpoint**: `POST /api/stations/otp/verify`

**Request Body**:
```json
{
  "transactionReference": "WS-1707123456789-ABCD1234",
  "otp": "123456",
  "stationId": "STATION001"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "OTP verified successfully. Dispensing authorized.",
  "data": {
    "transactionReference": "WS-1707123456789-ABCD1234",
    "stationId": "STATION001",
    "liters": 10,
    "pulses": 10000,
    "status": "in_progress",
    "verifiedAt": "2024-02-01T12:05:00.000Z"
  }
}
```

**Errors**:
- `400` - Invalid OTP, expired, or blocked
- `403` - OTP locked to different station
- `404` - OTP not found
- `409` - OTP in use at different station

**Notes**:
- OTP format: 6 digits
- Station locking prevents reuse
- Pulses calculated: `liters × STATION_PULSES_PER_LITER`
- Default: 1000 pulses per liter

---

### 14. Get OTP Status for Station

Check if OTP can be used at specific station.

**Endpoint**: `GET /api/stations/otp/status/:transactionReference?stationId=STATION001`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "exists": true,
    "status": "active",
    "liters": 10,
    "pulses": 10000,
    "expiresAt": "2024-02-01T12:10:00.000Z",
    "attempts": 0,
    "maxAttempts": 3,
    "remainingAttempts": 3,
    "stationId": null,
    "isLockedToDifferentStation": false,
    "canUse": true
  }
}
```

---

## Health Check

### 15. System Health

Check system health (database, Redis).

**Endpoint**: `GET /api/health`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "database": "connected",
    "redis": "connected",
    "timestamp": "2024-02-01T12:00:00.000Z"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "ERROR_CODE"
}
```

### Common Error Codes

- `400` - Bad Request (invalid input)
- `401` - Unauthorized (not implemented yet)
- `403` - Forbidden (e.g., station lock)
- `404` - Not Found (transaction/OTP)
- `409` - Conflict (duplicate, in use)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error

---

## Rate Limiting

Default: **100 requests per 15 minutes** per IP

Response when exceeded:
```json
{
  "success": false,
  "message": "Too many requests from this IP, please try again later."
}
```

Headers:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset timestamp

---

## Webhooks

### M-Pesa Callback Security

- Callback URL must be HTTPS in production
- Safaricom IP whitelist (optional)
- Payload validation (automatically handled)

### SMS Delivery Reports

Africa's Talking can send delivery reports to a configured URL:
```
POST /api/sms/delivery-reports
```

(Not yet implemented)

---

## Testing

### Sandbox Credentials

**Daraja**:
- Consumer Key: From sandbox app
- Consumer Secret: From sandbox app
- Passkey: From sandbox app
- Till Number: `174379`
- Environment: `sandbox`

**Africa's Talking**:
- Username: `sandbox`
- API Key: From sandbox dashboard
- Sender ID: Any value (not validated)

### Test Phone Numbers

Sandbox accepts any Kenyan number (254XXXXXXXXX).

For Africa's Talking sandbox:
- Add test numbers in dashboard
- SMS not actually delivered

---

## Pagination

Not yet implemented. Future endpoints may include:
- `?page=1&limit=50`
- `?offset=0&limit=50`

---

## Versioning

Current version: **v1.0.0**

API prefix: `/api`

Future versions may use: `/api/v2`, `/api/v3`, etc.

---

## Support

- Technical issues: Check logs (`LOG_LEVEL=debug`)
- Daraja issues: [developer.safaricom.co.ke/support](https://developer.safaricom.co.ke/support)
- Africa's Talking: [help.africastalking.com](https://help.africastalking.com)
