import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserMgt } from './user-mgt';

describe('UserMgt', () => {
  let component: UserMgt;
  let fixture: ComponentFixture<UserMgt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserMgt]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserMgt);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
