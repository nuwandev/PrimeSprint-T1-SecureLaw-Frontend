import { Component, OnInit, signal } from '@angular/core';
import { HealthService } from './services/health';
import { environment } from '../environments/environment';
import { RouterOutlet } from '@angular/router';
import { UserService } from './services/user.service';
import { finalize } from 'rxjs';
import { User } from './models/user';
import { Theme } from './core/services/theme';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('SecureLaw');
  users = signal<User[]>([]);
  loading = signal(false);
  errorMsg = signal('');

  constructor(
    private readonly healthService: HealthService,
    private readonly userService: UserService,
    private readonly theme: Theme,
  ) {}

  ngOnInit(): void {
    console.log(`Backend URL :${environment.apiUrl}`);

    this.healthService.checkBackend().subscribe({
      next: (res) => console.log('Backend is UP', res),
      error: (err) => console.error('Backend is DOWN', err),
    });

    this.loadUsers();
  }

  protected loadUsers(): void {
    this.loading.set(true);
    this.errorMsg.set('');

    this.userService
      .getUsers()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.users.set(res.data?.content ?? []),
        error: (err) => {
          console.error(err);
          this.errorMsg.set('Failed to load users. Please try again later.');
        },
      });
  }
}
