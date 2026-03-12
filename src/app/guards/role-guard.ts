import { CanActivateFn } from '@angular/router';

export const roleGuard: CanActivateFn = (route) => {

  const userRole = localStorage.getItem("role");

  const allowedRoles = route.data['roles'];

  if(allowedRoles.includes(userRole)){
    return true;
  }

  return false;

};
