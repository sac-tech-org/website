# SacTech website

The community website for SacTech. It is a Next.js application deployed on Netlify, backed by Netlify Database and Drizzle ORM, with Better Auth providing email/password accounts and role-based permissions.

The event flow is deliberately moderated:

1. A person creates an account at `/auth` and verifies their email through a Resend-delivered link, or signs in to an existing account.
2. From `/account`, they open `/events/submit` and send an event for review. New events always start as `pending`, and the account page tracks their status.
3. A SacTech approver or admin reviews the queue at `/admin/events` and approves or rejects each event.
4. Only `approved` events are returned to the public `/events` calendar.

Authorization and status checks are enforced on the server. Hiding a privileged link or changing a form value in the browser is not enough to bypass them.

### Roles and permissions

Better Auth uses three application roles:

| Role        | Permissions                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submitter` | Default for new accounts. Can submit events and cancel only events owned by that account. Cannot review events or manage users.                         |
| `approver`  | Includes submitter capabilities, can approve or reject pending events, and receives the daily approval reminder while verified and not actively banned. |
| `admin`     | Includes every approver capability, including reminders, and can also list users, assign configured roles, and ban or unban other users.                |

The roles are deliberately least-privilege, with Admin defined as a strict
superset of Approver.

## Stack

- Next.js 16 App Router and React 19
- Netlify's Next.js runtime, configured by `netlify.toml`
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/), a managed Postgres database
- [Drizzle ORM's native Netlify Database driver](https://orm.drizzle.team/docs/connect-netlify-db)
- [Better Auth](https://better-auth.com/docs/integrations/next) with its Drizzle adapter, email/password authentication, and Admin plugin
- [Resend](https://resend.com/docs/send-with-better-auth) with [React Email](https://react.email/) templates for account messages and reviewer reminders

Netlify Database is currently available only on Netlify's **Credit-based plans**. Database compute and bandwidth consume credits; review the current [billing and limits documentation](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/) before enabling it for the project.

## Local development

### Prerequisites

- Node.js 24 (`.nvmrc` pins the project to Node.js 24.19.0)
- Corepack and pnpm 10.33
- A supported local platform for Netlify Database

Install dependencies:

```sh
corepack enable
pnpm install
```

Create a local environment file:

```sh
cp .env.example .env.local
openssl rand -base64 32
```

Put the generated value in `BETTER_AUTH_SECRET`. Better Auth requires a high-entropy secret of at least 32 characters. The local values should look like this:

```dotenv
BETTER_AUTH_SECRET=<generated-secret>
BETTER_AUTH_URL=http://localhost:8888
BETTER_AUTH_ALLOWED_HOSTS=localhost:3000,localhost:8888,127.0.0.1:3000,127.0.0.1:8888

# Both values stay on the server. Use a sender on your verified Resend domain.
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=SacTech <accounts@mail.example.com>

# Optional Slack/community invitation used by the existing site UI.
NEXT_PUBLIC_INVITE_LINK=
```

Do not add `NETLIFY_DB_URL` to this file. Netlify supplies it to the application automatically.

Start the app in the first terminal:

```sh
pnpm dev
```

This runs `netlify dev`, which starts the local Postgres-compatible database and proxies the Next.js server at <http://localhost:8888>. Keep it running. Directly running `pnpm dev:next` bypasses the Netlify development environment and therefore does not provide the database connection.

In a second terminal, apply the committed migrations to the running local database:

```sh
pnpm db:migrate
pnpm db:status
```

The local database does not apply migrations automatically. Run `pnpm db:migrate` after cloning, after pulling migrations, and after generating a new migration. The command only targets the local database by default; Netlify applies remote migrations during deploys.

## Environment variables

| Variable                    | Where                   | Purpose                                                                                                                                                       |
| --------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`        | Local and Netlify       | Private, high-entropy secret used by Better Auth for encryption and hashing. Never prefix it with `NEXT_PUBLIC_`.                                             |
| `BETTER_AUTH_URL`           | Local; Netlify override | Optional explicit canonical fallback. Normal Netlify deploys derive this from Netlify's read-only `URL` variable.                                             |
| `BETTER_AUTH_ALLOWED_HOSTS` | Local; Netlify override | Optional comma-separated host allowlist. Setting it replaces the automatic Netlify host list; values do not include URL paths.                                |
| `NETLIFY_DB_URL`            | Supplied by Netlify     | Database connection string selected for the local, preview, or production database branch. Do not commit or manually configure it for normal app execution.   |
| `RESEND_API_KEY`            | Local and Netlify       | Private Resend key used only by the server to send account and approval-reminder emails. A key restricted to sending from the configured domain is preferred. |
| `RESEND_FROM_EMAIL`         | Local and Netlify       | Sender in `Name <address@example.com>` or plain-address form. Its domain must be verified in Resend.                                                          |
| `NEXT_PUBLIC_INVITE_LINK`   | Optional                | Public community invitation displayed by the site. It is intentionally browser-visible.                                                                       |

