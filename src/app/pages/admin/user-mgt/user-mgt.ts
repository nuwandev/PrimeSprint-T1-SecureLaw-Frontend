import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { UserService } from '../../../services/user.service';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { User, UserCreateRequest, UserUpdateRequest } from '../../../models/user';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, startWith } from 'rxjs';
import { NavBar } from '../../../components/nav-bar/nav-bar';

type RoleValue = 'SENIOR' | 'JUNIOR' | '';
@Component({
  selector: 'app-user-mgt',
  imports: [ReactiveFormsModule, NavBar],
  templateUrl: './user-mgt.html',
  styleUrl: './user-mgt.css',
})
export class UserMgt implements OnInit {
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  usersLoading = signal(false);
  usersLoadError = signal('');

  createSubmitted = signal(false);
  editSubmitted = signal(false);
  deleteSubmitted = signal(false);

  createRole = signal<RoleValue>('JUNIOR');
  createSubmitting = signal(false);
  createError = signal('');

  editRole = signal<RoleValue>('');
  editSubmitting = signal(false);
  editError = signal('');

  deactivateSubmitting = signal(false);
  deactivateError = signal('');

  deleteSubmitting = signal(false);
  deleteError = signal('');

  private getApiErrorMessage(err: unknown, fallback: string): string {
    if (!err || typeof err !== 'object') {
      return fallback;
    }

    const maybeErr = err as {
      message?: unknown;
      error?: {
        message?: unknown;
        error?: unknown;
      };
    };

    const message = maybeErr.error?.message ?? maybeErr.error?.error ?? maybeErr.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  ngOnInit(): void {
    // Keep UI state in sync with selected role.
    this.createForm.controls.role.valueChanges
      .pipe(startWith(this.createForm.controls.role.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        const roleValue = (role ?? '').toString().trim().toUpperCase() as RoleValue;
        this.createRole.set(roleValue);

        const seniorIdCtrl = this.createForm.controls.seniorId;

        // If creating a JUNIOR user, seniorId is required.
        if (roleValue === 'JUNIOR') {
          seniorIdCtrl.setValidators([Validators.required]);
        } else {
          seniorIdCtrl.clearValidators();
        }

        // If creating a SENIOR user, seniorId must be null.
        if (roleValue !== 'JUNIOR') {
          seniorIdCtrl.setValue(null);
        }

        seniorIdCtrl.updateValueAndValidity({ emitEvent: false });
      });

    this.editForm.controls.role.valueChanges
      .pipe(startWith(this.editForm.controls.role.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        const roleValue = (role ?? '').toString().trim().toUpperCase() as RoleValue;
        this.editRole.set(roleValue);

        const seniorIdCtrl = this.editForm.controls.seniorId;

        // If editing to JUNIOR, seniorId is required.
        if (roleValue === 'JUNIOR') {
          seniorIdCtrl.setValidators([Validators.required]);
        } else {
          seniorIdCtrl.clearValidators();
        }

        // If editing to SENIOR, clear seniorId.
        if (roleValue !== 'JUNIOR') {
          seniorIdCtrl.setValue('');
        }

        seniorIdCtrl.updateValueAndValidity({ emitEvent: false });
      });

    this.loadUsers();
    this.loadSeniorOptions();
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

    return this.users().filter((u) => {
      if (role && u.role !== role) {
        return false;
      }
      if (status && u.status !== status) {
        return false;
      }
      return true;
    });
  });

  totalOnPage = computed(() => this.users().length);
  activeOnPage = computed(() => this.users().filter((u) => u.status === 'ACTIVE').length);
  seniorOnPage = computed(() => this.users().filter((u) => u.role === 'SENIOR').length);
  disabledOnPage = computed(() => this.users().filter((u) => u.status === 'DISABLED').length);

  availableSeniors = computed(() =>
    this.users().filter((u) => u.role === 'SENIOR' && u.status === 'ACTIVE'),
  );

  private readonly seniorOptions = signal<User[]>([]);
  seniorSelectOptions = computed(() => {
    const byId = new Map<string, User>();
    for (const u of this.seniorOptions()) {
      byId.set(u.id, u);
    }
    for (const u of this.availableSeniors()) {
      byId.set(u.id, u);
    }
    return Array.from(byId.values()).sort((a, b) => a.username.localeCompare(b.username));
  });

