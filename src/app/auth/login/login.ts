import { Component } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { Token } from '../../core/services/token';
import { Router } from '@angular/router';
import { form } from '@angular/forms/signals';

@Component({
  selector: 'app-login',
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  from = {
    userNameOrEmail:'',
    password:''
  }

  constructor(
    private authService:Auth,
    private tokenService:Token,
    private router:Router 
  ){}

  login(){
    this.authService.login(this.from).subscribe((res:any)=>{

      this.tokenService.setToken(res.token);
      this.tokenService.setRole(res.role);
      
      this.router.navigate(['/dashboard'])
    });
  }
}
