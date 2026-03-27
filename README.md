# Aura (微光) - AI Emotional Companion

An AI-powered emotional companion app that helps users relax and fall asleep through personalized character conversations.

## Features

- **AI Character System** - Three unique AI companions with distinct personalities
  - 妩媚御姐 (Charming Sister) - Mature, caring, affectionate
  - 甜美少女 (Sweet Girl) - Lively, cute, positive energy
  - 清澈邻家弟弟 (Clear Brother) - Warm, sincere, supportive

- **Voice Interaction** - Text input with natural voice synthesis (MiniMax TTS)
- **Character Backgrounds** - Immersive full-screen backgrounds per character
- **Background Music** - Ambient sounds for relaxation

## Tech Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js (Email/Password + WeChat OAuth)
- **Payment:** ZPAY integration (Alipay, WeChat Pay)
- **AI/ML:** MiniMax LLM + TTS
- **Cloud Services:** Tencent COS (storage), Tencent ASR (speech recognition)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- MiniMax API credentials
- Tencent Cloud credentials (for COS/ASR)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/JefferXia/ai-app.git
cd ai-app
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Configure the required environment variables in `.env.local`:
- `POSTGRES_URL` - PostgreSQL connection string
- `AUTH_SECRET` - NextAuth secret
- `MINIMAX_API_KEY` - MiniMax API key
- `ZPAY_PID`, `ZPAY_KEY` - Payment credentials
- `WECHAT_APP_ID`, `WECHAT_APP_SECRET` - WeChat OAuth

5. Set up the database:
```bash
pnpm db:push
```

6. Start the development server:
```bash
pnpm dev
```

Visit [localhost:3000](http://localhost:3000) to see the app.

## Documentation

- [CLAUDE.md](./CLAUDE.md) - Project instructions for AI assistants
- [README-PAYMENT.md](./README-PAYMENT.md) - Payment system documentation
- [docs/aura-agent-prd.md](./docs/aura-agent-prd.md) - Aura agent system PRD

## License

MIT