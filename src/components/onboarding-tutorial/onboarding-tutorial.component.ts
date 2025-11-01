import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiStateService } from '../../services/ui-state.service';

interface TutorialStep {
  title: string;
  content: string;
  highlightElement?: string;
}

@Component({
  selector: 'app-onboarding-tutorial',
  templateUrl: './onboarding-tutorial.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  standalone: true,
})
export class OnboardingTutorialComponent {
  private uiStateService = inject(UiStateService);
  currentStep = signal(0);

  steps: TutorialStep[] = [
    {
      title: 'Bem-vindo ao Analisador de Estratégias!',
      content: 'Vamos fazer um tour rápido pelas funcionalidades principais para você dominar o aplicativo.',
    },
    {
      title: '1. Adicione Resultados Facilmente',
      content: 'Na aba "Entrada", registre os números da roleta. Você pode digitar um por um ou usar a IA para extrair números de uma imagem do seu histórico de jogo.',
    },
    {
      title: '2. Crie Estratégias Inteligentes',
      content: 'Vá para "Estratégias" para montar sequências de apostas. Use o modo Avançado para criar lógicas complexas, como estratégias de Alvo ou as novas estratégias Cíclicas (baseadas em tempo e repetição).',
    },
    {
      title: '3. Analise com Precisão',
      content: 'A aba "Análise" é seu centro de inteligência. O destaque é o Mapa de Calor da roleta, que pode mostrar a Frequência dos números ou o Atraso (quais não saem há mais tempo).',
    },
    {
      title: '4. Simule e Valide Riscos',
      content: 'Na aba "Simulação", faça o backtest de suas estratégias. Simule uma banca com sistemas como Martingale, defina metas de Stop-Loss/Take-Profit e salve/carregue suas configurações de teste.',
    },
    {
      title: '5. Personalize Sua Experiência',
      content: 'Em "Config", ajuste tudo ao seu gosto. Alterne entre roleta Europeia e Americana, mude as cores do app e escolha exatamente quais cards de informação exibir em cada aba. Aproveite!',
    }
  ];

  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update(i => i + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update(i => i - 1);
    }
  }

  finish(): void {
    this.uiStateService.finishOnboarding();
  }
}