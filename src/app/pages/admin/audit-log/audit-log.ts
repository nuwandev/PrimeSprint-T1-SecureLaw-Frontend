import { Component, OnInit } from '@angular/core';
import { NavBar } from '../../../components/nav-bar/nav-bar';
import { AuditLogService} from '../../../services/audit-log';
import { AuditLog } from '../../../models/audit-log';
import { DatePipe } from '@angular/common';


@Component({
  selector: 'app-audit-log',
  imports: [NavBar, DatePipe],
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
        console.log('API DATA:', data); // ADD THIS
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load audit logs';
        console.error(err);
        this.auditLogs = []; // prevent UI break
        this.loading = false;
      }
    });
  }

  getMaskKeys(maskCounts: any): string[] {
    return maskCounts ? Object.keys(maskCounts) : [];
  }

  selectedLog: AuditLog | null = null;

  openLog(log: AuditLog) {
    this.selectedLog = log;
  }

  downloadCSV() {
    this.auditLogService.exportLogs().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'audit_logs.csv'; // filename

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      },
      error: (err) => {
        console.error('Export failed', err);
      }
    });
  }

}