  createForm = this.fb.group({
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/),
      ],
    ],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    role: ['JUNIOR', [Validators.required]],
    seniorId: [null],
  });

  editForm = this.fb.group({
    id: [{ value: '', disabled: true }],
    username: [
      '',
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(50),
        Validators.pattern(/^[a-zA-Z0-9._-]+$/),
      ],
    ],
    email: [{ value: '', disabled: true }],
    role: ['JUNIOR', [Validators.required]],
    seniorId: [''],
    status: ['ACTIVE', [Validators.required]],
  });

  deactivateForm = this.fb.group({
    id: ['', [Validators.required]],
  });

  deleteForm = this.fb.group({
    id: ['', [Validators.required]],
    usernameConfirm: ['', [Validators.required]],
  });

  private matchDeleteUsernameValidator(
    expectedUsername: () => string | null | undefined,
  ): ValidatorFn {
    return (control: AbstractControl) => {
      const expected = (expectedUsername() ?? '').toString().trim();
      if (!expected) {
        return null;
      }
      const actual = (control.value ?? '').toString().trim();
      return actual === expected ? null : { usernameMismatch: true };
    };
  }

  private showError(control: AbstractControl | null, submitted: boolean): boolean {
    return !!control && control.invalid && (control.touched || submitted);
  }

  showCreateFieldError(field: 'username' | 'email' | 'password' | 'role' | 'seniorId'): boolean {
    return this.showError(this.createForm.get(field), this.createSubmitted());
  }

  createFieldErrorText(field: 'username' | 'email' | 'password' | 'role' | 'seniorId'): string {
    const control = this.createForm.get(field);
    const errors = control?.errors;
    if (!errors) {
      return '';
    }
    if (errors['required']) {
      if (field === 'seniorId') {
        return 'Please select a senior lawyer.';
      }
      return 'This field is required.';
    }
    if (errors['email']) {
      return 'Please enter a valid email address.';
    }
    if (errors['minlength']) {
      const requiredLength = errors['minlength']?.requiredLength;
      return `Must be at least ${requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength']?.requiredLength;
      return `Must be at most ${requiredLength} characters.`;
    }
    if (errors['pattern']) {
      return 'Only letters, numbers, dot, underscore, and hyphen are allowed.';
    }
    return 'Invalid value.';
  }

  showEditFieldError(field: 'username' | 'role' | 'seniorId' | 'status'): boolean {
    return this.showError(this.editForm.get(field), this.editSubmitted());
  }

  editFieldErrorText(field: 'username' | 'role' | 'seniorId' | 'status'): string {
    const control = this.editForm.get(field);
    const errors = control?.errors;
    if (!errors) {
      return '';
    }
    if (errors['required']) {
      if (field === 'seniorId') {
        return 'Please select a senior lawyer.';
      }
      return 'This field is required.';
    }
    if (errors['minlength']) {
      const requiredLength = errors['minlength']?.requiredLength;
      return `Must be at least ${requiredLength} characters.`;
    }
    if (errors['maxlength']) {
      const requiredLength = errors['maxlength']?.requiredLength;
      return `Must be at most ${requiredLength} characters.`;
    }
    if (errors['pattern']) {
      return 'Only letters, numbers, dot, underscore, and hyphen are allowed.';
    }
    return 'Invalid value.';
  }

  showDeleteFieldError(field: 'usernameConfirm'): boolean {
    return this.showError(this.deleteForm.get(field), this.deleteSubmitted());
  }

  deleteFieldErrorText(field: 'usernameConfirm'): string {
    const control = this.deleteForm.get(field);
    const errors = control?.errors;
    if (!errors) {
      return '';
    }
    if (errors['required']) {
      return 'Please type the username to confirm.';
    }
    if (errors['usernameMismatch']) {
      return 'Username confirmation does not match.';
    }
    return 'Invalid value.';
  }

  loadUsers() {
    const search = this.searchTerm();
    const page = this.currentPage();
    const size = this.pageSize();

    this.usersLoadError.set('');
    this.usersLoading.set(true);

    this.userService
      .getUsers({ search, page, size, sort: 'username', direction: 'asc' })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.usersLoading.set(false)),
      )
      .subscribe({
        next: (res) => {
          const pageData = res.data;
          this.users.set(pageData.content);
          this.currentPage.set(pageData.pageNumber);
          this.pageSize.set(pageData.pageSize);
          this.totalElements.set(pageData.totalElements);
          this.totalPages.set(pageData.totalPages);
        },
        error: (err) => {
          console.error(err);
          this.usersLoadError.set(this.getApiErrorMessage(err, 'Failed to load users.'));
        },
      });
  }

  private loadSeniorOptions() {
    // Best-effort: fetch a larger page and filter SENIOR users for dropdowns.
    this.userService
      .getUsers({ page: 1, size: 200, sort: 'username', direction: 'asc' })
      .subscribe({
        next: (res) => {
          const pageData = res.data;
          const seniors = (pageData?.content ?? []).filter((u) => u.role === 'SENIOR');
          this.seniorOptions.set(seniors);
        },
        error: () => {
          // Ignore; UI can still use seniors from current page.
        },
      });
  }

  onCreateUser() {
    this.createSubmitted.set(true);
    this.createError.set('');

    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    const raw = this.createForm.getRawValue();
    const role = (raw.role ?? '').toString().trim().toUpperCase();
    const seniorIdRaw = (raw.seniorId ?? '').toString().trim();

    const payload: UserCreateRequest = {
      username: (raw.username ?? '').toString().trim(),
      email: (raw.email ?? '').toString().trim(),
      password: (raw.password ?? '').toString(),
      role: role as UserCreateRequest['role'],
      seniorId: role === 'JUNIOR' ? seniorIdRaw || null : null,
    };

    this.createSubmitting.set(true);
    this.userService
      .createUser(payload)
      .pipe(finalize(() => this.createSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.loadSeniorOptions();
          this.closeCreateUserModel();
        },
        error: (err) => {
          console.error(err);
          const apiMessage =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            'Failed to create user. Please try again.';
          this.createError.set(apiMessage);
        },
      });
  }

  onEditUser() {
    this.editSubmitted.set(true);
    this.editError.set('');

    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue();

    const id = (raw.id ?? '').toString();
    const role = (raw.role ?? '').toString().trim().toUpperCase();
    const seniorIdRaw = (raw.seniorId ?? '').toString().trim();

    const payload: UserUpdateRequest = {
      username: (raw.username ?? '').toString().trim(),
      email: (raw.email ?? '').toString().trim(),
      role: role as UserUpdateRequest['role'],
      seniorId: role === 'JUNIOR' ? seniorIdRaw || null : null,
      status: (raw.status ?? '').toString().trim().toUpperCase(),
    };

    this.editSubmitting.set(true);
    this.userService
      .updateUser(id, payload)
      .pipe(finalize(() => this.editSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.loadSeniorOptions();
          this.closeEditUserModel();
        },
        error: (err) => {
          console.error(err);
          const apiMessage =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            'Failed to update user. Please try again.';
          this.editError.set(apiMessage);
        },
      });
  }

  onDeactivateUser() {
    this.deactivateError.set('');

    if (this.deactivateForm.invalid) {
      return;
    }

    const { id } = this.deactivateForm.value;

    const user = this.users().find((u) => u.id === id);
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

    this.deactivateSubmitting.set(true);
    this.userService
      .updateUser(id as string, payload)
      .pipe(finalize(() => this.deactivateSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.closeDeactivateUserModel();
        },
        error: (err) => {
          console.error(err);
          const apiMessage =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            'Failed to deactivate user. Please try again.';
          this.deactivateError.set(apiMessage);
        },
      });
  }

  onDeleteUser() {
    this.deleteSubmitted.set(true);
    this.deleteError.set('');

    if (this.deleteForm.invalid) {
      this.deleteForm.markAllAsTouched();
      return;
    }

    const { id, usernameConfirm } = this.deleteForm.value;

    // Extra safety in case the target changed while the modal is open.
    if (usernameConfirm?.trim() !== this.deleteUserTarget?.username) {
      this.deleteForm.controls.usernameConfirm.updateValueAndValidity();
      this.deleteForm.markAllAsTouched();
      return;
    }

    this.deleteSubmitting.set(true);
    this.userService
      .deleteUser(id as string)
      .pipe(finalize(() => this.deleteSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.loadUsers();
          this.closeDeleteUserModel();
        },
        error: (err) => {
          console.error(err);
          const apiMessage =
            err?.error?.message ??
            err?.error?.error ??
            err?.message ??
            'Failed to delete user. Please try again.';
          this.deleteError.set(apiMessage);
        },
      });
  }

  openCreateUserModel() {
    this.isCreateUserModelOpen.set(true);
    this.createSubmitted.set(false);
  }

  closeCreateUserModel() {
    this.isCreateUserModelOpen.set(false);
    this.createSubmitting.set(false);
    this.createError.set('');
    this.createRole.set('JUNIOR');
    this.createSubmitted.set(false);
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
    this.editError.set('');
    this.editSubmitted.set(false);
    this.editForm.reset({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      seniorId: user.seniorId ?? '',
      status: user.status,
    });
  }

  closeEditUserModel() {
    this.isEditUserModelOpen.set(false);
    this.selectedUserForEdit = null;
    this.editSubmitting.set(false);
    this.editError.set('');
    this.editRole.set('');
    this.editSubmitted.set(false);
    this.editForm.reset({
      id: '',
      username: '',
      email: '',
      role: 'JUNIOR',
      seniorId: '',
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
    this.deactivateSubmitting.set(false);
    this.deactivateError.set('');
    this.deactivateForm.reset({
      id: '',
    });
  }

  openDeleteUserModel(user: User) {
    this.isDeleteUserModelOpen.set(true);
    this.deleteUserTarget = user;
    this.deleteSubmitted.set(false);
    this.deleteForm.reset({
      id: user.id,
      usernameConfirm: '',
    });

    this.deleteForm.controls.usernameConfirm.setValidators([
      Validators.required,
      this.matchDeleteUsernameValidator(() => this.deleteUserTarget?.username),
    ]);
    this.deleteForm.controls.usernameConfirm.updateValueAndValidity({ emitEvent: false });
  }

  closeDeleteUserModel() {
    this.isDeleteUserModelOpen.set(false);
    this.deleteUserTarget = null;
    this.deleteSubmitting.set(false);
    this.deleteError.set('');
    this.deleteSubmitted.set(false);
    this.deleteForm.reset({
      id: '',
      usernameConfirm: '',
    });
  }

  onSearchChange(term: string) {
    // Ensure the search term updates correctly without interference
    if (this.searchTerm() !== term) {
      this.searchTerm.set(term);
      this.currentPage.set(1);
      this.loadUsers();
    }
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
