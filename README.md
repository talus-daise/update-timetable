# update-timetable

Google スプレッドシートから画像を取得して`output`フォルダに保存し、更新があった場合はGoogleドライブへアップロードします。

使い方（簡単）:

1. 依存をインストールします:

```bash
npm install
```

2. Google Cloud ConsoleでOAuthクライアントを作成します。

```
種類:デスクトップアプリ
名前:(任意)
```

3. `.env`を作成します。

```properties:.env
GOOGLE_CLIENT_ID=(クライアントID)
GOOGLE_CLIENT_SECRET=(クライアントシークレット)
SPREADSHEET_ID=(任意のスプレッドシートのID)
GOOGLE_DRIVE_FOLDER_ID=(任意のフォルダID)
```

4. `get_oauth_token.js`を実行します。

```bash
node get_oauth_token.js
```
`token.json`が出力されます

5. コードを実行します。
```bash
npm run start
```

6. 任意で`app.py`を実行します

`app.py`は`output`内のファイル一覧をポート`3000`で公開するプログラムです。
別途`python3 -m venv venv`で仮想環境を用意した上、
```
pip install flask flask_cors
```
を実行する必要があります。

出力:
- `output/` ディレクトリ内に画像ファイルが保存されます。ファイル名は日時-インデックス.拡張子です。

注意点:
- 認証が必要な非公開シートには対応していません（公開シートを利用してください）。