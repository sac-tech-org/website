import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	getCurrentSessionMock,
	getEventHeaderImageMock,
	limitMock,
	sessionCanReviewEventsMock,
} = vi.hoisted(() => ({
	getCurrentSessionMock: vi.fn(),
	getEventHeaderImageMock: vi.fn(),
	limitMock: vi.fn(),
	sessionCanReviewEventsMock: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...conditions) => conditions),
	eq: vi.fn((left, right) => [left, right]),
	isNull: vi.fn((value) => [value, null]),
}));

vi.mock("@/db", () => ({
	db: {
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ limit: limitMock })),
			})),
		})),
	},
}));

vi.mock("@/db/schema", () => ({
	event: {
		canceledAt: "canceledAt",
		headerImageKey: "headerImageKey",
		id: "id",
		status: "status",
	},
}));

vi.mock("@/lib/events/header-image", () => ({
	eventHeaderImageContentType: vi.fn(
		(metadata: Record<string, unknown>) => metadata.contentType ?? null,
	),
	getEventHeaderImage: getEventHeaderImageMock,
}));

vi.mock("@/lib/session", () => ({
	getCurrentSession: getCurrentSessionMock,
	sessionCanReviewEvents: sessionCanReviewEventsMock,
}));

import { GET } from "./route";

const routeContext = {
	params: Promise.resolve({
		eventId: "00000000-0000-4000-8000-000000000001",
		imageKey: "00000000-0000-4000-8000-000000000002",
	}),
};

describe("event header image route", () => {
	beforeEach(() => {
		getCurrentSessionMock.mockReset();
		getEventHeaderImageMock.mockReset();
		limitMock.mockReset();
		sessionCanReviewEventsMock.mockReset();
	});

	it("streams an approved image with immutable and safe response headers", async () => {
		limitMock.mockResolvedValue([{ status: "approved" }]);
		getEventHeaderImageMock.mockResolvedValue({
			data: new Blob(["image bytes"]).stream(),
			etag: '"image-etag"',
			metadata: { contentType: "image/png" },
		});

		const response = await GET(new Request("http://localhost"), routeContext);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("immutable");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("etag")).toBe('"image-etag"');
		expect(await response.text()).toBe("image bytes");
		expect(getCurrentSessionMock).not.toHaveBeenCalled();
	});

	it("does not expose a pending image to an unauthenticated request", async () => {
		limitMock.mockResolvedValue([{ status: "pending" }]);
		getCurrentSessionMock.mockResolvedValue(null);

		const response = await GET(new Request("http://localhost"), routeContext);

		expect(response.status).toBe(404);
		expect(getEventHeaderImageMock).not.toHaveBeenCalled();
	});

	it("lets an event reviewer inspect a pending image without caching it", async () => {
		limitMock.mockResolvedValue([{ status: "pending" }]);
		getCurrentSessionMock.mockResolvedValue({ user: { id: "reviewer" } });
		sessionCanReviewEventsMock.mockReturnValue(true);
		getEventHeaderImageMock.mockResolvedValue({
			data: new Blob(["pending image"]).stream(),
			metadata: { contentType: "image/webp" },
		});

		const response = await GET(new Request("http://localhost"), routeContext);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
});
