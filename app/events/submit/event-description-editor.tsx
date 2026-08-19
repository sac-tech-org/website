"use client";

import { $createCodeNode, $isCodeNode, CodeNode } from "@lexical/code";
import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
	INSERT_ORDERED_LIST_COMMAND,
	INSERT_UNORDERED_LIST_COMMAND,
	$isListNode,
	ListItemNode,
	ListNode,
	REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
	$convertFromMarkdownString,
	$convertToMarkdownString,
	BOLD_ITALIC_STAR,
	BOLD_ITALIC_UNDERSCORE,
	BOLD_STAR,
	BOLD_UNDERSCORE,
	CODE,
	HEADING,
	INLINE_CODE,
	ITALIC_STAR,
	ITALIC_UNDERSCORE,
	LINK,
	ORDERED_LIST,
	QUOTE,
	STRIKETHROUGH,
	type Transformer,
	UNORDERED_LIST,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import {
	$createHeadingNode,
	$createQuoteNode,
	$isHeadingNode,
	$isQuoteNode,
	HeadingNode,
	QuoteNode,
} from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import {
	$createParagraphNode,
	$getSelection,
	$isRangeSelection,
	$isRootNode,
	CAN_REDO_COMMAND,
	CAN_UNDO_COMMAND,
	COMMAND_PRIORITY_LOW,
	FORMAT_TEXT_COMMAND,
	REDO_COMMAND,
	SELECTION_CHANGE_COMMAND,
	SKIP_DOM_SELECTION_TAG,
	type TextFormatType,
	UNDO_COMMAND,
} from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import style from "./event-form.module.css";

const EVENT_DESCRIPTION_TRANSFORMERS: Transformer[] = [
	HEADING,
	QUOTE,
	CODE,
	UNORDERED_LIST,
	ORDERED_LIST,
	INLINE_CODE,
	BOLD_ITALIC_STAR,
	BOLD_ITALIC_UNDERSCORE,
	BOLD_STAR,
	BOLD_UNDERSCORE,
	ITALIC_STAR,
	ITALIC_UNDERSCORE,
	STRIKETHROUGH,
	LINK,
];

const EVENT_DESCRIPTION_LINK_ATTRIBUTES = Object.freeze({
	rel: "noopener noreferrer nofollow ugc",
});

type BlockType =
	"bullet" | "code" | "heading" | "number" | "paragraph" | "quote";

interface EventDescriptionEditorProps {
	"aria-describedby": string;
	"aria-invalid"?: boolean;
	disabled: boolean;
	onChange: (markdown: string) => void;
	value: string;
}

interface ToolbarButtonProps {
	active?: boolean;
	children: React.ReactNode;
	disabled: boolean;
	onClick: () => void;
	title: string;
}

function reportEditorError(error: Error) {
	throw error;
}

function isSafeLink(url: string) {
	try {
		const parsedUrl = new URL(url);
		return ["http:", "https:", "mailto:"].includes(parsedUrl.protocol);
	} catch {
		return false;
	}
}

function normalizeLink(url: string) {
	const trimmedUrl = url.trim();

	if (/^(?:https?:\/\/|mailto:)/i.test(trimmedUrl)) {
		return trimmedUrl;
	}

	return `https://${trimmedUrl}`;
}

function ToolbarButton({
	active = false,
	children,
	disabled,
	onClick,
	title,
}: ToolbarButtonProps) {
	return (
		<button
			aria-label={title}
			aria-pressed={active}
			className={style.editorToolbarButton}
			disabled={disabled}
			onClick={onClick}
			onMouseDown={(event) => event.preventDefault()}
			title={title}
			type="button"
		>
			{children}
		</button>
	);
}

function $getBlockType(): BlockType {
	const selection = $getSelection();

	if (!$isRangeSelection(selection)) {
		return "paragraph";
	}

	let node = selection.anchor.getNode();
	let parent = node.getParent();

	while (parent && !$isRootNode(parent)) {
		node = parent;
		parent = parent.getParent();
	}

	if ($isListNode(node)) {
		return node.getListType() === "number" ? "number" : "bullet";
	}

	if ($isHeadingNode(node)) {
		return "heading";
	}

	if ($isQuoteNode(node)) {
		return "quote";
	}

	if ($isCodeNode(node)) {
		return "code";
	}

	return "paragraph";
}

function $selectionHasLink() {
	const selection = $getSelection();

	if (!$isRangeSelection(selection)) {
		return false;
	}

	const anchorNode = selection.anchor.getNode();
	return $isLinkNode(anchorNode) || $isLinkNode(anchorNode.getParent());
}

