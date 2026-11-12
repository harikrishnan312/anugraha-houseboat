# Houseboat Booking Management System

A small operational booking app built with Next.js App Router, TypeScript, MongoDB Atlas, Mongoose and Tailwind CSS.

## Included

- Houseboat create, edit, list and safe delete (boats with booking history must be deactivated).
- One-date booking records.
- Sharing and individual bookings.
- Server-side room availability validation.
- Cancellation releases rooms because only confirmed bookings count toward occupancy.
- Booking list filtered by date and houseboat.
- Date-wise availability API.
- Dashboard summary and houseboat-wise availability.
- Daily booking/payment summary report.
- Admin/Staff-ready User Mongoose model.
- MongoDB indexes and reusable connection.
- Netlify configuration.

## Requirements

- Node.js 20.9 or later (Node 22 LTS recommended).
- MongoDB Atlas cluster.
- A MongoDB Atlas deployment that supports transactions (replica set; Atlas clusters support this).

## Run locally

1. Extract the ZIP.
2. Open a terminal in the extracted folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy `.env.example` to `.env.local`.
5. Set `MONGODB_URI` to your Atlas connection string.
6. Start the app:

   ```bash
   npm run dev
   ```

7. Open http://localhost:3000.

## API routes

| Method | Route | Purpose |
|---|---|---|
| GET, POST | `/api/houseboats` | List / create houseboats |
| PATCH, DELETE | `/api/houseboats/:id` | Update / delete houseboat |
| GET, POST | `/api/bookings` | List / create bookings |
| PATCH | `/api/bookings/:id` | Replace/update a booking |
| POST | `/api/bookings/:id/cancel` | Cancel booking |
| GET | `/api/availability?date=YYYY-MM-DD` | Date-wise availability |
| GET | `/api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD` | Payment and booking summary |

## Booking rules

- An individual booking occupies every room in the houseboat.
- An individual booking cannot coexist with any other confirmed booking on the same boat/date.
- Sharing bookings can coexist while the sum of rooms does not exceed the boat's room count.
- Cancelled bookings do not count toward room occupancy.
- The booking create flow uses a MongoDB transaction and writes a revision field on the houseboat document to serialize concurrent attempts for that boat.
- Booking dates are stored as UTC midnight for the selected calendar date. The app compares date boundaries in UTC to avoid server timezone drift.

## Security before production

The starter deliberately denies API access in production by default because the login UI/session layer has not been implemented. This avoids deploying unrestricted public management APIs.

- Keep `ALLOW_UNAUTHENTICATED_API=false` in production.
- Implement authentication using the `users` collection and protect every API route with verified server-side sessions/roles before production use.
- Do not expose a database URI, password hash, or server secret through `NEXT_PUBLIC_*` variables.
- Do not set `ALLOW_UNAUTHENTICATED_API=true` on a public production deployment.

The local development environment allows API access so you can build and test the application.

## Users collection

The `models/User.ts` model is ready for manually created admin/staff accounts. Passwords must be stored as a strong password hash (never plaintext). Authentication is intentionally not enabled in this starter.

## Important notes

- This project is a complete starter for the requested booking workflow, but it has not been executed against your own Atlas cluster. Run the test checklist below before entering live bookings.
- Booking edits update the existing booking inside a MongoDB transaction, re-checking capacity and acquiring per-houseboat write locks before saving.
- Monetary values are stored as numbers. If you need exact fractional currency accounting, use integer paise or MongoDB Decimal128 consistently.
- Add automated tests and audit logging before relying on the app for critical financial operations.

## Manual test checklist

1. Add a boat with 5 rooms.
2. Create a sharing booking for 2 rooms.
3. Create another sharing booking for 2 rooms on the same date.
4. Confirm availability shows 1 room.
5. Try another 2-room booking; it must be rejected.
6. Cancel one booking; availability should increase by its room count.
7. Create an individual booking on an empty date; availability should show 0.
8. Try any other booking for that boat/date; it must be rejected.
9. Try an individual booking after a sharing booking; it must be rejected.
10. Verify total, advance and balance values in the report.

## Netlify

1. Push the project to GitHub.
2. Import the repository in Netlify.
3. Add `MONGODB_URI` in Netlify environment variables.
4. Keep `ALLOW_UNAUTHENTICATED_API=false`.
5. Configure authentication/authorization before enabling management APIs publicly.
6. Deploy with the included `netlify.toml`.
