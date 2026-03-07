import sys
import os

def resource_path(relative_path):
    """
    获取资源文件的正确路径
    支持开发环境（直接运行.py）和 PyInstaller 打包后的环境
    """
    if hasattr(sys, '_MEIPASS'):
        # PyInstaller 打包后，资源文件会被解压到 _MEIPASS 临时目录
        return os.path.join(sys._MEIPASS, relative_path)
    # 开发环境：使用当前文件所在目录
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)
