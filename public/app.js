// ============================================================================
// Gemini Çeviri — İstemci Tarafı JavaScript (Frontend Mantığı)
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elementleri ---
  const sourceLangSelect = document.getElementById('sourceLangSelect');
  const targetLangSelect = document.getElementById('targetLangSelect');
  const swapLangsBtn = document.getElementById('swapLangsBtn');
  const domainSelect = document.getElementById('domainSelect');
  const toneSelect = document.getElementById('toneSelect');

  const glossaryToggleBtn = document.getElementById('glossaryToggleBtn');
  const glossaryContent = document.getElementById('glossaryContent');
  const glossaryInput = document.getElementById('glossaryInput');
  const glossaryCountBadge = document.getElementById('glossaryCountBadge');

  const sourceText = document.getElementById('sourceText');
  const targetText = document.getElementById('targetText');
  const sourceCardTitle = document.getElementById('sourceCardTitle');
  const targetCardTitle = document.getElementById('targetCardTitle');
  const sourceCharCount = document.getElementById('sourceCharCount');
  const targetCharCount = document.getElementById('targetCharCount');
  const clearSourceBtn = document.getElementById('clearSourceBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copyBtnText = document.getElementById('copyBtnText');

  const translateBtn = document.getElementById('translateBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const metaInfo = document.getElementById('metaInfo');

  const errorCard = document.getElementById('errorCard');
  const errorTitle = document.getElementById('errorTitle');
  const errorMessage = document.getElementById('errorMessage');
  const errorSolution = document.getElementById('errorSolution');
  const dismissErrorBtn = document.getElementById('dismissErrorBtn');

  const apiStatusBadge = document.getElementById('apiStatusBadge');
  const apiKeyNotice = document.getElementById('apiKeyNotice');
  const toast = document.getElementById('toast');

  let isTranslating = false;

  // --------------------------------------------------------------------------
  // 1. Sunucu ve API Anahtarı Durumu Kontrolü
  // --------------------------------------------------------------------------
  async function checkServerStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      const dot = apiStatusBadge.querySelector('.status-dot') || apiStatusBadge.querySelector('.stamp-dot');
      const text = apiStatusBadge.querySelector('.status-text');

      if (data.ok && data.hasApiKey) {
        if (dot) {
          dot.classList.add('active');
          dot.classList.remove('error');
        }
        if (text) text.textContent = 'Gemini Hazır';
        apiKeyNotice.classList.add('hidden');
      } else {
        if (dot) {
          dot.classList.add('error');
          dot.classList.remove('active');
        }
        if (text) text.textContent = 'API Anahtarı Bekleniyor';
        apiKeyNotice.classList.remove('hidden');
      }
    } catch (err) {
      const dot = apiStatusBadge.querySelector('.status-dot') || apiStatusBadge.querySelector('.stamp-dot');
      const text = apiStatusBadge.querySelector('.status-text');
      if (dot) {
        dot.classList.add('error');
        dot.classList.remove('active');
      }
      if (text) text.textContent = 'Sunucuya Ulaşılamıyor';
    }
  }

  // --------------------------------------------------------------------------
  // 2. Dil Başlıklarını ve Seçimlerini Güncelleme
  // --------------------------------------------------------------------------
  function updateLanguageLabels() {
    const sOption = sourceLangSelect.options[sourceLangSelect.selectedIndex];
    const tOption = targetLangSelect.options[targetLangSelect.selectedIndex];
    sourceCardTitle.textContent = sOption ? sOption.text.split('(')[0].trim() : 'Kaynak';
    targetCardTitle.textContent = tOption ? tOption.text.split('(')[0].trim() : 'Hedef';
  }

  // Dilleri birbiriyle takas et (Swap)
  swapLangsBtn.addEventListener('click', () => {
    const prevSource = sourceLangSelect.value;
    const prevTarget = targetLangSelect.value;

    sourceLangSelect.value = prevTarget;
    targetLangSelect.value = prevSource;

    // Eğer çeviri yapılmışsa metinleri de takas et (çift yönlü kolaylık)
    const prevSourceText = sourceText.value;
    const prevTargetText = targetText.value;

    if (prevTargetText.trim() !== '') {
      sourceText.value = prevTargetText;
      targetText.value = prevSourceText;
      copyBtn.disabled = !sourceText.value;
    }

    updateLanguageLabels();
    updateCharCounts();
  });

  sourceLangSelect.addEventListener('change', () => {
    // Kaynak ve hedef dilin aynı seçilmesini engelle
    if (sourceLangSelect.value === targetLangSelect.value) {
      targetLangSelect.value = sourceLangSelect.value === 'en' ? 'tr' : 'en';
    }
    updateLanguageLabels();
  });

  targetLangSelect.addEventListener('change', () => {
    if (targetLangSelect.value === sourceLangSelect.value) {
      sourceLangSelect.value = targetLangSelect.value === 'en' ? 'tr' : 'en';
    }
    updateLanguageLabels();
  });

  // --------------------------------------------------------------------------
  // 3. Terimce (Glossary) Akordiyonu ve Kural Sayacı
  // --------------------------------------------------------------------------
  glossaryToggleBtn.addEventListener('click', () => {
    const isExpanded = glossaryToggleBtn.getAttribute('aria-expanded') === 'true';
    glossaryToggleBtn.setAttribute('aria-expanded', String(!isExpanded));
    glossaryContent.classList.toggle('collapsed');
  });

  function updateGlossaryBadge() {
    const val = glossaryInput.value.trim();
    if (!val) {
      glossaryCountBadge.classList.add('hidden');
      return;
    }
    const lines = val.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && (trimmed.includes('=') || trimmed.includes('->') || trimmed.includes(':'));
    });

    if (lines.length > 0) {
      glossaryCountBadge.textContent = `${lines.length} terim`;
      glossaryCountBadge.classList.remove('hidden');
    } else {
      glossaryCountBadge.classList.add('hidden');
    }
  }

  glossaryInput.addEventListener('input', updateGlossaryBadge);

  // --------------------------------------------------------------------------
  // 4. Karakter Sayıcılar ve Metin Temizleme
  // --------------------------------------------------------------------------
  function updateCharCounts() {
    const srcLen = sourceText.value.length;
    const tgtLen = targetText.value.length;
    sourceCharCount.textContent = `${srcLen} karakter`;
    targetCharCount.textContent = `${tgtLen} karakter`;
    copyBtn.disabled = tgtLen === 0;
  }

  sourceText.addEventListener('input', updateCharCounts);

  clearSourceBtn.addEventListener('click', () => {
    sourceText.value = '';
    targetText.value = '';
    updateCharCounts();
    sourceText.focus();
    hideError();
  });

  // Kısayol: Ctrl + Enter veya Cmd + Enter ile çevir
  sourceText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleTranslate();
    }
  });

  // --------------------------------------------------------------------------
  // 5. Kopyalama Fonksiyonu & Toast Bildirimi
  // --------------------------------------------------------------------------
  copyBtn.addEventListener('click', async () => {
    if (!targetText.value) return;

    try {
      await navigator.clipboard.writeText(targetText.value);
      copyBtn.classList.add('copied');
      copyBtnText.textContent = 'Kopyalandı!';
      showToast('Çeviri panoya kopyalandı.');

      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtnText.textContent = 'Kopyala';
      }, 2000);
    } catch (err) {
      // Pano API erişimi engellendiyse klasik seçim yöntemi
      targetText.select();
      document.execCommand('copy');
      showToast('Çeviri seçildi ve kopyalandı.');
    }
  });

  function showToast(message) {
    const msgEl = toast.querySelector('.toast-msg');
    if (msgEl) {
      msgEl.textContent = message;
    } else {
      toast.textContent = message;
    }
    toast.classList.remove('hidden');
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 2500);
  }

  // --------------------------------------------------------------------------
  // 6. Hata Kartı Gösterme / Gizleme
  // --------------------------------------------------------------------------
  function showError(title, message, solution) {
    errorTitle.textContent = title || 'Bir Hata Oluştu';
    errorMessage.textContent = message || 'İşlem sırasında beklenmedik bir hata oluştu.';
    errorSolution.textContent = solution || 'Lütfen girdilerinizi kontrol edip tekrar deneyin.';
    errorCard.classList.remove('hidden');
    errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function hideError() {
    errorCard.classList.add('hidden');
  }

  dismissErrorBtn.addEventListener('click', hideError);

  // --------------------------------------------------------------------------
  // 7. Çeviri İsteği Gönderme (API Çağrısı)
  // --------------------------------------------------------------------------
  async function handleTranslate() {
    if (isTranslating) return;

    const textToTranslate = sourceText.value.trim();
    if (!textToTranslate) {
      showError(
        'Metin Girilmedi',
        'Lütfen çevirmek istediğiniz metni kaynak kutucuğuna yazın veya yapıştırın.',
        'Sol taraftaki kutucuğa bir cümle veya metin girdikten sonra "Çevir" butonuna tıklayın.'
      );
      sourceText.focus();
      return;
    }

    hideError();
    setLoadingState(true);

    try {
      const payload = {
        text: textToTranslate,
        sourceLang: sourceLangSelect.value,
        targetLang: targetLangSelect.value,
        domain: domainSelect.value,
        tone: toneSelect.value,
        glossary: glossaryInput.value
      };

      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const err = data.error || {};
        showError(
          err.title || 'Çeviri Başarısız',
          err.message || 'Sunucudan hata yanıtı alındı.',
          err.solution || 'Lütfen internet bağlantınızı ve .env ayarlarınızı kontrol edin.'
        );
        return;
      }

      // Başarılı çeviri
      targetText.value = data.translation || '';
      updateCharCounts();

      // Meta etiketini güncelle
      const domainName = domainSelect.options[domainSelect.selectedIndex].text.split('(')[0].trim();
      const toneName = toneSelect.options[toneSelect.selectedIndex].text.split('(')[0].trim();
      const gCount = data.meta ? data.meta.glossaryCount : 0;
      metaInfo.textContent = `${domainName} • ${toneName}${gCount > 0 ? ` • ${gCount} terim uygulandı` : ''}`;

    } catch (networkErr) {
      showError(
        'Bağlantı Hatası',
        'Node.js sunucusuna veya Gemini servisine ulaşılamadı.',
        'Sunucunun (npm start) açık olduğundan ve internet bağlantınızın çalıştığından emin olun.'
      );
    } finally {
      setLoadingState(false);
    }
  }

  function setLoadingState(loading) {
    isTranslating = loading;
    translateBtn.disabled = loading;
    btnSpinner.classList.toggle('hidden', !loading);

    if (loading) {
      loadingOverlay.classList.remove('hidden');
    } else {
      loadingOverlay.classList.add('hidden');
    }
  }

  translateBtn.addEventListener('click', handleTranslate);

  // Başlangıç Kurulumları
  updateLanguageLabels();
  updateCharCounts();
  updateGlossaryBadge();
  checkServerStatus();
});

