import type { TestProject } from "vitest/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import setupDatabaseProject from "@/test-support/database-global-setup";

const databaseMocks = vi.hoisted(() => ({
	applyMigrations: vi.fn(),
	reset: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
}));

vi.mock("@netlify/database-dev", () => ({
	NetlifyDB: vi.fn(function MockNetlifyDatabase() {
		return databaseMocks;
	}),
}));

type RerunHandler = Parameters<TestProject["onTestsRerun"]>[0];

function createProject() {
	let rerunHandler: RerunHandler | undefined;
	const provide = vi.fn();
	const onTestsRerun = vi.fn((handler: RerunHandler) => {
		rerunHandler = handler;
	});
	const project = {
		name: "database",
		onTestsRerun,
		provide,
	} as unknown as TestProject;

	return {
		getRerunHandler() {
			if (!rerunHandler) {
				throw new Error("Expected the database rerun handler to be registered");
			}

			return rerunHandler;
		},
		onTestsRerun,
		project,
		provide,
	};
}

describe("database project global setup", () => {
	beforeEach(() => {
		databaseMocks.applyMigrations.mockReset().mockResolvedValue([]);
		databaseMocks.reset.mockReset().mockResolvedValue(undefined);
		databaseMocks.start
			.mockReset()
			.mockResolvedValue("postgres://localhost:5432/postgres");
		databaseMocks.stop.mockReset().mockResolvedValue(undefined);
	});

	it("initializes once and rebuilds only for database project reruns", async () => {
		const { getRerunHandler, onTestsRerun, project, provide } = createProject();
		const teardown = await setupDatabaseProject(project);

		expect(databaseMocks.start).toHaveBeenCalledOnce();
		expect(databaseMocks.applyMigrations).toHaveBeenCalledOnce();
		expect(provide).toHaveBeenCalledWith(
			"netlifyDatabaseUrl",
			"postgres://postgres@localhost:5432/postgres",
		);
		expect(onTestsRerun).toHaveBeenCalledOnce();

		const rerun = getRerunHandler();
		await rerun([{ project: {} } as never]);
		expect(databaseMocks.reset).not.toHaveBeenCalled();

		await rerun([{ project } as never]);
		expect(databaseMocks.reset).toHaveBeenCalledOnce();
		expect(databaseMocks.applyMigrations).toHaveBeenCalledTimes(2);

		await teardown();
		expect(databaseMocks.stop).toHaveBeenCalledOnce();
	});

	it("attempts cleanup without masking a startup failure", async () => {
		const startupError = new Error("database startup failed");
		databaseMocks.start.mockRejectedValueOnce(startupError);
		databaseMocks.stop.mockRejectedValueOnce(
			new Error("database cleanup failed"),
		);

		await expect(setupDatabaseProject(createProject().project)).rejects.toBe(
			startupError,
		);
		expect(databaseMocks.stop).toHaveBeenCalledOnce();
	});
});
