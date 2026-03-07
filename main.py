import webview
import threading
import os
import sys
from PIL import Image
import pystray
from api import ExplorerAPI

def resource_path(relative_path):
    """Get correct resource path for both dev and PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def run_tray_icon(window):
    """Run system tray icon"""
    try:
        icon_path = resource_path("icon.ico")
        icon_image = Image.open(icon_path)
    except FileNotFoundError:
        print("Warning: icon.ico not found, using default icon")
        from PIL import ImageDraw
        icon_image = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
        draw = ImageDraw.Draw(icon_image)
        draw.rectangle([2, 2, 14, 14], outline="white", fill="blue")

    def on_show():
        window.show()
        try:
            window.restore()
        except AttributeError:
            pass

    def on_quit():
        icon.stop()
        window.destroy()
        os._exit(0)

    menu = pystray.Menu(
        pystray.MenuItem("显示主窗口", on_show),
        pystray.MenuItem("退出程序", on_quit)
    )

    icon = pystray.Icon("GooseManager", icon_image, "Goose Manager", menu)
    icon.run()

if __name__ == '__main__':
    api = ExplorerAPI()
    
    # Load HTML
    html_path = resource_path("index.html")
    try:
        with open(html_path, encoding="utf-8") as f:
            html_content = f.read()
    except FileNotFoundError:
        print(f"Error: index.html not found at {html_path}")
        print(f"Current dir: {os.getcwd()}")
        print(f"__file__: {__file__}")
        if hasattr(sys, '_MEIPASS'):
            print(f"_MEIPASS: {sys._MEIPASS}")
        input("Press Enter to exit...")
        sys.exit(1)
    
    window = webview.create_window(
        'Goose Manager',
        html=html_content,
        js_api=api,
        width=1000,
        height=700,
        resizable=True,
        min_size=(800, 500),
    )

    # Hide to tray on close
    def on_closing():
        window.hide()
        return False
    window.events.closing += on_closing

    # Start tray icon in separate thread
    tray_thread = threading.Thread(target=run_tray_icon, args=(window,), daemon=True)
    tray_thread.start()

    webview.start()
