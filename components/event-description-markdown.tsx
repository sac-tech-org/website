import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown, {
	defaultUrlTransform,
	type Components,
} from "react-markdown";
import remarkGfm from "remark-gfm";
import style from "./event-description-markdown.module.css";

const allowedElements = [
	"a",
	"blockquote",
	"br",
	"code",
	"del",
	"em",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"li",
	"ol",
	"p",
	"pre",
	"strong",
	"ul",
] as const;

function isExternalLink(href: string | undefined) {
	return href ? /^(?:https?:)?\/\//i.test(href) : false;
}

function safeUrlTransform(url: string) {
	const safeUrl = defaultUrlTransform(url);

	return safeUrl || undefined;
}

function MarkdownLink({
	children,
	href,
	title,
}: ComponentPropsWithoutRef<"a">) {
	const external = isExternalLink(href);

	return (
		<a
			href={href}
			rel={external ? "noopener noreferrer nofollow ugc" : undefined}
			target={external ? "_blank" : undefined}
			title={title}
		>
			{children}
		</a>
	);
}

const components: Components = {
	a: MarkdownLink,
	// Event titles are h3 elements, so description headings must start below them.
	h1: "h4",
	h2: "h5",
	h3: "h6",
	h4: "h4",
	h5: "h5",
	h6: "h6",
};

interface EventDescriptionMarkdownProps {
	className?: string;
	markdown: string;
}

export function EventDescriptionMarkdown({
	className,
	markdown,
}: EventDescriptionMarkdownProps) {
	return (
		<div className={[style.prose, className].filter(Boolean).join(" ")}>
			<ReactMarkdown
				allowedElements={allowedElements}
				components={components}
				remarkPlugins={[remarkGfm]}
				skipHtml
				urlTransform={safeUrlTransform}
			>
				{markdown}
			</ReactMarkdown>
		</div>
	);
}
