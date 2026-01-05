# ProChat MicroSaaS Fast Boilerplate - Cursor AI Instructions

## Overview

This is a comprehensive Next.js boilerplate designed for rapidly building microSaaS applications. It provides a complete foundation with authentication, payments, database management, and integration capabilities for automation platforms.

**Documentation**: https://docs.microsaasfast.me/

## Technology Stack

### Core Framework

- **Next.js**: 14.2.25 - React framework with App Router
- **React**: 18.3.1 - UI library
- **TypeScript**: 5.x - Type safety

### Authentication & User Management

- **Clerk**: 5.7.1 - Authentication and user management
  - Documentation: https://clerk.com/docs
  - Provides sign-in, sign-up, user profiles, and session management

### Database & ORM

- **Prisma**: 5.16.2 - Database ORM and migrations
  - Documentation: https://www.prisma.io/docs
  - PostgreSQL database with automatic migrations
  - Database schema located in `prisma/schema.prisma`

### Payment Processing

- **Stripe**: 16.0.0 - Payment processing and subscriptions
  - Documentation: https://stripe.com/docs
  - Handles checkout sessions, subscriptions, and webhooks

### Email Services

- **Resend**: 4.0.0 - Email delivery service
  - Documentation: https://resend.com/docs
  - Used for transactional emails and customer communication

### UI & Styling

- **Tailwind CSS**: 3.4.16 - Utility-first CSS framework
  - Documentation: https://tailwindcss.com/docs
- **Radix UI**: 1.x - Headless UI components
  - Documentation: https://www.radix-ui.com/docs
- **DaisyUI**: 4.10.1 - Tailwind CSS component library
  - Documentation: https://daisyui.com/docs

### Automation Platforms Integration

- **Make (Integromat)**: API integration for workflow automation
  - Documentation: https://www.make.com/en/help
- **n8n**: Workflow automation platform
  - Documentation: https://docs.n8n.io/

### Additional Libraries

- **Axios**: 1.7.9 - HTTP client
- **Formik**: 2.4.6 - Form management
- **Yup**: 1.4.0 - Schema validation
- **React Hot Toast**: 2.4.1 - Toast notifications
- **Lucide React**: 0.408.0 - Icon library

## Environment Variables Configuration

Create a `.env.local` file in the root directory with the following variables:

### Database

```
DATABASE_URL="postgresql://username:password@localhost:5433/database_name"
```

- **Source**: PostgreSQL database connection string
- **Setup**: Create a PostgreSQL database and use the connection string format above

### Authentication (Clerk)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."
```

- **Source**: Clerk Dashboard → API Keys
- **Setup**: Create a Clerk application and copy the publishable and secret keys

### Payment Processing (Stripe)

```
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

- **Source**: Stripe Dashboard → Developers → API Keys
- **Setup**:
  - Create a Stripe account and get API keys
  - For webhook secret: Stripe Dashboard → Developers → Webhooks → Add endpoint → Copy signing secret

### Email Service (Resend)

```
RESEND_API_KEY="re_..."
```

- **Source**: Resend Dashboard → API Keys
- **Setup**: Create a Resend account and generate an API key

### OpenAI Integration

```
OPENAI_API_KEY="sk-..."
```

- **Source**: OpenAI Platform → API Keys
- **Setup**: Create an OpenAI account and generate an API key

### Make (Integromat) Integration

```
MAKE_API_KEY="your_make_api_key"
MAKE_TEAM_ID="your_team_id"
MAKE_API_URL="https://eu2.make.com/api/v2"
```

- **Source**: Make Dashboard → Settings → API
- **Setup**:
  - Generate API key in Make dashboard
  - Find team ID in Make dashboard settings
  - API URL is typically `https://eu2.make.com/api/v2`

### n8n Integration

```
N8N_API_KEY="your_n8n_api_key"
N8N_API_URL="http://localhost:5678/api/v1"
N8N_WEBHOOK_URL="http://localhost:5678/webhook"
```

- **Source**: n8n instance settings
- **Setup**:
  - Install and configure n8n instance
  - Generate API key in n8n settings
  - Configure webhook URL based on your n8n deployment

### WordPress Integration (Optional)

```
WP_REST_ENDPOINT="http://your-wordpress-site.com/wp-json"
```

- **Source**: WordPress site REST API endpoint
- **Setup**: Enable REST API on WordPress site and use the endpoint URL

## Stripe Integration & Webhooks

### Webhook Configuration

The webhook handler is located at `src/app/api/webhook/stripe/route.ts`

**Webhook Events Handled:**

- `checkout.session.completed` - Processes successful payments
- `checkout.session.expired` - Handles abandoned checkouts
- `customer.subscription.updated` - Manages subscription changes
- `customer.subscription.deleted` - Handles subscription cancellations
- `invoice.paid` - Processes successful invoice payments
- `invoice.payment_failed` - Handles failed payments

**Setup Instructions:**

1. Configure webhook endpoint in Stripe Dashboard: `https://yourdomain.com/api/webhook/stripe`
2. Set `STRIPE_WEBHOOK_SECRET` environment variable
3. Webhook automatically updates user subscription status in database
4. Sends confirmation emails via Resend

