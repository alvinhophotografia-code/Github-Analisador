
import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse } from '@google/genai';
import { from, map, catchError, of } from 'rxjs';
import { Strategy, StrategyValue } from '../types';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    // IMPORTANT: The API key must be set as an environment variable `process.env.API_KEY`
    // in the execution environment. This code assumes its presence.
    try {
        if (process.env.API_KEY) {
            this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        } else {
            console.error("API_KEY environment variable not set. Gemini Service will be disabled.");
        }
    } catch (e) {
        console.error("Error initializing GoogleGenAI:", e);
    }
  }

  extractNumbersFromImage(base64Image: string, mimeType: string) {
    if (!this.ai) {
        return of({ error: 'Serviço Gemini não inicializado. A chave da API pode estar faltando.' });
    }
    
    const imagePart = {
        inlineData: {
            mimeType,
            data: base64Image,
        },
    };

    const textPart = {
        text: `Você é um especialista em analisar resultados de roleta europeia (números de 0 a 36). Analise a imagem e extraia todos os números visíveis em ordem de aparição.`
    };
    
    const promise = this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, imagePart] },
        config: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    numbers: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.NUMBER,
                        },
                        description: 'Uma lista de todos os números da roleta (0-36) extraídos da imagem, na ordem em que aparecem.'
                    }
                }
            }
        }
    });

    return from(promise).pipe(
      map((response: GenerateContentResponse) => {
        if (!response || !response.text) {
             throw new Error('Resposta inválida ou vazia da API Gemini.');
        }
        const text = response.text;
        try {
            const parsed = JSON.parse(text);
            if (parsed && Array.isArray(parsed.numbers)) {
                const numbers = parsed.numbers.filter((n: any) => typeof n === 'number' && n >= 0 && n <= 36);
                return { numbers };
            }
            throw new Error('Formato de resposta JSON inesperado.');
        } catch (e) {
            console.error('Erro ao analisar a resposta JSON do Gemini:', e);
            return { error: 'Falha ao analisar a resposta da IA.' };
        }
      }),
      catchError((error: any) => {
        console.error('Erro na chamada da API Gemini para extrair números:', error);
        let errorMessage = 'Falha ao comunicar com a IA.';
        if (error.message) {
            if (error.message.includes('API key not valid')) {
                errorMessage = 'A chave da API do Gemini é inválida ou não foi configurada.';
            } else if (error.message.includes('SAFETY')) {
                errorMessage = 'A imagem foi bloqueada por razões de segurança.';
            }
        }
        return of({ error: errorMessage });
      })
    );
  }

  suggestStrategy(results: number[], userPrompt: string) {
    if (!this.ai) {
      return of({ error: 'Serviço Gemini não inicializado. A chave da API pode estar faltando.' });
    }

    const latestResults = results.slice(0, 50);

    const promise = this.ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Com base nos seguintes resultados recentes da roleta (do mais recente para o mais antigo): ${JSON.stringify(latestResults)} e na solicitação do usuário: "${userPrompt}", gere uma nova sequência de estratégia.

INSTRUÇÕES CRÍTICAS:
1. Analise os resultados em busca de padrões relevantes para a solicitação do usuário (sequências, números quentes/frios, etc.).
2. Retorne APENAS um array JSON válido de objetos de passo de estratégia.
3. Cada objeto deve ter um 'type' e um 'value'.
4. O 'type' deve ser um dos seguintes: 'color', 'parity', 'range', 'dozen', 'column', 'single_number', 'number_set'.
5. O 'value' deve ser apropriado para o tipo (por exemplo, para 'color', o valor deve ser 'red', 'black' ou 'green'). Para 'number_set', o valor deve ser um array de números.

Exemplo de uma resposta válida para "apostar no vermelho e depois no par":
[
  {"type": "color", "value": "red"},
  {"type": "parity", "value": "even"}
]`,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      }
    });

    return from(promise).pipe(
      map((response: GenerateContentResponse) => {
        try {
          // The response.text is expected to be a clean JSON string because of responseMimeType
          const sequence = JSON.parse(response.text) as StrategyValue[];
          // Add validation here if necessary
          if (!Array.isArray(sequence)) throw new Error("A resposta não é um array.");
          return { sequence };
        } catch (e) {
          console.error('Erro ao analisar a sugestão de estratégia da IA:', e);
          return { error: 'Falha ao analisar a estratégia sugerida.' };
        }
      }),
      catchError(error => {
        console.error('Erro ao sugerir estratégia:', error);
        return of({ error: 'Falha ao obter uma sugestão de estratégia da IA.' });
      })
    );
  }

  generateInsights(
    latestResults: number[],
    priorityStrategies: Partial<Strategy>[],
    dueAnalysis: any
  ) {
    if (!this.ai) {
      return of({ error: 'Serviço Gemini não inicializado. A chave da API pode estar faltando.' });
    }

    const prompt = `
      Você é um analista especialista em roleta. Seu objetivo é fornecer insights acionáveis e concisos em português do Brasil.

      Com base nos dados a seguir:
      - Últimos 50 resultados (do mais recente para o mais antigo): ${JSON.stringify(latestResults)}
      - Estratégias ativas em sequências de derrota notáveis: ${JSON.stringify(priorityStrategies)}
      - Itens mais atrasados (quantas rodadas não saem): ${JSON.stringify(dueAnalysis)}

      Analise os dados e forneça um resumo em 2-3 parágrafos curtos. Foque em:
      1. Padrões óbvios ou tendências (ex: predominância de uma cor, dúzia, etc.).
      2. Estratégias que estão falhando e podem estar se aproximando de um ponto de reversão.
      3. Quais apostas (dúzias, colunas, etc.) estão significativamente atrasadas e merecem atenção.

      Seja direto e use uma linguagem clara. Não dê conselhos financeiros. Apenas apresente a análise dos dados. Formate sua resposta como texto simples, usando quebras de linha para separar os parágrafos.
    `;

    const promise = this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
    });

    return from(promise).pipe(
      map((response: GenerateContentResponse) => {
        if (!response || !response.text) {
          throw new Error('Resposta inválida ou vazia da API Gemini.');
        }
        return { insights: response.text };
      }),
      catchError(error => {
        console.error('Erro ao gerar insights:', error);
        return of({ error: 'Falha ao obter insights da IA.' });
      })
    );
  }
}