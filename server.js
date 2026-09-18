const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
}

const isWin = process.platform === 'win32';
const ytdlpPath = isWin ? path.join(__dirname, 'yt-dlp.exe') : path.join(__dirname, 'bin', 'yt-dlp');
const ffmpegLoc = isWin ? __dirname : path.join(__dirname, 'bin');

// --- TIKTOK ÜÇÜN 3 MƏRHƏLƏLİ EHTİYAT API SİSTEMİ ---
async function fetchTikTok(videoUrl, format) {
    // Attempt 1: TikWM POST API
    try {
        const params = new URLSearchParams();
        params.append('url', videoUrl);
        params.append('hd', '1');

        const res = await fetch('https://www.tikwm.com/api/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            },
            body: params
        });

        const json = await res.json();
        if (json && json.code === 0 && json.data) {
            let mediaUrl = format === 'mp3' ? json.data.music : (json.data.play || json.data.wmplay);
            if (mediaUrl && !mediaUrl.startsWith('http')) {
                mediaUrl = 'https://www.tikwm.com' + mediaUrl;
            }
            return {
                title: json.data.title || 'TikTok Video',
                mediaUrl: mediaUrl
            };
        }
    } catch (e) {
        console.log('TikWM Attempt failed, switching to backup 1...');
    }

    // Attempt 2: TiklyDown Backup API
    try {
        const res = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(videoUrl)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const json = await res.json();
        if (json && (json.video || json.music)) {
            const mediaUrl = format === 'mp3' 
                ? (json.music ? json.music.play_url : null) 
                : (json.video.noWatermark || json.video.watermark);
            
            if (mediaUrl) {
                return {
                    title: json.title || 'TikTok Video',
                    mediaUrl: mediaUrl
                };
            }
        }
    } catch (e) {
        console.log('TiklyDown Attempt failed, switching to backup 2...');
    }

    // Attempt 3: SSSTik Backup API
    try {
        const res = await fetch(`https://ww.ssstik.io/api/v1/fetch?url=${encodeURIComponent(videoUrl)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const json = await res.json();
        if (json && json.url) {
            return {
                title: 'TikTok Video',
                mediaUrl: json.url
            };
        }
    } catch (e) {
        console.log('SSSTik Attempt failed.');
    }

    throw new Error('TikTok video məlumatları alınarkən bütün xidmətlər məşğul oldu.');
}

// Brauzerdə faylın birbaşa endirilməsi üçün Proksi funksiyası
app.get('/api/proxy', async (req, res) => {
    const fileUrl = req.query.url;
    const fileName = req.query.name || `media_${Date.now()}.mp4`;

    if (!fileUrl) return res.status(400).send('URL yoxdur');

    try {
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) throw new Error('Fayl yüklənə bilmədi');

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (err) {
        console.error('Proxy Error:', err);
        res.status(500).send('Yükləmə xətası');
    }
});

app.post('/api/convert', async (req, res) => {
    let { url, platform, format, quality } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'Keçid daxil edilməyib.' });
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    // --- TIKTOK PROSESİ ---
    if (platform === 'tiktok' || url.includes('tiktok.com')) {
        try {
            const data = await fetchTikTok(url, format);
            const ext = format === 'mp3' ? 'mp3' : 'mp4';
            const downloadFileName = `TikTok_${Date.now()}.${ext}`;
            const proxyUrl = `/api/proxy?url=${encodeURIComponent(data.mediaUrl)}&name=${encodeURIComponent(downloadFileName)}`;

            return res.json({
                success: true,
                title: data.title,
                downloadUrl: proxyUrl
            });
        } catch (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }

    // --- YOUTUBE PROSESİ ---
    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = `media_${Date.now()}.${ext}`;
    const outputPath = path.join(downloadsDir, filename);

    const execOptions = { maxBuffer: 1024 * 1024 * 100 };
    const commonArgs = [
        '--no-progress',
        '--no-warnings',
        '--extractor-args', 'youtube:player_client=android,ios,web'
    ];

    execFile(ytdlpPath, ['--get-title', ...commonArgs, url], execOptions, (titleErr, stdout) => {
        const videoTitle = stdout ? stdout.trim() : 'Downloaded Media';
        let args = [...commonArgs];

        if (format === 'mp3') {
            const bitrate = quality || '320';
            args.push('-x', '--audio-format', 'mp3', '--audio-quality', `${bitrate}K`, '--ffmpeg-location', ffmpegLoc, '-o', outputPath, url);
        } else {
            let formatSpec = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best';
            if (quality && quality !== 'best') {
                formatSpec = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best`;
            }
            args.push('-f', formatSpec, '--merge-output-format', 'mp4', '--ffmpeg-location', ffmpegLoc, '-o', outputPath, url);
        }

        execFile(ytdlpPath, args, execOptions, (dlErr) => {
            if (dlErr) {
                return res.status(500).json({ success: false, message: 'YouTube videosu yüklənərkən xəta baş verdi.' });
            }

            return res.json({ success: true, title: videoTitle, downloadUrl: `/downloads/${filename}` });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Server işə düşdü: http://localhost:${PORT}`);
});
