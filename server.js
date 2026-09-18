const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
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

// Faylı url-dən serverə endirən funksiya
function downloadFile(fileUrl, outputPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(outputPath);
        https.get(fileUrl, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadFile(response.headers.location, outputPath).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(outputPath, () => {});
            reject(err);
        });
    });
}

app.post('/api/convert', async (req, res) => {
    let { url, platform, format, quality } = req.body;

    if (!url) return res.status(400).json({ success: false, message: 'Keçid daxil edilməyib.' });
    if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;

    const ext = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = `media_${Date.now()}.${ext}`;
    const outputPath = path.join(downloadsDir, filename);

    // --- TIKTOK ÜÇÜN BİRBAŞA API HƏLLİ (RENDER-DƏ 100% İŞLƏYİR) ---
    if (platform === 'tiktok' || url.includes('tiktok.com')) {
        try {
            const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
            
            https.get(apiUrl, (apiRes) => {
                let data = '';
                apiRes.on('data', chunk => data += chunk);
                apiRes.on('end', async () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.code === 0 && json.data) {
                            const downloadMediaUrl = format === 'mp3' ? json.data.music : json.data.play;
                            const title = json.data.title || 'TikTok Video';

                            await downloadFile(downloadMediaUrl, outputPath);

                            return res.json({
                                success: true,
                                title: title,
                                downloadUrl: `/downloads/${filename}`
                            });
                        } else {
                            return res.status(500).json({ success: false, message: 'TikTok keçidi emal edilə bilmədi.' });
                        }
                    } catch (e) {
                        return res.status(500).json({ success: false, message: 'TikTok məlumatı oxunarkən xəta.' });
                    }
                });
            }).on('error', () => {
                return res.status(500).json({ success: false, message: 'TikTok serveri ilə əlaqə kəsildi.' });
            });

        } catch (err) {
            return res.status(500).json({ success: false, message: 'TikTok yükləmə xətası.' });
        }
        return;
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
