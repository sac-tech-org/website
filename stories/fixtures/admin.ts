import type { ManagedUser } from "@/app/admin/users/user-management-card";
import type {
	getPendingEventEdits,
	getPendingEvents,
} from "@/lib/events/queries";

type PendingEvents = Awaited<ReturnType<typeof getPendingEvents>>;
type PendingEventEdits = Awaited<ReturnType<typeof getPendingEventEdits>>;

export const PENDING_ADMIN_EVENTS = [
	{
		canceledOccurrences: [],
		createdAt: new Date("2026-09-02T17:30:00.000Z"),
		description:
			"A welcoming evening of short demos from Sacramento developers, designers, and makers.",
		endsAt: new Date("2026-10-16T03:30:00.000Z"),
		eventUrl: "https://example.com/sacramento-demo-night",
		headerImageKey: null,
		id: "9ae8c027-41d6-4890-a431-1d8208b22e40",
		locationAddress: "828 I Street, Sacramento, CA 95814",
		locationName: "Sacramento Central Library",
		mode: "hybrid",
		recurrenceCount: null,
		recurrenceEndDate: null,
		recurrenceEndType: null,
		recurrenceFrequency: null,
		recurrenceInterval: null,
		recurrenceMonthlyPattern: null,
		recurrenceWeekdays: null,
		startsAt: new Date("2026-10-16T01:00:00.000Z"),
		submitterEmail: "maya.chen@example.com",
		submitterName: "Maya Chen",
		timezone: "America/Los_Angeles",
		title: "Sacramento Community Demo Night",
	},
	{
		canceledOccurrences: ["2026-11-03"],
		createdAt: new Date("2026-09-04T20:15:00.000Z"),
		description:
			"A practical weekly TypeScript study group with a rotating community-led topic.",
		endsAt: new Date("2026-10-21T02:00:00.000Z"),
		eventUrl: "https://example.com/typescript-weekly",
		headerImageKey: null,
		id: "e43f00ec-4003-4855-afc6-6b9b7f654229",
		locationAddress: null,
		locationName: null,
		mode: "online",
		recurrenceCount: 8,
		recurrenceEndDate: null,
		recurrenceEndType: "after_occurrences",
		recurrenceFrequency: "week",
		recurrenceInterval: 1,
		recurrenceMonthlyPattern: null,
		recurrenceWeekdays: [2],
		startsAt: new Date("2026-10-21T01:00:00.000Z"),
		submitterEmail: "jordan.lee@example.com",
		submitterName: "Jordan Lee",
		timezone: "America/Los_Angeles",
		title: "Sacramento TypeScript Weekly",
	},
] satisfies PendingEvents;

export const PENDING_ADMIN_EVENT_EDITS = [
	{
		createdAt: new Date("2026-09-05T19:20:00.000Z"),
		currentDescription:
			"A weekly coworking session for people building civic technology.",
		currentEndsAt: new Date("2026-10-22T03:00:00.000Z"),
		currentEventUrl: "https://example.com/civic-tech-coworking",
		currentLocationAddress: "915 I Street, Sacramento, CA 95814",
		currentLocationName: "Atrium 916",
		currentMode: "hybrid",
		currentRecurrenceCount: 12,
		currentRecurrenceEndDate: null,
		currentRecurrenceEndType: "after_occurrences",
		currentRecurrenceFrequency: "week",
		currentRecurrenceInterval: 1,
		currentRecurrenceMonthlyPattern: null,
		currentRecurrenceWeekdays: [3],
		currentStartsAt: new Date("2026-10-22T01:00:00.000Z"),
		currentTitle: "Civic Tech Coworking",
		description:
			"A weekly coworking and project clinic for anyone improving public services with technology.",
		endsAt: new Date("2026-10-22T03:30:00.000Z"),
		eventId: "cf679f00-5bb3-4d59-b782-1825b4ac78e4",
		eventUrl: "https://example.com/civic-tech-project-clinic",
		hasCurrentOccurrenceOverride: false,
		id: "08d3130a-2097-42a1-9319-a53cd149c625",
		locationAddress: "915 I Street, Sacramento, CA 95814",
		locationName: "Atrium 916",
		mode: "hybrid",
		occurrenceDate: null,
		proposerEmail: "priya.shah@example.com",
		proposerName: "Priya Shah",
		recurrenceCount: null,
		recurrenceEndDate: "2027-01-27",
		recurrenceEndType: "on_date",
		recurrenceFrequency: "week",
		recurrenceInterval: 1,
		recurrenceMonthlyPattern: null,
		recurrenceWeekdays: [3],
		scope: "series",
		seriesEndsAt: new Date("2026-10-22T03:00:00.000Z"),
		seriesStartsAt: new Date("2026-10-22T01:00:00.000Z"),
		startsAt: new Date("2026-10-22T01:30:00.000Z"),
		timezone: "America/Los_Angeles",
		title: "Civic Tech Project Clinic",
	},
] satisfies PendingEventEdits;

export const STORY_MANAGED_USERS = {
	administrator: {
		banned: false,
		email: "samira.patel@example.com",
		id: "storybook-administrator",
		name: "Samira Patel",
		roles: ["admin", "approver", "submitter"],
	},
	approver: {
		banned: false,
		email: "devon.brooks@example.com",
		id: "storybook-approver",
		name: "Devon Brooks",
		roles: ["approver", "submitter"],
	},
	bannedSubmitter: {
		banned: true,
		email: "taylor.morgan@example.com",
		id: "storybook-banned-submitter",
		name: "Taylor Morgan",
		roles: ["submitter"],
	},
	submitter: {
		banned: false,
		email: "alex.rivera@example.com",
		id: "storybook-submitter",
		name: "Alex Rivera",
		roles: ["submitter"],
	},
} as const satisfies Record<string, ManagedUser>;

const listedUserTimestamps = {
	createdAt: new Date("2026-01-15T18:00:00.000Z"),
	updatedAt: new Date("2026-08-20T18:00:00.000Z"),
};

export const CURRENT_ADMIN_LISTED_USER = {
	...listedUserTimestamps,
	banExpires: null,
	banReason: null,
	banned: false,
	email: "current.admin@example.com",
	emailVerified: true,
	id: "storybook-current-admin",
	image: null,
	name: "Current Admin",
	role: "admin",
};

export const OTHER_LISTED_USERS = Object.values(STORY_MANAGED_USERS).map(
	(user) => ({
		...listedUserTimestamps,
		banExpires: null,
		banReason: user.banned ? "Banned by a SacTech administrator." : null,
		banned: user.banned,
		email: user.email,
		emailVerified: true,
		id: user.id,
		image: null,
		name: user.name,
		role: user.roles.join(","),
	}),
);
