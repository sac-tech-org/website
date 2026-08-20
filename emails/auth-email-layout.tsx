import {
	Body,
	Button,
	Container,
	Head,
	Heading,
	Html,
	Link,
	Preview,
	Section,
	Text,
} from "react-email";

export const AUTH_EMAIL_APP_NAME = "SacTech";

interface AuthEmailLayoutProps {
	actionLabel: string;
	description: string;
	heading: string;
	ignoreMessage: string;
	preview: string;
	url: string;
	userName?: string;
}

export function normalizeEmailUserName(value: string | undefined) {
	return value?.trim().replace(/\s+/g, " ") || undefined;
}

export function AuthEmailLayout({
	actionLabel,
	description,
	heading,
	ignoreMessage,
	preview,
	url,
	userName,
}: AuthEmailLayoutProps) {
	const normalizedName = normalizeEmailUserName(userName);

	return (
		<Html lang="en">
			<Head />
			<Preview>{preview}</Preview>
			<Body style={bodyStyle}>
				<Container style={containerStyle}>
					<Text style={brandStyle}>{AUTH_EMAIL_APP_NAME}</Text>
					<Heading style={headingStyle}>{heading}</Heading>
					<Text style={greetingStyle}>
						{normalizedName ? `Hi ${normalizedName},` : "Hi,"}
					</Text>
					<Text style={descriptionStyle}>{description}</Text>
					<Section style={buttonSectionStyle}>
						<Button href={url} style={buttonStyle}>
							{actionLabel}
						</Button>
					</Section>
					<Text style={helpStyle}>
						If the button does not work, copy and paste this link into your
						browser:
					</Text>
					<Text style={linkTextStyle}>
						<Link href={url} style={linkStyle}>
							{url}
						</Link>
					</Text>
					<Text style={ignoreStyle}>{ignoreMessage}</Text>
				</Container>
			</Body>
		</Html>
	);
}

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
	margin: "0 0 28px",
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

const ignoreStyle = {
	color: "#4d5c67",
	fontSize: "14px",
	lineHeight: "1.5",
	margin: "0",
};
