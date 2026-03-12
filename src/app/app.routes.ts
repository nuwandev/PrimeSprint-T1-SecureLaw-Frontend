import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { authGuard } from './guards/auth-guard';
import { Dashboard } from './pages/dashboard/dashboard';

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
        path:'admin',
        canActivate:[authGuard],
        children:[
            {
                path:'user-management',
                component: Dashboard,
            }
        ]
    }
    // {
    //     path: 'admin/user-management',
    //     canActivate:[authGuard],
    //     // data:{roles:['Admin']}
    // },
    // {
    //     path:'profile',
    //     component: Profile,
    //     canActivate:[authGuard],
    //     // data:{roles:['SENIOR','JUNIOR']}
    // }
];
