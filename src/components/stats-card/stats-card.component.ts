
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stats-card',
  template: `
    <div class="glass-card p-4 flex flex-col items-start">
      <h3 class="text-sm font-medium text-muted-foreground">{{ label() }}</h3>
      <p class="text-2xl font-bold mt-1 text-primary">{{ value() }}</p>
      @if(description()) {
        <p class="text-xs text-muted-foreground mt-1">{{ description() }}</p>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule]
})
export class StatsCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  description = input<string>();
}