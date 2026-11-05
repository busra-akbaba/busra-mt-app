// ============================================================================
// Gemini API Destekli Makine Çevirisi Sunucusu (Node.js & Express)
// ============================================================================

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// .env dosyasındaki ortam değişkenlerini yükle
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// JSON gövdelerini ve statik web dosyalarını işle
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Alan (Domain) açıklamaları - Modele metnin bağlamını bildirir
const DOMAIN_INSTRUCTIONS = {
  genel: 'Genel günlük ve standart dil kullanımı. Doğal ve akıcı bir anlatım tercih edilmelidir.',
  hukuk: 'Hukuki metin, sözleşme ve mevzuat terminolojisi. Hukuki kesinlik, resmi terimler ve bağlayıcı ifade tarzı korunmalıdır.',
  tip: 'Tıbbi ve klinik terminoloji. Tıp literatürüne, anatomik ve farmakolojik terimlere tam sadakat gösterilmelidir.',
  teknik: 'Mühendislik, yazılım ve teknoloji terminolojisi. Sektör standardı teknik terimler ve kesin ifadeler kullanılmalıdır.',
  edebi: 'Edebi ve sanatsal anlatım. Metaforik zenginlik, anlatım estetiği, üslup ve edebi akıcılık ön planda tutulmalıdır.'
};

// Üslup (Tone) açıklamaları - Modele ton ve hitap tarzını bildirir
const TONE_INSTRUCTIONS = {
  resmi: 'Resmi, kurumsal, saygılı ve mesafeli bir üslup kullanılmalıdır.',
  gundelik: 'Samimi, rahat, gündelik konuşma diline uygun ve sıcak bir üslup kullanılmalıdır.'
};

// Dil adları (İngilizce ve Türkçe karşılıkları)
const LANGUAGE_NAMES = {
  en: 'İngilizce (English)',
  tr: 'Türkçe (Turkish)'
};

/**
 * Kullanıcının girdiği terimce (glossary) metnini ayrıştırır.
 * Format: "kaynak terim = hedef terim" (veya ":" veya "->")
 * @param {string} rawGlossary
 * @returns {Array<{source: string, target: string}>}
 */
function parseGlossary(rawGlossary) {
  if (!rawGlossary || typeof rawGlossary !== 'string') return [];

  const lines = rawGlossary.split('\n');
  const pairs = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    // Boş satırları veya yorum satırlarını atla
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    // "=", "->", ":" ayraçlarını destekle
    let parts = null;
    if (line.includes('=')) {
      parts = line.split('=');
    } else if (line.includes('->')) {
      parts = line.split('->');
    } else if (line.includes(':')) {
      parts = line.split(':');
    }

    if (parts && parts.length >= 2) {
      const source = parts[0].trim();
      // Hedef tarafında birden fazla ayraç varsa geri kalanını birleştir
      const target = parts.slice(1).join('=').trim();
      if (source && target) {
        pairs.push({ source, target });
      }
    }
  }

  return pairs;
}

/**
 * Gemini hatalarını yakalayıp kullanıcı dostu Türkçe hata ve çözüm mesajlarına dönüştürür.
 * @param {Error} error
 * @returns {{ title: string, message: string, solution: string, status: number }}
 */
