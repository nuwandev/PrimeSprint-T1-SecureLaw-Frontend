import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { LoginRequest } from '../../models/auth';

@Injectable({
  providedIn: 'root',
})
export class Auth {

  API = "http://localhost:8080/api/auth";

  constructor(private http: HttpClient) { }

  login(data: LoginRequest) {
    return this.http.post(`${this.API}/login`, data)
  }

  logout(data: any) {
    return this.http.post(`${this.API}/logout`, data)
  }

  me(){
  return this.http.get(
    "http://localhost:8080/api/auth/me"
  );
}
}
