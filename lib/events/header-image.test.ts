import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteMock, getWithMetadataMock, setMock } = vi.hoisted(() => ({
	deleteMock: vi.fn(),
	getWithMetadataMock: vi.fn(),
	setMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@netlify/blobs", () => ({
	getStore: vi.fn(() => ({
		delete: deleteMock,
		getWithMetadata: getWithMetadataMock,
		set: setMock,
	})),
}));

import {
	deleteEventHeaderImage,
	eventHeaderImageContentType,
	getEventHeaderImage,
	InvalidEventHeaderImageError,
	uploadEventHeaderImage,
} from "@/lib/events/header-image";

describe("event header image storage", () => {
	beforeEach(() => {
		deleteMock.mockReset();
		getWithMetadataMock.mockReset();
		setMock.mockReset();
		setMock.mockResolvedValue({ etag: "test-etag", modified: true });
	});

	it("stores a valid raster image with safe content-type metadata", async () => {
		const image = new File(
			[new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
			"header.png",
			{ type: "image/png" },
		);

		const key = await uploadEventHeaderImage(image);

		expect(key).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(setMock).toHaveBeenCalledWith(
			key,
			image,
			expect.objectContaining({
				metadata: expect.objectContaining({ contentType: "image/png" }),
				onlyIfNew: true,
			}),
		);
	});

	it("rejects a file whose bytes do not match its declared image type", async () => {
		const disguisedHtml = new File(
			["<html>not an image</html>"],
			"header.png",
			{
				type: "image/png",
			},
		);

		await expect(uploadEventHeaderImage(disguisedHtml)).rejects.toBeInstanceOf(
			InvalidEventHeaderImageError,
		);
		expect(setMock).not.toHaveBeenCalled();
	});

	it("reads and deletes entries through the site-wide store", async () => {
		getWithMetadataMock.mockResolvedValue({
			data: new ReadableStream(),
			metadata: { contentType: "image/webp" },
		});

		await expect(getEventHeaderImage("image-key")).resolves.toMatchObject({
			metadata: { contentType: "image/webp" },
		});
		await deleteEventHeaderImage("image-key");

		expect(getWithMetadataMock).toHaveBeenCalledWith("image-key", {
			type: "stream",
		});
		expect(deleteMock).toHaveBeenCalledWith("image-key");
	});

	it("only accepts allowlisted content types from blob metadata", () => {
		expect(eventHeaderImageContentType({ contentType: "image/avif" })).toBe(
			"image/avif",
		);
		expect(eventHeaderImageContentType({ contentType: "image/svg+xml" })).toBe(
			null,
		);
	});
});
