import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { authGuard } from './guards/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';
import { roleGuard } from './guards/role-guard';
import { SeniorDashboard } from './pages/dashboard/senior-dashboard/senior-dashboard';
import { JuniorDashboard } from './pages/dashboard/junior-dashboard/junior-dashboard';

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
        canActivate: [authGuard],
        children: [
            {
                path: 'user-management',
                component: Dashboard,
            }
        ]
    },
    {
        path: 'senior',
        component: SeniorDashboard,
        canActivate: [authGuard, roleGuard],
        data: { roles: ['SENIOR'] }
    },

    {
        path: 'junior',
        component: JuniorDashboard,
        canActivate: [authGuard, roleGuard],
        data: { roles: ['JUNIOR'] }
    }
];