### Stripe Products Configuration

Configure products in `src/config.ts`:

```typescript
stripe: {
  products: [
    {
      type: 'subscription', // or 'one-time'
      title: 'Product Name',
      productId: 'prod_...',
      priceId: 'price_...',
      price: 25,
      features: [...]
    }
  ]
}
```

## Make (Integromat) Integration

### API Endpoints

- `src/app/api/(make)/scenarios/route.ts` - List available scenarios
- `src/app/api/(make)/scenarios/openAIAssistant/route.ts` - Clone and configure OpenAI assistant scenarios
- `src/app/api/(make)/active/route.ts` - Activate/deactivate scenarios
- `src/app/api/(make)/link/route.ts` - Manage webhook links

### Integration Process

1. **Authentication**: Uses `MAKE_API_KEY` and `MAKE_TEAM_ID`
2. **Scenario Cloning**: Creates copies of existing scenarios with user-specific configurations
3. **OpenAI Integration**: Automatically configures OpenAI connections with user API keys
4. **Webhook Management**: Creates and manages webhooks for user interactions
5. **Database Storage**: Stores project configurations in PostgreSQL

### Make API Usage

- **Base URL**: `https://eu2.make.com/api/v2`
- **Authentication**: Token-based with `Authorization: Token ${MAKE_API_KEY}`
- **Key Endpoints**:
  - `GET /scenarios` - List scenarios
  - `POST /scenarios` - Create new scenario
  - `POST /scenarios/{id}/start` - Activate scenario
  - `POST /scenarios/{id}/stop` - Deactivate scenario
  - `POST /connections` - Create API connections
  - `POST /hooks` - Create webhooks

## n8n Integration

### API Endpoints

- `src/app/api/(n8n)/workflows/openAIAssistant/route.ts` - Clone and configure OpenAI assistant workflows

### Integration Process

1. **Authentication**: Uses `N8N_API_KEY` for API access
2. **Workflow Cloning**: Creates copies of existing workflows with user-specific settings
3. **Credential Management**: Creates OpenAI credentials for each user
4. **Webhook Configuration**: Updates webhook paths for user isolation
5. **Workflow Activation**: Automatically activates cloned workflows

### n8n API Usage

- **Base URL**: Configured via `N8N_API_URL` (typically `http://localhost:5678/api/v1`)
- **Authentication**: API key in header `X-N8N-API-KEY`
- **Key Endpoints**:
  - `GET /workflows/{id}` - Get workflow details
  - `POST /workflows` - Create new workflow
  - `POST /workflows/{id}/activate` - Activate workflow
  - `POST /credentials` - Create credentials

### n8n Setup Requirements

1. **n8n Instance**: Deploy n8n instance (local or cloud)
2. **API Access**: Enable API access in n8n settings
3. **Webhook URL**: Configure `N8N_WEBHOOK_URL` for webhook endpoints
4. **Template Workflows**: Create source workflows with OpenAI assistant nodes

## Database Schema

### Key Models

- **Subscription**: User subscription data and Stripe integration
- **Project**: User projects with automation platform configurations
- **Audiences**: Email audience management for Resend

### Migration Management

```bash
npm run migrate-db  # Run database migrations
npx prisma generate # Generate Prisma client
```

## Development Commands

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run start      # Start production server
npm run lint       # Run ESLint
npm run migrate-db # Run database migrations
```

## Key Configuration Files

- `src/config.ts` - Main application configuration
- `prisma/schema.prisma` - Database schema
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.js` - Next.js configuration
- `docker-compose.yml` - Local development services (PostgreSQL, WordPress)

## Architecture Notes

- **App Router**: Uses Next.js 14 App Router for routing
- **Server Actions**: Implements server actions for form handling
- **API Routes**: RESTful API endpoints for external integrations
- **Middleware**: Authentication middleware for protected routes
- **Type Safety**: Full TypeScript implementation with strict typing
- **Component Library**: Modular component architecture with Radix UI primitives

---

## 🚨 Mandatory Database Provisioning (Required for All Apps)

Every project built with the **ProChat MicroSaaS Fast Boilerplate** must provision a PostgreSQL database before the application can run locally or in production.

The boilerplate depends on PostgreSQL for:
- Clerk authentication session/map storage
- Stripe subscription state
- Multi‑tenant project schemas
- Prisma system schema
- Dashboard access checks

Because of this, **Codex must ALWAYS provision the database** when initializing a new app.

### ✔ Required Script

Codex must run:

```
./scripts/provision-saas.sh <project-slug>
```

This script automatically:
- Creates the tenant schema (`tenant_<slug>`)
- Creates the Postgres user (`tenant_<slug>_user`)
- Grants privileges
- Writes the correct `DATABASE_URL` to `.env` and `.env.production`
- Syncs system schema via Prisma migrations
- Registers the environment with the MCP Bridge (for production DB access)

### ✔ Codex Automation Rules

Codex 5.1 must:

