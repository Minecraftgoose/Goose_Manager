import webview
import threading
import os
import sys
from PIL import Image
import pystray
from api import ExplorerAPI

def resource_path(relative_path):
    """获取资源文件的正确路径（开发环境或 PyInstaller 打包后）"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

def run_tray_icon(window):
    """运行系统托盘图标"""
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

    # 获取 HTML 文件的正确路径（开发环境或打包后）
    html_path = resource_path("index.html")

    # 创建窗口，直接使用本地文件路径（自动加载外部 CSS/JS）
    window = webview.create_window(
        'Goose Manager',
        url=html_path,          # 使用 url 参数传入本地文件路径
        js_api=api,
        width=1000,
        height=700,
        resizable=True,
        min_size=(800, 500),
    )

    # 关闭窗口时隐藏到托盘（不退出）
    def on_closing():
        window.hide()
        return False
    window.events.closing += on_closing

    # 在独立线程中启动托盘图标
    tray_thread = threading.Thread(target=run_tray_icon, args=(window,), daemon=True)
    tray_thread.start()

    # 启动主窗口
    webview.start()
