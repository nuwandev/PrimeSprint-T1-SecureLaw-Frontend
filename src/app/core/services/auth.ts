import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequest } from '../../models/auth';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class Auth {
  API = `${environment.apiUrl}/api/auth`;

  constructor(private http: HttpClient) {}

  login(data: LoginRequest) {
    return this.http.post(`${this.API}/login`, data);
  }

  logout(data: any) {
    return this.http.post(`${this.API}/logout`, data);
  }

  me() {
    return this.http.get(`${environment.apiUrl}/api/auth/me`);
  }
}
