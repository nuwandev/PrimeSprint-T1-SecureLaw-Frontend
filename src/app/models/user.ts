export type UserRole = 'SENIOR' | 'JUNIOR' ;
export type UserStatus = 'ACTIVE' | 'DISABLED';

export interface User {
    id: string
    username: string
    email: string
    role: UserRole
    status: UserStatus
    seniorId: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface UserCreateRequest {
    username: string;
    email: string;
    password: string;
    role: UserRole;
    seniorId?: string | null;
}

export interface UserUpdateRequest {
    username: string;
    email: string;
    password?: string | null;
    role: UserRole;
    seniorId?: string | null;
    status: UserStatus | string;
}