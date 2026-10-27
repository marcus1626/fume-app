# Fume's sign-in and invitation emails

PROPOSED 26 Oct 2026. These are Supabase Auth's emails in Fume's look: 600 px tables, inline styles, palette hex
only, an Ink pill button and the Ink lockup on Porcelain. They follow the rules of Fume's email template
(Fume-Brand `templates/email`).

| File | Supabase Auth email | Subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link | `Your sign-in link for Fume` |
| `invite.html` | Invite user | `{{ .Data.inviter_name }} invited you to {{ .Data.brand_name }} on Fume` |

## What they do

- **The button opens Fume's confirm page** (`/auth/confirm?token_hash=…&type=…`). The person signs in only when they
  press the button there. A mail scanner that opens every link (common at companies) can no longer use the link up,
  which is Supabase's own advice for this problem.
- **The sign-in email also carries the 6-digit code** (`{{ .Token }}`) for signing in on another device. "Check your
  email" asks for it when the app is built with `VITE_AUTH_CODE=on`. Turn that on once this email is in Supabase.
- **The invitation names who invited and to which brand** (`data: { inviter_name, brand_name }`). The confirm page
  says "Join LYSNE on Fume" with a "Join LYSNE" button.

## Putting them in (Marcus or the MVP thread)

1. In Supabase, go to Authentication › Emails › Magic Link. Paste `magic-link.html` and set the subject.
2. Do the same for Invite user with `invite.html`.
3. Check the Auth settings:
   - **Site URL:** the app's public address.
   - **Email OTP length:** 6.
   - **Email OTP expiration:** 3600 s. The emails say "within the hour".
4. Make the logo load. It comes from `{{ .SiteURL }}/email/fume-lockup-horizontal-ink@2x.png`. `app/middleware.ts`
   lets `/email/` through without the preview password, but a deployment behind Vercel's own login will still block
   it. Until there is a public address, inboxes show the alt text "Fume".
5. Turn on `VITE_AUTH_CODE=on` in Vercel.

## Sending invitations (not built yet)

Fume is invitation-only: an `invitations` row comes first. To send the email, a server-side step (an Edge Function
with the service role) calls:

```ts
auth.admin.inviteUserByEmail(email, { data: { inviter_name, brand_name }, redirectTo: SITE_URL })
```

This creates the account at once (`app.on_new_user` turns the invitation into access). If the invitation link has
stopped working, the person can still sign in later with Google or an email code.

The invitation's text is written for a brand's own people ("you approve what goes out"). Supabase has one invite
email, so when Fume's or an agency's people are invited the same way, add a `kind` to `data` and branch the text with
`{{ if eq .Data.kind "agency" }}…{{ end }}`.

## How they were checked

Rendered with sample values at 600 px and 390 px. Every colour is a palette value (Porcelain, the Ink scale and the
tertiary text colour), as the email template's build requires. The UI gate (`fume_check`) flags the hex values and
px sizes, because it is written for the app's CSS; an email cannot use CSS variables.
