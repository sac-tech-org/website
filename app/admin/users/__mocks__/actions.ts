import { fn } from "storybook/test";

const idleResult = () => ({ message: "", status: "idle" as const });

export const updateUserBan = fn(async () => idleResult());
export const updateUserRoles = fn(async () => idleResult());
