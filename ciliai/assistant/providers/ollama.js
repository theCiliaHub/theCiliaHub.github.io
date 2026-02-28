// Ollama provider for local development
(function (root) {
    'use strict';

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    class OllamaProvider {
        constructor(options = {}) {
            this.baseUrl = options.baseUrl || 'http://localhost:11434';
            this.model = options.model || 'llama3.1';
            this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 120000;
            this.retries = typeof options.retries === 'number' ? options.retries : 2;
            this.debug = !!options.debug;
        }

        async chat(messages = []) {
            const url = `${String(this.baseUrl).replace(/\/+$/, '')}/api/chat`;
            const body = {
                model: this.model || 'llama3.1',
                messages,
                stream: false
            };

            let attempt = 0;
            let lastError = null;

            while (attempt <= this.retries) {
                attempt += 1;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const retryable = response.status >= 500;
                        const text = await response.text();
                        lastError = new Error(`Ollama error ${response.status}: ${text}`);
                        if (this.debug) console.warn('[Ollama] retryable error', response.status, text);
                        if (!retryable || attempt > this.retries) throw lastError;
                        await delay(300 * attempt);
                        continue;
                    }

                    const data = await response.json();
                    const content = data?.message?.content;
                    if (!content) throw new Error('Ollama response missing message.content');
                    return content;
                } catch (err) {
                    clearTimeout(timeoutId);
                    lastError = err;
                    const isAbort = err && err.name === 'AbortError';
                    if (this.debug) console.warn('[Ollama] request failed', err);
                    if (isAbort && attempt <= this.retries) {
                        await delay(300 * attempt);
                        continue;
                    }
                    if (attempt > this.retries) break;
                    await delay(300 * attempt);
                }
            }

            throw lastError || new Error('Ollama request failed');
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { OllamaProvider };
    }

    root.OllamaProvider = OllamaProvider;
})(typeof window !== 'undefined' ? window : globalThis);
