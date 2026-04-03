import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';


@Component({
  selector: 'app-forgotpassword',
  imports: [],
  templateUrl: './forgotpassword.html',
  styleUrl: './forgotpassword.css',
})

export class Forgotpassword {
  email='';
  newPassword='';
  
   private baseUrl = 'http://localhost:8080/api/auth';

  constructor(private http: HttpClient) {}

  login(data: any) {
    return this.http.post(`${this.baseUrl}/login`, data);
  }

  resetPassword(data: any) {
    return this.http.post(`${this.baseUrl}/users/reset-password`, data);
  }

}