### Authentication email delivery

Better Auth sends signup verification and password-reset messages through Resend. Before exercising either flow:

1. Add and verify a sending domain in Resend. A dedicated sending subdomain keeps transactional-email DNS separate from other mail; keep open and click tracking off for security messages.
2. Create a Resend API key with sending access scoped to that domain.
3. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` in `.env.local` and in every Netlify deploy context where accounts should work.

The sender is read at delivery time, so builds, schema generation, and other commands do not need live Resend credentials. Missing or invalid delivery configuration is logged by the server without revealing whether an account exists. Better Auth generates and validates the one-hour links; the application sends those URLs unchanged so local, preview, and production origins continue to follow the auth host policy above. React Email templates live in `emails/` and include both styled markup and plain-text alternatives.

Preview the React Email templates without sending mail at <http://localhost:3001>:

```sh
pnpm email:dev
```

### Daily approval reminders

The `send-admin-approval-reminders` Netlify Scheduled Function checks the
moderation queue once a day. It sends a private digest to each verified,
effectively non-banned account carrying the `approver` or `admin` role only when
at least one non-canceled event still has `pending` status. A pending event
remains in subsequent digests until it is approved, rejected, or canceled.

The checked-in cron expression is `0 15 * * *`. Netlify evaluates schedules in
UTC, so the function runs at 7:00 AM Pacific Standard Time and 8:00 AM Pacific
Daylight Time. The one-hour seasonal shift is intentional. Automatic scheduled
runs happen only for published production deploys; deploy previews and branch
deploys do not run the cron automatically.

The function uses Netlify's supplied production `URL` to build the authenticated
`/admin/events` review link and Netlify Database's supplied `NETLIFY_DB_URL` to
read the queue. Give `RESEND_API_KEY` and `RESEND_FROM_EMAIL` access to the
**Functions** scope in Netlify. It sends at most the ten oldest pending-event
summaries in each email, includes the full pending count, and uses a Pacific-date
Resend idempotency key so a same-day retry does not deliver the same digest
twice.

After deploying, use **Run now** on the function's Netlify page to exercise it
without waiting for the next cron tick. A manual production run can send real
email; same-day retries reuse the idempotency key. For a local invocation while
`pnpm dev` is running, use:

```sh
pnpm exec netlify functions:invoke send-admin-approval-reminders
```

### Production and deploy-preview hosts

Normal Netlify deployments do not need either URL variable. At runtime, the app uses Netlify's read-only `URL`, `SITE_NAME`, and `SITE_ID` values to configure:

- the primary custom or `netlify.app` hostname from `URL`;
- the site's default `SITE_NAME.netlify.app` hostname; and
- the site-scoped `*--SITE_NAME.netlify.app` pattern for deploy previews, branch deploys, and unique deploy URLs.

Better Auth validates the hostname of each request against that list and uses the matching preview hostname dynamically. The `URL` value is the canonical fallback for request-less server API calls. The build-only `DEPLOY_PRIME_URL` and `DEPLOY_URL` hosts are also added when present, but runtime preview support does not depend on them.

Do **not** use `*.netlify.app`: Better Auth automatically adds allowed hosts to its trusted origins, so that broad pattern would trust unrelated and potentially hostile Netlify sites.

Set `BETTER_AUTH_URL` only when an explicit canonical fallback should take precedence over Netlify's `URL`. Set `BETTER_AUTH_ALLOWED_HOSTS` for a nonstandard host policy, additional custom-domain aliases, or a custom automatic deploy subdomain. It is an override, so include every required host—including `SITE.netlify.app` and `*--SITE.netlify.app` if previews should continue to work.

## Schema and migrations

The Drizzle configuration reads both schemas:

- `db/auth-schema.ts` contains Better Auth's users, sessions, accounts, and verification records.
- `db/schema.ts` contains the SacTech event, moderation, and optional recurrence models.

### Recurring event rules

A recurring event has one `event_recurrence` row whose primary key is the parent event ID. An event without that row is a one-time event. Deleting the event deletes its recurrence row automatically.

| Rule               | Persisted constraint                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frequency          | `day`, `week`, `month`, or `year`, repeated every `interval` units; the interval must be from 1 through 99.                                             |
| Weekly             | `weekdays` is required, must contain 1–7 integers, and may contain only `0` (Sunday) through `6` (Saturday). Other frequencies require it to be `null`. |
| Monthly            | `monthly_pattern` is required and is either `day_of_month` or `nth_weekday`. Other frequencies require it to be `null`.                                 |
| Never ends         | `end_type=never`; both the end date and occurrence count are `null`.                                                                                    |
| Ends on a date     | `end_type=on_date`; `end_date` is required and the occurrence count is `null`.                                                                          |
| Ends after a count | `end_type=after_occurrences`; `occurrence_count` is required from 2 through 1000 and the end date is `null`.                                            |

Event date/time input and recurrence calculations use the fixed IANA timezone `America/Los_Angeles`—Pacific time, switching between PST and PDT automatically. The form intentionally has no timezone picker. `end_date` is a calendar date in that same timezone, while event start and end instants remain timezone-aware timestamps.

### Event cancellations

Event owners can cancel without another moderation decision. Setting `event.canceled_at` cancels the one-time event or the entire recurring series; `canceled_by` records the owner who performed the cancellation when that account still exists. Cancellation does not rewrite the approval status, so the moderation history remains intact.

A single occurrence of a recurring event is canceled by inserting its Pacific calendar date into `event_occurrence_cancellation`. The `(event_id, occurrence_date)` pair is unique, preventing duplicate exceptions, and deleting the parent event removes all of its occurrence cancellations. `occurrence_date` is interpreted in `America/Los_Angeles`, matching recurrence generation and avoiding UTC date shifts near midnight.

After changing either schema, generate a SQL migration:

```sh
pnpm db:generate
```

Review the generated SQL under `netlify/database/migrations`, then run the app and apply it locally:

```sh
# Terminal 1
pnpm dev

