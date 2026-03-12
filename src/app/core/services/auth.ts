import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class Auth {

  API = "http://localhost:8080/api/auth";
  
  constructor(private http: HttpClient){}

  login(data:any){
    return this.http.post(`${this.API}/login`,data)
  }

  logout(data:any){
    return this.http.post(`${this.API}/logout`,data)
  }

}
