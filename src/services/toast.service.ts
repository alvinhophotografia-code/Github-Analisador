
import { Injectable, signal, WritableSignal } from '@angular/core';
import { Toast, ToastType } from '../types';

@Injectable({ providedIn: 'root' })
export class ToastService {
  toasts: WritableSignal<Toast[]> = signal([]);
  private nextId = 0;

  show(message: string, type: ToastType = 'info', duration: number = 5000): void {
    const id = this.nextId++;
    this.toasts.update(currentToasts => [
      ...currentToasts,
      { id, message, type },
    ]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  remove(id: number): void {
    this.toasts.update(currentToasts =>
      currentToasts.filter(toast => toast.id !== id)
    );
  }
}