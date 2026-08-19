# SacTech website

The community website for SacTech. It is a Next.js application deployed on Netlify, backed by Netlify Database and Drizzle ORM, with Better Auth providing email/password accounts and admin roles.

The event flow is deliberately moderated:

1. A person creates an account or signs in at `/auth`.
2. From `/account`, they open `/events/submit` and send an event for review. New events always start as `pending`, and the account page tracks their status.
3. A SacTech admin reviews the queue at `/admin/events` and approves or rejects each event.
4. Only `approved` events are returned to the public `/events` calendar.

Authorization and status checks are enforced on the server. Hiding an admin link or changing a form value in the browser is not enough to bypass them.

## Stack

- Next.js 16 App Router and React 19
- Netlify's Next.js runtime, configured by `netlify.toml`
- [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/), a managed Postgres database
- [Drizzle ORM's native Netlify Database driver](https://orm.drizzle.team/docs/connect-netlify-db)
- [Better Auth](https://better-auth.com/docs/integrations/next) with its Drizzle adapter, email/password authentication, and Admin plugin

Netlify Database is currently available only on Netlify's **Credit-based plans**. Database compute and bandwidth consume credits; review the current [billing and limits documentation](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/) before enabling it for the project.

## Local development

### Prerequisites

- Node.js 22.13 or newer (`.nvmrc` pins the project's version)
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

| Variable | Where | Purpose |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Local and Netlify | Private, high-entropy secret used by Better Auth for encryption and hashing. Never prefix it with `NEXT_PUBLIC_`. |
| `BETTER_AUTH_URL` | Local and Netlify | Full canonical origin. Use `http://localhost:8888` locally and the primary HTTPS site URL in production. |
| `BETTER_AUTH_ALLOWED_HOSTS` | Local and Netlify | Comma-separated Better Auth host allowlist. Values are hostnames, optionally with ports or wildcards, and do not include URL paths. |
| `NETLIFY_DB_URL` | Supplied by Netlify | Database connection string selected for the local, preview, or production database branch. Do not commit or manually configure it for normal app execution. |
| `NEXT_PUBLIC_INVITE_LINK` | Optional | Public community invitation displayed by the site. It is intentionally browser-visible. |

### Production and deploy-preview hosts

Set `BETTER_AUTH_URL` to the canonical production origin. Replace `SITE` with the exact Netlify site name:

```dotenv
BETTER_AUTH_URL=https://SITE.netlify.app
```

Allow the site's default Netlify hostname, that site's deploy-preview/branch-deploy hosts, and any real custom domains:

```dotenv
BETTER_AUTH_ALLOWED_HOSTS=SITE.netlify.app,*--SITE.netlify.app,www.YOUR-DOMAIN.example,YOUR-DOMAIN.example
```

The `*--SITE.netlify.app` pattern covers URLs such as `deploy-preview-42--SITE.netlify.app` while remaining scoped to this Netlify site. Do **not** use `*.netlify.app`: Better Auth automatically adds allowed hosts to its trusted origins, so that broad pattern would trust unrelated and potentially hostile Netlify sites.

Better Auth resolves each allowed preview hostname dynamically. The canonical `BETTER_AUTH_URL` remains the fallback and stable production identity.

## Schema and migrations

The Drizzle configuration reads both schemas:

- `db/auth-schema.ts` contains Better Auth's users, sessions, accounts, and verification records.
- `db/schema.ts` contains the SacTech event, moderation, and optional recurrence models.

### Recurring event rules

A recurring event has one `event_recurrence` row whose primary key is the parent event ID. An event without that row is a one-time event. Deleting the event deletes its recurrence row automatically.

| Rule | Persisted constraint |
| --- | --- |
| Frequency | `day`, `week`, `month`, or `year`, repeated every `interval` units; the interval must be from 1 through 99. |
| Weekly | `weekdays` is required, must contain 1–7 integers, and may contain only `0` (Sunday) through `6` (Saturday). Other frequencies require it to be `null`. |
| Monthly | `monthly_pattern` is required and is either `day_of_month` or `nth_weekday`. Other frequencies require it to be `null`. |
| Never ends | `end_type=never`; both the end date and occurrence count are `null`. |
| Ends on a date | `end_type=on_date`; `end_date` is required and the occurrence count is `null`. |
| Ends after a count | `end_type=after_occurrences`; `occurrence_count` is required from 2 through 1000 and the end date is `null`. |

Event date/time input and recurrence calculations use the fixed IANA timezone `America/Los_Angeles`—Pacific time, switching between PST and PDT automatically. The form intentionally has no timezone picker. `end_date` is a calendar date in that same timezone, while event start and end instants remain timezone-aware timestamps.

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

Alternatively, promote an existing account without handling its password:

1. Have the person create their account normally.
2. In Netlify, open the project and choose **Database**.
3. Select the correct database branch—use the production branch only when intentionally granting live access—and choose **View/edit**.
4. Open the `user` table, find the exact email address, and change its `role` value to `admin`.
5. Have the person sign out and back in before opening `/admin/events`.

Changes made through the production database editor take effect immediately. Verify the branch, account, and new role before saving. Under Netlify's current [database access rules](https://docs.netlify.com/build/data-and-storage/netlify-database/access-control/), only a Team Owner can edit the production branch.

## Deploy to Netlify

1. Push the repository, including `netlify.toml` and all generated migrations, to the Git provider Netlify will use.
2. In Netlify, choose **Add new project** and import the repository. The checked-in configuration runs `pnpm build`, publishes `.next`, and selects Node 22.13.
3. Under **Project configuration → Environment variables**, add `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_ALLOWED_HOSTS`, and the optional `NEXT_PUBLIC_INVITE_LINK`. Configure the values for every deploy context that should support authentication.
4. Deploy the site.

Because `@netlify/database` is a project dependency, Netlify uses [package-based provisioning](https://docs.netlify.com/build/data-and-storage/netlify-database/getting-started/): on the first deploy it creates the database if needed, injects the branch-specific `NETLIFY_DB_URL`, and applies committed migrations as part of the deploy lifecycle. A database does not need to be created manually first. It can still be provisioned from the Netlify Database page if the team prefers to do that before the first deploy.

After the production deploy succeeds:

1. Confirm the production database branch and migrations in Netlify's **Database** view.
2. Create or promote the first admin.
3. Test account creation, event submission, moderation, and the public calendar.
4. Verify a deploy preview separately; it uses an isolated database branch and its own preview hostname.

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start Netlify Dev, the local database, and the Next.js app on port 8888. |
| `pnpm dev:next` | Start only Next.js on port 3000; useful for UI-only work, but no Netlify database is injected. |
| `pnpm build` | Create a production Next.js build. |
| `pnpm start` | Serve an already-built Next.js app. |
| `pnpm lint` | Run ESLint. |
| `pnpm typecheck` | Run TypeScript without emitting files. |
| `pnpm test` | Run the Vitest test suite once. |
| `pnpm db:generate` | Generate SQL migrations from the Drizzle schemas. |
| `pnpm db:migrate` | Apply pending migrations to the running local Netlify database. |
| `pnpm db:status` | Show local database connection and migration status. |
| `pnpm auth:generate` | Regenerate Better Auth's Drizzle schema after auth-model changes. |
| `pnpm auth:create-admin` | Create an initial Better Auth admin when `NETLIFY_DB_URL` is available. |

Before opening a pull request, run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Security notes

- Keep `BETTER_AUTH_SECRET` and `NETLIFY_DB_URL` out of Git, logs, screenshots, client components, and `NEXT_PUBLIC_*` variables. Rotate any value that is exposed.
- Keep the Better Auth host allowlist narrow. Add exact custom domains and the site-specific `*--SITE.netlify.app` preview pattern only.
- Protect deploy previews appropriately. Preview database branches are isolated, but can contain copied production-shaped data and run server code with preview-scoped environment variables.
- Grant the `admin` role sparingly. Approval and rejection actions mutate public content and are enforced from the server session's role.
- Review every migration before committing it and test it on a local database and deploy preview before production.
- The current setup enables email/password sign-up but does not configure an email delivery provider. Add verified-email and password-reset delivery before treating possession of an email address as verified identity.
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
