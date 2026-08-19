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
	maxCharacters?: number;
}

interface MarkdownAstNode {
	children?: MarkdownAstNode[];
	type?: string;
	value?: string;
}

const markdownTextNodeTypes = new Set(["code", "inlineCode", "text"]);

function isMarkdownAstNode(value: unknown): value is MarkdownAstNode {
	return typeof value === "object" && value !== null;
}

function createTruncatedMarkdownPlugin(maxCharacters: number) {
	return function truncatedMarkdownPlugin() {
		return (tree: unknown) => {
			if (!isMarkdownAstNode(tree)) {
				return;
			}

			let lastTextNode: MarkdownAstNode | null = null;
			let remainingCharacters = maxCharacters;
			let truncated = false;

			function addEllipsis() {
				if (lastTextNode?.value) {
					lastTextNode.value = `${lastTextNode.value.trimEnd()}…`;
				}
			}

			function truncateChildren(parent: MarkdownAstNode) {
				if (!parent.children) {
					return;
				}

				const visibleChildren: MarkdownAstNode[] = [];

				for (const child of parent.children) {
					if (truncated) {
						break;
					}

					if (
						child.type &&
						markdownTextNodeTypes.has(child.type) &&
						typeof child.value === "string"
					) {
						const characters = Array.from(child.value);

						if (characters.length <= remainingCharacters) {
							remainingCharacters -= characters.length;
							lastTextNode = child;
							visibleChildren.push(child);
							continue;
						}

						if (remainingCharacters > 0) {
							child.value = `${characters
								.slice(0, remainingCharacters)
								.join("")
								.trimEnd()}…`;
							lastTextNode = child;
							visibleChildren.push(child);
						} else {
							addEllipsis();
						}

						remainingCharacters = 0;
						truncated = true;
						break;
					}

					if (child.children) {
						truncateChildren(child);

						if (!truncated || child.children.length > 0) {
							visibleChildren.push(child);
						}
					} else {
						visibleChildren.push(child);
					}
				}

				parent.children = visibleChildren;
			}

			truncateChildren(tree);
		};
	};
}

export function EventDescriptionMarkdown({
	className,
	markdown,
	maxCharacters,
}: EventDescriptionMarkdownProps) {
	const remarkPlugins = maxCharacters
		? [remarkGfm, createTruncatedMarkdownPlugin(maxCharacters)]
		: [remarkGfm];

	return (
		<div className={[style.prose, className].filter(Boolean).join(" ")}>
			<ReactMarkdown
				allowedElements={allowedElements}
				components={components}
				remarkPlugins={remarkPlugins}
				skipHtml
				urlTransform={safeUrlTransform}
			>
				{markdown}
			</ReactMarkdown>
		</div>
	);
}
