export type UserRole = 'SENIOR' | 'JUNIOR' ;
export type UserStatus = 'Active' | 'Disabled';

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
    seniorId: string;
}