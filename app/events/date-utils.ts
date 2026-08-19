export function formatDateInTimeZone(
	date: Date,
	timeZone: string,
	options: Intl.DateTimeFormatOptions,
) {
	return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(
		date,
	);
}

export function formatDateKey(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		day: "2-digit",
		month: "2-digit",
		timeZone,
		year: "numeric",
	}).formatToParts(date);
	const getPart = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value;

	return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}
