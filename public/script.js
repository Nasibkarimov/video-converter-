let selectedPlatform = 'youtube';
let selectedFormat = 'mp3';
let currentLang = 'en';

const translations = {
    en: {
        youtubeSubtitle: "Download YouTube videos as MP3 audio or MP4 video",
        tiktokSubtitle: "Download TikTok videos without watermark in HD",
        youtubePlaceholder: "Paste YouTube video URL here...",
        tiktokPlaceholder: "Paste TikTok video URL here...",
        btnMp3: "MP3 (Audio)",
        btnMp4: "MP4 (Video)",
        qualityLabel: "Quality:",
        convertBtn: "Prepare Download",
        statusEnterUrlYt: "Please enter a valid YouTube URL!",
        statusEnterUrlTt: "Please enter a valid TikTok URL!",
        statusProcessing: "⏳ Processing media, please wait...",
        statusReady: "✅ Ready:",
        downloadBtn: "Download File",
        statusError: "❌ Error:",
        statusServerError: "❌ Server connection issue.",
        bestQuality: "Best Available (HD)"
    },
    az: {
        youtubeSubtitle: "YouTube videolarını MP3 audio və ya MP4 video kimi endirin",
        tiktokSubtitle: "TikTok videolarını fliqransız (loqosuz) tam HD yükləyin",
        youtubePlaceholder: "YouTube keçidini bura yapışdırın...",
        tiktokPlaceholder: "TikTok keçidini bura yapışdırın...",
        btnMp3: "MP3 (Audio)",
        btnMp4: "MP4 (Video)",
        qualityLabel: "Keyfiyyət:",
        convertBtn: "Endirməyə Hazırla",
        statusEnterUrlYt: "Xahiş olunur düzgün YouTube keçidi daxil edin!",
        statusEnterUrlTt: "Xahiş olunur düzgün TikTok keçidi daxil edin!",
        statusProcessing: "⏳ Fayl emal olunur, xahiş olunur gözləyin...",
        statusReady: "✅ Hazırdır:",
        downloadBtn: "Faylı Yüklə",
        statusError: "❌ Xəta:",
        statusServerError: "❌ Serverlə əlaqə kəsildi.",
        bestQuality: "Ən Yüksək Keyfiyyət (HD)"
    },
    ru: {
        youtubeSubtitle: "Скачивайте видео с YouTube в формате MP3 или MP4",
        tiktokSubtitle: "Скачивайте видео с TikTok без водяного знака в HD",
        youtubePlaceholder: "Вставьте ссылку на YouTube...",
        tiktokPlaceholder: "Вставьте ссылку на TikTok...",
        btnMp3: "MP3 (Аудио)",
        btnMp4: "MP4 (Видео)",
        qualityLabel: "Качество:",
        convertBtn: "Скачать",
        statusEnterUrlYt: "Введите корректную ссылку на YouTube!",
        statusEnterUrlTt: "Введите корректную ссылку на TikTok!",
        statusProcessing: "⏳ Обработка файла, подождите...",
        statusReady: "✅ Готово:",
        downloadBtn: "Скачать файл",
        statusError: "❌ Ошибка:",
        statusServerError: "❌ Ошибка соединения с сервером.",
        bestQuality: "Максимальное качество (HD)"
    }
};

const qualityOptions = {
    youtube: {
        mp3: [
            { value: '320', label: '320 kbps (High)' },
            { value: '192', label: '192 kbps (Medium)' },
            { value: '128', label: '128 kbps (Low)' }
        ],
        mp4: [
            { value: 'best', labelKey: 'bestQuality' },
            { value: '1080', label: '1080p (Full HD)' },
            { value: '720', label: '720p (HD)' },
            { value: '480', label: '480p' }
        ]
    },
    tiktok: {
        mp3: [
            { value: '320', label: '320 kbps (Audio Only)' }
        ],
        mp4: [
            { value: 'best', labelKey: 'bestQuality' }
        ]
    }
};

function renderUI() {
    const t = translations[currentLang];
    
    // Subtitle & Placeholder based on platform
    if (selectedPlatform === 'youtube') {
        document.getElementById('subtitleText').innerText = t.youtubeSubtitle;
        document.getElementById('urlInput').placeholder = t.youtubePlaceholder;
    } else {
        document.getElementById('subtitleText').innerText = t.tiktokSubtitle;
        document.getElementById('urlInput').placeholder = t.tiktokPlaceholder;
    }

    document.getElementById('btnMp3').innerText = t.btnMp3;
    document.getElementById('btnMp4').innerText = t.btnMp4;
    document.getElementById('qualityLabel').innerText = t.qualityLabel;
    document.getElementById('convertBtn').innerText = t.convertBtn;

    // Quality selector
    const qualitySelect = document.getElementById('qualitySelect');
    qualitySelect.innerHTML = '';
    const list = qualityOptions[selectedPlatform][selectedFormat];

    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.labelKey ? t[item.labelKey] : item.label;
        qualitySelect.appendChild(option);
    });
}

// Platform Tabs Switch
document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedPlatform = e.target.getAttribute('data-platform');
        document.getElementById('statusArea').innerHTML = '';
        renderUI();
    });
});

// Format Switch
document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedFormat = e.target.getAttribute('data-format');
        renderUI();
    });
});

function changeLanguage(lang) {
    currentLang = lang;
    document.getElementById('statusArea').innerHTML = '';
    renderUI();
}

async function processMedia() {
    const urlInput = document.getElementById('urlInput');
    const convertBtn = document.getElementById('convertBtn');
    const statusArea = document.getElementById('statusArea');
    const qualitySelect = document.getElementById('qualitySelect');
    
    const url = urlInput.value.trim();
    const quality = qualitySelect.value;
    const t = translations[currentLang];

    if (!url) {
        const errText = selectedPlatform === 'youtube' ? t.statusEnterUrlYt : t.statusEnterUrlTt;
        statusArea.innerHTML = `<p class="status-error">${errText}</p>`;
        return;
    }

    convertBtn.disabled = true;
    statusArea.innerHTML = `<div class="status-loading">${t.statusProcessing}</div>`;

    try {
        const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, platform: selectedPlatform, format: selectedFormat, quality })
        });

        const data = await res.json();

        if (data.success) {
            statusArea.innerHTML = `
                <p class="status-success">${t.statusReady} <strong>${escapeHtml(data.title)}</strong></p>
                <a href="${data.downloadUrl}" class="download-link-btn" download>${t.downloadBtn} (${selectedFormat.toUpperCase()})</a>
            `;
        } else {
            statusArea.innerHTML = `<p class="status-error">${t.statusError} ${escapeHtml(data.message)}</p>`;
        }
    } catch (err) {
        statusArea.innerHTML = `<p class="status-error">${t.statusServerError}</p>`;
    } finally {
        convertBtn.disabled = false;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
}

renderUI();