# update-timetable

Google スプレッドシートから画像を取得し、`output`フォルダに保存します。画像に更新があった場合はローカルに保存し、mito1-website-timetableリポジトリにPushします。

## 使い方

1. 依存パッケージをインストールします:

```bash
npm install
```

2. `.env`ファイルを作成し、スプレッドシートIDを設定します。  
   または、環境変数として指定してください。

```properties
SPREADSHEET_ID=（スプレッドシートのIDを入力）
```

3. コードを実行します:

```bash
npm run start
```

## 出力

- `output/` ディレクトリに画像ファイルが保存されます。ファイル名は `YYYYMMDD-hhmmss-インデックス.拡張子` 形式です。

## ログ
- `logs/app.log` に実行ログが記録されます。

## 注意事項

- 認証が必要な非公開シートには対応していません（公開シートをご利用ください）。
- Google APIの制限や仕様変更により動作しなくなる場合があります。