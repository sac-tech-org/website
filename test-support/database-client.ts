import { getDatabase, type ServerDatabaseConnection } from "@netlify/database";
import { inject } from "vitest";

interface TestDatabase {
	close: () => Promise<void>;
	exec: (sql: string) => Promise<unknown>;
	query: <T>(
		sql: string,
		params?: readonly unknown[],
	) => Promise<{ rows: T[] }>;
	resetPublicTables: () => Promise<void>;
}

let connection: ServerDatabaseConnection | undefined;

function getConnection() {
	if (!connection) {
		const candidate = getDatabase({
			connectionString: inject("netlifyDatabaseUrl"),
		});

		if (candidate.driver !== "server") {
			throw new Error("Database integration tests require the server driver");
		}

		connection = candidate;
	}

	return connection;
}

async function close() {
	if (connection) {
		await connection.pool.end();
		connection = undefined;
	}
}

async function exec(sql: string) {
	return getConnection().pool.query(sql);
}

async function query<T>(sql: string, params: readonly unknown[] = []) {
	const result = await getConnection().pool.query(sql, [...params]);
	return { rows: result.rows as T[] };
}

async function resetPublicTables() {
	const { rows } = await query<{ table_name: string }>(`
			SELECT table_name
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_type = 'BASE TABLE'
			ORDER BY table_name
		`);

	if (rows.length === 0) {
		return;
	}

	const tableNames = rows
		.map(({ table_name }) => `"${table_name.replaceAll('"', '""')}"`)
		.join(", ");
	await exec(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`);
}

export const testDatabase: TestDatabase = {
	close,
	exec,
	query,
	resetPublicTables,
};
