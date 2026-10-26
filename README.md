<!-- Purpose: Project overview and setup guide for the Smart Campus Resource Management System. -->
# Smart Campus Resource Management System

This project is a campus resource booking and scheduling backend built with Node.js, Express, and MongoDB. It allows students and faculty members to register with their DSCE institutional email, verify their account using OTP, browse available campus resources, request bookings, and manage room or slot availability.

The application is designed for a university environment where resources such as classrooms, labs, auditoriums, and departmental facilities need controlled access based on user role and department.

## Project purpose

The system supports:

- Student registration and OTP-based email verification
- Faculty and student role-based access
- Resource listing and auto-seeding of campus resources
- Booking requests with approval workflow
- Faculty-managed slot locking for departmental resources
- Event visibility based on department and scope
- Static frontend pages served from the public folder

## Tech stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Nodemailer for OTP email delivery
- CORS and dotenv

## Architecture overview

The backend is organized into a few core parts:

- `server.js` starts the Express app, loads middleware, mounts API routes, and connects to MongoDB.
- `routes/` contains API endpoints for authentication, resources, bookings, slot locks, and events.
- `models/` defines MongoDB schemas for users, resources, bookings, slot locks, and events.
- `middleware/` contains reusable authentication logic.
- `config/jwt.js` exposes the JWT secret used across protected routes.
- `public/` contains the front-end pages and JavaScript that call the backend APIs.

## How the app works

### 1. Server startup

When the app starts:

1. Express is initialized.
2. JSON parsing and CORS are enabled.
3. API route groups are mounted under `/api`.
4. Static frontend files are served from the `public` folder.
5. MongoDB is connected using `MONGO_URI` from the environment.

The main startup logic is in `server.js`.

### 2. Authentication flow

The project uses institutional email registration and OTP verification.

#### Registration

The `POST /api/auth/register` endpoint:

- accepts name, email, and password
- accepts student `@dsce.edu.in` USN emails and faculty `name+course+vtu@dayanandasagar.edu` emails
- determines the user's role:
  - student accounts are inferred from the DSCE USN pattern and branch code
  - faculty accounts are inferred from the course segment between the plus signs (for example, `name+mca+vtu@dayanandasagar.edu`)
- creates or updates a user record
- generates a 6-digit OTP
- sends the OTP to the registered email address

If email delivery is not configured, the system returns a 503 response explaining that SMTP settings are missing.

#### OTP verification

The `POST /api/auth/verify-otp` endpoint verifies the user and marks the account as active using `isVerified: true`.

#### Login

The `POST /api/auth/login` endpoint:

- checks the email and password
- ensures the user is verified
- generates a JWT token containing the user ID, role, and email
- sends the token to the client

The token is then used to access protected booking and resource routes.

### 3. Role system

The `User` model supports these main roles:

- `student`
- `faculty`

The app uses the role to control what each user can do:

- Students can request booking slots for resources.
- Faculty can manage and lock slots for their department's resources.
- Department-based visibility is enforced for events and resource access.

### 4. Resources

The resource model stores information such as:

- building
- course/department
- room number
- type (classroom, lab, auditorium, etc.)
- capacity
- availability status

The `GET /api/resources/` route lists available resources and ensures placeholder rooms for the configured campus blocks and their listed departments and facilities exist, using sample room numbers.

### 5. Booking workflow

The booking system is the core of the project.

`POST /api/bookings/` handles student booking requests and performs the following checks:

- verifies the user is a student
- validates the resource ID, time range, and purpose
- ensures the requested date is in the future
- checks that the resource exists and is available
- prevents overlap with any existing pending or approved booking
- creates a booking request with a status such as `PENDING_FACULTY` or `PENDING_ADMIN`

The booking record includes:

- `resource_id`
- `user_id`
- `start_time`
- `end_time`
- `purpose`
- `status`
- optional event metadata such as `eventTitle`, `eventDescription`, or `eventScope`

The project includes a lightweight resource booking lock mechanism to reduce race conditions when multiple users try to book the same room around the same time.

### 6. Slot locking

The slot lock system supports faculty-managed restrictions for specific time slots on a resource.

`PUT /api/slot-locks/` can be used by faculty to lock or unlock a given time slot for a resource and date.

Rules include:

- only faculty can update slot locks
- the faculty must belong to the matching department
- weekends, auditorium-based resources, Block 1, and Block 2 are exempt from locking
- bookings use one-hour slots from `08:00 - 09:00` through `17:00 - 18:00` in campus time
- weekday slots before 1:00 PM are locked by default except for Block 1 and Block 2

This helps prevent student booking attempts during blocked teaching or maintenance periods.

### 7. Event visibility

The system also supports event records and departmental visibility.

The `GET /api/events/` route returns all visible events for the logged-in user:

- global events are shown to everyone
- departmental events are shown only to matching department users
- general users can see all events

This allows campus announcements and event schedules to be filtered appropriately.

## Frontend flow

The app serves static HTML pages from `public/`:

- `index.html` – authentication page
- `student-dashboard.html` – student-facing dashboard
- `faculty-dashboard.html` – faculty-facing dashboard
- `verify.html` – optional verification page

The browser-side JavaScript in `public/app.js` handles:

- registration
- OTP verification
- login
- redirecting users to the correct dashboard based on their role

The frontend stores the JWT in `localStorage` and routes students and faculty to different pages after login.

## Environment variables

Create a `.env` file in the project root with values similar to the following:

```env
MONGO_URI=mongodb://localhost:27017/smart-campus-rms
PORT=3000
JWT_SECRET=your_secure_secret_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
EMAIL_FROM=your_email@example.com
```

Notes:

- `MONGO_URI` is required for database connectivity.
- `JWT_SECRET` is required for signing and verifying tokens.
- SMTP settings are required for the OTP email flow.

## Installation

1. Clone the repository.
2. Open the project folder.
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file as described above.
5. Start the server:

```bash
node server.js
```

The server will start on `http://localhost:3000` by default.

## API summary

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/verify-otp`
- `POST /api/auth/login`

### Resources

- `GET /api/resources/`
- `POST /api/resources/`

### Bookings

- `GET /api/bookings/my-bookings`
- `GET /api/bookings/availability`
- `POST /api/bookings/`

### Slot locks

- `GET /api/slot-locks/`
- `PUT /api/slot-locks/`

### Events

- `GET /api/events/`

## Security notes

This project uses JWT-based authentication and role checks on protected routes. However, production deployments should also consider:

- using stronger environment-based secrets
- hashing passwords before storing them
- validating all incoming inputs more strictly
- using a production-grade SMTP provider and secure credentials
- avoiding hardcoded secrets in code or shared environments

## Project behavior in one sentence

This application manages campus resource access by authenticating DSCE users, controlling booking requests by role and department, preventing conflicting bookings, and exposing a front-end dashboard for students and faculty.
