import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Next replaces process.env references at build time. Browser Mode serves the
// client modules through Vite, so expose only the build-time value they expect.
if (!("process" in globalThis)) {
	Object.defineProperty(globalThis, "process", {
		configurable: true,
		value: { env: { NODE_ENV: "test" } },
	});
}

afterEach(() => {
	cleanup();
});
