import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "SacTech";
export const size = {
	width: 1200,
	height: 630,
};
export const contentType = "image/png";

const publicImages = join(process.cwd(), "public", "images");
const footerImages = join(publicImages, "footer");

const [cityData, flowerData, bridgeData, stickerData] = await Promise.all([
	readFile(join(footerImages, "city-outline.svg"), "base64"),
	readFile(join(footerImages, "flower.svg"), "base64"),
	readFile(join(footerImages, "bridge-part.svg"), "base64"),
	readFile(join(publicImages, "opengraph", "sactech-sticker.png"), "base64"),
]);

const citySrc = `data:image/svg+xml;base64,${cityData}`;
const flowerSrc = `data:image/svg+xml;base64,${flowerData}`;
const bridgeSrc = `data:image/svg+xml;base64,${bridgeData}`;
const stickerSrc = `data:image/png;base64,${stickerData}`;
const bridgeTiles = Array.from({ length: 9 });

export default function OpenGraphImage() {
	return new ImageResponse(
		<div
			style={{
				alignItems: "center",
				backgroundColor: "#042849",
				color: "#fff5e5",
				display: "flex",
				height: "100%",
				justifyContent: "center",
				overflow: "hidden",
				position: "relative",
				width: "100%",
			}}
		>
			<div
				style={{
					backgroundColor: "#ed8403",
					display: "flex",
					height: 34,
					left: 0,
					position: "absolute",
					right: 0,
					top: 0,
				}}
			/>

			<img
				alt=""
				height={200}
				src={citySrc}
				style={{
					bottom: 80,
					height: 200,
					left: 44,
					position: "absolute",
					width: 360,
				}}
				width={360}
			/>

			<img
				alt=""
				height={400}
				src={flowerSrc}
				style={{
					bottom: 50,
					height: 400,
					position: "absolute",
					right: 40,
					width: 216,
				}}
				width={216}
			/>

			<div
				style={{
					alignItems: "center",
					display: "flex",
					flexDirection: "column",
					height: 496,
					justifyContent: "center",
					left: 320,
					position: "absolute",
					top: 34,
					width: 560,
				}}
			>
				<img
					alt=""
					height={480}
					src={stickerSrc}
					style={{ height: 480, width: 480 }}
					width={480}
				/>
			</div>

			<div
				style={{
					backgroundColor: "#fbc543",
					bottom: 0,
					display: "flex",
					height: 100,
					left: 0,
					overflow: "hidden",
					position: "absolute",
					width: "100%",
				}}
			>
				{bridgeTiles.map((_, index) => (
					<img
						alt=""
						height={100}
						key={index}
						src={bridgeSrc}
						style={{
							flexShrink: 0,
							height: 100,
							marginLeft: index === 0 ? -30 : -1,
							width: 141,
						}}
						width={141}
					/>
				))}
			</div>
		</div>,
		{
			...size,
		},
	);
}