function EditorToolbar({ disabled }: { disabled: boolean }) {
	const [editor] = useLexicalComposerContext();
	const [blockType, setBlockType] = useState<BlockType>("paragraph");
	const [canRedo, setCanRedo] = useState(false);
	const [canUndo, setCanUndo] = useState(false);
	const [formats, setFormats] = useState({
		bold: false,
		code: false,
		italic: false,
		link: false,
		strikethrough: false,
	});

	const updateToolbar = useCallback(() => {
		const selection = $getSelection();

		if (!$isRangeSelection(selection)) {
			return;
		}

		setBlockType($getBlockType());
		setFormats({
			bold: selection.hasFormat("bold"),
			code: selection.hasFormat("code"),
			italic: selection.hasFormat("italic"),
			link: $selectionHasLink(),
			strikethrough: selection.hasFormat("strikethrough"),
		});
	}, []);

	useEffect(() => {
		const removeUpdateListener = editor.registerUpdateListener(
			({ editorState }) => editorState.read(updateToolbar),
		);
		const removeSelectionListener = editor.registerCommand(
			SELECTION_CHANGE_COMMAND,
			() => {
				updateToolbar();
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);
		const removeCanUndoListener = editor.registerCommand(
			CAN_UNDO_COMMAND,
			(payload) => {
				setCanUndo(payload);
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);
		const removeCanRedoListener = editor.registerCommand(
			CAN_REDO_COMMAND,
			(payload) => {
				setCanRedo(payload);
				return false;
			},
			COMMAND_PRIORITY_LOW,
		);

		return () => {
			removeUpdateListener();
			removeSelectionListener();
			removeCanUndoListener();
			removeCanRedoListener();
		};
	}, [editor, updateToolbar]);

	function formatText(format: TextFormatType) {
		editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
	}

	function formatBlock(nextBlockType: Exclude<BlockType, "bullet" | "number">) {
		editor.update(() => {
			const selection = $getSelection();

			if (!$isRangeSelection(selection)) {
				return;
			}

			if (blockType === nextBlockType || nextBlockType === "paragraph") {
				$setBlocksType(selection, () => $createParagraphNode());
				return;
			}

			if (nextBlockType === "heading") {
				$setBlocksType(selection, () => $createHeadingNode("h4"));
			} else if (nextBlockType === "quote") {
				$setBlocksType(selection, () => $createQuoteNode());
			} else if (nextBlockType === "code") {
				$setBlocksType(selection, () => $createCodeNode());
			}
		});
	}

	function formatList(listType: "bullet" | "number") {
		if (blockType === listType) {
			editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
			return;
		}

		editor.dispatchCommand(
			listType === "bullet"
				? INSERT_UNORDERED_LIST_COMMAND
				: INSERT_ORDERED_LIST_COMMAND,
			undefined,
		);
	}

	function formatLink() {
		if (formats.link) {
			editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
			return;
		}

		const enteredUrl = window.prompt("Enter a web address");

		if (enteredUrl === null || enteredUrl.trim() === "") {
			return;
		}

		const normalizedUrl = normalizeLink(enteredUrl);

		if (!isSafeLink(normalizedUrl)) {
			window.alert("Use an http://, https://, or mailto: link.");
			return;
		}

		editor.dispatchCommand(TOGGLE_LINK_COMMAND, normalizedUrl);
	}

	return (
		<div
			aria-label="Description formatting"
			className={style.editorToolbar}
			role="toolbar"
		>
			<div className={style.editorToolbarGroup}>
				<ToolbarButton
					disabled={disabled || !canUndo}
					onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}
					title="Undo"
				>
					Undo
				</ToolbarButton>
				<ToolbarButton
					disabled={disabled || !canRedo}
					onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}
					title="Redo"
				>
					Redo
				</ToolbarButton>
			</div>
			<div className={style.editorToolbarGroup}>
				<ToolbarButton
					active={blockType === "heading"}
					disabled={disabled}
					onClick={() => formatBlock("heading")}
					title="Section heading"
				>
					Heading
				</ToolbarButton>
				<ToolbarButton
					active={blockType === "quote"}
					disabled={disabled}
					onClick={() => formatBlock("quote")}
					title="Block quote"
				>
					Quote
				</ToolbarButton>
				<ToolbarButton
					active={blockType === "bullet"}
					disabled={disabled}
					onClick={() => formatList("bullet")}
					title="Bulleted list"
				>
					Bullets
				</ToolbarButton>
				<ToolbarButton
					active={blockType === "number"}
					disabled={disabled}
					onClick={() => formatList("number")}
					title="Numbered list"
				>
					Numbered
				</ToolbarButton>
				<ToolbarButton
					active={blockType === "code"}
					disabled={disabled}
					onClick={() => formatBlock("code")}
					title="Code block"
				>
					Code block
				</ToolbarButton>
			</div>
			<div className={style.editorToolbarGroup}>
				<ToolbarButton
					active={formats.bold}
					disabled={disabled}
					onClick={() => formatText("bold")}
					title="Bold"
				>
					<strong>B</strong>
				</ToolbarButton>
				<ToolbarButton
					active={formats.italic}
					disabled={disabled}
					onClick={() => formatText("italic")}
					title="Italic"
				>
					<em>I</em>
				</ToolbarButton>
				<ToolbarButton
					active={formats.strikethrough}
					disabled={disabled}
					onClick={() => formatText("strikethrough")}
					title="Strikethrough"
				>
					<s>S</s>
				</ToolbarButton>
				<ToolbarButton
					active={formats.code}
					disabled={disabled}
					onClick={() => formatText("code")}
					title="Inline code"
				>
					&lt;/&gt;
				</ToolbarButton>
				<ToolbarButton
					active={formats.link}
					disabled={disabled}
					onClick={formatLink}
					title={formats.link ? "Remove link" : "Add link"}
				>
					{formats.link ? "Unlink" : "Link"}
				</ToolbarButton>
			</div>
		</div>
	);
}