# Terminal 2
pnpm db:migrate
```

Commit the schema change, generated SQL, and Drizzle migration metadata together. Netlify recognizes committed SQL files in `netlify/database/migrations` and applies them automatically:

- to the isolated database branch before a deploy preview becomes available; and
- to production immediately before the new deploy is published.

A failed migration blocks that deploy. Do not add `pnpm db:migrate` to the Netlify build command, edit a migration that has already shipped, or use `drizzle-kit push` against production. Add a new, preferably backwards-compatible migration instead. For breaking changes, use an expand/migrate/contract sequence. See Netlify's [migration lifecycle and guidance](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/).

If Better Auth configuration or plugins change the auth model, regenerate its Drizzle schema first, review the result, and then generate the SQL migration:

```sh
pnpm auth:generate
pnpm db:generate
```

## Create the first admin

Apply the auth migrations before bootstrapping an admin. The Better Auth CLI needs a persistent database and `NETLIFY_DB_URL` in the same shell; it cannot use the connection that exists only inside the separately running Next.js process.

For production, a Team Owner can open Netlify's **Database** view, select the production branch, and use **Copy connection string**. Expose that value temporarily as `NETLIFY_DB_URL` in a trusted shell; do not save it in `.env.local` or the repository. Under Netlify's current access rules, a Developer receives a read-only production connection string and cannot use it to create the admin.

Once `NETLIFY_DB_URL` is available in that shell, run:

```sh
pnpm auth:create-admin --email admin@example.com --name "SacTech Admin" --role admin
```

Let the CLI prompt for the password instead of passing `--password`, which can expose it in shell history or process listings. The CLI creates the account through Better Auth, hashes its password, and marks the email verified by default. Remove a temporarily exported production `NETLIFY_DB_URL` from the shell when finished.

After signing in as that admin, open `/admin/users` to assign the `admin`,
`approver`, or `submitter` role and to ban or unban other accounts. These actions
go through Better Auth's server-side permission checks; the UI is not the
security boundary. An admin cannot change or ban their own account from this
page.

As a break-glass alternative, promote an existing account through the database
without handling its password:

1. Have the person create their account normally.
2. In Netlify, open the project and choose **Database**.
3. Select the correct database branch—use the production branch only when intentionally granting live access—and choose **View/edit**.
4. Open the `user` table, find the exact email address, and change its `role` value to `admin`.
5. Have the person refresh their session before opening `/admin/events` or `/admin/users`.

Changes made through the production database editor take effect immediately. Verify the branch, account, and new role before saving. Under Netlify's current [database access rules](https://docs.netlify.com/build/data-and-storage/netlify-database/access-control/), only a Team Owner can edit the production branch.

## Deploy to Netlify

1. Push the repository, including `netlify.toml` and all generated migrations, to the Git provider Netlify will use.
2. In Netlify, choose **Add new project** and import the repository. The checked-in configuration installs Chromium for the browser integration tests, runs `pnpm verify`, publishes `.next`, and selects Node 24.19.0. Verification runs formatting, linting, type checking, tests, and one production build, so a failed quality gate blocks the deploy.
3. Under **Project configuration → Environment variables**, add `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and the optional `NEXT_PUBLIC_INVITE_LINK`. Configure the values for every deploy context that should support authentication, and make the Resend values available to Functions so the scheduled digest can use them. Netlify supplies the auth URLs and database connection automatically.
4. Deploy the site.

