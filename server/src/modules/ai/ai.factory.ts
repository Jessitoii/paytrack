import type { IAiParserProvider } from './types.js';
import { GroqProvider, CerebrasProvider } from './providers.js';
import { MockAiProvider } from './mock.provider.js';

export class AiProviderFactory {
  /**
   * Returns configured provider with fallback strategy:
   * Groq (if key present) -> Cerebras (if key present) -> MockAiProvider.
   */
  static getProvider(preferredProvider?: 'groq' | 'cerebras' | 'mock'): IAiParserProvider {
    const groqKey = process.env.GROQ_API_KEY;
    const cerebrasKey = process.env.CEREBRAS_API_KEY;

    if (preferredProvider === 'groq' && groqKey) {
      return new GroqProvider(groqKey);
    }

    if (preferredProvider === 'cerebras' && cerebrasKey) {
      return new CerebrasProvider(cerebrasKey);
    }

    if (preferredProvider === 'mock') {
      return new MockAiProvider();
    }

    // Default order
    if (groqKey) {
      return new GroqProvider(groqKey);
    }

    if (cerebrasKey) {
      return new CerebrasProvider(cerebrasKey);
    }

    return new MockAiProvider();
  }
}
