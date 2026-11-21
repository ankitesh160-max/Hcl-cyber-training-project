# SecureStep – Two-Factor Authentication System

A beginner-friendly Node.js + Express demonstration of email/password authentication followed by TOTP-based two-factor authentication.

## 1. Project introduction

SecureStep demonstrates how a modern login can use two independent steps:

1. Something the user knows: a password.
2. Something the user has access to: a time-based one-time password (TOTP) from an authenticator application.

## 2. Problem statement

Passwords can be stolen, guessed, reused, or exposed in data breaches. Adding TOTP makes a stolen password alone insufficient for login.

## 3. Objectives

- Register users securely.
- Hash passwords with bcryptjs.
- Create a unique TOTP secret for each user.
- Generate an authenticator QR code.
- Verify the first OTP before enabling 2FA.
- Require password + OTP during login.
- Protect the dashboard with sessions.
- Regenerate the session ID after authentication.
- Rate-limit authentication endpoints.
- Provide clear error messages.

## 4. Technology stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js
- Framework: Express.js
- Storage: JSON file (`data/users.json`)
- Password hashing: bcryptjs
- TOTP: Speakeasy
- QR code: qrcode
- Sessions: express-session
- Rate limiting: express-rate-limit
- Environment variables: dotenv

## 5. Architecture

Browser
  |
  | HTTP / JSON
  v
Express server
  |
  +--> Registration -> bcrypt hash + TOTP secret -> users.json
  |
  +--> Login -> password check -> pending session
  |                |
  |                +--> OTP check -> authenticated session
  |
  +--> Dashboard -> authenticated session required

### Login workflow

1. User submits email + password.
2. Server finds the user by normalized email.
3. bcrypt compares the supplied password with the stored hash.
4. If the password is correct, the server creates a pending login session.
5. User enters the current six-digit TOTP.
6. Speakeasy verifies the token.
7. Server regenerates the session ID and marks the session authenticated.
8. Dashboard becomes available.

### Registration + setup workflow

1. User submits name, email, and password.
2. Server validates the fields.
3. Password is hashed with bcryptjs.
4. Speakeasy creates a unique Base32 TOTP secret.
5. QRCode creates a QR image from the `otpauth://` URL.
6. User scans the QR code.
7. User enters the first six-digit TOTP.
8. Server verifies it and enables 2FA.

## 6. Features

- Registration
- Duplicate email prevention
- Password hashing
- TOTP secret generation
- QR-code setup
- First-OTP verification
- Two-step login
- Protected dashboard
- Logout
- Session regeneration
- Authentication rate limiting
- Input validation
- Friendly errors
- Responsive dark navy/white/blue interface

## 7. Installation

Requirements:
- Node.js 18+ recommended
- An authenticator app such as Google Authenticator or Microsoft Authenticator

Open a terminal in this folder:

```bash
npm install
```

Create `.env` from `.env.example` and change `SESSION_SECRET`.

Then:

```bash
npm start
```

Open:

http://localhost:3000

## 8. How to test manually

### Test 1: Registration
Expected:
- New account is created.
- Password is not stored as plain text.
- QR setup appears.

### Test 2: Duplicate registration
Register the same email twice.

Expected:
- Second attempt is rejected.

### Test 3: Wrong setup OTP
Enter an incorrect six-digit code.

Expected:
- 2FA is not enabled.
- Error is displayed.

### Test 4: Correct setup OTP
Scan QR code and enter the current code.

Expected:
- 2FA becomes enabled.
- Dashboard appears.

### Test 5: Wrong password
Use an incorrect password.

Expected:
- Login is rejected.

### Test 6: Correct password
Use the correct email/password.

Expected:
- OTP screen appears.

### Test 7: Wrong OTP
Enter an incorrect six-digit OTP.

Expected:
- Login is rejected.

### Test 8: Correct OTP
Enter the current authenticator code.

Expected:
- Dashboard appears.

### Test 9: Refresh dashboard
Refresh the browser.

