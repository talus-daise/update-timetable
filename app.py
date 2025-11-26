from flask import Flask, send_from_directory, abort
from flask_cors import CORS
import os
import mimetypes

app = Flask(__name__)
CORS(app,
     resources={r"/*": {"origins": "*"}},
     allow_headers=["Content-Type",
                    "authorization",
                    "ngrok-skip-browser-warning",
                    "bypass-tunnel-reminder"]
)

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'output')

@app.route('/')
def index():
    if not os.path.exists(OUTPUT_DIR):
        return "<h1>output フォルダが存在しません。</h1>", 404

    files = os.listdir(OUTPUT_DIR)
    file_links = [f'<li><a href="/files/{f}">{f}</a></li>' for f in files]
    return f"<h2>公開中のファイル一覧:</h2><ul>{''.join(file_links)}</ul>"

@app.route('/files/<path:filename>')
def serve_file(filename):
    file_path = os.path.join(OUTPUT_DIR, filename)

    if not os.path.exists(file_path):
        abort(404)

    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type is None:
        mime_type = "application/octet-stream"

    return send_from_directory(OUTPUT_DIR, filename, mimetype=mime_type)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
