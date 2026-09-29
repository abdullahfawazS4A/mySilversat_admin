# Silversat API — Endpoints Reference

Base URL (default): `http://localhost:3641`

Swagger (non-prod): `http://localhost:3641/api-docs`

## Global response shape

Almost all JSON responses are wrapped by `TransformInterceptor`:

```json
{
  "data": {},
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/example"
}
```

Paginated lists also include `total`, `limit`, `offset` at the top level:

```json
{
  "data": [],
  "total": 100,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/example?limit=20&offset=0"
}
```

Pagination query params (where noted): `limit` (default 20, max 100), `offset` (default 0).

## Auth

| Type | Header |
|------|--------|
| **Admin JWT** | `Authorization: Bearer <admin_access_token>` |
| **App JWT** | `Authorization: Bearer <app_access_token>` |
| **Public** | No auth |

Admin roles: `SUPER_ADMIN`, `ADMIN`, `USER` (endpoint notes which are required).

---

# Table of contents

1. [Health](#1-health)
2. [Admin Auth](#2-admin-auth--auth)
3. [App Auth](#3-app-auth--app-auth)
4. [Admin Users](#4-admin-users--users)
5. [App Users (admin)](#5-app-users-admin--app-users)
6. [Countries](#6-countries--countries)
7. [Provinces](#7-provinces--provinces)
8. [SilverSat Regions](#8-silversat-regions--silversat-regions)
9. [SilverSat Proxy](#9-silversat-proxy--silversat)
10. [Products](#10-products--products)
11. [Categories](#11-categories--categories)
12. [Batches](#12-batches--batches)
13. [Codes](#13-codes--codes)
14. [Catalog & Orders](#14-catalog--orders)
15. [Wayl Payments](#15-wayl-payments--wayl)
16. [Devices](#16-devices--devices)
17. [Towers](#17-towers--towers)
18. [Ads](#18-ads--ads)
19. [Leagues](#19-leagues--leagues)
20. [Teams](#20-teams--teams)
21. [Matches](#21-matches--matches)
22. [Predictions](#22-predictions--predictions)
23. [API-Football Sync](#23-api-football-sync--api-football)
24. [Notifications](#24-notifications--notifications)
25. [Prize Draws](#25-prize-draws--prize-draws)
26. [Coupons](#26-coupons--coupons)
27. [FAQs](#27-faqs--faqs)
28. [Tutorial Videos](#28-tutorial-videos--tutorial-videos)
29. [Contact Links](#29-contact-links--contact-links)
30. [Telegram](#30-telegram--telegram)

---
## 1. Health

### `GET /`

**Auth:** Public

Simple health / hello check.

**Request**

```http
GET / HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": "Hello World!",
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/"
}
```

---

## 2. Admin Auth — `/auth`

### `POST /auth/login`

**Auth:** Public

Validate admin phone+password and send SMS OTP. Does not return JWT yet.

**Request**

```http
POST /auth/login HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "phone": "9647701234567",
  "password": "AdminPass123"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/login"
}
```

---

### `POST /auth/verify-otp`

**Auth:** Public

Verify login OTP and receive admin JWT.

**Request**

```http
POST /auth/verify-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "code": "123456"
}
```

**Response**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "11111111-1111-1111-1111-111111111111",
      "email": "admin@silversat.com",
      "name": "Admin User",
      "role": "SUPER_ADMIN"
    }
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/verify-otp"
}
```

---

### `POST /auth/resend-otp`

**Auth:** Public

Resend admin login OTP for an existing challenge.

**Request**

```http
POST /auth/resend-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/resend-otp"
}
```

---

### `POST /auth/forgot-password`

**Auth:** Public

Send WhatsApp OTP to reset admin password.

**Request**

```http
POST /auth/forgot-password HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "phone": "9647701234567"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/forgot-password"
}
```

---

### `POST /auth/reset-password`

**Auth:** Public

Verify reset OTP and set a new admin password.

**Request**

```http
POST /auth/reset-password HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "code": "654321",
  "newPassword": "NewAdminPass123"
}
```

**Response**

```json
{
  "data": {
    "message": "Password reset successfully"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/reset-password"
}
```

---

### `POST /auth/resend-password-reset-otp`

**Auth:** Public

Resend admin password-reset OTP.

**Request**

```http
POST /auth/resend-password-reset-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/resend-password-reset-otp"
}
```

---

### `GET /auth/me`

**Auth:** Admin JWT

Return the current authenticated admin profile.

**Request**

```http
GET /auth/me HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "11111111-1111-1111-1111-111111111111",
    "email": "admin@silversat.com",
    "name": "Admin User",
    "phone": "9647701234567",
    "role": "SUPER_ADMIN",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/me"
}
```

---

### `POST /auth/register`

**Auth:** Public (Swagger-excluded)

Bootstrap create SUPER_ADMIN (intended for initial setup only).

**Request**

```http
POST /auth/register HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "email": "admin@silversat.com",
  "phone": "9647701234567",
  "password": "AdminPass123",
  "firstName": "Admin",
  "lastName": "User"
}
```

**Response**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "11111111-1111-1111-1111-111111111111",
      "email": "admin@silversat.com",
      "name": "Admin User",
      "role": "SUPER_ADMIN"
    }
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/auth/register"
}
```

---

## 3. App Auth — `/app-auth`

### `POST /app-auth/register/send-otp`

**Auth:** Public

Start app-user registration: send OTP to phone (account not created yet).

**Request**

```http
POST /app-auth/register/send-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "phone": "07701234567"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/register/send-otp"
}
```

---

### `POST /app-auth/register/resend-otp`

**Auth:** Public

Resend registration OTP.

**Request**

```http
POST /app-auth/register/resend-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/register/resend-otp"
}
```

---

### `POST /app-auth/register`

**Auth:** Public

Verify OTP, create app user with SilverSat region, return App JWT.

**Request**

```http
POST /app-auth/register HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "code": "123456",
  "name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "password": "SecurePass123",
  "phone": "07701234567",
  "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

**Response**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "phone": "07701234567",
      "imageUrl": null,
      "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "points": 0,
      "isBlocked": false,
      "createdAt": "2026-09-24T07:00:00.000Z",
      "updatedAt": "2026-09-24T07:00:00.000Z"
    }
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/register"
}
```

---

### `POST /app-auth/login`

**Auth:** Public

App-user login with phone+password (no OTP). Returns App JWT.

**Request**

```http
POST /app-auth/login HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "phone": "07701234567",
  "password": "SecurePass123"
}
```

**Response**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Ahmed Ali",
      "email": "ahmed@example.com",
      "phone": "07701234567",
      "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "points": 120,
      "isBlocked": false
    }
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/login"
}
```

---

### `POST /app-auth/forgot-password`

**Auth:** Public

Send WhatsApp OTP for app-user password reset.

**Request**

```http
POST /app-auth/forgot-password HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "phone": "07701234567"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "d4e5f6a7-b8c9-0123-def0-234567890123",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/forgot-password"
}
```

---

### `POST /app-auth/reset-password`

**Auth:** Public

Verify reset OTP and set new app-user password.

**Request**

```http
POST /app-auth/reset-password HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "code": "654321",
  "newPassword": "NewSecurePass123"
}
```

**Response**

```json
{
  "data": {
    "message": "Password reset successfully"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/reset-password"
}
```

---

### `POST /app-auth/resend-password-reset-otp`

**Auth:** Public

Resend app-user password-reset OTP.

**Request**

```http
POST /app-auth/resend-password-reset-otp HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "challengeToken": "d4e5f6a7-b8c9-0123-def0-234567890123"
}
```

**Response**

```json
{
  "data": {
    "requiresOtp": true,
    "challengeToken": "d4e5f6a7-b8c9-0123-def0-234567890123",
    "maskedPhone": "****4567",
    "expiresInSeconds": 300
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/resend-password-reset-otp"
}
```

---

### `GET /app-auth/me`

**Auth:** App JWT

Current app-user profile plus SilverSat regions in the same province.

**Request**

```http
GET /app-auth/me HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "phone": "07701234567",
    "imageUrl": "/uploads/app-users/user-123.jpg",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "silversatRegion": {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "name": "Erbil Region",
      "provinceId": "33333333-3333-3333-3333-333333333333"
    },
    "points": 120,
    "isBlocked": false,
    "silversatRegions": [
      {
        "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        "name": "Erbil Region",
        "baseUrl": "https://region.example.com",
        "isActive": true,
        "provinceId": "33333333-3333-3333-3333-333333333333"
      }
    ]
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/me"
}
```

---

### `GET /app-auth/leaderboard`

**Auth:** App JWT

Top prediction scorers (default top 50).

**Request**

```http
GET /app-auth/leaderboard HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "name": "Ahmed Ali",
      "points": 250,
      "imageUrl": null
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/leaderboard"
}
```

---

### `PATCH /app-auth/me`

**Auth:** App JWT

Update profile (multipart). Changing region is blocked if user has devices.

**Request**

```http
PATCH /app-auth/me HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

Ahmed Ali Updated
------Boundary
Content-Disposition: form-data; name="image"; filename="avatar.jpg"
Content-Type: image/jpeg

<binary>
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "22222222-2222-2222-2222-222222222222",
    "name": "Ahmed Ali Updated",
    "imageUrl": "/uploads/app-users/app-user-123.jpg",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "silversatRegions": []
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/me"
}
```

---

### `PATCH /app-auth/me/silversat-region`

**Auth:** App JWT

Change SilverSat region. Returns 400 if the user has registered devices.

**Request**

```http
PATCH /app-auth/me/silversat-region HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{
  "silversatRegionId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
}
```

**Response**

```json
{
  "data": {
    "id": "22222222-2222-2222-2222-222222222222",
    "silversatRegionId": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    "silversatRegions": []
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-auth/me/silversat-region"
}
```

> Error example when devices exist: `{ "statusCode": 400, "message": "Cannot change SilverSat region while you have registered devices. Delete your devices first." }`

---

## 4. Admin Users — `/users`

### `POST /users/register`

**Auth:** Admin JWT — SUPER_ADMIN

Create a new admin/panel user.

**Request**

```http
POST /users/register HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "ops@silversat.com",
  "phone": "9647709998888",
  "password": "OpsPass123",
  "name": "Ops Admin",
  "role": "ADMIN"
}
```

**Response**

```json
{
  "data": {
    "id": "44444444-4444-4444-4444-444444444444",
    "email": "ops@silversat.com",
    "phone": "9647709998888",
    "name": "Ops Admin",
    "role": "ADMIN"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/users/register"
}
```

---

### `PATCH /users/change-password`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Change the authenticated admin's password.

**Request**

```http
PATCH /users/change-password HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "currentPassword": "OpsPass123",
  "newPassword": "OpsPass456"
}
```

**Response**

```json
{
  "data": { "message": "Password changed successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/users/change-password"
}
```

---

### `PATCH /users`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update the authenticated admin's own profile.

**Request**

```http
PATCH /users HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Ops Admin Updated",
  "email": "ops2@silversat.com"
}
```

**Response**

```json
{
  "data": {
    "id": "44444444-4444-4444-4444-444444444444",
    "name": "Ops Admin Updated",
    "email": "ops2@silversat.com",
    "role": "ADMIN"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/users"
}
```

---

## 5. App Users (admin) — `/app-users`

### `POST /app-users`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create an app user (multipart).

**Request**

```http
POST /app-users HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

Sara Kamal
------Boundary
Content-Disposition: form-data; name="phone"

07709876543
------Boundary
Content-Disposition: form-data; name="password"

SecurePass123
------Boundary
Content-Disposition: form-data; name="silversatRegionId"

aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Sara Kamal",
    "phone": "07709876543",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "points": 0,
    "isBlocked": false
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users"
}
```

---

### `GET /app-users`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Paginated list of app users.

**Request**

```http
GET /app-users?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "55555555-5555-5555-5555-555555555555",
      "name": "Sara Kamal",
      "phone": "07709876543",
      "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "points": 0,
      "isBlocked": false
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users?limit=20&offset=0"
}
```

---

### `GET /app-users/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get one app user by id.

**Request**

```http
GET /app-users/55555555-5555-5555-5555-555555555555 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Sara Kamal",
    "phone": "07709876543",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "isBlocked": false
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users/55555555-5555-5555-5555-555555555555"
}
```

---

### `PATCH /app-users/:id/block`

**Auth:** Admin JWT — SUPER_ADMIN

Block an app user (invalidates sessions).

**Request**

```http
PATCH /app-users/55555555-5555-5555-5555-555555555555/block HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "isBlocked": true
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users/55555555-5555-5555-5555-555555555555/block"
}
```

---

### `PATCH /app-users/:id/unblock`

**Auth:** Admin JWT — SUPER_ADMIN

Unblock an app user.

**Request**

```http
PATCH /app-users/55555555-5555-5555-5555-555555555555/unblock HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "isBlocked": false
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users/55555555-5555-5555-5555-555555555555/unblock"
}
```

---

### `PATCH /app-users/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update app user (multipart).

**Request**

```http
PATCH /app-users/55555555-5555-5555-5555-555555555555 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

Sara Updated
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "55555555-5555-5555-5555-555555555555",
    "name": "Sara Updated"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users/55555555-5555-5555-5555-555555555555"
}
```

---

### `DELETE /app-users/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Soft-delete an app user.

**Request**

```http
DELETE /app-users/55555555-5555-5555-5555-555555555555 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "App user deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/app-users/55555555-5555-5555-5555-555555555555"
}
```

---

## 6. Countries — `/countries`

### `POST /countries`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a country.

**Request**

```http
POST /countries HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "code": "IQ",
  "dialCode": "+964",
  "name": "Iraq",
  "currency": "IQD"
}
```

**Response**

```json
{
  "data": {
    "id": "66666666-6666-6666-6666-666666666666",
    "code": "IQ",
    "dialCode": "+964",
    "name": "Iraq",
    "currency": "IQD"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/countries"
}
```

---

### `GET /countries`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

List countries (paginated).

**Request**

```http
GET /countries?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "66666666-6666-6666-6666-666666666666", "code": "IQ", "name": "Iraq" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/countries?limit=20&offset=0"
}
```

---

### `GET /countries/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get country by id.

**Request**

```http
GET /countries/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "66666666-6666-6666-6666-666666666666", "code": "IQ", "name": "Iraq", "currency": "IQD" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/countries/66666666-6666-6666-6666-666666666666"
}
```

---

### `PATCH /countries/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update country.

**Request**

```http
PATCH /countries/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "name": "Republic of Iraq" }
```

**Response**

```json
{
  "data": { "id": "66666666-6666-6666-6666-666666666666", "name": "Republic of Iraq" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/countries/66666666-6666-6666-6666-666666666666"
}
```

---

### `DELETE /countries/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete country.

**Request**

```http
DELETE /countries/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Country deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/countries/66666666-6666-6666-6666-666666666666"
}
```

---

## 7. Provinces — `/provinces`

### `GET /provinces/for-app`

**Auth:** Public

List provinces for app registration / profile (optional country filter).

**Request**

```http
GET /provinces/for-app?countryId=66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "code": "EBL",
      "name": "Erbil",
      "countryId": "66666666-6666-6666-6666-666666666666"
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces/for-app?countryId=66666666-6666-6666-6666-666666666666"
}
```

---

### `POST /provinces`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create province.

**Request**

```http
POST /provinces HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "countryId": "66666666-6666-6666-6666-666666666666",
  "code": "EBL",
  "name": "Erbil"
}
```

**Response**

```json
{
  "data": {
    "id": "33333333-3333-3333-3333-333333333333",
    "countryId": "66666666-6666-6666-6666-666666666666",
    "code": "EBL",
    "name": "Erbil"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces"
}
```

---

### `GET /provinces`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list provinces (optional `countryId`).

**Request**

```http
GET /provinces?countryId=66666666-6666-6666-6666-666666666666&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "33333333-3333-3333-3333-333333333333", "code": "EBL", "name": "Erbil" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces?countryId=66666666-6666-6666-6666-666666666666&limit=20&offset=0"
}
```

---

### `GET /provinces/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get province by id.

**Request**

```http
GET /provinces/33333333-3333-3333-3333-333333333333 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "33333333-3333-3333-3333-333333333333", "code": "EBL", "name": "Erbil" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces/33333333-3333-3333-3333-333333333333"
}
```

---

### `PATCH /provinces/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update province.

**Request**

```http
PATCH /provinces/33333333-3333-3333-3333-333333333333 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "name": "Erbil Governorate" }
```

**Response**

```json
{
  "data": { "id": "33333333-3333-3333-3333-333333333333", "name": "Erbil Governorate" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces/33333333-3333-3333-3333-333333333333"
}
```

---

### `DELETE /provinces/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete province.

**Request**

```http
DELETE /provinces/33333333-3333-3333-3333-333333333333 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Province deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/provinces/33333333-3333-3333-3333-333333333333"
}
```

---

## 8. SilverSat Regions — `/silversat-regions`

### `POST /silversat-regions`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a SilverSat region with vendor credentials.

**Request**

```http
POST /silversat-regions HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Erbil Region",
  "baseUrl": "https://region.example.com",
  "authKey": "secret-auth-key",
  "userId": "vendor-user",
  "password": "vendor-pass",
  "appDeviceId": "bootstrap",
  "isActive": true,
  "provinceId": "33333333-3333-3333-3333-333333333333"
}
```

**Response**

```json
{
  "data": {
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "name": "Erbil Region",
    "baseUrl": "https://region.example.com",
    "isActive": true,
    "provinceId": "33333333-3333-3333-3333-333333333333"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions"
}
```

---

### `POST /silversat-regions/check-all`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Health-check all regions against vendor APIs.

**Request**

```http
POST /silversat-regions/check-all HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [
    {
      "regionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "name": "Erbil Region",
      "baseUrl": "https://region.example.com",
      "isActive": true,
      "ok": true,
      "latencyMs": 320,
      "info": "OK",
      "error": null
    }
  ],
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions/check-all"
}
```

---

### `POST /silversat-regions/:id/check`

**Auth:** Admin JWT or App JWT

Health-check one region.

**Request**

```http
POST /silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/check HTTP/1.1
Host: localhost:3641
Authorization: Bearer <token>
```

**Response**

```json
{
  "data": {
    "regionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "name": "Erbil Region",
    "ok": true,
    "latencyMs": 280,
    "info": "OK",
    "error": null
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/check"
}
```

---

### `GET /silversat-regions`

**Auth:** Public

List regions (secrets never returned).

**Request**

```http
GET /silversat-regions HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": [
    {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "name": "Erbil Region",
      "isActive": true,
      "provinceId": "33333333-3333-3333-3333-333333333333"
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions"
}
```

---

### `GET /silversat-regions/:id`

**Auth:** Public

Get one region (no secrets).

**Request**

```http
GET /silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": {
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "name": "Erbil Region",
    "baseUrl": "https://region.example.com",
    "isActive": true,
    "provinceId": "33333333-3333-3333-3333-333333333333"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

### `PATCH /silversat-regions/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update region credentials / metadata.

**Request**

```http
PATCH /silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "name": "Erbil Region Updated", "isActive": true }
```

**Response**

```json
{
  "data": {
    "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "name": "Erbil Region Updated",
    "isActive": true
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

### `DELETE /silversat-regions/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete a region (blocked if products/users still linked).

**Request**

```http
DELETE /silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "SilverSat region deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat-regions/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

## 9. SilverSat Proxy — `/silversat`

> Note: App JWT guard is currently commented out on this controller (routes behave as public). Recharge still expects app-user context when guard is re-enabled.

### `GET /silversat/regions`

**Auth:** Public

Active SilverSat regions for clients.

**Request**

```http
GET /silversat/regions HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": [
    {
      "id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "name": "Erbil Region",
      "baseUrl": "https://region.example.com",
      "isActive": true,
      "provinceId": "33333333-3333-3333-3333-333333333333"
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/regions"
}
```

---

### `GET /silversat/me`

**Auth:** Public (Swagger-excluded)

Vendor agent profile for a region.

**Request**

```http
GET /silversat/me?regionId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee HTTP/1.1
Host: localhost:3641
```

**Response**

```json
{
  "data": { "UserId": "vendor-user", "Name": "Agent" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/me?regionId=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

---

### `POST /silversat/subscription`

**Auth:** Public

Lookup device subscription cards (BringBack + GetAuths). Empty array means no cards.

**Request**

```http
POST /silversat/subscription HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "regionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "deviceNumber": "123456789"
}
```

**Response**

```json
{
  "data": [
    {
      "icid": 1,
      "current": { "EndDate": "2026-12-31", "ICID": 1 },
      "history": []
    }
  ],
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/subscription"
}
```

---

### `POST /silversat/check-code`

**Auth:** Public

Validate a recharge code on the vendor API.

**Request**

```http
POST /silversat/check-code HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "regionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "code": "ABC123XYZ"
}
```

**Response**

```json
{
  "data": {
    "exists": true,
    "used": false,
    "usedTime": null,
    "expired": false,
    "type": 1,
    "usedOnDevice": null,
    "info": "OK",
    "raw": {}
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/check-code"
}
```

---

### `POST /silversat/recharge`

**Auth:** Intended App JWT

Activate/renew a device using a code sold to the app user. `rechargingType`: `0` renew, `1` activate.

**Request**

```http
POST /silversat/recharge HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{
  "deviceNumber": "123456789",
  "code": "ABC123XYZ",
  "rechargingType": 1
}
```

**Response**

```json
{
  "data": {
    "StatusCode": 200,
    "Info": "Success",
    "Data": {}
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/recharge"
}
```

---

### `POST /silversat/send-signal`

**Auth:** Public

Re-authorize / send signal to a device on a region.

**Request**

```http
POST /silversat/send-signal HTTP/1.1
Host: localhost:3641
Content-Type: application/json

{
  "regionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "deviceNumber": "123456789"
}
```

**Response**

```json
{
  "data": { "StatusCode": 200, "Info": "OK", "Data": null },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/silversat/send-signal"
}
```

---

## 10. Products — `/products`

### `POST /products`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a product linked to a SilverSat region (multipart).

**Request**

```http
POST /products HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

fiber-50mb
------Boundary
Content-Disposition: form-data; name="displayName"

Fiber 50 Mbps
------Boundary
Content-Disposition: form-data; name="silversatRegionId"

aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
------Boundary
Content-Disposition: form-data; name="activationApi"

silvers
------Boundary
Content-Disposition: form-data; name="image"; filename="p.jpg"
Content-Type: image/jpeg

<binary>
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "p1111111-1111-1111-1111-111111111111",
    "name": "fiber-50mb",
    "displayName": "Fiber 50 Mbps",
    "imageUrl": "/uploads/products/product-123.jpg",
    "activationApi": "silvers",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products"
}
```

---

### `POST /products/with-categories`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create product and nested categories in one multipart request. `categories` is a JSON string array.

**Request**

```http
POST /products/with-categories HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

fiber-50mb
------Boundary
Content-Disposition: form-data; name="displayName"

Fiber 50 Mbps
------Boundary
Content-Disposition: form-data; name="silversatRegionId"

aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
------Boundary
Content-Disposition: form-data; name="categories"

[{"name":"شهري","nameKu":"مانگانە","costPrice":4000,"unitPrice":7000,"sortOrder":0}]
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "p1111111-1111-1111-1111-111111111111",
    "name": "fiber-50mb",
    "displayName": "Fiber 50 Mbps",
    "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    "categories": [
      {
        "id": "c1111111-1111-1111-1111-111111111111",
        "name": "شهري",
        "unitPrice": "7000"
      }
    ]
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products/with-categories"
}
```

---

### `GET /products`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

List products (paginated).

**Request**

```http
GET /products?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "p1111111-1111-1111-1111-111111111111", "name": "fiber-50mb", "displayName": "Fiber 50 Mbps" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products?limit=20&offset=0"
}
```

---

### `GET /products/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get product with categories.

**Request**

```http
GET /products/p1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "p1111111-1111-1111-1111-111111111111",
    "name": "fiber-50mb",
    "displayName": "Fiber 50 Mbps",
    "categories": []
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products/p1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /products/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update product (multipart). New image replaces old file.

**Request**

```http
PATCH /products/p1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="displayName"

Fiber 50 Mbps Plus
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "p1111111-1111-1111-1111-111111111111",
    "displayName": "Fiber 50 Mbps Plus"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products/p1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /products/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Soft-delete product and remove its image file.

**Request**

```http
DELETE /products/p1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Product deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/products/p1111111-1111-1111-1111-111111111111"
}
```

---

## 11. Categories — `/categories`

### `POST /categories`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a priced category under a product (multipart).

**Request**

```http
POST /categories HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="productId"

p1111111-1111-1111-1111-111111111111
------Boundary
Content-Disposition: form-data; name="name"

شهري
------Boundary
Content-Disposition: form-data; name="nameKu"

مانگانە
------Boundary
Content-Disposition: form-data; name="costPrice"

4000
------Boundary
Content-Disposition: form-data; name="unitPrice"

7000
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "c1111111-1111-1111-1111-111111111111",
    "productId": "p1111111-1111-1111-1111-111111111111",
    "name": "شهري",
    "nameKu": "مانگانە",
    "costPrice": "4000",
    "unitPrice": "7000",
    "isDisplay": true,
    "isDisabled": false
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/categories"
}
```

---

### `GET /categories`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

List categories (optional `productId`).

**Request**

```http
GET /categories?productId=p1111111-1111-1111-1111-111111111111&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "c1111111-1111-1111-1111-111111111111", "name": "شهري", "unitPrice": "7000" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/categories?productId=p1111111-1111-1111-1111-111111111111&limit=20&offset=0"
}
```

---

### `GET /categories/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get category (includes stock stats when available).

**Request**

```http
GET /categories/c1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "c1111111-1111-1111-1111-111111111111",
    "name": "شهري",
    "unitPrice": "7000"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/categories/c1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /categories/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update category (multipart).

**Request**

```http
PATCH /categories/c1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="unitPrice"

7500
------Boundary--
```

**Response**

```json
{
  "data": { "id": "c1111111-1111-1111-1111-111111111111", "unitPrice": "7500" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/categories/c1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /categories/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete category.

**Request**

```http
DELETE /categories/c1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Category deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/categories/c1111111-1111-1111-1111-111111111111"
}
```

---

## 12. Batches — `/batches`

### `POST /batches/with-codes`

**Auth:** Admin JWT — SUPER_ADMIN

Create a batch and bulk-insert codes (uploader = JWT user).

**Request**

```http
POST /batches/with-codes HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "categoryId": "c1111111-1111-1111-1111-111111111111",
  "fileName": "september-batch.csv",
  "notes": "Sept stock",
  "codes": [
    { "primaryValue": "CODE-001" },
    { "primaryValue": "CODE-002" }
  ]
}
```

**Response**

```json
{
  "data": {
    "id": "b1111111-1111-1111-1111-111111111111",
    "categoryId": "c1111111-1111-1111-1111-111111111111",
    "fileName": "september-batch.csv",
    "status": "active",
    "codes": [
      { "id": "code-1", "primaryValue": "CODE-001", "status": "available" },
      { "id": "code-2", "primaryValue": "CODE-002", "status": "available" }
    ]
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/with-codes"
}
```

---

### `POST /batches`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create an empty batch shell.

**Request**

```http
POST /batches HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "categoryId": "c1111111-1111-1111-1111-111111111111",
  "fileName": "empty-batch.csv",
  "status": "active"
}
```

**Response**

```json
{
  "data": {
    "id": "b2222222-2222-2222-2222-222222222222",
    "categoryId": "c1111111-1111-1111-1111-111111111111",
    "fileName": "empty-batch.csv",
    "status": "active"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches"
}
```

---

### `GET /batches`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

List/filter batches (`categoryId`, `status`, `fileName`).

**Request**

```http
GET /batches?categoryId=c1111111-1111-1111-1111-111111111111&status=active&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "b1111111-1111-1111-1111-111111111111", "fileName": "september-batch.csv", "status": "active" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches?categoryId=c1111111-1111-1111-1111-111111111111&status=active&limit=20&offset=0"
}
```

---

### `GET /batches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get batch by id.

**Request**

```http
GET /batches/b1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "b1111111-1111-1111-1111-111111111111", "fileName": "september-batch.csv", "status": "active" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/b1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /batches/:id/disable`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Disable batch and non-sold codes.

**Request**

```http
PATCH /batches/b1111111-1111-1111-1111-111111111111/disable HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "batch": { "id": "b1111111-1111-1111-1111-111111111111", "status": "disabled" },
    "disabledCodesCount": 2
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/b1111111-1111-1111-1111-111111111111/disable"
}
```

---

### `DELETE /batches/:id/unsold-codes`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Soft-delete unsold codes in a batch.

**Request**

```http
DELETE /batches/b1111111-1111-1111-1111-111111111111/unsold-codes HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "batchId": "b1111111-1111-1111-1111-111111111111",
    "deletedCodesCount": 2,
    "message": "Unsold codes deleted"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/b1111111-1111-1111-1111-111111111111/unsold-codes"
}
```

---

### `PATCH /batches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update batch metadata.

**Request**

```http
PATCH /batches/b1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "notes": "Updated notes" }
```

**Response**

```json
{
  "data": { "id": "b1111111-1111-1111-1111-111111111111", "notes": "Updated notes" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/b1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /batches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete batch.

**Request**

```http
DELETE /batches/b1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Batch deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/batches/b1111111-1111-1111-1111-111111111111"
}
```

---

## 13. Codes — `/codes`

### `POST /codes`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a single recharge code (value encrypted at rest).

**Request**

```http
POST /codes HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "batchId": "b1111111-1111-1111-1111-111111111111",
  "categoryId": "c1111111-1111-1111-1111-111111111111",
  "primaryValue": "CODE-003",
  "status": "available"
}
```

**Response**

```json
{
  "data": {
    "id": "code-3",
    "batchId": "b1111111-1111-1111-1111-111111111111",
    "categoryId": "c1111111-1111-1111-1111-111111111111",
    "primaryValue": "CODE-003",
    "status": "available"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes"
}
```

---

### `GET /codes/lookup`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Lookup codes by id or primary value (`q`).

**Request**

```http
GET /codes/lookup?q=CODE-003 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "code-3", "primaryValue": "CODE-003", "status": "available" }],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes/lookup?q=CODE-003"
}
```

---

### `GET /codes`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

List/filter codes.

**Request**

```http
GET /codes?batchId=b1111111-1111-1111-1111-111111111111&status=available&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "code-3", "primaryValue": "CODE-003", "status": "available" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes?batchId=b1111111-1111-1111-1111-111111111111&status=available&limit=20&offset=0"
}
```

---

### `GET /codes/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get one code.

**Request**

```http
GET /codes/code-3 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "code-3", "primaryValue": "CODE-003", "status": "available" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes/code-3"
}
```

---

### `PATCH /codes/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update code status/value.

**Request**

```http
PATCH /codes/code-3 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "status": "disabled" }
```

**Response**

```json
{
  "data": { "id": "code-3", "status": "disabled" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes/code-3"
}
```

---

### `DELETE /codes/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete a code (not allowed if sold).

**Request**

```http
DELETE /codes/code-3 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Code deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/codes/code-3"
}
```

---

## 14. Catalog & Orders

### `GET /catalog`

**Auth:** App JWT

Buyable products/categories for the user's SilverSat region (with available code counts).

**Request**

```http
GET /catalog HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "p1111111-1111-1111-1111-111111111111",
      "name": "fiber-50mb",
      "displayName": "Fiber 50 Mbps",
      "imageUrl": "/uploads/products/product-123.jpg",
      "silversatRegionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "provinceId": "33333333-3333-3333-3333-333333333333",
      "categories": [
        {
          "id": "c1111111-1111-1111-1111-111111111111",
          "name": "شهري",
          "nameKu": "مانگانە",
          "unitPrice": "7000",
          "hasSecondaryCode": false,
          "imageUrl": null,
          "sortOrder": 0,
          "availableCount": 12
        }
      ]
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/catalog"
}
```

---

### `POST /orders/checkout`

**Auth:** App JWT

Create a pending order and Wayl payment link for one category.

**Request**

```http
POST /orders/checkout HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{
  "categoryId": "c1111111-1111-1111-1111-111111111111"
}
```

**Response**

```json
{
  "data": {
    "id": "o1111111-1111-1111-1111-111111111111",
    "referenceId": "ss_abc123",
    "status": "pending",
    "amount": "7000",
    "currency": "IQD",
    "categoryId": "c1111111-1111-1111-1111-111111111111",
    "categoryName": "شهري",
    "productName": "Fiber 50 Mbps",
    "paymentUrl": "https://pay.wayl.io/l/xxxxxx",
    "waylStatus": null,
    "paidAt": null,
    "fulfilledAt": null,
    "createdAt": "2026-09-24T07:00:00.000Z",
    "code": null
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/orders/checkout"
}
```

---

### `GET /orders/mine`

**Auth:** App JWT

List my orders (paginated).

**Request**

```http
GET /orders/mine?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "o1111111-1111-1111-1111-111111111111",
      "referenceId": "ss_abc123",
      "status": "fulfilled",
      "amount": "7000",
      "currency": "IQD",
      "code": { "id": "code-1", "primaryValue": "CODE-001" }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/orders/mine?limit=20&offset=0"
}
```

---

### `GET /orders/by-reference/:referenceId`

**Auth:** App JWT

Get my order by Wayl reference id.

**Request**

```http
GET /orders/by-reference/ss_abc123 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": {
    "id": "o1111111-1111-1111-1111-111111111111",
    "referenceId": "ss_abc123",
    "status": "fulfilled",
    "code": { "id": "code-1", "primaryValue": "CODE-001" }
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/orders/by-reference/ss_abc123"
}
```

---

### `POST /orders/:id/sync`

**Auth:** App JWT

Poll Wayl payment status and fulfill if paid (allocate a code).

**Request**

```http
POST /orders/o1111111-1111-1111-1111-111111111111/sync HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": {
    "id": "o1111111-1111-1111-1111-111111111111",
    "status": "fulfilled",
    "paidAt": "2026-09-24T07:05:00.000Z",
    "fulfilledAt": "2026-09-24T07:05:01.000Z",
    "code": { "id": "code-1", "primaryValue": "CODE-001" }
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/orders/o1111111-1111-1111-1111-111111111111/sync"
}
```

---

### `GET /orders/:id`

**Auth:** App JWT

Get my order by id (includes code when fulfilled).

**Request**

```http
GET /orders/o1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": {
    "id": "o1111111-1111-1111-1111-111111111111",
    "status": "fulfilled",
    "amount": "7000",
    "code": { "id": "code-1", "primaryValue": "CODE-001" }
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/orders/o1111111-1111-1111-1111-111111111111"
}
```

---

## 15. Wayl Payments — `/wayl`

### `POST /wayl/webhook`

**Auth:** Public (HMAC `x-wayl-signature-256`)

Wayl payment webhook. Raw body is required for signature verify. On success, order is fulfilled and coupons may be issued.

**Request**

```http
POST /wayl/webhook HTTP/1.1
Host: localhost:3641
Content-Type: application/json
x-wayl-signature-256: <hmac_sha256_hex>

{"referenceId":"ss_abc123","status":"paid"}
```

**Response**

```json
{
  "data": { "received": true, "fulfilled": true },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/wayl/webhook"
}
```

---

### `GET /wayl/success`

**Auth:** Public

HTML landing page after payment (raw HTML, not TransformInterceptor JSON).

**Request**

```http
GET /wayl/success?referenceId=ss_abc123 HTTP/1.1
Host: localhost:3641
```

**Response**

```html
<!DOCTYPE html>
<html>...redirect / success page...</html>
```

---

## 16. Devices — `/devices`

### `GET /devices/all`

**Auth:** Admin JWT — SUPER_ADMIN

Admin list/filter all devices (`appUserId`, `provinceId`, `name`, `deviceNumber`, `search`).

**Request**

```http
GET /devices/all?provinceId=33333333-3333-3333-3333-333333333333&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "d1111111-1111-1111-1111-111111111111",
      "name": "Living room",
      "deviceNumber": "123456789",
      "appUserId": "22222222-2222-2222-2222-222222222222",
      "appUser": { "name": "Ahmed Ali", "phone": "07701234567" }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices/all?provinceId=33333333-3333-3333-3333-333333333333&limit=20&offset=0"
}
```

---

### `POST /devices`

**Auth:** App JWT

Register a device for the current user. Validates via SilverSat subscription for the user's region. Rejects if subscription is null or empty `[]`. Soft-deleted same number is restored.

**Request**

```http
POST /devices HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{
  "name": "Living room",
  "deviceNumber": "123456789"
}
```

**Response**

```json
{
  "data": {
    "id": "d1111111-1111-1111-1111-111111111111",
    "appUserId": "22222222-2222-2222-2222-222222222222",
    "name": "Living room",
    "deviceNumber": "123456789"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices"
}
```

> 400 if device unknown / empty subscription; 409 if active duplicate.

---

### `GET /devices`

**Auth:** App JWT

List my devices.

**Request**

```http
GET /devices?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [{ "id": "d1111111-1111-1111-1111-111111111111", "name": "Living room", "deviceNumber": "123456789" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices?limit=20&offset=0"
}
```

---

### `GET /devices/:id`

**Auth:** App JWT

Get one of my devices.

**Request**

```http
GET /devices/d1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "id": "d1111111-1111-1111-1111-111111111111", "name": "Living room", "deviceNumber": "123456789" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices/d1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /devices/:id`

**Auth:** App JWT

Update my device. Changing `deviceNumber` re-validates on SilverSat.

**Request**

```http
PATCH /devices/d1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{ "name": "Bedroom" }
```

**Response**

```json
{
  "data": { "id": "d1111111-1111-1111-1111-111111111111", "name": "Bedroom", "deviceNumber": "123456789" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices/d1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /devices/:id`

**Auth:** App JWT

Soft-delete my device (required before changing SilverSat region).

**Request**

```http
DELETE /devices/d1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "message": "Device deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/devices/d1111111-1111-1111-1111-111111111111"
}
```

---

## 17. Towers — `/towers`

### `GET /towers/my-province`

**Auth:** App JWT

Towers in the province derived from the user's SilverSat region. Empty if no province.

**Request**

```http
GET /towers/my-province?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "t1111111-1111-1111-1111-111111111111",
      "name": "Tower A",
      "nameKu": "تاوەر A",
      "latitude": "36.1911",
      "longitude": "44.0094",
      "provinceId": "33333333-3333-3333-3333-333333333333"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers/my-province?limit=20&offset=0"
}
```

---

### `POST /towers`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a tower.

**Request**

```http
POST /towers HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Tower A",
  "nameKu": "تاوەر A",
  "latitude": 36.1911,
  "longitude": 44.0094,
  "provinceId": "33333333-3333-3333-3333-333333333333"
}
```

**Response**

```json
{
  "data": {
    "id": "t1111111-1111-1111-1111-111111111111",
    "name": "Tower A",
    "nameKu": "تاوەر A",
    "latitude": "36.1911",
    "longitude": "44.0094",
    "provinceId": "33333333-3333-3333-3333-333333333333"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers"
}
```

---

### `GET /towers`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list towers (optional `provinceId`).

**Request**

```http
GET /towers?provinceId=33333333-3333-3333-3333-333333333333&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "t1111111-1111-1111-1111-111111111111", "name": "Tower A" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers?provinceId=33333333-3333-3333-3333-333333333333&limit=20&offset=0"
}
```

---

### `GET /towers/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get tower by id.

**Request**

```http
GET /towers/t1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "t1111111-1111-1111-1111-111111111111", "name": "Tower A" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers/t1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /towers/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update tower.

**Request**

```http
PATCH /towers/t1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "name": "Tower A Updated" }
```

**Response**

```json
{
  "data": { "id": "t1111111-1111-1111-1111-111111111111", "name": "Tower A Updated" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers/t1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /towers/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete tower.

**Request**

```http
DELETE /towers/t1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Tower deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/towers/t1111111-1111-1111-1111-111111111111"
}
```

---

## 18. Ads — `/ads`

### `GET /ads/active`

**Auth:** App JWT

Active ads/offers for the user (global + province). Optional `type=offers|ads`.

**Request**

```http
GET /ads/active?type=ads&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "ad111111-1111-1111-1111-111111111111",
      "title": "Summer offer",
      "type": "ads",
      "actionType": "url",
      "actionValue": "https://example.com",
      "imageUrl": "/uploads/ads/ad-123.jpg",
      "isActive": true
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads/active?type=ads&limit=20&offset=0"
}
```

---

### `POST /ads`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create ad/offer (multipart).

**Request**

```http
POST /ads HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="title"

Summer offer
------Boundary
Content-Disposition: form-data; name="type"

ads
------Boundary
Content-Disposition: form-data; name="actionType"

url
------Boundary
Content-Disposition: form-data; name="actionValue"

https://example.com
------Boundary
Content-Disposition: form-data; name="image"; filename="ad.jpg"
Content-Type: image/jpeg

<binary>
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "ad111111-1111-1111-1111-111111111111",
    "title": "Summer offer",
    "type": "ads",
    "actionType": "url",
    "actionValue": "https://example.com",
    "imageUrl": "/uploads/ads/ad-123.jpg",
    "isActive": true
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads"
}
```

---

### `GET /ads`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list ads.

**Request**

```http
GET /ads?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "ad111111-1111-1111-1111-111111111111", "title": "Summer offer" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads?limit=20&offset=0"
}
```

---

### `GET /ads/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get ad by id.

**Request**

```http
GET /ads/ad111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "ad111111-1111-1111-1111-111111111111", "title": "Summer offer" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads/ad111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /ads/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update ad (multipart). New image deletes old file.

**Request**

```http
PATCH /ads/ad111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="title"

Winter offer
------Boundary--
```

**Response**

```json
{
  "data": { "id": "ad111111-1111-1111-1111-111111111111", "title": "Winter offer" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads/ad111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /ads/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete ad and its image file.

**Request**

```http
DELETE /ads/ad111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Ad deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/ads/ad111111-1111-1111-1111-111111111111"
}
```

---

## 19. Leagues — `/leagues`

### `GET /leagues/active`

**Auth:** App JWT

Active leagues for the app (optional `countryId`).

**Request**

```http
GET /leagues/active?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "l1111111-1111-1111-1111-111111111111",
      "name": "Premier League",
      "nameAr": "الدوري الإنجليزي",
      "isActive": true,
      "countryId": "66666666-6666-6666-6666-666666666666"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues/active?limit=20&offset=0"
}
```

---

### `POST /leagues`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create league.

**Request**

```http
POST /leagues HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "name": "Premier League",
  "nameAr": "الدوري الإنجليزي",
  "countryId": "66666666-6666-6666-6666-666666666666",
  "order": 1,
  "isActive": true
}
```

**Response**

```json
{
  "data": {
    "id": "l1111111-1111-1111-1111-111111111111",
    "name": "Premier League",
    "isActive": true
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues"
}
```

---

### `GET /leagues`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list leagues.

**Request**

```http
GET /leagues?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "l1111111-1111-1111-1111-111111111111", "name": "Premier League" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues?limit=20&offset=0"
}
```

---

### `GET /leagues/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get league.

**Request**

```http
GET /leagues/l1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "l1111111-1111-1111-1111-111111111111", "name": "Premier League" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues/l1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /leagues/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update league.

**Request**

```http
PATCH /leagues/l1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "isActive": false }
```

**Response**

```json
{
  "data": { "id": "l1111111-1111-1111-1111-111111111111", "isActive": false },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues/l1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /leagues/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete league.

**Request**

```http
DELETE /leagues/l1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "League deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/leagues/l1111111-1111-1111-1111-111111111111"
}
```

---

## 20. Teams — `/teams`

### `GET /teams/by-league`

**Auth:** App JWT

Teams for a league (`leagueId` required).

**Request**

```http
GET /teams/by-league?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "tm111111-1111-1111-1111-111111111111",
      "name": "Arsenal",
      "nameAr": "آرسنال",
      "leagueId": "l1111111-1111-1111-1111-111111111111",
      "logoUrl": "/uploads/teams/team-123.png"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams/by-league?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0"
}
```

---

### `POST /teams`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create team (multipart, optional logo).

**Request**

```http
POST /teams HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="name"

Arsenal
------Boundary
Content-Disposition: form-data; name="leagueId"

l1111111-1111-1111-1111-111111111111
------Boundary
Content-Disposition: form-data; name="logo"; filename="logo.png"
Content-Type: image/png

<binary>
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "tm111111-1111-1111-1111-111111111111",
    "name": "Arsenal",
    "leagueId": "l1111111-1111-1111-1111-111111111111",
    "logoUrl": "/uploads/teams/team-123.png"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams"
}
```

---

### `GET /teams`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list teams (optional `leagueId`).

**Request**

```http
GET /teams?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "tm111111-1111-1111-1111-111111111111", "name": "Arsenal" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0"
}
```

---

### `GET /teams/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get team.

**Request**

```http
GET /teams/tm111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "tm111111-1111-1111-1111-111111111111", "name": "Arsenal" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams/tm111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /teams/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update team (multipart).

**Request**

```http
PATCH /teams/tm111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="nameAr"

آرسنال
------Boundary--
```

**Response**

```json
{
  "data": { "id": "tm111111-1111-1111-1111-111111111111", "name": "Arsenal", "nameAr": "آرسنال" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams/tm111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /teams/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete team and logo file.

**Request**

```http
DELETE /teams/tm111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Team deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/teams/tm111111-1111-1111-1111-111111111111"
}
```

---

## 21. Matches — `/matches`

### `GET /matches/open-for-prediction`

**Auth:** App JWT

Scheduled matches still open for predictions.

**Request**

```http
GET /matches/open-for-prediction?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "m1111111-1111-1111-1111-111111111111",
      "leagueId": "l1111111-1111-1111-1111-111111111111",
      "homeTeamId": "tm111111-1111-1111-1111-111111111111",
      "awayTeamId": "tm222222-2222-2222-2222-222222222222",
      "matchAt": "2026-09-25T18:00:00.000Z",
      "status": "scheduled",
      "isOpenForPrediction": true
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/open-for-prediction?limit=20&offset=0"
}
```

---

### `GET /matches/live`

**Auth:** App JWT

Currently live matches.

**Request**

```http
GET /matches/live?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "m1111111-1111-1111-1111-111111111111",
      "status": "live",
      "homeScore": 1,
      "awayScore": 0,
      "currentMinute": 67
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/live?limit=20&offset=0"
}
```

---

### `GET /matches/scheduled`

**Auth:** App JWT

Scheduled matches (including closed for prediction).

**Request**

```http
GET /matches/scheduled?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [{ "id": "m1111111-1111-1111-1111-111111111111", "status": "scheduled" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/scheduled?leagueId=l1111111-1111-1111-1111-111111111111&limit=20&offset=0"
}
```

---

### `POST /matches`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create a match.

**Request**

```http
POST /matches HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "leagueId": "l1111111-1111-1111-1111-111111111111",
  "homeTeamId": "tm111111-1111-1111-1111-111111111111",
  "awayTeamId": "tm222222-2222-2222-2222-222222222222",
  "matchAt": "2026-09-25T18:00:00.000Z",
  "status": "scheduled",
  "isOpenForPrediction": true
}
```

**Response**

```json
{
  "data": {
    "id": "m1111111-1111-1111-1111-111111111111",
    "status": "scheduled",
    "isOpenForPrediction": true
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches"
}
```

---

### `GET /matches`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list matches (`leagueId`, `status`).

**Request**

```http
GET /matches?status=scheduled&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "m1111111-1111-1111-1111-111111111111", "status": "scheduled" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches?status=scheduled&limit=20&offset=0"
}
```

---

### `GET /matches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get match.

**Request**

```http
GET /matches/m1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "m1111111-1111-1111-1111-111111111111", "status": "scheduled" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/m1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /matches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update match (scores/status). Finishing can trigger prediction scoring.

**Request**

```http
PATCH /matches/m1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "status": "finished",
  "homeScore": 2,
  "awayScore": 1
}
```

**Response**

```json
{
  "data": {
    "id": "m1111111-1111-1111-1111-111111111111",
    "status": "finished",
    "homeScore": 2,
    "awayScore": 1
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/m1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /matches/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete match.

**Request**

```http
DELETE /matches/m1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Match deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/matches/m1111111-1111-1111-1111-111111111111"
}
```

---

## 22. Predictions — `/predictions`

### `POST /predictions`

**Auth:** App JWT

Submit a score prediction for an open match.

**Request**

```http
POST /predictions HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{
  "matchId": "m1111111-1111-1111-1111-111111111111",
  "predictedHomeScore": 2,
  "predictedAwayScore": 1
}
```

**Response**

```json
{
  "data": {
    "id": "pr111111-1111-1111-1111-111111111111",
    "matchId": "m1111111-1111-1111-1111-111111111111",
    "appUserId": "22222222-2222-2222-2222-222222222222",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1,
    "pointsEarned": null
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions"
}
```

---

### `GET /predictions/my`

**Auth:** App JWT

My predictions (optional `matchId`).

**Request**

```http
GET /predictions/my?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "pr111111-1111-1111-1111-111111111111",
      "predictedHomeScore": 2,
      "predictedAwayScore": 1,
      "pointsEarned": 10,
      "match": { "id": "m1111111-1111-1111-1111-111111111111", "status": "finished" }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/my?limit=20&offset=0"
}
```

---

### `GET /predictions/my/:id`

**Auth:** App JWT

Get one of my predictions.

**Request**

```http
GET /predictions/my/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": {
    "id": "pr111111-1111-1111-1111-111111111111",
    "predictedHomeScore": 2,
    "predictedAwayScore": 1
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/my/pr111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /predictions/my/:id`

**Auth:** App JWT

Update my prediction while match is still open.

**Request**

```http
PATCH /predictions/my/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{ "predictedHomeScore": 3, "predictedAwayScore": 1 }
```

**Response**

```json
{
  "data": {
    "id": "pr111111-1111-1111-1111-111111111111",
    "predictedHomeScore": 3,
    "predictedAwayScore": 1
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/my/pr111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /predictions/my/:id`

**Auth:** App JWT

Delete my prediction while match is still open.

**Request**

```http
DELETE /predictions/my/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "message": "Prediction deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/my/pr111111-1111-1111-1111-111111111111"
}
```

---

### `POST /predictions/score/match/:matchId`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Score all predictions for a finished match and award points.

**Request**

```http
POST /predictions/score/match/m1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "matchId": "m1111111-1111-1111-1111-111111111111",
    "scored": 40,
    "skipped": 2,
    "totalPointsAwarded": 180
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/score/match/m1111111-1111-1111-1111-111111111111"
}
```

---

### `POST /predictions/score/pending`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Score all finished matches that still have unscored predictions.

**Request**

```http
POST /predictions/score/pending HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "matchesProcessed": 3,
    "results": [
      {
        "matchId": "m1111111-1111-1111-1111-111111111111",
        "scored": 40,
        "skipped": 0,
        "totalPointsAwarded": 180
      }
    ]
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/score/pending"
}
```

---

### `GET /predictions`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list predictions (`matchId`, `appUserId`).

**Request**

```http
GET /predictions?matchId=m1111111-1111-1111-1111-111111111111&limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "pr111111-1111-1111-1111-111111111111", "pointsEarned": 10 }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions?matchId=m1111111-1111-1111-1111-111111111111&limit=20&offset=0"
}
```

---

### `GET /predictions/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin get prediction.

**Request**

```http
GET /predictions/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "pr111111-1111-1111-1111-111111111111", "predictedHomeScore": 2 },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/pr111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /predictions/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin update prediction / points.

**Request**

```http
PATCH /predictions/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "pointsEarned": 15 }
```

**Response**

```json
{
  "data": { "id": "pr111111-1111-1111-1111-111111111111", "pointsEarned": 15 },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/pr111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /predictions/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin delete prediction.

**Request**

```http
DELETE /predictions/pr111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Prediction deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/predictions/pr111111-1111-1111-1111-111111111111"
}
```

---

## 23. API-Football Sync — `/api-football`

### `GET /api-football/config`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Sync configuration (no secrets).

**Request**

```http
GET /api-football/config HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "enabled": true,
    "baseUrl": "https://v3.football.api-sports.io",
    "hasApiKey": true,
    "season": 2026,
    "leagueIds": [39, 140],
    "fixtureDaysBack": 1,
    "fixtureDaysAhead": 7,
    "quotaReserve": 100,
    "syncAllIfQuotaAllows": true,
    "maxRequestsPerMinute": 30
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/config"
}
```

---

### `GET /api-football/status`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Account quota status and whether sync uses all leagues or configured ids.

**Request**

```http
GET /api-football/status HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "account": { "requests": { "current": 120, "limit_day": 7500 } },
    "scope": { "mode": "configured_ids", "leagueIds": [39, 140] }
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/status"
}
```

---

### `POST /api-football/sync/leagues`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Manually sync leagues.

**Request**

```http
POST /api-football/sync/leagues HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "createdOrUpdated": 12, "skipped": 0, "scope": "configured_ids" },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/sync/leagues"
}
```

---

### `POST /api-football/sync/teams`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Manually sync teams for leagues with externalId.

**Request**

```http
POST /api-football/sync/teams HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "createdOrUpdated": 40, "skipped": 2 },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/sync/teams"
}
```

---

### `POST /api-football/sync/fixtures`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Manually sync fixtures in the configured date window.

**Request**

```http
POST /api-football/sync/fixtures HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "createdOrUpdated": 28, "skipped": 5 },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/sync/fixtures"
}
```

---

### `POST /api-football/sync/live`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Manually sync currently live fixtures (may score finished matches).

**Request**

```http
POST /api-football/sync/live HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "createdOrUpdated": 3, "skipped": 0 },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/api-football/sync/live"
}
```

---

## 24. Notifications — `/notifications`

### `POST /notifications/me/fcm-token`

**Auth:** App JWT

Register FCM device token and subscribe to topics.

**Request**

```http
POST /notifications/me/fcm-token HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
Content-Type: application/json

{ "fcmToken": "fcm_device_token_here" }
```

**Response**

```json
{
  "data": { "message": "FCM token registered successfully" },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me/fcm-token"
}
```

---

### `DELETE /notifications/me/fcm-token`

**Auth:** App JWT

Clear FCM token and unsubscribe topics.

**Request**

```http
DELETE /notifications/me/fcm-token HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "message": "FCM token cleared successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me/fcm-token"
}
```

---

### `GET /notifications/me`

**Auth:** App JWT

Inbox for current user (user + all + province targets).

**Request**

```http
GET /notifications/me?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "n1111111-1111-1111-1111-111111111111",
      "titleAr": "عنوان",
      "titleKu": "ناونیشان",
      "bodyAr": "نص",
      "bodyKu": "دەق",
      "isRead": false,
      "match": null
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me?limit=20&offset=0"
}
```

---

### `GET /notifications/me/unread-count`

**Auth:** App JWT

Unread inbox count.

**Request**

```http
GET /notifications/me/unread-count HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "count": 3 },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me/unread-count"
}
```

---

### `PATCH /notifications/me/read-all`

**Auth:** App JWT

Mark recent inbox notifications as read.

**Request**

```http
PATCH /notifications/me/read-all HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "message": "Notifications marked as read", "marked": 3 },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me/read-all"
}
```

---

### `PATCH /notifications/me/:id/read`

**Auth:** App JWT

Mark one notification as read.

**Request**

```http
PATCH /notifications/me/n1111111-1111-1111-1111-111111111111/read HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": { "message": "Notification marked as read" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/me/n1111111-1111-1111-1111-111111111111/read"
}
```

---

### `POST /notifications/send`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Send bilingual push. `targetType`: `user` | `all` | `province`.

**Request**

```http
POST /notifications/send HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "titleAr": "عرض جديد",
  "titleKu": "ئۆفەری نوێ",
  "bodyAr": "تحقق من العروض",
  "bodyKu": "سەیری ئۆفەرەکان بکە",
  "targetType": "all",
  "data": { "type": "promo" }
}
```

**Response**

```json
{
  "data": {
    "id": "n2222222-2222-2222-2222-222222222222",
    "titleAr": "عرض جديد",
    "targetType": "all",
    "source": "admin"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/send"
}
```

---

### `GET /notifications`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list sent notifications.

**Request**

```http
GET /notifications?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "n2222222-2222-2222-2222-222222222222", "titleAr": "عرض جديد" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications?limit=20&offset=0"
}
```

---

### `GET /notifications/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin get notification.

**Request**

```http
GET /notifications/n2222222-2222-2222-2222-222222222222 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "n2222222-2222-2222-2222-222222222222", "titleAr": "عرض جديد" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/notifications/n2222222-2222-2222-2222-222222222222"
}
```

---

## 25. Prize Draws — `/prize-draws`

### `GET /prize-draws/upcoming`

**Auth:** App JWT

Upcoming active draws with `myCouponCount` for the current user.

**Request**

```http
GET /prize-draws/upcoming HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "pd111111-1111-1111-1111-111111111111",
      "titleAr": "السحب السنوي 2026",
      "titleKu": "فڕۆکەکردنی ساڵانەی ٢٠٢٦",
      "bodyAr": "...",
      "bodyKu": "...",
      "imageUrl": "/uploads/prize-draws/prize-draw-123.jpg",
      "drawAt": "2026-12-31T21:00:00.000Z",
      "isActive": true,
      "myCouponCount": 2
    }
  ],
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/upcoming"
}
```

---

### `GET /prize-draws/my-prizes`

**Auth:** App JWT

Prize draws this user won.

**Request**

```http
GET /prize-draws/my-prizes?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "pd111111-1111-1111-1111-111111111111",
      "titleAr": "السحب السنوي 2026",
      "winnerAppUserId": "22222222-2222-2222-2222-222222222222",
      "winnerCoupon": { "id": "cp111111-1111-1111-1111-111111111111", "code": "RW-ABC123" }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/my-prizes?limit=20&offset=0"
}
```

---

### `POST /prize-draws`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create prize draw (multipart, optional image).

**Request**

```http
POST /prize-draws HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="titleAr"

السحب السنوي 2026
------Boundary
Content-Disposition: form-data; name="titleKu"

فڕۆکەکردنی ساڵانەی ٢٠٢٦
------Boundary
Content-Disposition: form-data; name="bodyAr"

كل تجديد يمنحك كوبون
------Boundary
Content-Disposition: form-data; name="bodyKu"

هەر نوێکردنەوەیەک کوبونێکت دەداتێ
------Boundary
Content-Disposition: form-data; name="drawAt"

2026-12-31T21:00:00.000Z
------Boundary
Content-Disposition: form-data; name="isActive"

true
------Boundary
Content-Disposition: form-data; name="image"; filename="draw.jpg"
Content-Type: image/jpeg

<binary>
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "pd111111-1111-1111-1111-111111111111",
    "titleAr": "السحب السنوي 2026",
    "imageUrl": "/uploads/prize-draws/prize-draw-123.jpg",
    "drawAt": "2026-12-31T21:00:00.000Z",
    "isActive": true
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws"
}
```

---

### `GET /prize-draws`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list prize draws.

**Request**

```http
GET /prize-draws?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "pd111111-1111-1111-1111-111111111111", "titleAr": "السحب السنوي 2026" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws?limit=20&offset=0"
}
```

---

### `POST /prize-draws/:id/draw-winner`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Randomly select a winner coupon once for this draw.

**Request**

```http
POST /prize-draws/pd111111-1111-1111-1111-111111111111/draw-winner HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "pd111111-1111-1111-1111-111111111111",
    "winnerCouponId": "cp111111-1111-1111-1111-111111111111",
    "winnerAppUserId": "22222222-2222-2222-2222-222222222222",
    "winnerSelectedAt": "2026-09-24T07:00:00.000Z",
    "isActive": false
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/pd111111-1111-1111-1111-111111111111/draw-winner"
}
```

---

### `GET /prize-draws/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get prize draw.

**Request**

```http
GET /prize-draws/pd111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": {
    "id": "pd111111-1111-1111-1111-111111111111",
    "titleAr": "السحب السنوي 2026",
    "imageUrl": "/uploads/prize-draws/prize-draw-123.jpg"
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/pd111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /prize-draws/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update prize draw (multipart). New image deletes old file.

**Request**

```http
PATCH /prize-draws/pd111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: multipart/form-data; boundary=----Boundary

------Boundary
Content-Disposition: form-data; name="isActive"

false
------Boundary--
```

**Response**

```json
{
  "data": {
    "id": "pd111111-1111-1111-1111-111111111111",
    "isActive": false
  },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/pd111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /prize-draws/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Soft-delete prize draw and delete its image file.

**Request**

```http
DELETE /prize-draws/pd111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Prize draw deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/prize-draws/pd111111-1111-1111-1111-111111111111"
}
```

---

## 26. Coupons — `/coupons`

### `GET /coupons/my`

**Auth:** App JWT

List Renew-and-Win coupons for the current user (issued on order fulfill).

**Request**

```http
GET /coupons/my?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "cp111111-1111-1111-1111-111111111111",
      "code": "RW-ABC123",
      "prizeDrawId": "pd111111-1111-1111-1111-111111111111",
      "orderId": "o1111111-1111-1111-1111-111111111111",
      "prizeDraw": {
        "id": "pd111111-1111-1111-1111-111111111111",
        "titleAr": "السحب السنوي 2026",
        "drawAt": "2026-12-31T21:00:00.000Z"
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/coupons/my?limit=20&offset=0"
}
```

---

## 27. FAQs — `/faqs`

### `GET /faqs/active`

**Auth:** App JWT

Active FAQs for the app.

**Request**

```http
GET /faqs/active?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "f1111111-1111-1111-1111-111111111111",
      "question": "How do I recharge?",
      "questionKu": "چۆن ڕیچارج بکەم؟",
      "answer": "Buy a code then activate.",
      "answerKu": "...",
      "order": 0,
      "isActive": true
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs/active?limit=20&offset=0"
}
```

---

### `POST /faqs`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create FAQ.

**Request**

```http
POST /faqs HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "question": "How do I recharge?",
  "questionKu": "چۆن ڕیچارج بکەم؟",
  "answer": "Buy a code then activate.",
  "answerKu": "...",
  "order": 0,
  "isActive": true
}
```

**Response**

```json
{
  "data": {
    "id": "f1111111-1111-1111-1111-111111111111",
    "question": "How do I recharge?",
    "isActive": true
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs"
}
```

---

### `GET /faqs`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list FAQs.

**Request**

```http
GET /faqs?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "f1111111-1111-1111-1111-111111111111", "question": "How do I recharge?" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs?limit=20&offset=0"
}
```

---

### `GET /faqs/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get FAQ.

**Request**

```http
GET /faqs/f1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "f1111111-1111-1111-1111-111111111111", "question": "How do I recharge?" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs/f1111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /faqs/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update FAQ.

**Request**

```http
PATCH /faqs/f1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "isActive": false }
```

**Response**

```json
{
  "data": { "id": "f1111111-1111-1111-1111-111111111111", "isActive": false },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs/f1111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /faqs/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete FAQ.

**Request**

```http
DELETE /faqs/f1111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Faq deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/faqs/f1111111-1111-1111-1111-111111111111"
}
```

---

## 28. Tutorial Videos — `/tutorial-videos`

### `GET /tutorial-videos/active`

**Auth:** App JWT

Active tutorial videos.

**Request**

```http
GET /tutorial-videos/active?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "tv111111-1111-1111-1111-111111111111",
      "title": "How to recharge",
      "titleKu": "چۆن ڕیچارج بکەیت",
      "videoUrl": "https://cdn.example.com/videos/recharge.mp4",
      "durationSeconds": 90,
      "isActive": true
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos/active?limit=20&offset=0"
}
```

---

### `POST /tutorial-videos`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create tutorial video.

**Request**

```http
POST /tutorial-videos HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "title": "How to recharge",
  "titleKu": "چۆن ڕیچارج بکەیت",
  "videoUrl": "https://cdn.example.com/videos/recharge.mp4",
  "durationSeconds": 90,
  "order": 0,
  "isActive": true
}
```

**Response**

```json
{
  "data": {
    "id": "tv111111-1111-1111-1111-111111111111",
    "title": "How to recharge",
    "videoUrl": "https://cdn.example.com/videos/recharge.mp4",
    "durationSeconds": 90
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos"
}
```

---

### `GET /tutorial-videos`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list tutorial videos.

**Request**

```http
GET /tutorial-videos?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "tv111111-1111-1111-1111-111111111111", "title": "How to recharge" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos?limit=20&offset=0"
}
```

---

### `GET /tutorial-videos/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get tutorial video.

**Request**

```http
GET /tutorial-videos/tv111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "tv111111-1111-1111-1111-111111111111", "title": "How to recharge" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos/tv111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /tutorial-videos/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update tutorial video.

**Request**

```http
PATCH /tutorial-videos/tv111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "isActive": false }
```

**Response**

```json
{
  "data": { "id": "tv111111-1111-1111-1111-111111111111", "isActive": false },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos/tv111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /tutorial-videos/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete tutorial video.

**Request**

```http
DELETE /tutorial-videos/tv111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Tutorial video deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/tutorial-videos/tv111111-1111-1111-1111-111111111111"
}
```

---

## 29. Contact Links — `/contact-links`

### `GET /contact-links/active`

**Auth:** App JWT

Active contact channels (`phone`, `whatsapp`, `facebook`, `instagram`, `telegram`).

**Request**

```http
GET /contact-links/active?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <app_access_token>
```

**Response**

```json
{
  "data": [
    {
      "id": "cl111111-1111-1111-1111-111111111111",
      "type": "whatsapp",
      "label": "Support",
      "labelKu": "پشتگیری",
      "value": "9647701234567",
      "isActive": true
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links/active?limit=20&offset=0"
}
```

---

### `POST /contact-links`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Create contact link.

**Request**

```http
POST /contact-links HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "type": "whatsapp",
  "label": "Support",
  "labelKu": "پشتگیری",
  "value": "9647701234567",
  "order": 0,
  "isActive": true
}
```

**Response**

```json
{
  "data": {
    "id": "cl111111-1111-1111-1111-111111111111",
    "type": "whatsapp",
    "label": "Support",
    "value": "9647701234567"
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links"
}
```

---

### `GET /contact-links`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Admin list contact links.

**Request**

```http
GET /contact-links?limit=20&offset=0 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": [{ "id": "cl111111-1111-1111-1111-111111111111", "type": "whatsapp" }],
  "total": 1,
  "limit": 20,
  "offset": 0,
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links?limit=20&offset=0"
}
```

---

### `GET /contact-links/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Get contact link.

**Request**

```http
GET /contact-links/cl111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "id": "cl111111-1111-1111-1111-111111111111", "type": "whatsapp", "value": "9647701234567" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links/cl111111-1111-1111-1111-111111111111"
}
```

---

### `PATCH /contact-links/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Update contact link.

**Request**

```http
PATCH /contact-links/cl111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{ "isActive": false }
```

**Response**

```json
{
  "data": { "id": "cl111111-1111-1111-1111-111111111111", "isActive": false },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links/cl111111-1111-1111-1111-111111111111"
}
```

---

### `DELETE /contact-links/:id`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN

Delete contact link.

**Request**

```http
DELETE /contact-links/cl111111-1111-1111-1111-111111111111 HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
```

**Response**

```json
{
  "data": { "message": "Contact link deleted successfully" },
  "statusCode": 200,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/contact-links/cl111111-1111-1111-1111-111111111111"
}
```

---

## 30. Telegram — `/telegram`

### `POST /telegram/send-message`

**Auth:** Admin JWT — ADMIN/SUPER_ADMIN (Swagger-excluded)

Send a message to the configured Telegram chat.

**Request**

```http
POST /telegram/send-message HTTP/1.1
Host: localhost:3641
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "message": "Server alert: sync completed",
  "parseMode": "HTML"
}
```

**Response**

```json
{
  "data": {
    "ok": true,
    "messageId": 12345
  },
  "statusCode": 201,
  "timestamp": "2026-09-24T07:00:00.000Z",
  "path": "/telegram/send-message"
}
```

---


---

## Notes

1. **UUIDs** in examples are placeholders — use real ids from your DB.
2. **Static files** are served from `/uploads/...` (products, ads, teams, app-users, prize-draws, etc.).
3. **Schedulers** (no HTTP): API-Football auto-sync runs daily/hourly/every-minute when enabled.
4. **Live interactive docs**: open `/api-docs` when Swagger is enabled.
