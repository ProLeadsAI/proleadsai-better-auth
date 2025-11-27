## NuxSaaS (Customized Fork)

Very small Nuxt-based SaaS starter I’m using for my own project.

[ADD SCREENSHOT: main dashboard]

### Features (What This Starter Actually Does)

- **Billing & Plans**  
  - Pro plan with monthly / yearly billing.  
  - **Legacy pricing aware**: you can raise prices for new customers while existing subscriptions **stay locked on their original (legacy) price**. When someone on a legacy plan downgrades, a warning explains that coming back later will use the newer, more expensive plan.  
  - Switching from monthly to yearly moves users onto the current standard yearly price.  
  - **Stripe-only**: billing is implemented against Stripe subscriptions/prices and expects Stripe webhooks to keep local subscription state in sync.

- **Organizations & Limits**  
  - First team gets **one free organization**.  
  - Every additional organization requires its own Pro subscription.  
  - Good for “workspace per client” / “workspace per brand” setups.

- **Seats, Members & Invites**  
  - Pro plan is seat-based: base plan includes 1 seat, extra members cost per-seat.  
  - Owners/Admins can add/remove seats and preview the new price before confirming.  
  - Invitation links work for both **new** and **existing** users:  
    - If a user signs up from an invite, they land directly in the invited org instead of a confusing default personal team. 
    - If they already have an account, they can click the invite link any time to join the org.

[ADD SCREENSHOT: billing page with downgrade warning + seat controls]

- **Referrals (Users & Orgs)**  
  - Basic tracking hooks for who referred a **user** and/or an **organization** (e.g. for attribution, rewards, or analytics).  
  - Can be extended to payouts or dashboards later.

- **Timezone Switcher**  
  - UI support for choosing a timezone so billing dates, trials, and activity timestamps make sense for the user (not just the server).  
  - Helpful when you have globally distributed teams.

[ADD SCREENSHOT: settings / profile with timezone selector]

- **Roles & Permissions**  
  - **Owner**: full control over org, billing, members, and dangerous actions.  
  - **Admin**: manage members and settings, but typically less billing power than the owner.  
  - **Member (read-only / limited)**: can use the product inside the org but cannot touch billing or sensitive admin actions.

- **Auth & Org Handling (Better Auth style)**  
  - Most auth, organization, and subscription flows are implemented the “Better Auth way”, using its primitives and conventions.  
  - **Exception:** API keys are wired using metadata on users/orgs to associate keys with organizations where Better Auth doesn’t natively handle org-scoped API keys.

[ADD SCREENSHOT: members page showing roles (owner/admin/member)]

### Stack

- Nuxt 4 + Vue 3 + TypeScript
- Better Auth
- PostgreSQL + Drizzle ORM + Cloudflare Hyperdrive
- Stripe-based billing with seats and plan versions

### Getting Started

```bash
cp .env.example .env   # Fill in env vars (database, Stripe, auth, etc.)
pnpm install
pnpm run db:generate
pnpm run db:migrate
pnpm run dev -o
```

For production, build and serve:

```bash
npx nuxthub deploy
```

### Admin & Management Features

- Delete team / leave team flows (tied to **owner/admin/member** roles, with safety checks if you’re the last owner).
- User settings: API keys per user or per organization for external integrations.
- User settings: session management UI (see active sessions/devices, revoke sessions).
- Admin panel tools: impersonate users for support, soft-ban or restrict abusive accounts.

---

Inspired by the original NuxSaaS project: https://github.com/NuxSaaS/NuxSaaS

### License

MIT. See [LICENSE](LICENSE).

Documentation coming soon – if there’s interest, I’ll prioritize writing deeper docs and examples.
