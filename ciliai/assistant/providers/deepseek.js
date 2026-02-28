// DeepSeek provider (OpenAI-compatible chat completions)
(function (root) {
    'use strict';

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeUrl(url) {
        const trimmed = String(url || '').trim();
        if (!trimmed) return '';
        return trimmed.replace(/\/+$/, '');
    }

    class DeepSeekProvider {
        constructor(options = {}) {
            this.apiKey = options.apiKey || '';
            this.baseUrl = normalizeUrl(options.baseUrl);
            this.proxyUrl = normalizeUrl(options.proxyUrl);
            this.proxySecret = typeof options.proxySecret === 'string' ? options.proxySecret : '';
            this.model = options.model || 'deepseek-chat';
            this.temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;
            this.timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 15000;
            this.retries = typeof options.retries === 'number' ? options.retries : 2;
            this.debug = !!options.debug;
        }

        async chat(messages = []) {
            if (!this.proxyUrl) {
                throw new Error('Proxy URL missing');
            }

            const url = this.proxyUrl;
            const body = {
                model: this.model,
                temperature: this.temperature,
                messages
            };

            let attempt = 0;
            let lastError = null;

            while (attempt <= this.retries) {
                attempt += 1;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

                const headers = { 'Content-Type': 'application/json' };
                if (this.proxySecret) {
                    headers['Authorization'] = 'Bearer ' + this.proxySecret;
                }
                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify(body),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const text = await response.text();
                        lastError = new Error('Proxy error ' + response.status + (response.status === 402 ? ': Payment Required. Add credits at platform.deepseek.com' : ': ' + text));
                        if (response.status === 402) throw lastError;
                        const retryable = response.status === 429 || response.status >= 500;
                        if (this.debug) console.warn('[DeepSeek] proxy retryable error', response.status, text);
                        if (!retryable || attempt > this.retries) throw lastError;
                        await delay(300 * attempt);
                        continue;
                    }

                    const data = await response.json();
                    const content = data?.choices?.[0]?.message?.content;
                    if (!content) {
                        throw new Error('DeepSeek response missing content');
                    }
                    return content;
                } catch (err) {
                    clearTimeout(timeoutId);
                    lastError = err;
                    const isAbort = err && err.name === 'AbortError';
                    if (this.debug) console.warn('[DeepSeek] request failed', err);
                    if (isAbort && attempt <= this.retries) {
                        await delay(300 * attempt);
                        continue;
                    }
                    if (attempt > this.retries) break;
                    await delay(300 * attempt);
                }
            }

            throw lastError || new Error('DeepSeek request failed');
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { DeepSeekProvider };
    }

    root.DeepSeekProvider = DeepSeekProvider;
})(typeof window !== 'undefined' ? window : globalThis);

