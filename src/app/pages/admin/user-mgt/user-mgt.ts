import { Component, inject, OnInit, signal } from '@angular/core';
import { UserService } from '../../../services/user.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User, UserCreateRequest } from '../../../models/user';

@Component({
  selector: 'app-user-mgt',
  imports: [ReactiveFormsModule],
  templateUrl: './user-mgt.html',
  styleUrl: './user-mgt.css',
})
export class UserMgt implements OnInit {

  private userService = inject(UserService);
  private fb = inject(FormBuilder);

  ngOnInit(): void {
    this.loadUsers();
  }

  isCreateUserModelOpen = signal(false);
  isEditUserModelOpen = signal(false);
  isDeactivateUserModelOpen = signal(false);
  isDeleteUserModelOpen = signal(false);

  users = signal<User[]>([]);

  createForm = this.fb.group({
    username: ['', Validators.required],
    email: ['', Validators.required, Validators.email],
    password: ['', Validators.required],
    role: ['JUNIOR'],
    seniorId: [null], // TODO: we need to populate this with actual senior user id who is currently logged in...
  });

  loadUsers() {
    this.userService.getUsers().subscribe({
      next: (res) => {
        console.log(res);
        this.users.set(res.data.content);
      },
      error: (err) => console.error(err)
    });
  }

  onCreateUser() {
    if (this.createForm.invalid) {
      return;
    }

    this.userService.createUser(this.createForm.value as unknown as UserCreateRequest).subscribe({
      next: (res) => {
        console.log(res);
        this.loadUsers();
        this.closeCreateUserModel();
      }, error: (err) => console.error(err)
    });
  }

  openCreateUserModel() {
    this.isCreateUserModelOpen.set(true);
  }

  closeCreateUserModel() {
    this.isCreateUserModelOpen.set(false);
    // reset form
    this.createForm.reset({
      username: '',
      email: '',
      password: '',
      role: 'JUNIOR',
      seniorId: null,
    });
  }

  openEditUserModel() {
    this.isEditUserModelOpen.set(true);
  }

  closeEditUserModel() {
    this.isEditUserModelOpen.set(false);
    // reset form
  }

  openDeactivateUserModel() {
    this.isDeactivateUserModelOpen.set(true);
  }

  closeDeactivateUserModel() {
    this.isDeactivateUserModelOpen.set(false);
    // reset form
  }

  openDeleteUserModel() {
    this.isDeleteUserModelOpen.set(true);
  }

  closeDeleteUserModel() {
    this.isDeleteUserModelOpen.set(false);
    // reset form
  }
}
