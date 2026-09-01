import preview from "@/.storybook/preview";
import { JoinCommunity } from "@/components/join-community";
import { expect } from "storybook/test";

const meta = preview.meta({
	title: "Components/Join Community",
	component: JoinCommunity,
	parameters: {
		layout: "centered",
		nextjs: {
			appDirectory: true,
		},
	},
	tags: ["autodocs"],
	decorators: [
		(Story) => (
			<div
				style={{
					background: "var(--color-navy-deep)",
					color: "var(--color-cream)",
					padding: "2rem",
					width: "min(40rem, calc(100vw - 2rem))",
				}}
			>
				<Story />
			</div>
		),
	],
});

export const InviteUnavailable = meta.story({
	args: {},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByText("We're updating the Slack invitations."),
		).toBeVisible();
		await expect(
			canvas.getByRole("link", { name: "Code of Conduct" }),
		).toHaveAttribute("href", "/code-of-conduct");
	},
});

export const InviteAvailable = meta.story({
	args: {
		inviteLink: "https://community.example.com/sactech",
	},
	play: async ({ canvas }) => {
		await expect(
			canvas.getByRole("checkbox", { name: /I agree to the Code of Conduct/ }),
		).not.toBeChecked();
		await expect(
			canvas.getByRole("button", { name: /Join SacTech Slack/ }),
		).toBeEnabled();
	},
});

export const AgreementRequired = InviteAvailable.extend({
	play: async ({ canvas, userEvent }) => {
		await userEvent.click(
			canvas.getByRole("button", { name: /Join SacTech Slack/ }),
		);

		await expect(canvas.getByRole("status")).toHaveTextContent(
			"Please agree to the Code of Conduct before joining.",
		);
	},
});

export const AgreementSelected = InviteAvailable.extend({
	play: async ({ canvas, userEvent }) => {
		const agreement = canvas.getByRole("checkbox", {
			name: /I agree to the Code of Conduct/,
		});

		await userEvent.click(agreement);
		await expect(agreement).toBeChecked();
		await expect(canvas.queryByRole("status")).not.toBeInTheDocument();
	},
});
