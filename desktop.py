from __future__ import annotations

import argparse
import ctypes
import logging
import os
import threading
from http.server import ThreadingHTTPServer
from pathlib import Path

import webview

from server import Handler, ROOT, VERSION, _claim_pid_file, _release_pid_file

APP_TITLE = 'Hoja Personal CV Studio'
DEFAULT_PORT = 4173
WINDOW_WIDTH = 1440
WINDOW_HEIGHT = 900
WINDOW_MIN_SIZE = (1080, 700)


def _app_data_dir() -> Path:
    base = os.environ.get('LOCALAPPDATA')
    root = Path(base) if base else (Path.home() / 'AppData' / 'Local')
    target = root / 'HojaPersonalCVStudio'
    target.mkdir(parents=True, exist_ok=True)
    return target


def _configure_logging(app_dir: Path) -> None:
    logging.basicConfig(
        filename=app_dir / 'desktop.log',
        level=logging.INFO,
        format='%(asctime)s %(levelname)s %(message)s',
        encoding='utf-8',
    )


def _message_box(message: str, title: str = APP_TITLE) -> None:
    if os.name == 'nt':
        ctypes.windll.user32.MessageBoxW(None, str(message), title, 0x10)
    else:
        logging.error('%s: %s', title, message)


def _server_thread(server: ThreadingHTTPServer) -> threading.Thread:
    thread = threading.Thread(
        target=server.serve_forever,
        kwargs={'poll_interval': 0.2},
        name='mastercv-local-server',
        daemon=True,
    )
    thread.start()
    return thread


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT)
    parser.add_argument('--pid-file', default='')
    parser.add_argument('--instance-token', default='')
    parser.add_argument('--smoke-seconds', type=float, default=0.0)
    return parser.parse_args()


def run_desktop() -> int:
    args = _parse_args()
    app_dir = _app_data_dir()
    _configure_logging(app_dir)

    pid_file = Path(args.pid_file).expanduser() if args.pid_file else (app_dir / 'server.pid')
    pid_path = None
    server = None

    try:
        pid_path = _claim_pid_file(pid_file)
        os.chdir(ROOT)
        server = ThreadingHTTPServer((args.host, args.port), Handler)
        server.daemon_threads = True
        _server_thread(server)

        actual_port = int(server.server_address[1])
        url = f'http://{args.host}:{actual_port}'
        storage_path = app_dir / 'WebView'
        storage_path.mkdir(parents=True, exist_ok=True)

        window = webview.create_window(
            APP_TITLE,
            url=url,
            width=WINDOW_WIDTH,
            height=WINDOW_HEIGHT,
            min_size=WINDOW_MIN_SIZE,
            resizable=True,
            background_color='#111827',
            text_select=True,
        )

        def on_window_shown():
            logging.info('Ventana de escritorio mostrada.')
            if args.smoke_seconds > 0:
                def close_smoke_window():
                    try:
                        window.destroy()
                    except Exception:
                        logging.exception('No se pudo cerrar la ventana de smoke test.')
                threading.Timer(args.smoke_seconds, close_smoke_window).start()

        def on_window_loaded():
            logging.info('Interfaz WebView cargada correctamente.')

        window.events.shown += on_window_shown
        window.events.loaded += on_window_loaded

        logging.info('Iniciando %s %s en %s', APP_TITLE, VERSION, url)
        webview.start(
            gui='edgechromium',
            debug=False,
            private_mode=False,
            storage_path=str(storage_path),
        )
        return 0
    except OSError as exc:
        logging.exception('No se pudo iniciar el servidor local.')
        _message_box(
            'No se pudo iniciar Master CV Studio. '
            'El puerto local puede estar ocupado o WebView2 no está disponible.\n\n'
            f'Detalle: {exc}'
        )
        return 1
    except RuntimeError as exc:
        logging.exception('Master CV Studio no pudo iniciar.')
        _message_box(str(exc))
        return 1
    except Exception as exc:
        logging.exception('Error inesperado al iniciar Master CV Studio.')
        _message_box(f'Error inesperado al iniciar Master CV Studio.\n\n{exc}')
        return 1
    finally:
        if server is not None:
            try:
                server.shutdown()
            except Exception:
                logging.exception('No se pudo detener el servidor local limpiamente.')
            try:
                server.server_close()
            except Exception:
                logging.exception('No se pudo cerrar el socket local limpiamente.')
        _release_pid_file(pid_path)


if __name__ == '__main__':
    raise SystemExit(run_desktop())
