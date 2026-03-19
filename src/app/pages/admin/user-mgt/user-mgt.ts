import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { UserService } from '../../../services/user.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User, UserCreateRequest, UserUpdateRequest } from '../../../models/user';

@Component({
  selector: 'app-user-mgt',
  imports: [ReactiveFormsModule],
  templateUrl: './user-mgt.html',
  styleUrl: './user-mgt.css',
})
export class UserMgt implements OnInit {
  private searchDebounceTimeout: any;

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

  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalElements = signal<number>(0);
  totalPages = signal<number>(0);

  selectedUserForEdit: User | null = null;
  deactivateUserTarget: User | null = null;
  deleteUserTarget: User | null = null;

  searchTerm = signal<string>('');

  roleFilter = signal<string>('');
  statusFilter = signal<string>('');

  visibleUsers = computed(() => {
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.users().filter(u => {
      if (role && u.role !== role) {
        return false;
      }
      if (status && u.status !== status) {
        return false;
      }
      return true;
    });
  });

  totalOnPage = computed(() => this.visibleUsers().length);
  activeOnPage = computed(() => this.visibleUsers().filter(u => u.status === 'ACTIVE').length);
  seniorOnPage = computed(() => this.visibleUsers().filter(u => u.role === 'SENIOR').length);
  disabledOnPage = computed(() => this.visibleUsers().filter(u => u.status === 'DISABLED').length);

  createForm = this.fb.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    role: ['JUNIOR', [Validators.required]],
    seniorId: [null], // TODO: we need to populate this with actual senior user id who is currently logged in...
  });

  editForm = this.fb.group({
    id: [{ value: '', disabled: true }],
    username: ['', [Validators.required]],
    email: [{ value: '', disabled: true }],
    role: ['JUNIOR', [Validators.required]],
    seniorId: [''],
    status: ['ACTIVE', [Validators.required]],
  });

  deactivateForm = this.fb.group({
    id: [''],
  });

  deleteForm = this.fb.group({
    id: [''],
    usernameConfirm: ['', [Validators.required]],
  });

  loadUsers() {
    const search = this.searchTerm();
    const page = this.currentPage();
    const size = this.pageSize();

    this.userService.getUsers({ search, page, size, sort: 'created_at', direction: 'desc' }).subscribe({
      next: (res) => {
        console.log(res);
        const pageData = res.data;
        this.users.set(pageData.content);
        this.currentPage.set(pageData.pageNumber);
        this.pageSize.set(pageData.pageSize);
        this.totalElements.set(pageData.totalElements);
        this.totalPages.set(pageData.totalPages);
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

  onEditUser() {
    if (this.editForm.invalid) {
      return;
    }

    const raw = this.editForm.getRawValue();
    const { id, ...rest } = raw;

    this.userService.updateUser(id as string, rest as UserUpdateRequest).subscribe({
      next: () => {
        this.loadUsers();
        this.closeEditUserModel();
      },
      error: (err) => console.error(err)
    });
  }

  onDeactivateUser() {
    if (this.deactivateForm.invalid) {
      return;
    }

    const { id } = this.deactivateForm.value;

    const user = this.users().find(u => u.id === id);
    if (!user) {
      return;
    }

    const payload: UserUpdateRequest = {
      username: user.username,
      email: user.email,
      role: user.role,
      seniorId: user.seniorId,
      status: 'DISABLED',
    };

    this.userService.updateUser(id as string, payload).subscribe({
      next: () => {
        this.loadUsers();
        this.closeDeactivateUserModel();
      },
      error: (err) => console.error(err)
    });
  }

  onDeleteUser() {
    if (this.deleteForm.invalid) {
      return;
    }

    const { id, usernameConfirm } = this.deleteForm.value;

    if (!this.deleteUserTarget || usernameConfirm?.trim() !== this.deleteUserTarget.username) {
      return;
    }

    this.userService.deleteUser(id as string).subscribe({
      next: () => {
        this.loadUsers();
        this.closeDeleteUserModel();
      },
      error: (err) => console.error(err)
    });
  }

  openCreateUserModel() {
    this.isCreateUserModelOpen.set(true);
  }

  closeCreateUserModel() {
    this.isCreateUserModelOpen.set(false);
    this.createForm.reset({
      username: '',
      email: '',
      password: '',
      role: 'JUNIOR',
      seniorId: null,
    });
  }

  openEditUserModel(user: User) {
    this.isEditUserModelOpen.set(true);
    this.selectedUserForEdit = user;
    this.editForm.reset({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      seniorId: user.seniorId ?? null,
      status: user.status,
    });
  }

  closeEditUserModel() {
    this.isEditUserModelOpen.set(false);
    this.selectedUserForEdit = null;
    this.editForm.reset({
      id: '',
      username: '',
      email: '',
      role: 'JUNIOR',
      seniorId: null,
      status: 'ACTIVE',
    });
  }

  openDeactivateUserModel(user: User) {
    this.isDeactivateUserModelOpen.set(true);
    this.deactivateUserTarget = user;
    this.deactivateForm.reset({
      id: user.id,
    });
  }

  closeDeactivateUserModel() {
    this.isDeactivateUserModelOpen.set(false);
    this.deactivateUserTarget = null;
    this.deactivateForm.reset({
      id: '',
    });
  }

  openDeleteUserModel(user: User) {
    this.isDeleteUserModelOpen.set(true);
    this.deleteUserTarget = user;
    this.deleteForm.reset({
      id: user.id,
      usernameConfirm: '',
    });
  }

  closeDeleteUserModel() {
    this.isDeleteUserModelOpen.set(false);
    this.deleteUserTarget = null;
    this.deleteForm.reset({
      id: '',
      usernameConfirm: '',
    });
  }

  onSearchChange(term: string) {
    clearTimeout(this.searchDebounceTimeout);
    this.searchDebounceTimeout = setTimeout(() => {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadUsers();
    }, 300);
  }

  onRoleFilterChange(role: string) {
    this.roleFilter.set(role);
  }

  onStatusFilterChange(status: string) {
    this.statusFilter.set(status);
  }

  goToPage(page: number) {
    if (page < 1 || (this.totalPages() && page > this.totalPages())) {
      return;
    }
    this.currentPage.set(page);
    this.loadUsers();
  }
}
