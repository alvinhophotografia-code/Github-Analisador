
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { ToastType } from '../../types';

@Component({
  selector: 'app-toast-container',
  template: `
    <div class="fixed top-4 right-4 z-50 space-y-3">
      @for (toast of toasts(); track toast.id) {
        <div 
          role="alert"
          (click)="toastService.remove(toast.id)"
          [class]="'toast-item animate-slide-in-right ' + toastClasses(toast.type)">
          <div class="flex-shrink-0 text-lg">
            @switch (toast.type) {
              @case ('success') { <span>✔️</span> }
              @case ('error') { <span>❌</span> }
              @case ('warning') { <span>⚠️</span> }
              @case ('info') { <span>ℹ️</span> }
            }
          </div>
          <p class="flex-1 text-sm font-medium pr-4">{{ toast.message }}</p>
          <button (click)="toastService.remove(toast.id)" class="toast-close-btn">&times;</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .toast-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1rem;
      border-radius: var(--radius);
      width: 350px;
      max-width: 90vw;
      border: 1px solid;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      cursor: pointer;
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
    }
    .toast-close-btn {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      opacity: 0.7;
      background: none;
      border: none;
      font-size: 1.25rem;
      line-height: 1;
      padding: 0;
      color: inherit;
    }
    .toast-close-btn:hover {
      opacity: 1;
    }
    .success {
      border-color: hsl(142 71% 45% / 0.5);
      color: hsl(142 90% 90%);
    }
    .error {
      border-color: hsl(0 84% 60% / 0.5);
      color: hsl(0 90% 90%);
    }
    .info {
      border-color: hsl(var(--border));
      color: hsl(var(--secondary-foreground));
    }
    .warning {
      border-color: hsl(48 96% 53% / 0.5);
      color: hsl(48 90% 90%);
    }
    @keyframes slide-in-right {
      from {
        opacity: 0;
        transform: translateX(calc(100% + 1rem));
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
    .animate-slide-in-right {
      animation: slide-in-right 0.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
  toasts = this.toastService.toasts;

  toastClasses(type: ToastType): string {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
    }
  }
}