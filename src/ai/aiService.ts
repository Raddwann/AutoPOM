import * as vscode from 'vscode';
import { ScannedElement, AIProviderConfig } from '../types';
import { DomPruner } from './domPruner';
import { SYSTEM_POM_ARCHITECT_PROMPT } from './prompts';

export interface AISemanticResult {
  pageClassName: string;
  components: Array<{
    componentName: string;
    elements: Array<{
      id: string;
      semanticName: string;
      actionDescription?: string;
    }>;
  }>;
}

export class AIService {
  private static instance: AIService;

  private constructor() {}

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  public getConfig(): AIProviderConfig {
    const config = vscode.workspace.getConfiguration('autopom');
    return {
      provider: config.get<'gemini' | 'openai' | 'anthropic' | 'ollama'>('aiProvider') || 'gemini',
      apiKey: config.get<string>('aiApiKey') || '',
      endpoint: config.get<string>('ollamaEndpoint') || 'http://localhost:11434',
      model: config.get<string>('ollamaModel') || 'qwen2.5-coder:latest',
      geminiModel: config.get<string>('geminiModel') || 'gemini-2.0-flash-lite',
    };
  }

  /**
   * Refines scanned elements with semantic grouping and names via LLM.
   */
  public async refactorWithAI(
    elements: ScannedElement[],
    pageTitle: string,
    pageUrl: string
  ): Promise<{ pageClassName?: string; updatedElements: ScannedElement[] }> {
    const config = this.getConfig();
    const prunedJson = DomPruner.pruneForAI(elements);

    const userPrompt = `
Page Title: "${pageTitle}"
Page URL: "${pageUrl}"

Scanned Interactive Elements:
${prunedJson}
`;

    try {
      let rawResponse = '';

      if (config.provider === 'ollama') {
        rawResponse = await this.callOllama(config.endpoint || 'http://localhost:11434', config.model || 'qwen2.5-coder:latest', userPrompt);
      } else if (config.provider === 'gemini') {
        if (!config.apiKey) {
          throw new Error('Gemini API key is not configured in Settings ("autopom.aiApiKey").');
        }
        rawResponse = await this.callGemini(config.apiKey, userPrompt, config.geminiModel || 'gemini-2.0-flash-lite');
      } else if (config.provider === 'openai') {
        if (!config.apiKey) {
          throw new Error('OpenAI API key is not configured in Settings ("autopom.aiApiKey").');
        }
        rawResponse = await this.callOpenAI(config.apiKey, userPrompt);
      } else {
        throw new Error(`Unsupported AI provider: ${config.provider}`);
      }

      // Parse JSON
      const cleanedJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const result: AISemanticResult = JSON.parse(cleanedJson);

      // Map back to elements
      const nameMap = new Map<string, { semanticName: string; componentName?: string }>();
      result.components?.forEach((comp) => {
        comp.elements?.forEach((el) => {
          nameMap.set(el.id, {
            semanticName: el.semanticName,
            componentName: comp.componentName,
          });
        });
      });

      const updatedElements = elements.map((el) => {
        const aiInfo = nameMap.get(el.id);
        if (aiInfo) {
          return {
            ...el,
            suggestedVariableName: aiInfo.semanticName || el.suggestedVariableName,
            componentGroup: aiInfo.componentName,
          };
        }
        return el;
      });

      return {
        pageClassName: result.pageClassName,
        updatedElements,
      };
    } catch (err: any) {
      vscode.window.showWarningMessage(`AI Refactor notice: ${err.message}. Using deterministic names.`);
      return { updatedElements: elements };
    }
  }

  private async callGemini(apiKey: string, prompt: string, model: string = 'gemini-2.0-flash-lite'): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_POM_ARCHITECT_PROMPT }],
        },
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          response_schema: {
            type: 'OBJECT',
            properties: {
              pageClassName: { type: 'STRING' },
              components: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    componentName: { type: 'STRING' },
                    description: { type: 'STRING' },
                    elements: {
                      type: 'ARRAY',
                      items: {
                        type: 'OBJECT',
                        properties: {
                          id: { type: 'STRING' },
                          semanticName: { type: 'STRING' },
                          actionDescription: { type: 'STRING' },
                        },
                        required: ['id', 'semanticName'],
                      },
                    },
                  },
                  required: ['componentName', 'elements'],
                },
              },
            },
            required: ['pageClassName', 'components'],
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  }

  private async callOpenAI(apiKey: string, prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_POM_ARCHITECT_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return data.choices?.[0]?.message?.content || '{}';
  }

  private async callOllama(endpoint: string, model: string, prompt: string): Promise<string> {
    const url = `${endpoint.replace(/\/$/, '')}/api/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_POM_ARCHITECT_PROMPT}\n\nTask:\n${prompt}`,
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data: any = await response.json();
    return data.response || '{}';
  }
}

