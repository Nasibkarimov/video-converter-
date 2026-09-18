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

app.post('/api/convert', async (req, res) => {
    let { url, platform, format, quality } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'Keçid daxil edilməyib.' });
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = `media_${Date.now()}.${ext}`;
    const outputPath = path.join(downloadsDir, filename);

    // --- TIKTOK ÜÇÜN DÖZÜMLÜ API HƏLLİ ---
    if (platform === 'tiktok' || url.includes('tiktok.com')) {
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            
            const apiRes = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            const json = await apiRes.json();

            if (json.code === 0 && json.data) {
                const downloadMediaUrl = format === 'mp3' ? json.data.music : json.data.play;
                const title = json.data.title || 'TikTok Video';

                const mediaRes = await fetch(downloadMediaUrl);
                const arrayBuffer = await mediaRes.arrayBuffer();
                fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

                return res.json({
                    success: true,
                    title: title,
                    downloadUrl: `/downloads/${filename}`
                });
            } else {
                return res.status(500).json({ success: false, message: 'TikTok keçidi emal edilə bilmədi.' });
            }
        } catch (err) {
            console.error('TikTok Error:', err);
            return res.status(500).json({ success: false, message: 'TikTok yükləmə xətası baş verdi.' });
        }
    }

    // --- YOUTUBE ÜÇÜN YT-DLP HƏLLİ ---
    const execOptions = { maxBuffer: 1024 * 1024 * 100 };
    const commonArgs = ['--no-progress', '--no-warnings', '--extractor-args', 'youtube:player_client=android,web'];

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
