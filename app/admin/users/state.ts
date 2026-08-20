export interface UserManagementActionState {
	status: "idle" | "error" | "success";
	message: string;
}

export const initialUserManagementActionState: UserManagementActionState = {
	status: "idle",
	message: "",
};
