import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { UserMgt } from './pages/admin/user-mgt/user-mgt';
import { authGuard } from './guards/auth-guard';
import { roleGuard } from './guards/role-guard';
import { Chat } from './pages/chat/chat';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login',
        pathMatch: 'full'
    },
    {
        path: 'login',
        component: Login
    },
    {
        path: 'admin',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['SENIOR'] },
        children: [
            {
                path: 'user-management',
                component: UserMgt
            }
        ]
    },
    {
        path: 'chat',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['SENIOR', 'JUNIOR'] },
        component: Chat
    }
];
