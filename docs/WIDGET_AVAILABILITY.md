# Widget Availability Gating

This documents the safe way to hide or disable `proleadsai-custom-element` when an organization has no credits remaining.

## Goal

The iframe/custom-element can hide itself client-side for UX, but the actual enforcement must stay in `proleadsai-better-auth`.

That means:

- The widget may decide not to render.
- The widget may decide not to send requests.
- The API must still reject `roof-estimate` and `forms/submit` when credits are exhausted.

## Server-Side Source Of Truth

The public widget endpoints already consume credits:

- `GET /api/organization/:orgId/roof-estimate`
- `POST /api/organization/:orgId/forms/submit`

Both rely on `consumeCredits()` in [`server/utils/credits.ts`](/Users/red/Sites/migrate/proleadsai-better-auth/server/utils/credits.ts).

When an org is out of credits, `consumeCredits()` throws `403` with an out-of-credits message. This is the real protection against UI bypasses.

## Public Status Endpoint

For embed UX, the app exposes:

- `GET /api/organization/:orgId/widget-status`

Response shape:

```json
{
  "widgetEnabled": false,
  "reason": "out_of_credits",
  "message": "This widget is currently unavailable because this organization has no credits remaining.",
  "remaining": 0,
  "limit": 60,
  "plan": "free",
  "periodEnd": "2026-04-30T00:00:00.000Z"
}
```

Use this endpoint only to decide whether the widget should render. Do not treat it as enforcement.

## Custom Element Flag

`proleadsai-custom-element` supports:

```html
<roof-estimator
  org-id="YOUR_ORG_ID"
  api-url="https://app.proleadsai.com/api"
  disable-when-unavailable="true"
></roof-estimator>
```

Behavior:

- The widget checks `widget-status` before rendering.
- If unavailable, it renders nothing.
- If an API request later returns out-of-credits, the widget marks itself unavailable and stops future client-side sends.

## Recommendation

Proper setup is:

1. Hide or dismiss the iframe/custom element client-side for UX.
2. Keep all credit enforcement in `proleadsai-better-auth`.
3. Never rely on client-side hiding as the only guard.

That gives you the behavior you want without trusting the browser.