Expected:
- Authenticated session remains available until session expiration/logout.

### Test 10: Logout
Click Log out.

Expected:
- Session is destroyed.
- Dashboard is no longer accessible.

### Test 11: Dashboard without authentication
Open the app in a new browser session and request `/api/me`.

Expected:
- HTTP 401.

### Test 12: OTP format
Enter letters or fewer/more than six digits.

Expected:
- Server rejects the value.

### Test 13: Rate limiting
Make repeated authentication attempts.

Expected:
- Server eventually responds with a rate-limit message.

## 9. Advantages

- Simple architecture suitable for a B.Tech project.
- Uses industry-relevant concepts.
- Easy to run locally.
- Demonstrates password hashing and MFA.
- No complex frontend framework.
- Clear separation between browser and server logic.

## 10. Limitations

This is a student demonstration, not a production authentication service.

- JSON-file storage is not suitable for concurrent production workloads.
- The default Express session store is intended for development, not production.
- No email verification or password reset flow.
- No recovery codes.
- No account lockout or advanced fraud detection.
- No HTTPS is configured for local development.
- Secrets are stored in the local JSON file; a production system should use protected secret storage.
- CSRF protection is not implemented.
- Content Security Policy and other advanced HTTP security headers are not configured.
- Rate limits are basic and in-memory.
- TOTP clock tolerance is set to one time step (`window: 1`).
- A production system should use a proper database, secure cookie settings, HTTPS, monitoring, secret management, backup/recovery, and stronger abuse controls.

## 11. Viva questions and answers

### 1. What is authentication?
Authentication verifies who a user is.

### 2. What is 2FA?
Two-factor authentication uses two different verification factors. In this project, the password is the first factor and the TOTP code is the second.

### 3. What is TOTP?
TOTP means Time-based One-Time Password. An authenticator app calculates a short-lived code from a shared secret and the current time.

### 4. Why does the OTP change?
The code is calculated using time, so a new code is generated periodically.

### 5. Why use bcrypt?
bcrypt is a password-hashing algorithm designed to make password guessing expensive. The application stores a hash rather than the original password.

### 6. Why should passwords not be stored as plain text?
If the database is leaked, plain-text passwords can immediately be read and reused. Hashing reduces this risk.

### 7. What is a session?
A session lets the server remember that a browser has successfully authenticated.

### 8. Why regenerate the session ID after authentication?
It helps defend against session fixation by replacing the old session identifier after a privilege change.

### 9. What is a QR code doing in this project?
The QR code contains the standard `otpauth://` configuration that an authenticator app uses to add the account.

### 10. What is a TOTP secret?
It is a shared secret known by the server and authenticator app. Both use it with the current time to calculate the OTP.

### 11. What is rate limiting?
Rate limiting restricts how many requests a client can make in a time window. It helps slow password and OTP guessing.

### 12. Why validate OTP as six digits?
The application's TOTP configuration uses six-digit tokens, so malformed input can be rejected before verification.

### 13. Why is `httpOnly` used for the session cookie?
It prevents normal client-side JavaScript from reading the cookie, reducing exposure to some XSS-related cookie theft.

### 14. What does `sameSite: "lax"` do?
It provides some protection against cross-site request behavior by limiting when the browser sends the session cookie.

### 15. Is this project production-ready?
No. It is a learning demonstration. Production authentication requires stronger infrastructure, HTTPS, a production session store, proper database design, secret management, CSRF/XSS defenses, monitoring, recovery procedures, and security testing.

### 16. What happens if the OTP is wrong?
The server returns an error and does not create an authenticated session.

### 17. Can a user log in with only the password?
Not after 2FA has been enabled. The second TOTP verification is also required.

### 18. Why use environment variables?
Secrets such as session keys should not be hard-coded into source control.

## 12. Important security note

Do not describe this project as "fully secure" or "production-ready." The implementation is intentionally simple for education. A real service should undergo threat modeling, dependency review, penetration/security testing, code review, secure deployment, and operational monitoring.
