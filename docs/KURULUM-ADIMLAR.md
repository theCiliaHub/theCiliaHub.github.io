# CiliAI Assistant — DeepSeek Kurulum (Adım Adım)

Bu rehber, chatbot'u DeepSeek API'ye bağlamak, veritabanından cevap aldırmak (RAG) ve API'yi gizleyip korumak için yapmanız gerekenleri adım adım anlatır.

---

## Bölüm A: Cloudflare Worker (Proxy) — API key tarayıcıda olmayacak

### Adım 1 — Cloudflare hesabı
1. [Cloudflare](https://dash.cloudflare.com) giriş yapın.
2. **Workers & Pages** → **Create** → **Create Worker**.
3. Worker’a bir isim verin (örn. `ciliai-deepseek-proxy`) ve **Deploy** deyin.

### Adım 2 — Worker kodunu yapıştırın
1. Worker sayfasında **Edit code** (veya **Quick Edit**) tıklayın.
2. Bu repodaki `serverless/cloudflare-worker.js` dosyasının **tüm içeriğini** kopyalayıp mevcut kodu silip yapıştırın.
3. **Save and Deploy** deyin.

### Adım 3 — DeepSeek API key’i Worker’a secret olarak ekleyin
1. Worker sayfasında **Settings** → **Variables and Secrets**.
2. **Add variable** → **Secret**.
3. **Variable name:** `DEEPSEEK_API_KEY`  
   **Value:** DeepSeek’ten aldığınız API key ([platform.deepseek.com](https://platform.deepseek.com) veya API sayfasından).
4. **Encrypt** / **Save** deyin.

### Adım 4 — (İsteğe bağlı) Proxy’yi token ile koruyun
1. Aynı **Variables and Secrets** bölümünde tekrar **Add variable** → **Secret**.
2. **Variable name:** `CILIAI_PROXY_SECRET`  
   **Value:** Uzun, rastgele bir parola (örn. 32 karakter). Bunu bir yere not edin; aynı değeri `env.js` içine yazacaksınız.
3. Kaydedin.  
   Bu adımı atlarsanız proxy herkese açık olur (sadece URL’yi bilen kullanabilir). Token eklerseniz sadece bu token’ı bilen istekler çalışır.

### Adım 5 — Worker URL’sini kopyalayın
1. Worker sayfasında **Deploy** sonrası görünen URL’yi kopyalayın (örn. `https://ciliai-deepseek-proxy.xxx.workers.dev`).
2. Chat için kullanacağınız tam adres:  
   `https://BURAYA-WORKER-URL/api/chat`  
   Örnek: `https://ciliai-deepseek-proxy.xxx.workers.dev/api/chat`

---

## Bölüm B: Site tarafı (env.js) — DeepSeek’i açma

### Adım 6 — env.js dosyasını düzenleyin
1. Projede `ciliai/env.js` dosyasını açın.
2. Aşağıdaki değerleri **DeepSeek** için ayarlayın:

| Değişken | Değer | Açıklama |
|----------|--------|----------|
| `CILIAI_LLM_PROVIDER` | `'deepseek'` | Ollama yerine DeepSeek kullanılır. |
| `CILIAI_MODEL` | `'deepseek-chat'` | Varsayılan model. |
| `CILIAI_ASSISTANT_PROXY_URL` | `'https://...workers.dev/api/chat'` | Adım 5’te kopyaladığınız tam URL. |
| `CILIAI_PROXY_SECRET` | `'...'` veya `''` | Adım 4’te Worker’a yazdığınız secret. Kullanmadıysanız `''` bırakın. |
| `CILIAI_ASSISTANT_TIMEOUT_MS` | `'60000'` veya `'120000'` | İsterseniz 60–120 saniye (DeepSeek genelde hızlı). |

3. **Önemli:** `DEEPSEEK_API_KEY`’i `env.js` içine **yazmayın**. Key sadece Worker’da kalmalı.

Örnek `env.js` (DeepSeek için):

```javascript
window.CILIAI_ENV = {
    CILIAI_ENV_VERSION: 'v1-deepseek',
    CILIAI_ASSISTANT_V2: 'true',
    CILIAI_LLM_PROVIDER: 'deepseek',
    CILIAI_ASSISTANT_CHAT_MODE: 'llm_first',
    CILIAI_MODEL: 'deepseek-chat',
    CILIAI_ASSISTANT_TEMPERATURE: '0.2',
    CILIAI_ASSISTANT_TIMEOUT_MS: '60000',
    CILIAI_ASSISTANT_RETRIES: '2',
    CILIAI_ASSISTANT_PROXY_URL: 'https://SIZIN-WORKER-URL.workers.dev/api/chat',
    CILIAI_PROXY_SECRET: '',   // Worker'da CILIAI_PROXY_SECRET tanımladıysanız aynı değeri yazın
    CILIAI_ASSISTANT_DRY_RUN: 'false',
    CILIAI_ASSISTANT_FORCE_FAILURE: 'false',
    CILIAI_DEBUG: 'false'
};
```

### Adım 7 — env.js’i repoda paylaşmayın
1. `env.js` içine gerçek `CILIAI_PROXY_SECRET` veya başka gizli bilgi yazdıysanız, bu dosyayı **Git’e commit etmeyin**.
2. Proje kökünde `.gitignore` varsa şu satırı ekleyin:  
   `ciliai/env.js`  
   (Zaten `env.example.js` ile örnek dağıtılıyorsa, gerçek key/secret sadece `env.js`’te olmalı.)

---

## Bölüm C: Test

### Adım 8 — Sayfayı yenileyin
1. Siteyi açın (Live Server veya GitHub Pages).
2. **Hard refresh:** `Ctrl+Shift+R` (Windows/Linux) veya `Cmd+Shift+R` (Mac).

### Adım 9 — Verification paneli
1. CiliAI panelinde **Assistant Verification** (veya `/verify` / `#verify`) açın.
2. **Run Verification** tıklayın.
3. **Proxy reachable**, **Basic assistant response**, **Actions JSON** gibi satırlarda ✅ görmelisiniz.  
   ❌ varsa: Proxy URL’yi, Worker’daki `DEEPSEEK_API_KEY` ve (kullandıysanız) `CILIAI_PROXY_SECRET` değerini kontrol edin.

### Adım 10 — Sohbeti deneyin
1. Chatbot’a örneğin şunları yazın:
   - "Merhaba"
   - "IFT88 nedir?"
   - "CEP290 nerede lokalize?"
2. Cevaplar DeepSeek’ten gelmeli ve veritabanı (RAG) bilgisi kullanılıyor olmalı.

---

## Kısa kontrol listesi

- [ ] Cloudflare Worker oluşturuldu, `cloudflare-worker.js` kodu yüklendi.
- [ ] Worker’da **DEEPSEEK_API_KEY** secret olarak tanımlı.
- [ ] (İsteğe bağlı) Worker’da **CILIAI_PROXY_SECRET** tanımlı.
- [ ] `ciliai/env.js` içinde **CILIAI_LLM_PROVIDER: 'deepseek'** ve **CILIAI_ASSISTANT_PROXY_URL** doğru.
- [ ] Token kullanıyorsanız **CILIAI_PROXY_SECRET** env.js’te Worker’daki ile aynı.
- [ ] `env.js` içinde **DEEPSEEK_API_KEY** yok.
- [ ] Verification’da proxy ve assistant cevabı ✅.
- [ ] Chatbot’ta birkaç soru test edildi.

---

## Sorun giderme

| Belirti | Olası neden | Yapılacak |
|--------|--------------|-----------|
| "I couldn't reach the assistant service" | Proxy’ye ulaşamıyor veya 401 | URL doğru mu? Token kullanıyorsanız Worker ve env.js’teki secret aynı mı? |
| 401 Unauthorized | CILIAI_PROXY_SECRET uyumsuz | Worker’daki ve env.js’teki değer birebir aynı olmalı. |
| 402 / billing | DeepSeek bakiyesi yetersiz | platform.deepseek.com’da bakiye kontrol edin. |
| Cevap DB’den gelmiyor gibi | RAG bağlamı boş | Veri yüklü mü? Sayfa tam açıldıktan sonra (CiliAI ready) soru sorun. |

Bu adımları tamamladığınızda chatbot DeepSeek’e bağlı, API tarayıcıda görünmüyor ve (isteğe bağlı) token ile korunuyor olacaktır.
