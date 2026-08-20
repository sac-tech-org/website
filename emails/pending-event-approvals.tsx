import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "react-email";
import { AUTH_EMAIL_APP_NAME } from "@/emails/auth-email-layout";

export const MAX_PENDING_EVENTS_IN_EMAIL = 10;
const DEFAULT_EMAIL_TIME_ZONE = "America/Los_Angeles";

export interface PendingApprovalEmailEvent {
	createdAt: Date | string;
	startsAt: Date | string;
	title: string;
	timezone: string;
}

export interface PendingEventApprovalsEmailProps {
	events?: readonly PendingApprovalEmailEvent[];
	pendingCount?: number;
	reviewUrl?: string;
}

function getEventTitle(title: string) {
	return title.trim().replace(/\s+/g, " ") || "Untitled event";
}

function getDate(value: Date | string) {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function getTimeZone(value: string) {
	const timeZone = value.trim() || DEFAULT_EMAIL_TIME_ZONE;

	try {
		new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
		return timeZone;
	} catch {
		return DEFAULT_EMAIL_TIME_ZONE;
	}
}

function formatEmailDate(
	value: Date | string,
	options: Intl.DateTimeFormatOptions,
) {
	const date = getDate(value);

	if (!date) {
		return "date unavailable";
	}

	return new Intl.DateTimeFormat("en-US", options).format(date);
}

export function getPendingApprovalEventDetails(
	event: PendingApprovalEmailEvent,
) {
	const submittedAt = formatEmailDate(event.createdAt, {
		day: "numeric",
		month: "short",
		timeZone: DEFAULT_EMAIL_TIME_ZONE,
		year: "numeric",
	});
	const startsAt = formatEmailDate(event.startsAt, {
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
		month: "short",
		timeZone: getTimeZone(event.timezone),
		timeZoneName: "short",
		year: "numeric",
	});

	return `Submitted ${submittedAt} · Starts ${startsAt}`;
}

export function getPendingApprovalSubject(pendingCount: number) {
	return pendingCount === 1
		? `1 ${AUTH_EMAIL_APP_NAME} event needs approval`
		: `${pendingCount} ${AUTH_EMAIL_APP_NAME} events need approval`;
}

export function getListedPendingApprovalEvents(
	events: readonly PendingApprovalEmailEvent[],
) {
	return events.slice(0, MAX_PENDING_EVENTS_IN_EMAIL).map((event) => ({
		...event,
		title: getEventTitle(event.title),
	}));
}

export function PendingEventApprovalsEmail({
	events = [
		{
			createdAt: new Date("2026-08-19T18:00:00.000Z"),
			startsAt: new Date("2026-09-01T01:00:00.000Z"),
			title: "Sacramento TypeScript Meetup",
			timezone: DEFAULT_EMAIL_TIME_ZONE,
		},
		{
			createdAt: new Date("2026-08-20T16:00:00.000Z"),
			startsAt: new Date("2026-09-03T01:30:00.000Z"),
			title: "Open Source Contributor Night",
			timezone: DEFAULT_EMAIL_TIME_ZONE,
		},
	],
	pendingCount = events.length,
	reviewUrl = "https://example.com/admin/events",
}: PendingEventApprovalsEmailProps = {}) {
	const listedEvents = getListedPendingApprovalEvents(events);
	const unlistedCount = Math.max(0, pendingCount - listedEvents.length);
	const subject = getPendingApprovalSubject(pendingCount);

	return (
		<Html lang="en">
			<Head />
			<Preview>{subject}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Text style={brandStyle}>{AUTH_EMAIL_APP_NAME}</Text>
					<Heading style={headingStyle}>Events are waiting for review</Heading>
					<Text style={greetingStyle}>Hi admin,</Text>
					<Text style={descriptionStyle}>
						{pendingCount === 1
							? "There is 1 event waiting for approval."
							: `There are ${pendingCount} events waiting for approval.`}
					</Text>

					{listedEvents.length > 0 ? (
						<Section style={eventListStyle}>
							{listedEvents.map((event, index) => (
								<Section key={`${event.title}-${index}`}>
									<Text style={eventTitleStyle}>{event.title}</Text>
									<Text style={eventDetailsStyle}>
										{getPendingApprovalEventDetails(event)}
									</Text>
								</Section>
							))}
							{unlistedCount > 0 ? (
								<Text style={moreEventsStyle}>…and {unlistedCount} more</Text>
							) : null}
						</Section>
					) : null}

					<Section style={buttonSectionStyle}>
						<Button href={reviewUrl} style={buttonStyle}>
							Review pending events
						</Button>
					</Section>
					<Text style={helpStyle}>
						If the button does not work, copy and paste this link into your
						browser:
					</Text>
					<Text style={linkTextStyle}>
						<Link href={reviewUrl} style={linkStyle}>
							{reviewUrl}
						</Link>
					</Text>
					<Hr style={dividerStyle} />
					<Text style={footerStyle}>
						You are receiving this reminder because your {AUTH_EMAIL_APP_NAME}
						account has admin access.
					</Text>
				</Container>
			</Body>
		</Html>
	);
}

export default PendingEventApprovalsEmail;

const bodyStyle = {
	backgroundColor: "#fff5e5",
	color: "#062a53",
	fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
	margin: "0",
	padding: "32px 16px",
};

const containerStyle = {
	backgroundColor: "#fffdf8",
	border: "2px solid #f2ab18",
	borderRadius: "12px",
	boxSizing: "border-box" as const,
	margin: "0 auto",
	maxWidth: "560px",
	padding: "40px",
};

const brandStyle = {
	color: "#b93619",
	fontSize: "14px",
	fontWeight: "700",
	letterSpacing: "0.08em",
	margin: "0 0 24px",
	textTransform: "uppercase" as const,
};

const headingStyle = {
	color: "#062a53",
	fontSize: "28px",
	lineHeight: "1.2",
	margin: "0 0 20px",
};

const greetingStyle = {
	fontSize: "16px",
	lineHeight: "1.6",
	margin: "0 0 12px",
};

const descriptionStyle = {
	fontSize: "16px",
	lineHeight: "1.6",
	margin: "0 0 20px",
};

const eventListStyle = {
	backgroundColor: "#fff5e5",
	borderLeft: "4px solid #f2ab18",
	borderRadius: "8px",
	margin: "0 0 28px",
	padding: "12px 18px",
};

const eventTitleStyle = {
	color: "#062a53",
	fontSize: "15px",
	fontWeight: "600",
	lineHeight: "1.5",
	margin: "6px 0",
};

const eventDetailsStyle = {
	color: "#4d5c67",
	fontSize: "13px",
	lineHeight: "1.5",
	margin: "0 0 12px",
};

const moreEventsStyle = {
	color: "#4d5c67",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "10px 0 4px",
};

const buttonSectionStyle = {
	margin: "0 0 28px",
};

const buttonStyle = {
	backgroundColor: "#00474e",
	borderRadius: "8px",
	color: "#fffdf8",
	display: "inline-block",
	fontSize: "16px",
	fontWeight: "700",
	padding: "12px 18px",
	textDecoration: "none",
};

const helpStyle = {
	color: "#4d5c67",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0 0 8px",
};

const linkTextStyle = {
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0 0 28px",
	overflowWrap: "anywhere" as const,
};

const linkStyle = {
	color: "#00474e",
};

const dividerStyle = {
	borderColor: "#f2ab18",
	margin: "0 0 20px",
};

const footerStyle = {
	color: "#4d5c67",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};
