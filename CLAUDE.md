# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**极效火眼** is a streamlined AI platform featuring:
- Basic user authentication (email/password + WeChat OAuth)
- Payment system with ZPAY integration
- User account management with invite codes
- SMS verification system

Tech Stack: Next.js 15 (App Router), PostgreSQL (Prisma), NextAuth.js, ZPAY payment gateway

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Lint code
pnpm lint

# Database operations
pnpm db:generate  # Generate Prisma client
pnpm db:push      # Push schema changes to database
```

## Database Management

The project uses **PostgreSQL** with both Drizzle ORM (new) and Prisma (legacy). Key database operations:

```bash
# Generate Drizzle client
npx drizzle-kit generate

# Push Drizzle schema
npx drizzle-kit push

# Prisma operations
npx prisma generate
npx prisma db push
```

Primary database schema files:
- `db/schema.ts` - Drizzle schema (active)
- `prisma/schema.prisma` - Prisma schema (legacy, some models still referenced)

## Key Architecture

### App Structure (`app/`)
```
app/
├── (auth)/              # Authentication pages (login, register)
├── api/                 # API routes
│   ├── payment/         # ZPAY payment endpoints
│   ├── recharge/        # Token/point recharge
│   ├── sms/             # SMS verification
│   ├── user/            # User management
│   ├── invite/          # Invite code system
│   └── wx-login/        # WeChat OAuth
├── profile/             # User profile pages
│   ├── account/         # Account information
│   └── invite/          # Invite management
├── recharge/            # Payment/top-up pages
└── history/             # User activity history
```

### Core Services (`lib/`)
- `lib/payment.ts` - ZPAY payment processing
- `lib/prisma.ts` - Prisma database client
- `lib/db.ts` - Drizzle database client (legacy)
- `lib/wechat.ts` - WeChat API integration
- `lib/invite.ts` - Invite code management

### Database Models (Prisma)
Key models in `prisma/schema.prisma`:
- **User** - User accounts with WeChat OAuth, invite codes
- **Account** - Token-based account system (gift/recharge/earned tokens)
- **PaymentRecord** - ZPAY payment transactions
- **AudioWork** - Generated audio content
- **Video** - Video analysis/results
- **WeiRecord** - Product analysis records
- **InviteRecord** - Referral tracking

### API Routes Pattern
Most API routes follow a consistent pattern:
- Authentication via `auth()` from NextAuth
- Drizzle queries via `db/queries.ts`
- Response format: `{ success: boolean, data?: any, error?: string }`

## External Services & APIs

The application integrates with multiple external services (see `.env.local` for keys):

### AI Services
- **OpenAI** - Text generation (via ai-search.fun endpoint)
- **Minimax** - Audio generation
- **Groq** - LLM inference
- **Reecho** - TTS (async generation)

### Payment
- **ZPAY** - Multi-payment gateway (alipay, wxpay, qqpay, tenpay)

### Cloud Services
- **Tencent COS** - File storage
- **Tencent ASR** - Speech recognition
- **Vercel Postgres** - Database hosting

### Communication
- **Twilio** - SMS verification
- **Volc SMS** - SMS service (Chinese market)

### WeChat Integration
- OAuth login (see `app/api/wx-login/route.ts`)
- App ID/Secret in `.env.local`

## Authentication System

NextAuth.js with two providers:
1. **Credentials** - Email/password authentication
2. **WeChat** - OAuth via custom implementation

Auth configuration: `app/(auth)/auth.config.ts`
Session strategy: JWT (default)

## Cursor Rules

The project follows these development principles (`.cursorrules`):
- Prefer incremental progress over big bangs
- Study existing code before implementing
- Choose pragmatic solutions over dogmatic rules
- Favor clear, boring code over clever tricks
- Each function/class should have single responsibility
- Avoid premature abstractions
- Use dependency injection, not singletons
- Fail fast with descriptive messages
- Prioritize testability, readability, consistency, simplicity, reversibility

## Common Development Tasks

### Adding a New API Route
1. Create route in `app/api/{feature}/route.ts`
2. Use `auth()` for authentication
3. Import database client from `lib/prisma.ts`
4. Follow response pattern: `{ success, data, error }`
5. Add proper error handling and validation (Zod recommended)

### Working with Database
The project uses Prisma ORM:
- Schema: `prisma/schema.prisma`
- Client: `lib/prisma.ts`
- Generate client: `npx prisma generate`

### Payment Integration
ZPAY integration is in `lib/payment.ts`:
- Create: `/api/payment/create`
- Query: `/api/payment/query`
- Refund: `/api/payment/refund`
- Callbacks: `/api/payment/notify`, `/api/payment/return`

### WeChat OAuth Flow
1. User clicks WeChat login
2. Redirect to `app/api/wx-login/route.ts`
3. Exchange code for access token
4. Fetch user info and create/login user
5. Generate invite code if new user

## Environment Variables

Key environment variables (`.env.local`):
```bash
# Database
POSTGRES_URL=postgresql://...

# Authentication
AUTH_SECRET=...
NEXT_PUBLIC_API_URL=https://sv.topmind.video/api

# AI Services
OPENAI_API_KEY=...
MINIMAX_API_KEY=...
GROQ_API_KEY=...
REECHO_API_KEY=...

# Payment
ZPAY_PID=...
ZPAY_KEY=...
ZPAY_NOTIFY_URL=https://ai.topmind.video/api/payment/notify
ZPAY_RETURN_URL=https://ai.topmind.video/api/payment/return

# Cloud Services
COS_SECRETID=...
COS_SECRETKEY=...
ASR_SECRETID=...
ASR_SECRETKEY=...

# Social Auth
WECHAT_APP_ID=...
WECHAT_APP_SECRET=...
```

## Important Notes

1. **ORM**: Project uses Prisma ORM exclusively.

2. **Payment Security**: ZPAY payment callbacks must verify signatures before processing.

3. **WeChat OAuth**: Redirect URI must be whitelisted in WeChat app settings.

4. **Database Indexes**: Several composite indexes exist for performance. Check `prisma/schema.prisma` before adding new queries.

5. **SMS Services**: Both Twilio and Volc SMS are configured for different use cases.

## Testing Payment Integration

For local testing of ZPAY:
1. Use ngrok to expose local server: `ngrok http 3000`
2. Update ZPAY_NOTIFY_URL and ZPAY_RETURN_URL in .env.local
3. Use small test amounts (0.01 CNY)
4. Test callbacks must return "success" for async notifications

## Deleted Modules

The following modules have been removed to simplify the codebase:
- Content creation features (text, audio, video)
- PromptKeeper marketplace
- AI integration services
- Product analysis features
- Sound list and hot topics
- Member upgrade system
