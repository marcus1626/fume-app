# Fume's sign-in and invitation emails

PROPOSED 26 Oct 2026. These are Supabase Auth's emails in Fume's look: 600 px tables, inline styles, palette hex
only, an Ink pill button and the Ink lockup on Porcelain. They follow the rules of Fume's email template
(Fume-Brand `templates/email`).

| File | Supabase Auth email | Subject |
| --- | --- | --- |
| `magic-link.html` | Magic Link, and Confirm signup | `Your sign-in link for Fume` |
| `invite.html` | Invite user | `{{ .Data.inviter_name }} invited you to {{ .Data.brand_name }} on Fume` |

`magic-link.html` serves both sign-in emails: Supabase sends "Confirm signup" instead of "Magic Link" the first time
an invited address signs in by email, and both are confirmed the same way (`type=email`).

## What they do

- **The button opens Fume's confirm page** (`{{ .RedirectTo }}/auth/confirm?token_hash=…&type=…`). The person signs
  in only when they press the button there. A mail scanner that opens every link (common at companies) can no longer
  use the link up, which is Supabase's own advice for this problem. `{{ .RedirectTo }}` is the app the person asked
  from (its origin), so a preview and the live app each get their own links; Supabase Auth falls back to the Site URL
  when the address is not on its allow list.
- **The sign-in email also carries the 6-digit code** (`{{ .Token }}`) for signing in on another device. "Check your
  email" asks for it when the app is built with `VITE_AUTH_CODE=on`. Turn that on once this email is in Supabase.
- **The invitation names who invited and to which brand** (`data: { inviter_name, brand_name }`). The confirm page
  says "Join LYSNE on Fume" with a "Join LYSNE" button.

## Putting them in

1. In Supabase, go to Authentication › Emails. Paste `magic-link.html` into Magic Link and into Confirm signup, and
   `invite.html` into Invite user, each with its subject.
2. Check the Auth settings:
   - **Email OTP length:** 6 (the project had 8). The code field has six slots.
   - **Email OTP expiration:** 3600 s. The emails say "within the hour".
   - **Redirect URLs:** every address the app runs on (the live app, the previews, localhost).
3. **Send email through Resend** (Authentication › SMTP; set up 27 Oct). Without it Supabase sends two emails an
   hour, and only to the members of the Supabase organisation.
4. The logo loads from the public edge function `email-logo` (`supabase/functions/email-logo`):
   the Ink lockup by default and the Paper lockup with `?c=paper`. The app's previews sit behind Vercel's login, so the
   logo cannot come from `{{ .SiteURL }}`. Gmail's apps darken light backgrounds but leave images alone, so in Gmail
   only (`u + .body`) the templates show the Paper lockup blended with `mix-blend-mode: difference`: near Ink on a
   light background, near Paper on a dark one. Other inboxes keep the Ink logo (the emails declare light only).
5. Turn on `VITE_AUTH_CODE=on` in Vercel.

## Sending invitations

Settings › Team › Invite someone calls the edge function `invite` (`supabase/functions/invite`). It calls
`public.invite_member` as the person inviting, which decides who may invite (the brand's owner, Fume's account
manager on the brand, an admin) and keeps the invitation. Then the function sends the email with the service role:

```ts
auth.admin.inviteUserByEmail(email, { data: { inviter_name, brand_name }, redirectTo: site })
```

This creates the account at once (`app.on_new_user` turns the invitation into the membership). Until the person has
said who they are ("About you"), the team lists them as invited. Someone who already uses Fume gets no email: the
brand is in their list the next time they open Fume. If the invitation link has stopped working, the person can still
sign in with Google or an email code.

Deploy it with `verify_jwt` off: the function asks Supabase Auth who the token belongs to, and the database command
decides the rest. Its tests run without Supabase: `deno test supabase/functions/invite/` (from a folder without
`package.json`, or with `"nodeModulesDir": "none"`).

The invitation's text is written for a brand's own people ("you approve what goes out"). Supabase has one invite
email, so when Fume's or an agency's people are invited the same way, add a `kind` to `data` and branch the text with
`{{ if eq .Data.kind "agency" }}…{{ end }}`.

## How they were checked

Rendered with sample values at 600 px and 390 px. Every colour is a palette value (Porcelain, the Ink scale and the
tertiary text colour), as the email template's build requires. The UI gate (`fume_check`) flags the hex values and
px sizes, because it is written for the app's CSS; an email cannot use CSS variables.