function EditableStatePlugin({ disabled }: { disabled: boolean }) {
	const [editor] = useLexicalComposerContext();

	useEffect(() => {
		editor.setEditable(!disabled);
	}, [disabled, editor]);

	return null;
}

function MarkdownValuePlugin({
	onChange,
	value,
}: Pick<EventDescriptionEditorProps, "onChange" | "value">) {
	const [editor] = useLexicalComposerContext();
	const lastMarkdown = useRef(value);

	useEffect(() => {
		if (value === lastMarkdown.current) {
			return;
		}

		lastMarkdown.current = value;
		editor.update(
			() => {
				$convertFromMarkdownString(value, EVENT_DESCRIPTION_TRANSFORMERS);
			},
			{ tag: SKIP_DOM_SELECTION_TAG },
		);
	}, [editor, value]);

	return (
		<OnChangePlugin
			ignoreSelectionChange
			onChange={(editorState) => {
				const markdown = editorState.read(() =>
					$convertToMarkdownString(EVENT_DESCRIPTION_TRANSFORMERS),
				);

				if (markdown === lastMarkdown.current) {
					return;
				}

				lastMarkdown.current = markdown;
				onChange(markdown);
			}}
		/>
	);
}

function createInitialEditorState(value: string) {
	return () => {
		if (value) {
			$convertFromMarkdownString(value, EVENT_DESCRIPTION_TRANSFORMERS);
		}
	};
}

export function EventDescriptionEditor({
	"aria-describedby": ariaDescribedBy,
	"aria-invalid": ariaInvalid,
	disabled,
	onChange,
	value,
}: EventDescriptionEditorProps) {
	const [initialEditorState] = useState(() => createInitialEditorState(value));

	const initialConfig = {
		editorState: initialEditorState,
		namespace: "SacTechEventDescription",
		nodes: [CodeNode, HeadingNode, LinkNode, ListItemNode, ListNode, QuoteNode],
		onError: reportEditorError,
		theme: {
			code: style.editorCodeBlock,
			heading: {
				h1: style.editorHeading,
				h2: style.editorHeading,
				h3: style.editorHeading,
				h4: style.editorHeading,
				h5: style.editorHeading,
				h6: style.editorHeading,
			},
			link: style.editorLink,
			list: {
				listitem: style.editorListItem,
				ol: style.editorList,
				ul: style.editorList,
			},
			paragraph: style.editorParagraph,
			quote: style.editorQuote,
			text: {
				bold: style.editorBold,
				code: style.editorInlineCode,
				italic: style.editorItalic,
				strikethrough: style.editorStrikethrough,
			},
		},
	};

	return (
		<div className={style.editorFrame} data-disabled={disabled || undefined}>
			<LexicalComposer initialConfig={initialConfig}>
				<EditorToolbar disabled={disabled} />
				<div className={style.editorContentShell}>
					<RichTextPlugin
						contentEditable={
							<ContentEditable
								aria-describedby={ariaDescribedBy}
								aria-disabled={disabled}
								aria-invalid={ariaInvalid}
								aria-labelledby="description-label"
								aria-multiline="true"
								aria-required="true"
								className={style.editorContentEditable}
								data-form-field="description"
								id="description"
								spellCheck
							/>
						}
						ErrorBoundary={LexicalErrorBoundary}
						placeholder={
							<div className={style.editorPlaceholder}>
								Describe what will happen and who the event is for…
							</div>
						}
					/>
				</div>
				<EditableStatePlugin disabled={disabled} />
				<HistoryPlugin />
				<LinkPlugin
					attributes={EVENT_DESCRIPTION_LINK_ATTRIBUTES}
					validateUrl={isSafeLink}
				/>
				<ListPlugin />
				<MarkdownShortcutPlugin transformers={EVENT_DESCRIPTION_TRANSFORMERS} />
				<MarkdownValuePlugin onChange={onChange} value={value} />
			</LexicalComposer>
			<input name="description" type="hidden" value={value} />
			<div className={style.editorFooter}>
				<span>We save your formatting as Markdown automatically.</span>
				<span
					aria-live="polite"
					className={value.length > 4_000 ? style.editorCountError : undefined}
				>
					{value.length.toLocaleString()} / 4,000
				</span>
			</div>
		</div>
	);
}
