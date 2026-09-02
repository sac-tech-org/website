import { fn } from "storybook/test";

const idleResult = () => ({ message: "", status: "idle" as const });

export const cancelEvent = fn(async () => idleResult());
export const inviteEventCollaborator = fn(async () => idleResult());
export const moderateEvent = fn(async () => idleResult());
export const moderateEventEdit = fn(async () => idleResult());
export const requestEventEdit = fn(async () => idleResult());
export const submitEvent = fn(async () => idleResult());