- **Always** execute the provisioning script for new projects.
- **Never** skip database provisioning.
- **Never** substitute SQLite, in‑memory, or alternative databases.
- **Never** invent its own connection strings.
- **Never** alter the Postgres provider or protocol.
- **Never** modify `systemPrisma.ts`, `prismaTenant.ts`, or tenant‑routing logic unless explicitly instructed.

For deeper details, Codex must reference:

```
/instructions/database-provisioning.md
```

## Codex 5.1 Operational Rules

The following rules ensure consistent, safe, low‑token, and non‑destructive behavior for Codex agents working within the ProChat MicroSaaS Fast Boilerplate. These rules apply to all future apps built using this boilerplate.

### 1. Architectural Safety
- Do not create new root‑level folders unless explicitly instructed.
- Do not modify or rename existing folders defined in the Appendix folder tree.
- Do not reorganize or refactor the boilerplate architecture.
- Always reference the folder tree before proposing edits.

### 2. Minimal Diff Discipline
- Only modify the files required to complete the explicit task.
- Avoid large rewrites; prefer surgical line‑level edits.
- Never regenerate full files unless the user explicitly commands it.

### 3. Reuse Over Recreation
- Always reuse existing libraries inside `/src/libs`, `/src/utils`, `/src/components`, etc.
- Never create a duplicate of an existing module (e.g., do not create “wpClient.ts” if “wp.ts” exists).
- Extend existing functionality rather than replacing it.

### 4. Protected Areas — Do Not Modify
Codex must not modify the following unless the user explicitly instructs otherwise:
- Authentication (Clerk)
- Billing (Stripe)
- Email (Resend)
- Database core files (`prisma/`, Prisma client helpers)
- Automation integrations (`/src/app/api/(make)` and `(n8n)`)
- SEO & blog engine
- Global components and layout
- The entire instructions folder (except when explicitly asked)

### 5. Dependency Safety
- Do not install new dependencies.
- Do not upgrade existing dependencies.
- Do not remove dependencies.
- Do not introduce new frameworks or architectural patterns.

### 6. Token Efficiency
- Avoid unnecessary explanations inside code changes.
- Minimize context usage by focusing strictly on the task.
- Use compact diffs and avoid rewriting JSON, schemas, or configs entirely.

### 7. Multi‑tenant Awareness
- Respect existing tenant utilities like `getTenantFromRequest.ts` and `prismaTenant.ts`.
- Do not modify multi‑tenant logic unless explicitly told to.

### 8. UI & Routing Rules
- All new dashboard features belong under `/src/app/dashboard`.
- All new public features belong under `/src/app`.
- All new API endpoints belong under `/src/app/api`.
- All styling must follow Tailwind + shadcn UI conventions already established.

### 9. Confirm When Unsure
- If the task cannot be performed safely under these constraints, Codex must ask the user for clarification instead of guessing.

---

## Feature Placement Guide (App‑Agnostic)

This boilerplate supports rapid shipping of microSaaS applications. The following placement guide defines where Codex should place new features for any future app.

### Frontend Pages
- Public pages: `/src/app/...`
- Auth pages: `/src/app/sign-in`, `/src/app/sign-up`
- Protected dashboard pages: `/src/app/dashboard/...`

### API Endpoints
- `/src/app/api/...` — All new backend logic.
- Group related endpoints under a folder (e.g., `/api/myfeature/...`).

### Reusable Logic
- Place helpers in `/src/libs`.
- Place utilities in `/src/utils`.
- Place UI components in `/src/components`.

### Backend Integrations
- Extend `/src/libs/wp.ts`, `/src/libs/prisma.ts`, `/src/libs/resend.ts`, etc.
- Never create parallel versions of existing libs.

### Database
- Modify `prisma/schema.prisma` only when instructed.

---

## “Do Not Touch” Rules (App‑Independent)

Codex must avoid modifying these areas unless the user gives explicit permission:

### Authentication
- `/src/libs/safeClerk.tsx`
- `/src/libs/safeClerkServer.ts`
- `/src/app/sign-in`
- `/src/app/sign-up`

### Billing
- `/src/app/api/stripe/*`
- Product definitions in `src/config.ts`

### Automation Systems
- `/src/app/api/(make)`
- `/src/app/api/(n8n)`

### Global Components & SEO
- `/src/components/*`
- `/src/libs/seo.tsx`
- Blog system under `/src/app/blog`

### System‑Level Files
- `next.config.js`
- `tailwind.config.ts`
- `tsconfig.json`
- Deployment & Docker files unless asked

---

## Codex Behavior Guidelines

### For All Future Apps:
- Fit new features into the existing boilerplate.
- Maintain compatibility with Clerk, Stripe, and Prisma.
- Respect the minimal surface area principle.
- Prioritize rapid MVP delivery (48‑hour target).
- Keep app logic isolated from boilerplate core.
- Use small, isolated commits.

---

This completes the universal enhancement of `structure.md` while keeping it boilerplate‑agnostic and aligned with the ProChat MicroSaaS Fast Boilerplate architecture.
