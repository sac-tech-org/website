import { existsSync, globSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const sourcePatterns = ["app/**/*.tsx", "components/**/*.tsx"];
const excludedSourcePatterns = [
	"**/*.test.tsx",
	"**/*.integration.test.tsx",
	"**/*.stories.tsx",
	"app/layout.tsx",
	"app/**/opengraph-image.tsx",
	"app/**/twitter-image.tsx",
	"app/**/icon.tsx",
	"app/**/apple-icon.tsx",
];

function expectedStoryPath(sourcePath: string) {
	return `stories/${sourcePath.replace(/\.tsx$/, ".stories.tsx")}`;
}

describe("Storybook story coverage", () => {
	it("has a mirrored story for every page and component", () => {
		const sourcePaths = sourcePatterns
			.flatMap((pattern) =>
				globSync(pattern, {
					cwd: projectRoot,
					exclude: excludedSourcePatterns,
				}),
			)
			.sort();
		const missingStoryPaths = sourcePaths
			.map(expectedStoryPath)
			.filter((storyPath) => !existsSync(resolve(projectRoot, storyPath)));

		expect(
			missingStoryPaths,
			`Missing mirrored Storybook stories:\n${missingStoryPaths.join("\n")}`,
		).toEqual([]);
	});
});
