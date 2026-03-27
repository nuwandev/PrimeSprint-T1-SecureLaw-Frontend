import { Component, OnInit } from '@angular/core';
import { NavBar } from '../../../components/nav-bar/nav-bar';
import { AuditLogService, AuditLog} from '../../../services/audit-log';


@Component({
  selector: 'app-audit-log',
  imports: [NavBar],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.css',
})
export class AuditLogComponent implements OnInit {

  auditLogs: AuditLog[] = [];
  loading = false;
  error = '';

  constructor(private auditLogService: AuditLogService) {}

  ngOnInit(): void {
    this.loadAuditLogs();
  }

  loadAuditLogs(): void {
    this.loading = true;

    this.auditLogService.getAuditLogs().subscribe({
      next: (data) => {
        this.auditLogs = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load audit logs';
        console.error(err);
        this.loading = false;
      }
    });
  }

}