Because `@netlify/database` is a project dependency, Netlify uses [package-based provisioning](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/): on the first deploy it creates the database if needed, injects the branch-specific `NETLIFY_DB_URL`, and applies committed migrations as part of the deploy lifecycle. A database does not need to be created manually first. It can still be provisioned from the Netlify Database page if the team prefers to do that before the first deploy.

After the production deploy succeeds:

1. Confirm the production database branch and migrations in Netlify's **Database** view.
2. Create or promote the first admin.
3. Test account creation, email verification, forgot-password recovery, event submission, moderation, and the public calendar.
4. Open the `send-admin-approval-reminders` function in Netlify and use **Run now** after seeding a pending event and a verified approver or admin.
5. Verify a deploy preview separately; it uses an isolated database branch and its own preview hostname, but its scheduled function does not run automatically.

## Scripts

| Command                  | Purpose                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `pnpm dev`               | Start Netlify Dev, the local database, and the Next.js app on port 8888.                       |
| `pnpm dev:next`          | Start only Next.js on port 3000; useful for UI-only work, but no Netlify database is injected. |
| `pnpm email:dev`         | Preview the React Email account and approval-reminder templates locally on port 3001.          |
| `pnpm build`             | Create a production Next.js build.                                                             |
| `pnpm start`             | Serve an already-built Next.js app.                                                            |
| `pnpm format`            | Format supported project files with the pinned Prettier version.                               |
| `pnpm format:check`      | Check formatting without changing files.                                                       |
| `pnpm lint`              | Run ESLint.                                                                                    |
| `pnpm typecheck`         | Run TypeScript without emitting files.                                                         |
| `pnpm test`              | Run the Vitest test suite once.                                                                |
| `pnpm test:watch`        | Run Vitest in watch mode while developing.                                                     |
| `pnpm verify`            | Run the complete CI/deploy gate: formatting, lint, typecheck, tests, and one production build. |
| `pnpm db:generate`       | Generate SQL migrations from the Drizzle schemas.                                              |
| `pnpm db:migrate`        | Apply pending migrations to the running local Netlify database.                                |
| `pnpm db:status`         | Show local database connection and migration status.                                           |
| `pnpm auth:generate`     | Regenerate Better Auth's Drizzle schema after auth-model changes.                              |
| `pnpm auth:create-admin` | Create an initial Better Auth admin when `NETLIFY_DB_URL` is available.                        |

Before opening a pull request, run:

```sh
pnpm verify
```

