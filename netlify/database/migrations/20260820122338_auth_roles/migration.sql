-- Replace Better Auth's former default `user` role wherever it appears in the
-- comma-separated role field. Preserve any other assigned roles and their
-- ordering while normalizing whitespace.
UPDATE "user" AS target
SET
	"role" = migrated.canonical_role,
	"updated_at" = now()
FROM (
	SELECT
		account.id,
		string_agg(
			CASE
				WHEN btrim(role_entry.value) = 'user' THEN 'submitter'
				ELSE btrim(role_entry.value)
			END,
			','
			ORDER BY role_entry.position
		) AS canonical_role
	FROM "user" AS account
	CROSS JOIN LATERAL unnest(string_to_array(account."role", ','))
		WITH ORDINALITY AS role_entry(value, position)
	GROUP BY account.id
	HAVING bool_or(btrim(role_entry.value) = 'user')
) AS migrated
WHERE target.id = migrated.id;
--> statement-breakpoint

-- Older rows may predate the admin plugin role hook. Missing roles receive the
-- same submitter default that Better Auth now assigns to new accounts.
UPDATE "user"
SET
	"role" = 'submitter',
	"updated_at" = now()
WHERE "role" IS NULL OR btrim("role") = '';
