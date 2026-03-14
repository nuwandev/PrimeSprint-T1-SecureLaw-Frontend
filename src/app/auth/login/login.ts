import { Component, inject } from '@angular/core';
import { Auth } from '../../core/services/auth';
import { Token } from '../../core/services/token';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LoginRequest } from '../../models/auth';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {

  private readonly fb = inject(FormBuilder);
  showPassword : boolean = false;

  constructor(
    private authService: Auth,
    private tokenService: Token,
    private router: Router
  ) { }

  loginForm = this.fb.group({
    usernameOrEmail: ['', Validators.required],
    password: ['', Validators.required]
  });

  login() {

    if (this.loginForm.invalid) {
      return;
    }

    this.authService.login(this.loginForm.value as LoginRequest).subscribe((res: any) => {

      this.tokenService.setToken(res.token);
      this.tokenService.setRole(res.role);

      if (res.role === 'SENIOR') {
        this.router.navigate(['/admin/user-management']);
      } else {
        this.router.navigate(['/chat']);
      }
    });
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }
}