function categorizeError(error) {
  const errStr = (error.message || error.toString() || '').toLowerCase();
  const status = error.status || 500;

  // 1. API Anahtarı Hataları
  if (
    errStr.includes('api_key_invalid') ||
    errStr.includes('api key not valid') ||
    errStr.includes('invalid api key') ||
    errStr.includes('api key is required') ||
    errStr.includes('api key expired') ||
    errStr.includes('permission_denied') ||
    status === 401 ||
    status === 403
  ) {
    return {
      status: 401,
      title: 'Geçersiz veya Eksik API Anahtarı',
      message: 'Gemini API anahtarınız doğrulanamadı veya eksik girilmiş.',
      solution: 'Proje kök dizinindeki .env dosyasını açın ve GEMINI_API_KEY değerini Google AI Studio\'dan (https://aistudio.google.com/) aldığınız geçerli anahtarla güncelleyin. Ardından sunucuyu yeniden başlatın.'
    };
  }

  // 2. Kota ve İstek Sınırı (Rate Limit) Hataları
  if (
    errStr.includes('resource_exhausted') ||
    errStr.includes('quota') ||
    errStr.includes('rate limit') ||
    status === 429
  ) {
    return {
      status: 429,
      title: 'API İstek Sınırı / Kota Doldu',
      message: 'Gemini API dakikalık istek limitiniz veya ücretsiz kullanım kotanız doldu.',
      solution: 'Lütfen 30-60 saniye bekledikten sonra tekrar deneyin. Kotanızı kontrol etmek için Google AI Studio konsolunu ziyaret edebilirsiniz.'
    };
  }

  // 3. Ağ ve İnternet Bağlantı Hataları
  if (
    errStr.includes('enotfound') ||
    errStr.includes('fetch failed') ||
    errStr.includes('econnrefused') ||
    errStr.includes('econnreset') ||
    errStr.includes('etimedout') ||
    errStr.includes('network') ||
    errStr.includes('und_err_connect_timeout')
  ) {
    return {
      status: 503,
      title: 'İnternet Bağlantısı Hatası',
      message: 'Google Gemini sunucularına bağlanılamadı. İnternet erişiminiz kesilmiş olabilir.',
      solution: 'Lütfen internet bağlantınızı ve varsa proxy/VPN ayarlarınızı kontrol edip sayfayı yenileyin ve tekrar deneyin.'
    };
  }

  // 4. Model Meşgul veya Aşırı Yüklü
  if (
    errStr.includes('overloaded') ||
    errStr.includes('unavailable') ||
    errStr.includes('high demand') ||
    status === 503
  ) {
    return {
      status: 503,
      title: 'Model Sunucuları Yoğun',
      message: 'Gemini sunucuları şu anda yoğun talep altında olduğundan yanıt veremedi.',
      solution: 'Lütfen birkaç saniye bekleyip "Çevir" butonuna tekrar tıklayın.'
    };
  }

  // 5. İçerik Güvenliği / Filtreleme
  if (errStr.includes('safety') || errStr.includes('blocked') || errStr.includes('harm_category')) {
    return {
      status: 400,
      title: 'İçerik Güvenlik Filtresine Takıldı',
      message: 'Gönderilen metin Google güvenlik politikaları gereğince çevrilemedi.',
      solution: 'Lütfen metnin içeriğini kontrol edip hassas veya sakıncalı ifadeleri çıkartarak tekrar deneyin.'
    };
  }

  // 6. Genel / Bilinmeyen Hata
  return {
    status: 500,
    title: 'Beklenmeyen Çeviri Hatası',
    message: error.message || 'Çeviri işlemi sırasında sunucuda bir hata oluştu.',
    solution: 'Girdiğiniz metni ve ayarları gözden geçirip tekrar deneyin. Sorun devam ederse sunucu loglarını inceleyin.'
  };
}

/**
 * Model çıktısını temizler:
 * - Olası "İşte çevirisi:", "Çeviri:", "Translation:" vb. girişleri temizler
 * - Çevreleyen tırnak işaretlerini ("...", “...”) kaldırır
 * @param {string} rawText
 * @returns {string}
 */
function cleanModelOutput(rawText) {
  if (!rawText) return '';
  let cleaned = rawText.trim();

  // Olası "İşte çeviri:", "İşte çevirisi:", "Çeviri:", "Translation:" vb. girişleri temizle (Türkçe karakter duyarlı)
  cleaned = cleaned.replace(/^(?:[iİıI]şte\s+)?(?:[cçCÇ]eviri(?:si)?|translation)\s*:\s*/i, '');

  // Eğer model tüm çıktıyı tek bir tırnak içine aldıysa tırnakları kaldır
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('“') && cleaned.endsWith('”')) ||
    (cleaned.startsWith('\'') && cleaned.endsWith('\''))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  return cleaned;
}

// ----------------------------------------------------------------------------
// API ROTALARI
// ----------------------------------------------------------------------------

/**
 * Sunucu ve API anahtarı durumunu kontrol eden uç nokta
 */
app.get('/api/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && !process.env.GEMINI_API_KEY.includes('buraya_'));
  res.json({
    ok: true,
    hasApiKey: hasKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'
  });
});

/**
 * Çeviri uç noktası (POST /api/translate)
 */
