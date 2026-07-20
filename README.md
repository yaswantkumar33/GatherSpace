# GatherSpace API

> A production-grade **Event Discovery & Booking Platform** REST API built with Node.js, Express, MongoDB, and Mongoose.

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat&logo=node.js)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat&logo=express)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat&logo=mongodb)](https://mongodb.com)
[![Mongoose](https://img.shields.io/badge/Mongoose-7.x-880000?style=flat)](https://mongoosejs.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)

**Live API:** `https://gatherspace-api.up.railway.app`  
**Postman Collection:** [View & Fork](https://postman.com) *(link after publish)*

---

## What Is This?

GatherSpace is the backend API that powers an event discovery and booking platform — think of it as the server-side engine behind something like **Eventbrite or Meetup.com**.

It handles everything a real-world event platform needs:

- An **organizer** creates an event with a real venue location, ticket price, capacity, and category
- **Attendees** discover events near them using GPS coordinates — not city name string matching
- They **book tickets** — the system automatically tracks seat availability and booking status
- After attending, they **leave reviews** — the event's average rating recalculates automatically via a Mongoose post-save hook
- Organizers view **analytics** — revenue per event, bookings by date, top-performing categories — powered by MongoDB's aggregation pipeline

This is not a CRUD tutorial project. Every architectural decision here reflects how production systems are actually designed.

---

## Why This Was Built

Most backend portfolios show the same thing: a to-do API or a blog with endpoints that hit a database and return JSON. Any interviewer has seen it a hundred times.

GatherSpace was designed to demonstrate backend engineering skills that actually matter in production:

- **Schema design decisions** — knowing when to embed vs reference data, and being able to explain why
- **Geospatial querying** — a category of database capability that no tutorial covers but real applications depend on
- **Aggregation pipelines** — transforming and summarizing data at the database layer, not in application code
- **Event-driven data consistency** — using Mongoose middleware so the system keeps itself consistent without coupling controllers together
- **Production API patterns** — advanced filtering, sorting, field limiting, pagination, and route aliasing on every resource endpoint

---

## Business Problem It Solves

Event organizers face three real problems:

1. **Discovery is broken by geography** — listing "Chennai" as a city field means someone 200km away in Vellore can find the event. That is not discovery. GatherSpace stores venue coordinates as GeoJSON and lets users query events within a real radius in kilometers.

2. **Capacity management is manual** — most small platforms require organizers to manually count bookings. GatherSpace tracks available seats as a derived value — when a booking is confirmed, available seats update automatically.

3. **Trust signals are stale** — review averages that only update when the organizer remembers to click something are meaningless. GatherSpace recalculates the event's `ratingsAverage` and `ratingsQuantity` automatically every time a review document is saved or deleted, via a Mongoose static method triggered by a post-save hook.

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Runtime | Node.js 18+ | Non-blocking I/O for concurrent booking requests |
| Framework | Express.js | Minimal, flexible, industry standard |
| Database | MongoDB Atlas | Native GeoJSON support, flexible schema for events |
| ODM | Mongoose | Schema enforcement, middleware hooks, virtuals |
| Auth | JWT (access + refresh) | Stateless, scalable, no session storage needed |
| Validation | Mongoose validators + express-validator | Schema-level + request-level validation |
| Error Handling | Custom AppError + global handler | Operational vs programming error separation |
| Deployment | Railway | Zero-config Node.js deployment |
| API Testing | Postman | Full collection with environment variables |

---

## Data Architecture

### The Four Core Models

#### Event
The central entity. Stores everything about an event in one document — with a deliberate design decision:

```
Event {
  title, description, category, status,
  startDate, endDate,
  venue: {                        ← EMBEDDED (not referenced)
    name, address,
    location: {                   ← GeoJSON Point
      type: "Point",
      coordinates: [lng, lat]
    }
  },
  ticketPrice, capacity,
  organizer: ObjectId → User      ← REFERENCED (not embedded)
  ratingsAverage,                 ← Virtual / auto-calculated
  ratingsQuantity,                ← Auto-updated via hook
  availableSeats,                 ← Virtual: capacity - bookings
  slug                            ← Auto-generated pre-save
}
```

**Why embed venue but reference organizer?**
Venue details are always needed when fetching an event — embedding avoids an extra database round-trip on every request. An organizer, however, is an independent entity who might run 50 events — referencing them means their profile updates once and reflects everywhere, with no duplication.

#### User
```
User {
  name, email, password (bcrypt hashed),
  role: enum["attendee", "organizer", "admin"],
  passwordChangedAt, passwordResetToken
}
```

#### Booking
```
Booking {
  event: ObjectId → Event,
  user: ObjectId → User,
  tickets: Number,
  totalPrice: Number,
  status: enum["pending", "confirmed", "cancelled"],
  bookedAt: Date
}
```

#### Review
```
Review {
  event: ObjectId → Event,
  user: ObjectId → User,
  rating: Number (1–5),
  comment: String,
  createdAt: Date
}
```
A compound index on `{ event, user }` with `unique: true` ensures one review per attendee per event.

---

## Key Engineering Features

### 1. Geospatial Event Discovery
Events within a radius use MongoDB's `$geoNear` aggregation stage — real spherical distance math from GPS coordinates, not string matching on a city field.

```
GET /api/v1/events/within/15/center/-13.021,28.065/unit/km
GET /api/v1/events/distances/-13.021,28.065/unit/km
```

A `2dsphere` index on `venue.location` makes these queries fast at scale.

### 2. Aggregation Pipeline Analytics
Multi-stage MongoDB aggregation for real analytics — not application-layer loops.

```
GET /api/v1/events/stats
```

Returns: average rating, average price, min/max price, total events — grouped by category. Uses `$match`, `$group`, `$sort`, `$project` stages.

```
GET /api/v1/events/monthly-plan/:year
```

Returns: booking volume by month for business planning. Uses `$unwind`, `$group`, `$addFields`, `$sort`, `$limit`.

### 3. Automatic Rating Recalculation
When a review is saved or deleted, the event's `ratingsAverage` and `ratingsQuantity` update automatically — no controller code involved.

```javascript
// Mongoose static method on Review model
ReviewSchema.statics.calcAverageRatings = async function(eventId) {
  const stats = await this.aggregate([
    { $match: { event: eventId } },
    { $group: {
      _id: '$event',
      nRating: { $sum: 1 },
      avgRating: { $avg: '$rating' }
    }}
  ]);
  await Event.findByIdAndUpdate(eventId, {
    ratingsQuantity: stats[0].nRating,
    ratingsAverage: stats[0].avgRating
  });
};

ReviewSchema.post('save', function() {
  this.constructor.calcAverageRatings(this.event);
});
```

### 4. Advanced API Query Layer
Every collection endpoint supports the full query feature set through a reusable `APIFeatures` class:

```
GET /api/v1/events?category=tech&status=upcoming
GET /api/v1/events?price[gte]=500&price[lte]=2000
GET /api/v1/events?sort=-ratingsAverage,price
GET /api/v1/events?fields=title,venue,ticketPrice
GET /api/v1/events?page=2&limit=10
GET /api/v1/events/popular   ← alias: sort=-ratingsAverage, limit=5
```

### 5. Mongoose Middleware Used Throughout

| Hook | Model | What It Does |
|---|---|---|
| `pre('save')` | Event | Auto-generates slug from title |
| `pre('save')` | Event | Sets `status` based on date comparison |
| `pre('save')` | User | Hashes password with bcrypt before saving |
| `post('save')` | Review | Triggers `calcAverageRatings` on parent Event |
| `pre(/^find/)` | Event | Populates organizer field on all find queries |
| `pre('aggregate')` | Event | Excludes upcoming-only events from aggregation |

### 6. Virtual Properties

| Virtual | Model | Computed From |
|---|---|---|
| `availableSeats` | Event | `capacity - confirmedBookingsCount` |
| `isSoldOut` | Event | `availableSeats === 0` |
| `daysUntilEvent` | Event | `startDate - Date.now()` |
| `fullVenueAddress` | Event | `venue.name + ', ' + venue.address` |

---

## API Endpoints

### Events
```
GET    /api/v1/events                    Get all events (filter/sort/paginate)
POST   /api/v1/events                    Create event (organizer only)
GET    /api/v1/events/:id                Get single event
PATCH  /api/v1/events/:id               Update event (organizer/admin)
DELETE /api/v1/events/:id               Delete event (organizer/admin)
GET    /api/v1/events/popular            Top 5 highest-rated events (alias)
GET    /api/v1/events/stats              Aggregated stats by category
GET    /api/v1/events/monthly-plan/:year Bookings by month
GET    /api/v1/events/within/:dist/center/:latlng/unit/:unit
GET    /api/v1/events/distances/:latlng/unit/:unit
```

### Users & Auth
```
POST   /api/v1/auth/signup               Register new user
POST   /api/v1/auth/login                Login, returns JWT
POST   /api/v1/auth/refresh-token        Issue new access token
POST   /api/v1/auth/forgot-password      Send reset token to email
PATCH  /api/v1/auth/reset-password/:token
PATCH  /api/v1/auth/update-password      Update password (authenticated)
GET    /api/v1/users/me                  Get own profile
PATCH  /api/v1/users/update-me          Update own profile
```

### Bookings
```
GET    /api/v1/bookings                  Get all bookings (admin)
POST   /api/v1/bookings                  Create booking
GET    /api/v1/bookings/:id              Get single booking
PATCH  /api/v1/bookings/:id             Update booking status
DELETE /api/v1/bookings/:id             Cancel booking
GET    /api/v1/events/:eventId/bookings  All bookings for an event
GET    /api/v1/users/:userId/bookings    All bookings by a user
```

### Reviews
```
GET    /api/v1/reviews                   Get all reviews (admin)
POST   /api/v1/events/:eventId/reviews   Create review (attendees only, post-event)
GET    /api/v1/events/:eventId/reviews   Get reviews for an event
PATCH  /api/v1/reviews/:id              Update own review
DELETE /api/v1/reviews/:id              Delete review (owner/admin)
```

---

## Project Structure

```
gatherspace-api/
├── src/
│   ├── config/
│   │   └── db.js                  MongoDB Atlas connection
│   ├── models/
│   │   ├── Event.model.js         Schema + middleware + virtuals + statics
│   │   ├── User.model.js          Schema + bcrypt hooks + token methods
│   │   ├── Booking.model.js       Schema + post-save seat decrement
│   │   └── Review.model.js        Schema + calcAverageRatings static
│   ├── controllers/
│   │   ├── event.controller.js
│   │   ├── user.controller.js
│   │   ├── booking.controller.js
│   │   ├── review.controller.js
│   │   └── auth.controller.js
│   ├── routes/
│   │   ├── event.routes.js
│   │   ├── user.routes.js
│   │   ├── booking.routes.js
│   │   ├── review.routes.js
│   │   └── auth.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js     JWT verification + role guards
│   │   └── error.middleware.js    Global error handler
│   ├── utils/
│   │   ├── APIFeatures.js         Filter/sort/paginate/field-limit class
│   │   ├── AppError.js            Custom operational error class
│   │   └── catchAsync.js          Async error wrapper
│   └── app.js                     Express app setup
├── server.js                      Entry point + unhandled rejection handler
├── .env.example
├── .gitignore
└── package.json
```

---

## Running Locally

```bash
# 1. Clone the repo
git clone https://github.com/yaswantkumar33/gatherspace-api.git
cd gatherspace-api

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Fill in: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, PORT

# 4. Start development server
npm run dev

# API is now running at http://localhost:3000
```

### Environment Variables
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/gatherspace
JWT_SECRET=your-access-token-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRES_IN=7d
```

---

## Design Decisions & Trade-offs

**Why MongoDB over PostgreSQL for this project?**
Events have a natural document structure — a venue is always fetched with its event, never independently. MongoDB's native GeoJSON support and `2dsphere` indexing make geospatial queries first-class, not a bolted-on extension. The aggregation pipeline handles analytics that would require complex SQL CTEs. For a relational use case (users, roles, strict referential integrity), PostgreSQL would be the right call — see [DevBoard API](#) for that pattern.

**Why Mongoose over the native MongoDB driver?**
Schema enforcement at the application layer, built-in validation, virtual properties, and middleware hooks. The `pre('save')` and `post('save')` hooks are what make automatic slug generation and rating recalculation clean — without them, that logic would bleed into every controller.

**Why embed venue but reference organizer?**
Embed data that is always accessed together and has no independent existence. Reference data that is shared across multiple documents and needs to stay consistent in one place. A venue without its event is meaningless. An organizer is an independent User who can own many events.

**Why JWT with refresh tokens over sessions?**
Stateless auth scales horizontally without shared session storage. Short-lived access tokens (15min) limit the blast radius of a stolen token. Refresh tokens (7 days, stored securely) handle re-authentication without forcing the user to log in again.

---

## What's Next (v2)

- [ ] TypeScript migration — strict mode, typed Mongoose models
- [ ] Test suite — Supertest integration tests on all route groups
- [ ] Swagger/OpenAPI documentation
- [ ] Redis caching on high-traffic event listing endpoints
- [ ] Rate limiting per IP
- [ ] Email notifications via Nodemailer on booking confirmation

---

## Author

**Yash** — Backend Engineer  
GitHub: [@yaswantkumar33](https://github.com/yaswantkumar33)  
LinkedIn: [yaswant-webdeveloper](https://linkedin.com/in/yaswant-webdeveloper)
