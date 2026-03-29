import { Component, OnInit } from '@angular/core';
import { NavBar } from '../../../components/nav-bar/nav-bar';
import { AuditLogService} from '../../../services/audit-log';
import { AuditLog } from '../../../models/audit-log';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-audit-log',
  imports: [NavBar, DatePipe, FormsModule],
  templateUrl: './audit-log.html',
  styleUrl: './audit-log.css',
})
export class AuditLogComponent implements OnInit {

  filters = {
    userId: '',
    fromDate: '',
    toDate: ''
  };

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

  // MAIN FILTER FUNCTION
  applyFilters() {
    const { userId, fromDate, toDate } = this.filters;

    this.loading = true;

    // CASE 1: userId + date range
    if (userId && fromDate && toDate) {
      this.auditLogService.getByDateAndUser(userId, fromDate, toDate)
        .subscribe({
          next: (res) => {
            this.auditLogs = res;
            this.loading = false;
          },
          error: () => this.loading = false
        });
    }

    // CASE 2: only userId
    else if (userId) {
      this.auditLogService.getByUserId(userId)
        .subscribe({
          next: (res) => {
            this.auditLogs = res;
            this.loading = false;
          },
          error: () => this.loading = false
        });
    }

    // CASE 3: only date range
    else if (fromDate && toDate) {
      this.auditLogService.getByDate(fromDate, toDate)
        .subscribe({
          next: (res) => {
            this.auditLogs = res;
            this.loading = false;
          },
          error: () => this.loading = false
        });
    }

    // CASE 4: no filters
    else {
      this.loadAuditLogs();
    }
  }

  // RESET
  resetFilters() {
    this.filters = {
      userId: '',
      fromDate: '',
      toDate: ''
    };

    this.loadAuditLogs();
  }





  

}



