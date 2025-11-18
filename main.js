const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { google } = require('googleapis');
const { Readable } = require('stream');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

const OUTPUT_DIR = path.resolve(__dirname, 'output');
const HASH_FILE = path.join(OUTPUT_DIR, '.last_hashes.json');
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '1vCjJklOsTeYBcyQ7P4eJNBuCE1VvzvF8';
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const TOKEN_PATH = path.resolve(__dirname, 'token.json');

/** 出力フォルダを確保 */
function ensureOutputDir() {
	if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/** ファイル名生成 */
function getTimestampFilename(index, ext) {
	const now = new Date();
	const pad = n => n.toString().padStart(2, '0');
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${index}.${ext}`;
}

/** SHA256ハッシュ */
function hashBuffer(buf) {
	return crypto.createHash('sha256').update(buf).digest('hex');
}

/** 最終ハッシュ読み込み */
function loadLastHashes() {
	try {
		if (fs.existsSync(HASH_FILE)) return JSON.parse(fs.readFileSync(HASH_FILE, 'utf8'));
	} catch {}
	return {};
}

/** 最終ハッシュ保存 */
function saveLastHashes(hashes) {
	try {
		fs.writeFileSync(HASH_FILE, JSON.stringify(hashes, null, 2));
	} catch {}
}

/** OAuth2クライアント取得 */
function getOAuthClient() {
	if (!fs.existsSync(TOKEN_PATH)) {
		console.error('token.json が見つかりません。まず get_oauth_token.js を実行してください。');
		process.exit(1);
	}
	const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
	const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
	oAuth2Client.setCredentials(tokens);
	return oAuth2Client;
}

/** Drive に画像をアップロード */
async function uploadToDrive(filename, buffer, mimeType = 'image/png') {
	try {
		const auth = getOAuthClient();
		const drive = google.drive({ version: 'v3', auth });

		const stream = Readable.from(buffer);

		const res = await drive.files.create({
			requestBody: {
				name: filename,
				parents: [DRIVE_FOLDER_ID],
			},
			media: {
				mimeType,
				body: stream,
			},
			fields: 'id, webViewLink',
		});

		console.log(`　→ Driveにアップロード完了: ${res.data.webViewLink}`);
	} catch (err) {
		console.error('Driveアップロード失敗:', err.message);
	}
}

/** スプレッドシートから埋め込み画像を抽出 */
async function exportXlsxAndExtract(spreadsheetId) {
	const tmpXlsx = path.join(__dirname, `tmp-${spreadsheetId}.xlsx`);

	async function extractImages(buffer) {
		fs.writeFileSync(tmpXlsx, buffer);
		const zip = new AdmZip(tmpXlsx);
		const entries = zip.getEntries().filter(e => e.entryName.startsWith('xl/media/'));
		const images = entries.map(e => ({
			name: path.basename(e.entryName),
			data: e.getData(),
		}));
		fs.unlinkSync(tmpXlsx);
		return images;
	}

	try {
		console.log('Trying unauthenticated XLSX export...');
		const unauthUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
		const res = await axios.get(unauthUrl, { responseType: 'arraybuffer', timeout: 20000 });
		if (res.status === 200) return await extractImages(res.data);
	} catch (e) {
		console.log('Unauthenticated export failed:', e.message);
	}

	console.error('スプレッドシートの取得に失敗しました。');
	return [];
}

async function main() {
    ensureOutputDir();
    if (!SPREADSHEET_ID) {
        console.error('環境変数 SPREADSHEET_ID が設定されていません。');
        process.exit(1);
    }

    const images = await exportXlsxAndExtract(SPREADSHEET_ID);
    if (images.length === 0) {
        console.log('スプレッドシートに埋め込み画像が見つかりませんでした。');
        return;
    }

    console.log(`発見: ${images.length} 枚（※処理するのは最初の1枚だけ）`);

    const onlyImage = images[0];
    const { name, data } = onlyImage;

    const lastHashes = loadLastHashes();
    const newHashes = {};

    const hash = hashBuffer(data);
    newHashes[name] = hash;

    if (lastHashes[name] && lastHashes[name] === hash) {
        console.log(`${name}: SKIP（変更なし）`);
    } else {
        const ext = path.extname(name).replace('.', '') || 'png';
        const filename = getTimestampFilename(1, ext);
        const filePath = path.join(OUTPUT_DIR, filename);

        fs.writeFileSync(filePath, data);
        console.log(`${name}: 保存 → ${filename}`);

        await uploadToDrive(filename, data, `image/${ext}`);
        console.log(`　→ Driveにアップロード完了`);
    }

    saveLastHashes(newHashes);
}

if (require.main === module) {
	main();
	setInterval(main, 60 * 1000);
}
