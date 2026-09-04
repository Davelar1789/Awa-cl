# 🚌 AwaBus

> **Geofence-Triggered Automated Proximity Alert and Communication System for School Transport in Ghana**

A school bus proximity alert system purpose-built for the Ghanaian school transport ecosystem. When a school bus enters a configurable radius around a child's drop-off point, AwaBus automatically triggers a voice call (robocall) to the parent, no smartphone, no data connection, no app required on the parent's end.

The system is built around three components: a **React Native Driver Android App**, a **React.js Admin Web Portal**, and an **Arkesel IVR telephony channel** as the exclusive parent interface. Parents on any phone — basic or smart — are fully served by the IVR dial-in channel for both inbound actions and outbound alerts.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Deployment](#deployment)
- [Team](#team)

---

## Overview

AwaBus addresses a safety-critical gap in Ghanaian school transport: no structured, automated communication exists between school bus drivers and parents. Children are left waiting unsupervised at drop-off points while drivers make manual calls from moving vehicles.

**AwaBus automates the entire pipeline:**

1. Driver opens the Android app and initiates a trip with one tap
2. The app streams GPS coordinates to the backend every 10 seconds via a background foreground service
3. The backend runs a Haversine geofence check against every active student's drop-off coordinates on each GPS ping
4. When the bus enters the configured radius, an automated voice call fires to the parent via Arkesel
5. An SMS broadcast is dispatched to all parents in situations where there is going to be a drop-off or pickup delay, which will be initiated by the driver.
6. Parents manage attendance and connect to drivers exclusively via the **Arkesel IVR inbound channel** — a single phone call, no smartphone required
7. Admins configure the entire system — users, buses, students, geofence coordinates — through the **Admin Web Portal**

---

## Key Features

### 🗺️ Geofence Engine (Backend)
- Haversine formula computed server-side on every GPS ping — no external mapping library
- Per-student configurable geofence radius (100m–2000m; default 500m)
- Inclusive boundary trigger: student exactly at the radius boundary receives an alert
- One-time alert trigger per student per trip (write-once `alertTriggered` flag, never reversed)

### 🚗 Driver Android App
- Background GPS foreground service (`expo-task-manager`) that streams continuously even when the phone is locked or the app is minimised
- Dynamic student attendance checklist per active trip (Pending / Alert Sent / Dropped Off)
- One-tap trip initiation and completion with pre/post-trip confirmation prompts
- Live GPS status display: current coordinates, last ping timestamp, connectivity indicator
- Offline ping queue: up to 60 pings (10 minutes) cached locally and replayed in order on reconnect
- Delay broadcast: notify all attending parents on the route via SMS with a single tap

### 🖥️ Admin Web Portal
- Full CRUD: Users (Admins, Drivers, Parents), Buses, Students
- Student Geospatial Mapping: Leaflet.js interactive map with drag-and-drop pin placement, geofence circle overlay, per-driver colour filtering
- Driver–Bus assignment with bidirectional reference updates
- Activity & Communication Log: paginated, filterable audit trail of every system event (voice calls, SMS, IVR interactions)
- Real-time Socket.io updates: live log entries and critical failure alerts

### 📞 IVR Inbound Channel (Exclusive Parent Interface)
- Dedicated school dial-in number powered by Arkesel
- Caller ID recognition: registered parents are greeted by ward name automatically
- Unrecognised numbers prompted to enter their registered phone number and 4-digit PIN
- **Press 1** → cancel ward's bus seat for today (blocked after 06:30 AM Ghana Standard Time)
- **Press 2** → bridge call directly to the driver; automatic fallback message if driver unreachable within 30 seconds
- Multi-student support: parents with multiple wards on different routes are prompted to select a student first
- PIN security: bcrypt-hashed 4-digit PIN; maximum 3 attempts per IVR session before disconnection
- All webhook events validated via `X-Arkesel-Signature` shared secret

### 📣 Outbound Voice & SMS
- Arkesel Voice API for proximity alerts with automatic Arkesel SMS fallback
- Delay broadcast to all attending parents with deduplication (parent with multiple children on the same route receives one message, not two)
- `Promise.allSettled` async dispatch — driver's request returns immediately with a queued confirmation

---

## System Architecture

```
┌──────────────────────┐    GPS Pings (REST)      ┌──────────────────────────────────────┐
│  Driver Android App   │ ────────────────────────▶│                                      │
│  (React Native/Expo)  │                          │      Node.js / Express.js            │
└──────────────────────┘                          │          Backend API                  │
                                                  │                                      │
┌──────────────────────┐    REST + WebSocket       │   ┌──────────────────────────────┐  │
│   Admin Web Portal    │ ◀──────────────────────▶ │   │      Geofence Engine         │  │
│   (React.js / Vite)   │                          │   │      (Haversine calc)        │  │
└──────────────────────┘                          │   └──────────────┬───────────────┘  │
                                                  │                  │                   │
                                                  │                  ▼                   │
                                                  │   ┌──────────────────────────────┐  │
                                                  │   │    Communication Engine      │  │
                                                  │   │  Voice → SMS → Hubtel        │  │
                                                  │   └──────────────┬───────────────┘  │
                                                  │                  │                   │
                                                  │                  ▼                   │
                                                  │   ┌──────────────────────────────┐  │
                                                  │   │     IVR Webhook Handler      │  │
                                                  │   │  /inbound · /dtmf · /callback│  │
                                                  │   └──────────────────────────────┘  │
                                                  │                                      │
┌──────────────────────┐    Webhook (IVR events)  └──────────────────┬───────────────────┘
│   Arkesel IVR         │ ────────────────────────▶                  │
│ (Inbound calls)       │                                             ▼
└──────────────────────┘                          ┌──────────────────────────────────────┐
                                                  │           MongoDB Atlas               │
┌──────────────────────┐    API Calls             │          (Mongoose ODM)               │
│   Arkesel API         │ ◀──────────────────────  └──────────────────────────────────────┘
│ (Voice / SMS / IVR)   │
└──────────────────────┘


         ┌──────────────────────────────────────────────────────────────────┐
         │                  Parent Interface — IVR Only                      │
         │  Parents have NO app and NO web interface. They interact with     │
         │  AwaBus exclusively through outbound voice calls and SMS (system  │
         │  → parent) and inbound IVR calls (parent → system). Any phone     │
         │  — basic or smart — is fully supported.                           │
         └──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Driver Mobile App | React Native (Expo), `expo-location`, `expo-task-manager` |
| Admin Web Portal | React.js (Vite) |
| Backend API | Node.js, Express.js |
| Database | MongoDB Atlas (Mongoose ODM) |
| Real-time | Socket.io (driver app + admin portal only) |
| Map (Admin) | Leaflet.js + OpenStreetMap (no paid APIs) |
| Communication | Arkesel API (Voice Call, SMS, IVR) |
| Geofence Logic | Haversine formula (pure Node.js) |
| Authentication | JWT (stateless), bcrypt (passwords + IVR PINs) |
| Rate Limiting | express-rate-limit |
| Testing | Jest, Supertest |
| Hosting | Railway (backend), Vercel (admin portal), Expo EAS (driver app), MongoDB Atlas (DB) |
| Design | Figma |
| Version Control | Git, GitHub |

---

## Project Structure

```
awabus/
├── server/                         # Node.js / Express backend
│   ├── config/
│   │   ├── db.js                   # MongoDB connection
│   │   ├── env.js                  # Fail-fast required-env-var check
│   │   └── arkesel.js              # Arkesel API config + axios clients (mockable)
│   ├── models/
│   │   ├── User.js                 # Roles: driver | parent | admin
│   │   ├── Bus.js                  # Bus registration + driver assignment
│   │   ├── Student.js              # Home coords, geofence radius, parent + driver refs
│   │   ├── Trip.js                 # Status: Active | Completed; one-active-trip-per-bus index
│   │   ├── TripStudent.js          # Per-student alert state per trip; write-once alertTriggered
│   │   ├── DailyAttendance.js      # IVR attendance cancellations; unique (studentId + date)
│   │   ├── SecondaryReceiver.js    # Temp alternate contact with TTL expiry
│   │   ├── CommunicationLog.js     # Append-only voice/SMS/IVR event records
│   │   ├── AuthLog.js              # Login + IVR PIN attempt audit log
│   │   └── PasswordReset.js        # OTP + reset-token documents with TTL index
│   ├── routes/
│   │   ├── auth.js                 # Register, login, refresh, OTP forgot/verify/reset-password
│   │   ├── trips.js                # Trip start/ping/end/broadcast, checklist polling, resolve
│   │   ├── students.js             # CRUD (admin)
│   │   ├── drivers.js              # GET /me/route — bus + roster + in-progress trip
│   │   ├── buses.js                # Bus CRUD + driver assignment
│   │   ├── users.js                # Admin user management (suspend, delete, edit)
│   │   ├── ivr.js                  # Arkesel IVR webhook: /inbound, /dtmf, /voice-callback
│   │   ├── logs.js                 # GET /api/logs with filter params
│   │   └── dashboard.js            # GET /api/dashboard/stats
│   ├── middleware/
│   │   ├── auth.js                 # JWT verify + passwordChangedAt invalidation
│   │   ├── rbac.js                 # Role-based access control
│   │   ├── ivrSignature.js         # X-Arkesel-Signature webhook validation (constant-time)
│   │   ├── rateLimiters.js         # Per-route rate limits (login, OTP, IVR, GPS ping, general)
│   │   ├── validate.js             # express-validator error → 400 mapper
│   │   └── errorHandler.js         # Central error handler + 404
│   ├── services/
│   │   ├── geofenceEngine.js       # Haversine + inclusive-boundary trigger; write-once claim
│   │   ├── communicationEngine.js  # Voice call → Arkesel SMS fallback; all Arkesel calls go through here
│   │   ├── ivrService.js           # Caller ID lookup, PIN verify, DTMF routing, cancel/bridge
│   │   ├── ivrSessionStore.js      # In-memory per-call IVR conversation state (single-instance)
│   │   └── broadcastService.js     # Bulk SMS with phone-based dedup + Promise.allSettled dispatch
│   ├── utils/
│   │   ├── haversine.js            # Pure Haversine distance calculation (returns metres)
│   │   ├── time.js                 # Attendance cutoff (GST = UTC, no DST)
│   │   ├── phone.js                # E.164 validation + Ghana-number normalisation
│   │   ├── otp.js, jwt.js, asyncHandler.js, AppError.js
│   ├── socket/
│   │   └── index.js                # Socket.io, JWT-authenticated; rooms: driver:<id>, admin
│   ├── tests/
│   │   ├── unit/                   # No DB — Haversine, geofence boundary, cutoff, phone
│   │   └── integration/            # Supertest + mongodb-memory-server
│   ├── seedAdmin.js                # Creates the first admin from env vars (no hardcoded secrets)
│   ├── app.js
│   └── server.js
│
├── client-driver/                  # React Native (Expo) — Driver app, Android only
│   ├── app/
│   │   ├── SplashScreen.jsx
│   │   ├── auth/LoginScreen.jsx
│   │   └── trip/
│   │       ├── DashboardScreen.jsx     # Pre-trip home: bus/roster, permission gate, start button
│   │       ├── ActiveTripScreen.jsx    # Live checklist, GPS status, end/broadcast buttons
│   │       └── DelayBroadcastScreen.jsx
│   ├── components/                 # Button, GPSStatusBar, StatusBadge, StudentCard
│   ├── services/
│   │   ├── gpsService.js           # expo-task-manager background location task
│   │   ├── pingQueue.js            # Offline ping queue (AsyncStorage; max 60, replay on reconnect)
│   │   ├── api.js, auth.js, socket.js
│   ├── constants/theme.js
│   └── app.json                    # Requests foreground + background location permissions
│
├── client-web/                     # React.js (Vite) — Admin Web Portal
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx, ForgotPassword.jsx, NotFound.jsx
│   │   │   └── admin/
│   │   │       ├── Dashboard.jsx       # Live stats, socket-refreshed
│   │   │       ├── Users.jsx           # User management: admins, drivers, parents
│   │   │       ├── Buses.jsx           # Bus CRUD + driver assignment
│   │   │       ├── Students.jsx        # Student table + geospatial map workspace
│   │   │       └── ActivityLog.jsx     # Communication + activity log, live via Socket.io
│   │   ├── components/
│   │   │   ├── layout/                 # AppShell, PageHeader
│   │   │   ├── map/MapWorkspace.jsx    # Leaflet.js: pin placement, geofence circles
│   │   │   └── ui/                     # Small design-system kit (Button, Table, Modal, …)
│   │   ├── services/api.js, socket.js
│   │   ├── context/AuthContext.jsx
│   │   └── main.jsx
│   └── vite.config.js
│
├── .gitignore
└── README.md
```

Each app (`server/`, `client-web/`, `client-driver/`) has its own `.env.example` — copy it to
`.env` inside that app's folder, not at the repo root.

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB Atlas account (free tier works)
- Arkesel API account (for voice, SMS, and IVR)
- Android device or emulator (for driver app)
- Expo CLI: `npm install -g expo-cli`

### 1. Clone the Repository

```bash
git clone https://github.com/McEsselB/AwaBus.git
cd AwaBus
```

### 2. Set Up the Backend

```bash
cd server
npm install
cp .env.example .env
# Fill in your environment variables (see below) — at minimum MONGO_URI and JWT_SECRET
npm run dev
```

Create the first admin account (one-time — reads `MONGO_URI` from `.env`, prints a random
password if you don't set `SEED_ADMIN_PASSWORD`):

```bash
npm run seed:admin
```

### 3. Set Up the Admin Web Portal

```bash
cd client-web
npm install
npm run dev
```

Opens at `http://localhost:5173`. In dev, Vite proxies `/api` and `/socket.io` to the
backend on `http://localhost:5000` — no `.env` needed unless you're pointing at a deployed
API (see `client-web/.env.example`).

### 4. Set Up the Driver App

```bash
cd client-driver
npm install
cp .env.example .env
# Set EXPO_PUBLIC_API_URL to your machine's LAN IP, not localhost —
# e.g. http://192.168.1.20:5000/api — so a phone on Expo Go can reach it.
npx expo start
# Scan the QR code with Expo Go on your Android device
# Grant "Allow all the time" location permission when prompted — required for background GPS
```

> **Note:** Background location ("Always Allow") must be granted before the driver can start a trip. The app enforces this at the OS prompt level and disables the "Start Trip" button until permission is confirmed.

---

## Environment Variables

Create a `.env` file in `/server` based on `.env.example`:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/awabus

# JWT
JWT_SECRET=your_jwt_secret_here_min_32_chars
JWT_EXPIRES_IN=7d

# Arkesel API
ARKESEL_API_KEY=your_arkesel_api_key
ARKESEL_SENDER_ID=AwaBus
ARKESEL_IVR_NUMBER=+233XXXXXXXXX
ARKESEL_SMS_BASE_URL=https://sms.arkesel.com/api/v2
ARKESEL_VOICE_BASE_URL=https://sms.arkesel.com/api/v2/voice
ARKESEL_WEBHOOK_SECRET=your_shared_webhook_secret
# true = log outbound voice/SMS to the console instead of calling Arkesel.
# Keep this true until real Arkesel credentials are in place.
ARKESEL_MOCK_MODE=true

# Geofence
DEFAULT_GEOFENCE_RADIUS_METRES=500
GPS_PING_INTERVAL_SECONDS=10

# Attendance
ATTENDANCE_CUTOFF_TIME=06:30

# Frontend URLs (for CORS)
CLIENT_WEB_URL=https://awabus.vercel.app
CLIENT_DRIVER_APP_URL=exp://localhost:8081
```

---

## API Documentation

### Authentication

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Admin | Create a user (admin, driver, or parent) |
| POST | `/api/auth/login` | Public | Login with phone + password; returns JWT |
| POST | `/api/auth/refresh` | Auth | Refresh JWT (rate limited: 10/hr/user) |
| POST | `/api/auth/forgot-password` | Public | Initiate SMS OTP flow |
| POST | `/api/auth/verify-otp` | Public | Validate OTP; returns short-lived reset token |
| POST | `/api/auth/reset-password` | Public | Set new password using reset token |

### Users (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/users` | Admin | Paginated, filterable user list |
| PUT | `/api/users/:id` | Admin | Update name, phone, role, status |
| PATCH | `/api/users/:id/status` | Admin | Suspend or reactivate user |
| DELETE | `/api/users/:id` | Admin | Hard or soft delete (based on history) |

### Buses (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/buses` | Admin | List all buses |
| POST | `/api/buses` | Admin | Create bus |
| PUT | `/api/buses/:id` | Admin | Update bus details |
| PATCH | `/api/buses/:id/assign-driver` | Admin | Assign driver to bus |
| DELETE | `/api/buses/:id` | Admin | Delete bus (only if unassigned + no trips) |

### Students (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/students` | Admin | List all students |
| POST | `/api/students` | Admin | Create student with geofence coordinates |
| PUT | `/api/students/:id` | Admin | Update student (incl. coordinate drag-drop) |
| DELETE | `/api/students/:id` | Admin | Hard or soft delete (based on history) |

### Trips (Driver)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/drivers/me/route` | Driver | Assigned bus + today's student list + any trip already in progress |
| POST | `/api/trips/start` | Driver | Initiate trip; creates TripStudent records (409 if one is already active) |
| GET | `/api/trips/:id/students` | Driver | Poll alert/drop-off state for the active trip's checklist |
| PATCH | `/api/trips/:id/students/:studentId/resolve` | Driver | Mark a student dropped off (`manuallyResolved`) |
| POST | `/api/trips/ping` | Driver | Stream GPS coordinate `{ tripId, lat, lng, timestamp }`; runs the geofence engine |
| POST | `/api/trips/:id/end` | Driver | Mark trip Completed; reset the bus to Idle |
| POST | `/api/trips/:id/broadcast` | Driver | Send delay SMS broadcast `{ delayMinutes }` to attending parents (deduplicated) |

### Dashboard (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/dashboard/stats` | Admin | Live counts: buses, active trips, students, users, today's alerts/SMS |

### IVR Webhooks

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/ivr/inbound` | Arkesel (webhook) | Handle inbound IVR call; caller ID lookup |
| POST | `/api/ivr/dtmf` | Arkesel (webhook) | Handle DTMF keypress events; route actions |
| POST | `/api/ivr/voice-callback` | Arkesel (webhook) | Receive call outcome; trigger SMS fallback if failed |

> **Note on the IVR webhook contract:** the field names above follow the conventions this
> kind of provider webhook typically uses, but Arkesel's exact Voice/IVR payload shape could
> not be verified against their live docs while building this (`arkesel.com` and
> `developers.arkesel.com` were unreachable from the build environment). `routes/ivr.js` and
> `config/arkesel.js` are the two files to correct against Arkesel's real docs/dashboard
> before disabling `ARKESEL_MOCK_MODE` in production — the rest of the IVR logic in
> `services/ivrService.js` is provider-agnostic and shouldn't need to change.

### Logs (Admin)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/api/logs` | Admin | Paginated, filterable communication + activity log |

---

## Database Schema

### User
```js
{
  name: String,
  phone: { type: String, unique: true },          // E.164 format
  passwordHash: String,                            // bcrypt, 12 salt rounds (admins + drivers only)
  ivrPinHash: String,                              // bcrypt, 10 salt rounds (parents only)
  role: { type: String, enum: ['driver', 'parent', 'admin'] },
  status: { type: String, enum: ['active', 'suspended', 'deleted'] },
  mustChangePassword: { type: Boolean, default: true },
  assignedBusId: { type: ObjectId, ref: 'Bus' },  // drivers only
  loginAttempts: Number,
  lockoutUntil: Date,
  passwordChangedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Bus
```js
{
  registrationNumber: { type: String, unique: true },
  nickname: String,
  capacity: Number,
  assignedDriverUserId: { type: ObjectId, ref: 'User', default: null },
  status: { type: String, enum: ['Idle', 'Active Trip', 'Maintenance'] },
  createdAt: Date
}
```

### Student
```js
{
  name: String,
  parentUserId: { type: ObjectId, ref: 'User' },
  driverUserId: { type: ObjectId, ref: 'User', index: true },
  homeLatitude: { type: Number, required: true },
  homeLongitude: { type: Number, required: true },
  geofenceRadius: { type: Number, default: 500 },   // metres; 100–2000
  active: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

### Trip
```js
{
  driverUserId: { type: ObjectId, ref: 'User', index: true },
  busId: { type: ObjectId, ref: 'Bus' },
  direction: { type: String, enum: ['dropoff', 'pickup'], default: 'dropoff' },
  startTime: Date,
  endTime: Date,
  status: { type: String, enum: ['Active', 'Completed'], index: true },
  lastKnownLocation: { lat: Number, lng: Number, timestamp: Date },
  delayBroadcastLog: [{ timestamp: Date, delayMinutes: Number, message: String, recipientCount: Number }]
}
// PARTIAL UNIQUE INDEX: { busId } where status = 'Active' — one active trip per bus, enforced at the DB layer
```

### TripStudent
```js
{
  tripId: { type: ObjectId, ref: 'Trip', index: true },
  studentId: { type: ObjectId, ref: 'Student' },
  attending: { type: Boolean, default: true },
  alertTriggered: { type: Boolean, default: false },  // write-once; NEVER set back to false
  alertTimestamp: Date,
  alertDistanceMetres: Number,
  manuallyResolved: { type: Boolean, default: false },
  createdAt: Date
}
// COMPOUND INDEX: { tripId, attending, alertTriggered }
// UNIQUE INDEX: { tripId, studentId }
```

### DailyAttendance
```js
{
  studentId: { type: ObjectId, ref: 'Student' },
  date: Date,
  attending: Boolean,
  updatedByIVR: { type: Boolean, default: false },
  reason: String,
  timestamp: Date,
  updatedAt: Date
}
// UNIQUE INDEX: { studentId, date }
```

### SecondaryReceiver
```js
{
  studentId: { type: ObjectId, ref: 'Student', index: true },
  phone: String,                    // E.164
  name: String,
  setByParentUserId: { type: ObjectId, ref: 'User' },
  expiresAt: Date                   // TTL index — auto-expires at end of day
}
```

### CommunicationLog
```js
{
  tripStudentId: { type: ObjectId, ref: 'TripStudent' },
  tripId: { type: ObjectId, ref: 'Trip', index: true },
  studentId: { type: ObjectId, ref: 'Student', index: true },
  driverId: { type: ObjectId, ref: 'User' },
  parentUserId: { type: ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['proximity_alert', 'sms_fallback', 'ivr_cancellation', 'ivr_bridge', 'delay_broadcast', 'login'] },
  channel: { type: String, enum: ['voice', 'sms', 'ivr'] },
  status: { type: String, enum: ['sent', 'delivered', 'failed'] },
  recipientPhone: String,
  message: String,
  arkeselResponseCode: String,
  retryCount: Number,
  failureReason: String,
  arkeselCallId: String,
  arkeselSessionId: String,
  timestamp: Date
}
// APPEND-ONLY — log entries are never updated or deleted
```

### AuthLog
```js
{
  userId: { type: ObjectId, ref: 'User' },
  phone: String,
  ip: String,
  userAgent: String,
  channel: { type: String, enum: ['web', 'driver_app', 'ivr'] },
  success: Boolean,
  reason: String,                   // e.g. 'wrong_password', 'wrong_pin', 'locked_out'
  timestamp: Date
}
// APPEND-ONLY — log entries are never updated or deleted
```

### PasswordReset
```js
{
  userId: { type: ObjectId, ref: 'User' },
  otpHash: String,                  // bcrypt
  resetTokenHash: String,           // sha256; set once the OTP is verified
  expiresAt: Date,                  // TTL index (5 minutes)
  used: Boolean,
  otpAttempts: Number,
  timestamp: Date
}
```

---

## Testing

### Run the Tests

```bash
cd server
npm test
```

`npm test` runs both suites under `server/tests/`:

- **`tests/unit/`** — pure-logic tests with no database (Haversine accuracy, geofence
  boundary, attendance cutoff, phone validation). No setup required.
- **`tests/integration/`** — Supertest against the real Express app, backed by an
  in-memory MongoDB via [`mongodb-memory-server`](https://github.com/nodkz/mongodb-memory-server)
  (it downloads a real `mongod` binary the first time it runs, so these need outbound
  internet access once). No separate database setup needed otherwise — each test file
  spins its own instance up and tears it down.

### Test Coverage

| Area | Method | Tool |
|---|---|---|
| Haversine ±1m accuracy at ~500m, symmetry, known reference distance | Unit test | Jest |
| Geofence triggers at 200/400/490/500m (inclusive boundary) | Unit test | Jest |
| Geofence does not trigger at 510/600/800m | Unit test | Jest |
| Attendance cutoff boundary (06:30 GST) | Unit test | Jest |
| Phone E.164 validation + Ghana-number normalisation | Unit test | Jest |
| Login: correct/incorrect credentials, 5-failure lockout | Integration test | Supertest |
| JWT expired → 401; no token → 401 | Integration test | Supertest |
| Admin-only registration; duplicate phone rejected | Integration test | Supertest |
| Cannot start a second active trip (409 Conflict) | Integration test | Supertest |
| Duplicate alert prevented by `alertTriggered` (write-once, concurrent-safe claim) | Integration test | Supertest |
| Trip end resets bus to Idle | Integration test | Supertest |
| Broadcast deduplicates a parent with two children on the same route | Integration test | Supertest |
| IVR PIN: 3 failures → session ends, logged to AuthLog | Integration test | Supertest |
| IVR Press 1 after cutoff → no DB mutation, rejection message | Integration test | Supertest |
| IVR Press 1 before cutoff → `DailyAttendance` written, `updatedByIVR: true` | Integration test | Supertest |
| Full end-to-end trip workflow | System test | Manual |
| Driver app, Admin portal | Usability study | SUS questionnaire |

> The integration suite needs a one-time `mongod` binary download that some sandboxed /
> restricted-network environments block — if `npm test` fails immediately inside
> `MongoMemoryServer.create()`, that's a network policy issue in that environment, not a
> code problem; the unit suite (`npx jest tests/unit`) has no such dependency and always
> runs standalone.

### Geofence Accuracy Test Coordinates

Simulated distances from a fixed test student home coordinate:

| Simulated Distance | Expected Outcome |
|---|---|
| 200m | Alert triggers ✅ |
| 400m | Alert triggers ✅ |
| 490m | Alert triggers ✅ |
| 500m | Alert triggers ✅ (inclusive boundary) |
| 510m | No alert ❌ |
| 600m | No alert ❌ |
| 800m | No alert ❌ |

---

## Security Notes

- **Passwords & PINs** — bcrypt, 12 salt rounds for admin/driver passwords, 10 for parent
  IVR PINs. Password hashes, PINs, login-attempt counters, and lockout timestamps are all
  `select: false` on the `User` model — a normal query never accidentally returns them.
- **Account lockout** — 5 failed logins locks an account for 15 minutes, on top of a
  per-IP rate limit (10 attempts/15 min) at the network layer.
- **JWT invalidation** — changing a password stamps `passwordChangedAt`; any token issued
  before that instant is rejected even if it hasn't expired yet.
- **IVR webhooks** — validated via a constant-time comparison of the `X-Arkesel-Signature`
  header against `ARKESEL_WEBHOOK_SECRET` (timing-safe, so a byte-by-byte guessing attack
  gains nothing). Disabled only in mock mode outside production.
- **Input handling** — `express-validator` on every mutating route, `express-mongo-sanitize`
  strips `$`/`.` operator injection from `body`/`query`/`params`, `hpp` blocks HTTP
  parameter pollution, `helmet` sets standard security headers.
- **Rate limiting** — separate, appropriately-sized limits for login, OTP request/verify,
  token refresh, IVR webhooks, GPS pings, and the general API surface (see
  `middleware/rateLimiters.js`).
- **Soft deletes** — users and students are soft-deleted (`status`/`active` flip) rather
  than removed, so trip history and the communication log stay intact and queryable.
- **Append-only audit trails** — `CommunicationLog` and `AuthLog` are only ever `create()`d,
  never updated or deleted by application code.
- **No secrets in source control** — `seedAdmin.js` reads `MONGO_URI` from the environment
  and generates a random admin password if `SEED_ADMIN_PASSWORD` isn't set; nothing is
  hardcoded. *(An earlier version of this script had a live MongoDB Atlas password
  committed to git in plaintext — if that credential is still in this repo's history,
  rotate it in Atlas regardless of anything done here; removing a committed secret from
  history doesn't undo prior exposure.)*
- **Concurrency-safe alerting** — the geofence engine claims an alert with an atomic
  `findOneAndUpdate({ alertTriggered: false }, { alertTriggered: true })`, so two GPS pings
  racing each other can never double-fire a proximity call.

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Backend API | Railway | Free tier for prototype |
| Admin Web Portal | Vercel | Free tier |
| Driver Android App | Expo EAS Build | APK for direct install during testing |
| MongoDB | MongoDB Atlas | Free M0 cluster |
| IVR + Voice + SMS | Arkesel | Paid per API credit |


### Deploy Backend to Railway

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Deploy Admin Portal to Vercel

```bash
cd client-web
npx vercel --prod
```

### Build Driver App APK via Expo EAS

```bash
cd client-driver
npx eas build --platform android --profile preview
```

---

## Budget

| Item | Cost (GHS) |
|---|---|
| Internet / Data Bundles | GHS 250 |
| Arkesel API Credits (Voice, SMS, IVR) | GHS 250 |
| Cloud Hosting (Railway/Vercel) | GHS 150 |
| Miscellaneous / Contingency | GHS 70 |
| **Total** | **GHS 720** |

---

## Team

| Name | Student ID | Role |
|---|---|---|
| David Nii Ayi Laryea | 11253339 | Developer |
| Mc-Essel Kweku Bondzie | 11354613 | Developer |

**Supervisor:** Prof. Matilda S.A. Wilson
**Institution:** University of Ghana, Department of Computer Science
**Programme:** BSc. Information Technology
**Academic Year:** 2025/2026

---

## Acknowledgements

- [Arkesel](https://arkesel.com) — Voice Call, SMS, and IVR APIs for Ghana
- [Expo](https://expo.dev) — React Native toolchain for Android background GPS
- [Leaflet.js](https://leafletjs.com) — Open-source interactive maps (Admin Portal)
- [MongoDB Atlas](https://www.mongodb.com/atlas) — Cloud database
- [Railway](https://railway.app) — Backend hosting

---

*AwaBus — Keeping Ghanaian children safe, one proximity alert at a time.*
