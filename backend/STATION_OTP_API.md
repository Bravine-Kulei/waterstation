# Station OTP Verification API

## Overview

This API provides endpoints for water dispensing stations to verify OTPs and authorize water dispensing. The system enforces security measures including max attempts, expiration checks, and optional station locking.

## Endpoints

### 1. Verify OTP for Dispensing

**Endpoint:** `POST /api/stations/otp/verify`

**Description:** Verifies an OTP and authorizes water dispensing. Marks OTP as `IN_PROGRESS` upon successful verification.

**Request Body:**
```json
{
  "transactionReference": "TXN123456789",
  "otp": "123456",
  "stationId": "STATION001"
}
```

**Request Fields:**
- `transactionReference` (string, required): The transaction reference linked to the OTP
- `otp` (string, required): 6-digit OTP code
- `stationId` (string, required): Unique identifier of the dispensing station

**Success Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully. Dispensing authorized.",
  "data": {
    "transactionReference": "TXN123456789",
    "stationId": "STATION001",
    "liters": 10.5,
    "pulses": 10500,
    "status": "in_progress",
    "verifiedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

**Response Fields:**
- `liters` (number): Amount of water authorized in liters
- `pulses` (number): Hardware pulses required (liters × pulses_per_liter)
- `status` (string): OTP status (`in_progress` after verification)
- `verifiedAt` (ISO timestamp): When OTP was verified

**Error Responses:**

| Status Code | Error | Description |
|------------|-------|-------------|
| 400 | Invalid OTP | OTP is incorrect |
| 400 | OTP has expired | OTP has passed expiration time |
| 400 | OTP has been blocked | Too many failed attempts |
| 400 | Validation error | Missing or invalid request fields |
| 403 | OTP locked to different station | OTP is locked to another station |
| 404 | OTP not found | Transaction reference not found |
| 409 | OTP already in use | OTP is in progress at different station |

**Example Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid OTP. 2 attempt(s) remaining"
  }
}
```

---

### 2. Get OTP Status

**Endpoint:** `GET /api/stations/otp/status/:transactionReference`

**Description:** Retrieves the current status of an OTP for a specific station.

**URL Parameters:**
- `transactionReference` (string, required): Transaction reference

**Query Parameters:**
- `stationId` (string, required): Station ID checking the status

**Example Request:**
```
GET /api/stations/otp/status/TXN123456789?stationId=STATION001
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "exists": true,
    "status": "active",
    "liters": 10.5,
    "pulses": 10500,
    "expiresAt": "2024-01-01T13:00:00.000Z",
    "attempts": 0,
    "maxAttempts": 3,
    "remainingAttempts": 3,
    "stationId": null,
    "isLockedToDifferentStation": false,
    "canUse": true
  }
}
```

**Response Fields:**
- `exists` (boolean): Whether OTP exists
- `status` (string): Current status (`active`, `in_progress`, `used`, `expired`, `blocked`, or `null`)
- `liters` (number): Water amount in liters
- `pulses` (number): Hardware pulses required
- `expiresAt` (ISO timestamp): Expiration time
- `attempts` (number): Number of failed attempts
- `maxAttempts` (number): Maximum allowed attempts
- `remainingAttempts` (number): Attempts remaining
- `stationId` (string|null): Station ID if locked to a station
- `isLockedToDifferentStation` (boolean): Whether locked to different station
- `canUse` (boolean): Whether station can use this OTP

**Error Responses:**

| Status Code | Error | Description |
|------------|-------|-------------|
| 400 | Transaction reference is required | Missing transaction reference |
| 400 | Station ID is required | Missing stationId query parameter |

---

## Security Features

### 1. Max Attempts Enforcement
- Default: 3 attempts
- OTP is blocked after max attempts exceeded
- Attempts are tracked per OTP

### 2. Expiration Check
- OTPs expire after configurable time (default: 10 minutes)
- Expired OTPs cannot be verified
- Expiration is checked on every verification attempt

### 3. Station Locking (Optional)
- When enabled (`STATION_ENFORCE_LOCK=true`), OTPs are locked to the first station that verifies them
- Prevents OTP reuse across multiple stations
- Can be disabled for multi-station scenarios

### 4. Status Management
- `active`: OTP is available for verification
- `in_progress`: OTP verified and dispensing authorized
- `used`: OTP has been fully consumed
- `expired`: OTP has passed expiration time
- `blocked`: Too many failed attempts

---

## Configuration

Environment variables (in `.env`):

```bash
# Station Configuration
STATION_PULSES_PER_LITER=1000    # Pulses per liter (hardware-specific)
STATION_ENFORCE_LOCK=true         # Lock OTP to first verifying station
STATION_REQUIRE_AUTH=false        # Require station authentication (future)
```

---

## Usage Flow

1. **Customer pays** → Transaction created with status `completed`
2. **OTP generated** → Customer receives OTP via `/api/otp/generate`
3. **Customer enters OTP at station** → Station calls `/api/stations/otp/verify`
4. **System verifies** → Checks expiration, attempts, station lock
5. **Authorization granted** → Returns liters and pulses, marks as `in_progress`
6. **Station dispenses** → Uses pulses to control hardware
7. **Completion** → Station can mark OTP as `used` (future endpoint)

---

## Example Integration

```javascript
// Station verifies OTP
const response = await fetch('https://api.example.com/api/stations/otp/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transactionReference: 'TXN123456789',
    otp: '123456',
    stationId: 'STATION001'
  })
});

const result = await response.json();

if (result.success) {
  const { liters, pulses } = result.data;
  // Authorize dispensing hardware with pulses
  authorizeDispensing(pulses);
} else {
  // Handle error
  console.error(result.error.message);
}
```

---

## Notes

- OTPs are hashed before storage (never stored in plain text)
- Verification uses constant-time comparison to prevent timing attacks
- All verification attempts are logged for auditing
- Station locking prevents OTP reuse across stations (when enabled)
- Pulses calculation: `pulses = liters × STATION_PULSES_PER_LITER`
