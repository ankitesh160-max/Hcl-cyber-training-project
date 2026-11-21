# SecureStep Test Plan

| ID | Test | Input/Action | Expected Result |
|---|---|---|---|
| T01 | Register valid user | New name/email/password | Account created |
| T02 | Duplicate email | Same email again | 409 error |
| T03 | Weak password | 5-character password | 400 error |
| T04 | Invalid email | `abc` | 400 error |
| T05 | Setup QR | Start setup | QR image returned |
| T06 | Wrong setup OTP | Incorrect 6 digits | 401 error |
| T07 | Correct setup OTP | Current TOTP | 2FA enabled |
| T08 | Wrong password | Incorrect password | 401 error |
| T09 | Correct password | Correct password | OTP screen |
| T10 | Wrong login OTP | Incorrect TOTP | 401 error |
| T11 | Correct login OTP | Current TOTP | Dashboard |
| T12 | Unauthenticated `/api/me` | No session | 401 error |
| T13 | Logout | POST logout | Session destroyed |
| T14 | Rate limit | Repeated auth attempts | Rate-limit response |
| T15 | Malformed OTP | Non-numeric value | 400 error |
