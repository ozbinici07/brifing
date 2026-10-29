"""Brifing Bilgi Sistemi icin standart Python yerel web sunucusu."""

from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import urlopen
import webbrowser


ROOT = Path(__file__).resolve().parent.parent
ADDRESS = ("127.0.0.1", 8765)
URL = "http://127.0.0.1:8765/"


def main():
    # A second click opens the already running application.
    try:
        with urlopen(URL, timeout=2) as response:
            existing = response.read()
        if existing == (ROOT / "index.html").read_bytes():
            webbrowser.open(URL)
            print("Uygulama mevcut sunucuda acildi: " + URL)
            return
    except OSError:
        pass

    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    try:
        server = ThreadingHTTPServer(ADDRESS, handler)
    except OSError as error:
        raise SystemExit("Sunucu baslatilamadi. 8765 portu kullanimda olabilir: " + str(error))

    with server:
        print("Brifing Bilgi Sistemi: " + URL)
        print("Uygulama acik kaldigi surece bu pencereyi kapatmayin.")
        webbrowser.open(URL)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nSunucu kapatildi.")


if __name__ == "__main__":
    main()
