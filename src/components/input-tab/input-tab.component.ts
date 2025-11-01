
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { RouletteService } from '../../services/roulette.service';
import { GeminiService } from '../../services/gemini.service';
import { ToastService } from '../../services/toast.service';
import { UiLayoutService } from '../../services/ui-layout.service';
import { RecentResultsComponent } from '../recent-results/recent-results.component';
import { StrategyStreaksComponent } from '../strategy-streaks/strategy-streaks.component';
import { LiveCorrelationComponent } from '../live-correlation/live-correlation.component';

@Component({
  selector: 'app-input-tab',
  templateUrl: './input-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RecentResultsComponent, StrategyStreaksComponent, LiveCorrelationComponent]
})
export class InputTabComponent {
  rouletteService = inject(RouletteService);
  geminiService = inject(GeminiService);
  toastService = inject(ToastService);
  uiLayoutService = inject(UiLayoutService);

  isUploading = signal(false);
  singleNumberInput = signal<string>('');
  isAddingSequentially = signal(false);
  private addSequenceController: AbortController | null = null;
  
  isAddResultMinimized = this.uiLayoutService.isMinimized('inputTabAddResult');

  // Card order and visibility signals
  cards = this.uiLayoutService.inputTabCards;
  isCardVisible = (key: string) => this.uiLayoutService.isVisible(key)();

  stats = this.rouletteService.stats;
  
  private stopSequence(): void {
    if (this.addSequenceController) {
      this.addSequenceController.abort(); // Signal cancellation
    }
  }
  
  onNumberInputChange(value: string | number | null): void {
    this.singleNumberInput.set(String(value ?? ''));
  }

  addSingleNumber(): void {
    this.stopSequence();
    const numStr = this.singleNumberInput().trim();
    if (numStr === '') return;

    if (numStr === '00') {
      this.rouletteService.addResult('00');
      this.singleNumberInput.set('');
      return;
    }

    const num = parseInt(numStr, 10);
    if (!isNaN(num) && num >= 0 && num <= 36) {
      this.rouletteService.addResult(num);
      this.singleNumberInput.set('');
    } else {
      this.toastService.show('Por favor, insira um número válido (0-36 ou 00).', 'error');
    }
  }

  async addNumbersSequentially(numbers: number[]): Promise<void> {
    this.stopSequence(); // Abort any previous sequence
    if (numbers.length === 0) return;

    this.addSequenceController = new AbortController();
    const signal = this.addSequenceController.signal;

    this.isAddingSequentially.set(true);

    try {
      for (const num of numbers) {
        if (signal.aborted) {
          // The sequence was cancelled by another user action
          return;
        }
        this.rouletteService.addResult(num);
        // Wait for 300ms, but make the wait cancellable
        await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 300);
          signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Sequence aborted', 'AbortError'));
          });
        });
      }
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') {
        // Rethrow if it's not our expected abort error
        throw e;
      }
      // Otherwise, just log that it was cancelled and exit gracefully
      console.log("Sequence was cancelled successfully.");
    } finally {
      this.isAddingSequentially.set(false);
      this.addSequenceController = null;
    }
  }

  onFileSelected(event: Event): void {
    this.stopSequence();
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
        this.toastService.show('Por favor, selecione um arquivo de imagem.', 'error');
        return;
    }
    const reader = new FileReader();
    
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      this.isUploading.set(true);
      
      this.geminiService.extractNumbersFromImage(base64String, file.type)
        .pipe(finalize(() => this.isUploading.set(false)))
        .subscribe(result => {
          if ('error' in result) {
            this.toastService.show(result.error, 'error');
          } else if (result.numbers && result.numbers.length > 0) {
            const numbersInOrder = result.numbers.slice().reverse();
            this.addNumbersSequentially(numbersInOrder); // Fire and let it run
            this.toastService.show(`Extraiu ${result.numbers.length} números. Adicionando sequencialmente...`, 'success');
          } else {
             this.toastService.show('Nenhum número válido encontrado na imagem.', 'warning');
          }
        });
    };
    
    reader.onerror = () => {
        this.toastService.show('Erro ao ler o arquivo.', 'error');
    }
    
    reader.readAsDataURL(file);
    input.value = '';
  }

  undo(): void {
    this.stopSequence();
    this.rouletteService.undoLastResult();
  }

  clear(): void {
    this.stopSequence();
    this.rouletteService.clearResults();
    this.toastService.show('Todos os resultados foram limpos.', 'info');
  }
  
  toggleAddResultMinimized(): void {
    this.uiLayoutService.toggleMinimized('inputTabAddResult');
  }
}