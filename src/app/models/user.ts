export type UserRole = 'Admin' | 'Lawyer' | 'Staff';
export type UserStatus = 'Active' | 'Disabled';

export interface User{
    id:string
    userName:string
    email:string
    role:UserRole
    status:UserStatus
}