The `CI` GitHub Actions workflow runs the same command for every pull request and
push to `main`, using the checked-in Node.js and pnpm versions with a frozen
lockfile. Configure the `CI / quality` status check as required in the repository's
`main` branch protection settings. Netlify also installs the test browser and
runs `pnpm verify`, so direct or manually retried deploys cannot bypass the
checks; the production build inside that command is the single build Netlify
publishes.

## Testing

The test suite is pinned to the Vitest 5 beta requested by the project and is
split across two environments:

- React integration tests run in headless Chromium through Vitest Browser Mode's
  Playwright provider. They use React Testing Library, DOM Testing Library, and
  `jest-dom`, while `vitest/browser` drives real user interactions through the
  browser. Tests interact through accessible labels, roles, and visible status
  messages, with only the network or Server Action boundary mocked.
- Server and persistence integration tests run in Node and start an isolated
  Netlify Database emulator. They apply every committed migration before testing
  real Drizzle inserts, transactions, authorization decisions, moderation,
  cancellation, and public-query visibility.

Run the complete suite once with `pnpm test`, or use `pnpm test:watch` for fast
feedback while editing. The database-backed files start and stop their own
database, so `pnpm dev` does not need to be running.

After installing dependencies for the first time, install the Chromium binary
used by Browser Mode with `pnpm exec playwright install chromium`. CI installs
Chromium and its Linux system dependencies before running the same test suite.

The local Netlify Database emulator uses PGlite and does not reproduce
cross-connection PostgreSQL row-lock blocking. Keep the cancellation concurrency
guard (`FOR UPDATE` on the parent event) covered in deploy-preview smoke testing,
and use a real Postgres-compatible test database before changing that locking
path.

## Security notes

- Keep `BETTER_AUTH_SECRET`, `RESEND_API_KEY`, and `NETLIFY_DB_URL` out of Git, logs, screenshots, client components, and `NEXT_PUBLIC_*` variables. Rotate any value that is exposed.
- Keep the Better Auth host allowlist narrow. Add exact custom domains and the site-specific `*--SITE.netlify.app` preview pattern only.
- Protect deploy previews appropriately. Preview database branches are isolated, but can contain copied production-shaped data and run server code with preview-scoped environment variables.
- Grant the `admin` role sparingly. It can change other accounts' roles and ban status. Approval and rejection are available to both admins and approvers and are enforced again inside each Server Action.
- Review every migration before committing it and test it on a local database and deploy preview before production.
- Email/password accounts cannot sign in until Better Auth verifies their address. Password resets revoke the account's existing sessions.
- Account creation and event submission are intentionally open. Add project-appropriate rate limiting or abuse controls before a high-traffic public launch.
- Event links are restricted to `http://` and `https://`, submitted dates are interpreted in `America/Los_Angeles`, and only approved rows are queried for the public calendar. Preserve those checks when extending the workflow.

## Official references

- [Netlify Next.js starter `netlify.toml`](https://github.com/netlify-templates/next-platform-starter/blob/main/netlify.toml)
- [Netlify Database local development](https://docs.netlify.com/build/data-and-storage/netlify-database/local-development/)
- [Netlify Database migrations](https://docs.netlify.com/build/data-and-storage/netlify-database/migrations/)
- [Drizzle with Netlify Database](https://orm.drizzle.team/docs/connect-netlify-db)
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth dynamic base URL](https://better-auth.com/docs/guides/dynamic-base-url)
- [Better Auth CLI and `create-admin`](https://better-auth.com/docs/concepts/cli)
- [Better Auth Admin plugin](https://better-auth.com/docs/plugins/admin)
- [Resend with Better Auth](https://resend.com/docs/send-with-better-auth)
- [Resend with Next.js](https://resend.com/docs/send-with-nextjs)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
- [Resend batch sending](https://resend.com/docs/api-reference/emails/send-batch-emails)
- [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [React Email with Resend](https://react.email/docs/integrations/resend)
- [Netlify Scheduled Functions](https://docs.netlify.com/build/functions/scheduled-functions/)
- [Vitest guide](https://main.vitest.dev/guide/)
- [React Testing Library introduction](https://testing-library.com/docs/react-testing-library/intro/)
- [DOM Testing Library installation](https://testing-library.com/docs/dom-testing-library/install/)
