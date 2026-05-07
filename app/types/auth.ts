export type AuthUser = {
	id: string;
	email: string;
	name: string;
};

export type RouterContext = {
	auth: { user: AuthUser | null };
};