app.post('/api/translate', async (req, res) => {
  try {
    const {
      text,
      sourceLang = 'en',
      targetLang = 'tr',
      domain = 'genel',
      tone = 'resmi',
      glossary = ''
    } = req.body;

    // 1. Temel Girdi Doğrulamaları
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          title: 'Metin Eksik',
          message: 'Lütfen çevrilmesini istediğiniz bir metin girin.',
          solution: 'Kaynak metin kutusuna çevirmek istediğiniz metni yazın veya yapıştırın.'
        }
      });
    }

    // 2. API Anahtarı Kontrolü
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey || apiKey.includes('buraya_')) {
      return res.status(401).json({
        success: false,
        error: {
          title: 'Gemini API Anahtarı Bulunamadı',
          message: '.env dosyasında geçerli bir GEMINI_API_KEY tanımlanmamış.',
          solution: 'Proje dizinindeki .env dosyasını bir metin düzenleyici ile açın ve GEMINI_API_KEY= satırına Google AI Studio\'dan aldığınız anahtarı ekleyip kaydedin. Ardından sunucuyu yeniden başlatın.'
        }
      });
    }

    // 3. Dil Kontrolü
    if (sourceLang === targetLang) {
      return res.status(400).json({
        success: false,
        error: {
          title: 'Kaynak ve Hedef Dil Aynı',
          message: 'Kaynak dil ile hedef dil birbirinden farklı olmalıdır.',
          solution: 'Lütfen kaynak dil ile hedef dil seçimlerini birbirinden farklı yapın.'
        }
      });
    }

    const sourceName = LANGUAGE_NAMES[sourceLang] || sourceLang;
    const targetName = LANGUAGE_NAMES[targetLang] || targetLang;
    const domainDesc = DOMAIN_INSTRUCTIONS[domain] || DOMAIN_INSTRUCTIONS.genel;
    const toneDesc = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.resmi;

    // 4. Terimceyi ayrıştır
    const glossaryPairs = parseGlossary(glossary);

    // 5. Terimce Talimatı Oluştur
    let glossaryInstruction = '';
    if (glossaryPairs.length > 0) {
      glossaryInstruction = `
TERİMCE (GLOSSARY) KURALI (KESİNLİKLE UYULMALIDIR):
Aşağıda verilen terim çiftlerine çeviride MUTLAKA ve EKSİKSİZ şekilde uyacaksın.
Kaynak metinde bu terimlerden biri geçtiğinde, hedef metinde KESİNLİKLE karşılığı olarak belirtilen terimi kullan:
${glossaryPairs.map((p, i) => `${i + 1}. [Kaynak]: "${p.source}" => [Hedef]: "${p.target}"`).join('\n')}
Bu terimlerin hedef dildeki dilbilgisel eklerini (çekim eki vb.) cümlenin akışına göre koruyabilirsin, ancak terim kökünü kesinlikle yukarıdaki eşleşmeye sadık kalarak kullanacaksın.
`;
    }

    // 6. Sistem Talimatı (System Instruction)
    const systemInstruction = `Sen profesyonel, üst düzey bir çevirmensin. Görevin verilen metni ${sourceName} dilinden ${targetName} diline çevirmektir.

ÇEVİRİ KURALLARI VE YÖNERGELERİ:
1. ALAN (DOMAIN): Bu metin "${domain.toUpperCase()}" alanına aittir. ${domainDesc}
2. ÜSLUP (TONE): Çeviride "${tone.toUpperCase()}" üslup benimsenmelidir. ${toneDesc}
${glossaryInstruction}
3. ÇIKTI FORMATI KURALI (HAYATİ ÖNEM TAŞIR):
   - SADECE ve YALNIZCA çevrilen hedef metni döndür.
   - Başına veya sonuna hiçbir açıklama, not, yorum, alternatif ekleme.
   - "İşte çeviri:", "Çeviri:", "Here is the translation:" gibi giriş cümleleri KESİNLİKLE KULLANMA.
   - Çeviriyi tırnak içine alma.
   - Orijinal metnin satır başları ve paragraf yapısını koru.`;

    // 7. Gemini API Çağrısı
    const genAI = new GoogleGenerativeAI(apiKey);
    const configuredModel = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

    // Model öncelik listesi: Önce .env'deki model, ardından doğrulanmış güncel alternatifler
    const candidateModels = Array.from(new Set([
      configuredModel,
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-3.8-flash'
    ]));

    let rawTranslatedText = '';
    let usedModel = configuredModel;
    let lastError = null;

    for (const mName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: mName,
          systemInstruction: systemInstruction,
          generationConfig: {
            temperature: 0.3 // Çeviride tutarlılık ve doğruluğu artırmak için düşük sıcaklık
          }
        });

        const result = await model.generateContent(text);
        const response = await result.response;
        rawTranslatedText = response.text();
        usedModel = mName;
        lastError = null;
        break; // Başarılı çeviri alındı
      } catch (err) {
        lastError = err;
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('not found') || msg.includes('404') || msg.includes('no longer available') || msg.includes('unsupported')) {
          console.warn(`[Model Uyarısı] "${mName}" modeli kullanılamadı, alternatif modele geçiliyor...`);
          continue;
        }
        // Kota (429) veya API Key (401/403) hatalarında doğrudan hata fırlat
        throw err;
      }
    }

    if (!rawTranslatedText && lastError) {
      throw lastError;
    }

    const cleanedText = cleanModelOutput(rawTranslatedText);

    // 8. Başarılı Yanıtı İstemciye İlet
    return res.json({
      success: true,
      translation: cleanedText,
      meta: {
        sourceLang,
        targetLang,
        domain,
        tone,
        glossaryCount: glossaryPairs.length
      }
    });

  } catch (error) {
    console.error('[Çeviri Hatası]:', error);
    const categorized = categorizeError(error);
    return res.status(categorized.status).json({
      success: false,
      error: {
        title: categorized.title,
        message: categorized.message,
        solution: categorized.solution
      }
    });
  }
});

// Sunucuyu başlat
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Gemini Çeviri Uygulaması Başlatıldı!`);
  console.log(`📡 Adres: http://localhost:${PORT}`);
  console.log(`🔑 API Anahtarı Durumu: ${process.env.GEMINI_API_KEY ? 'Tanımlı (Hazır)' : 'Eksik (.env dosyasını kontrol edin)'}`);
  console.log(`======================================================\n`);
});
