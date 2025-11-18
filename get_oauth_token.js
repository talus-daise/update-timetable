const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function main() {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('以下のURLを開いて認証コードを入力してください:');
    console.log(authUrl);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('認証コードを貼り付け: ', async (code) => {
        rl.close();
        const { tokens } = await oAuth2Client.getToken(code);
        fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
        console.log('トークンを token.json に保存しました。');
    });
}

main().catch(console.error);
