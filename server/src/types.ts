export type Role = 'student' | 'club_admin' | 'college_admin';

export interface AuthUser {
    id: number;
    name: string;
    role: Role;
}

export interface UserRow {
    id: number;
    name: string;
    email: string;
    role: Role;
    password_hash: string;
    created_at: Date;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}
