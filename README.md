# ✦ Gemini Makine Çevirisi (Level 3)

Google Gemini API kullanan, Node.js ve Express ile çalışan modern, minimalist ve yüksek doğruluklu makine çevirisi web uygulaması.

---

## 🌟 Özellikler

- **Çift Yönlü Çeviri:** İngilizce ↔ Türkçe (tek tıkla dilleri ve metinleri yer değiştirme).
- **Alan (Domain) Seçimi:**
  - Genel (Standart anlatım)
  - Hukuk (Sözleşmeler ve resmi terminoloji)
  - Tıp (Klinik ve medikal doğruluk)
  - Teknik (Mühendislik, yazılım ve teknoloji)
  - Edebi (Sanatsal akıcılık ve üslup)
- **Üslup (Tone) Seçimi:**
  - Resmi (Kurumsal, saygılı, mesafeli)
  - Gündelik (Samimi, doğal konuşma dili)
- **Terimce (Glossary):**
  - Kullanıcı `kaynak terim = hedef terim` formatında özel kurallar tanımlayabilir.
  - Model bu terimleri çeviride **kesinlikle** kullanır.
- **Temiz Çıktı Garantisi:**
  - Gemini'ye yalnızca çeviriyi döndürmesi talimatı verilir; tırnak işaretleri, selamlama veya "İşte çeviri:" gibi gereksiz eklemeler otomatik temizlenir.
- **Tek Tıkla Kopyalama:** Çeviriyi anında panoya kopyalama ve geri bildirim.
- **Kapsamlı Türkçe Hata Yönetimi:**
  - API anahtarı eksik veya geçersiz olduğunda,
  - Kota veya istek limiti aşıldığında,
  - İnternet bağlantısı koptuğunda,
  kullanıcıya tam olarak ne olduğunu ve **ne yapması gerektiğini** açıklayan Türkçe rehber kartları gösterilir.
- **Tasarım:** Minimalist krem, koyu gri ve kahve tonları; mobilde ve masaüstünde tam uyumlu (responsive).

---

## 🚀 Adım Adım Kurulum ve Çalıştırma

Yeni başlayanlar için adım adım rehber:

### 1. Adım: Bağımlılıkları Yükleyin
Proje klasöründe bir terminal (komut satırı veya PowerShell) açın ve şu komutu çalıştırın:

```bash
npm install
```
*(Windows PowerShell'de betik çalıştırma engeli uyarısı alırsanız `npm.cmd install` yazabilirsiniz.)*

---

### 2. Adım: Gemini API Anahtarınızı `.env` Dosyasına Ekleyin
Proje klasöründe bulunan `.env` dosyasını Not Defteri veya kullandığınız kod editörü ile açın:

```env
# Gemini API Anahtarınızı aşağıdaki tırnaksız olarak yapıştırın:
GEMINI_API_KEY=AIzaSy...BURAYA_ANAHTARINIZI_YAPISTIRIN...

# İsteğe bağlı port ayarı:
PORT=3000

# Kullanılacak model:
GEMINI_MODEL=gemini-2.5-flash
```

> **API Anahtarınız Yok mu?**
> [Google AI Studio (https://aistudio.google.com/)](https://aistudio.google.com/) adresine Google hesabınızla giriş yaparak **"Get API key"** butonuna tıklayıp tamamen ücretsiz bir API anahtarı alabilirsiniz.

---

### 3. Adım: Uygulamayı Başlatın
Terminalde şu komutu çalıştırın:

```bash
npm start
```

Terminalde şu mesajı göreceksiniz:
```text
======================================================
🚀 Gemini Çeviri Uygulaması Başlatıldı!
📡 Adres: http://localhost:3000
🔑 API Anahtarı Durumu: Tanımlı (Hazır)
======================================================
```

---

### 4. Adım: Tarayıcıda Açın
İnternet tarayıcınızı (Chrome, Edge, Firefox vb.) açın ve adres çubuğuna şunu yazın:

👉 **`http://localhost:3000`**

Artık metinlerinizi çevirmeye başlayabilirsiniz!

---

## 📖 Terimce (Glossary) Nasıl Kullanılır?

"Terimce (Glossary) & Özel Terim Kuralları" başlığına tıklayarak paneli açın. Her satıra bir terim gelecek şekilde yazın:

```text
pipeline = veri hattı
machine learning = makine öğrenimi
framework = yazılım çatısı
deployment = canlıya alma
```

Model, çeviri yaparken bu kelimelerin geçtiği yerlerde sözlük anlamları yerine sizin belirlediğiniz özel karşılıkları kullanacaktır.

---

## ⌨️ Klavye Kısayolları

- **Ctrl + Enter** (Mac: **Cmd + Enter**): Metin kutusundayken çeviriyi doğrudan başlatır.

---

## 📁 Proje Dosya Yapısı

```
ai/
├── public/
│   ├── index.html       # Arayüz iskeleti ve HTML yapısı
│   ├── style.css        # Krem, koyu gri ve kahve tonları, responsive stiller
│   └── app.js           # Arayüz etkileşimleri, API istekleri ve kopyalama mantığı
├── server.js            # Express sunucusu, Gemini API entegrasyonu ve hata yönetimi
├── package.json         # Proje ayarları ve kütüphaneler
├── .env.example         # Örnek ortam değişkenleri şablonu
├── .env                 # API anahtarınızın yer aldığı dosya (özel)
└── README.md            # Bu kullanım kılavuzu
```

