import os
import json
import time
import hashlib
import zipfile
import requests
import subprocess
import logging
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"
HASH_FILE = OUTPUT_DIR / ".last_hashes.json"
SPREADSHEET_ID = os.getenv("SPREADSHEET_ID")

# ログ設定
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "app.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

# 画像専用Gitリポジトリ
IMAGE_REPO_DIR = Path.home() / "mito1-website-timetable"
IMAGE_REPO_OUTPUT = IMAGE_REPO_DIR / "output"
GIT_REMOTE = "origin"
GIT_BRANCH = "main"


def ensure_output_dir():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def hash_buffer(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_hashes() -> dict:
    if HASH_FILE.exists():
        try:
            return json.loads(HASH_FILE.read_text(encoding="utf-8"))
        except Exception as e:
            logging.warning(f"hash読み込み失敗: {e}")
    return {}


def save_hashes(hashes: dict):
    try:
        HASH_FILE.write_text(json.dumps(hashes, indent=2), encoding="utf-8")
    except Exception as e:
        logging.error(f"hash保存失敗: {e}")


def today_string() -> str:
    return datetime.now().strftime("%Y%m%d")


def export_xlsx_and_extract(spreadsheet_id: str):
    tmp_xlsx = BASE_DIR / f"tmp-{spreadsheet_id}.xlsx"
    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=xlsx"

    logging.info("スプレッドシート取得開始")
    res = requests.get(url, timeout=20)
    res.raise_for_status()
    tmp_xlsx.write_bytes(res.content)

    images = []
    with zipfile.ZipFile(tmp_xlsx, "r") as z:
        media_files = sorted(
            [f for f in z.namelist() if f.startswith("xl/media/")]
        )
        for i, name in enumerate(media_files, start=1):
            ext = Path(name).suffix or ".jpg"
            images.append({
                "index": i,
                "ext": ext,
                "data": z.read(name)
            })

    tmp_xlsx.unlink(missing_ok=True)
    logging.info(f"画像抽出完了: {len(images)}件")
    return images


def sync_to_image_repo():
    IMAGE_REPO_OUTPUT.mkdir(parents=True, exist_ok=True)
    for file in OUTPUT_DIR.iterdir():
        if file.is_file():
            target = IMAGE_REPO_OUTPUT / file.name
            target.write_bytes(file.read_bytes())
    logging.info("画像リポジトリへ同期完了")


def git_push_images():
    subprocess.run(["git", "add", "output"], cwd=IMAGE_REPO_DIR, check=True)
    subprocess.run(
        ["git", "commit", "-m", "update timetable images"],
        cwd=IMAGE_REPO_DIR,
        check=True
    )
    subprocess.run(
        ["git", "push", GIT_REMOTE, GIT_BRANCH],
        cwd=IMAGE_REPO_DIR,
        check=True
    )
    logging.info("Git push 完了")


def main():
    ensure_output_dir()

    if not SPREADSHEET_ID:
        logging.warning("SPREADSHEET_ID未設定")
        return

    try:
        images = export_xlsx_and_extract(SPREADSHEET_ID)
        if not images:
            logging.info("画像なし")
            return

        hash_state = load_hashes()
        all_known_hashes = set(hash_state.values())

        new_images = []
        for img in images:
            h = hash_buffer(img["data"])
            img["hash"] = h
            new_images.append(img)

        if any(img["hash"] in all_known_hashes for img in new_images):
            logging.info("既存画像のみのためスキップ")
            return

        date = today_string()
        saved = False

        for img in new_images:
            filename = f"{date}-{img['index']}{img['ext']}"
            (OUTPUT_DIR / filename).write_bytes(img["data"])
            hash_state[filename] = img["hash"]
            saved = True
            logging.info(f"保存: {filename}")

        if saved:
            save_hashes(hash_state)
            sync_to_image_repo()
            git_push_images()

    except Exception as e:
        logging.exception(f"エラー発生: {e}")


if __name__ == "__main__":
    while True:
        main()
        time.sleep(60)
