import { drizzle } from "drizzle-orm/netlify-db";
import { describe, expect, it, vi } from "vitest";
import { event } from "@/db/schema";

describe("Netlify Database's serverless Drizzle client", () => {
	it("uses Neon's conventional query API for ORM selects", async () => {
		const query = vi.fn().mockResolvedValue({ rows: [] });
		const httpClient = Object.assign(
			vi.fn(() => {
				throw new Error("The tagged-template API should not handle ORM SQL.");
			}),
			{
				query,
				transaction: vi.fn(),
			},
		);
		const database = drizzle({
			client: {
				connectionString: "postgres://test:test@example.test/test",
				driver: "serverless",
				httpClient,
				pool: {},
			} as never,
		});

		await expect(database.execute("select 1")).resolves.toMatchObject({
			rows: [],
		});
		await expect(
			database.select({ id: event.id }).from(event),
		).resolves.toEqual([]);
		expect(httpClient).not.toHaveBeenCalled();
		expect(query).toHaveBeenNthCalledWith(
			1,
			"select 1",
			[],
			expect.objectContaining({ arrayMode: false, fullResults: true }),
		);
		expect(query).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining('from "event"'),
			[],
			expect.objectContaining({ arrayMode: true, fullResults: true }),
		);
	});
});
