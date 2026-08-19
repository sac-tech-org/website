# Dependency patches

pnpm applies the patches in this directory through `pnpm.patchedDependencies`
in `package.json`.

## `drizzle-orm@1.0.0-rc.4.patch`

### Why it exists

The `drizzle-orm/netlify-db` serverless adapter uses Neon's HTTP client. In
`@neondatabase/serverless` v1, the root client function accepts only tagged
templates; conventional `(sql, params, options)` calls must use the client's
`query()` method.

Drizzle ORM 1.0.0-rc.4 creates a compatibility function named `clientQuery`,
but its prepared-query and batch paths call the root HTTP client instead. In
production, normal Drizzle queries therefore fail with:

> This function can now be called only as a tagged-template function.

This patch routes those calls through `clientQuery` in both distributed module
formats (`session.js` and `session.cjs`). That uses `client.query()` with Neon
v1 while preserving the callable-client fallback for older Neon versions.

The regression test is `db/netlify-driver.test.ts`.

Upstream context:

- [Drizzle issue #5208](https://github.com/drizzle-team/drizzle-orm/issues/5208)
  tracks the same Neon v1 error in the older `neon-http` adapter. Its closure
  does not fix the Netlify adapter in 1.0.0-rc.4.
- [Drizzle PR #5933](https://github.com/drizzle-team/drizzle-orm/pull/5933),
  titled `feat(netlify-db): support credential rotation`, includes the
  equivalent Netlify compatibility change as part of a broader proposal.
- The corresponding upstream change is visible in Netlify's
  [PR commit](https://github.com/netlify/drizzle-orm/commit/45120d2b59ad1d91d0d0239e6f5dd44c1574169c).

When this patch was added on 2026-08-19, there was no dedicated
Netlify-adapter issue and no released Drizzle version containing that fix.

### When to remove it

Remove the patch after upgrading to a published Drizzle ORM version whose
`netlify-db` adapter routes prepared queries and batches through the Neon
v1-compatible `query()` path. A commit on a branch or an unmerged PR is not
enough; the fix must be present in the installed package.

To verify removal:

1. Upgrade `drizzle-orm` (and keep `drizzle-kit` on the corresponding release).
2. Remove the `pnpm.patchedDependencies` entry from `package.json`.
3. Delete `patches/drizzle-orm@1.0.0-rc.4.patch` and run `pnpm install` to update
   `pnpm-lock.yaml`.
4. Run `pnpm exec vitest run db/netlify-driver.test.ts` without the patch.
5. Run `pnpm verify`.

If the regression test still invokes the tagged-template root client, the
installed Drizzle release does not contain the fix and the patch is still
required.
