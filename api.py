import base64
import os
import shutil
import string
import ctypes
import json
import sys
from datetime import datetime

# Lazy imports to reduce startup time and avoid circular imports
_requests = None
_webview = None

def _get_requests():
    global _requests
    if _requests is None:
        import requests
        _requests = requests
    return _requests

def _get_webview():
    global _webview
    if _webview is None:
        import webview
        _webview = webview
    return _webview

def resource_path(relative_path):
    """Get correct resource path for both dev and PyInstaller"""
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

class ExplorerAPI:
    def __init__(self):
        self._kernel32 = ctypes.windll.kernel32
        self.clipboard = {'operation': None, 'paths': []}

    def _get_settings_path(self):
        app_data = os.environ.get('APPDATA', os.path.expanduser('~'))
        settings_dir = os.path.join(app_data, 'GooseManager')
        os.makedirs(settings_dir, exist_ok=True)
        return os.path.join(settings_dir, 'settings.json')

    def _get_volume_label(self, root_path):
        try:
            buf = ctypes.create_unicode_buffer(1024)
            self._kernel32.GetVolumeInformationW(
                ctypes.c_wchar_p(root_path), buf, ctypes.sizeof(buf),
                None, None, None, None, 0
            )
            return buf.value or root_path[0] + ':'
        except:
            return root_path[0] + ':'

    def save_settings(self, settings):
        try:
            with open(self._get_settings_path(), 'w', encoding='utf-8') as f:
                json.dump(settings, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            print(f"Save settings failed: {e}")
            return False

    def load_settings(self):
        default = {
            'theme': 'dark', 'animations': True,
            'wallpaper': 'default', 'wallpaper_custom_path': '',
            'anim_speed': 50, 'anim_easing': 'ease',
            'anim_list': True, 'anim_grid': True,
            'anim_nav': True, 'anim_bg': True
        }
        try:
            path = self._get_settings_path()
            if os.path.exists(path):
                with open(path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    return {**default, **data}
            return default
        except Exception as e:
            print(f"Load settings failed: {e}")
            return default

    def get_drives(self):
        drives = []
        for letter in string.ascii_uppercase:
            root = letter + ':\\'
            if os.path.exists(root):
                label = self._get_volume_label(root)
                drives.append({
                    'drive': letter + ':', 'path': root,
                    'label': f'{label} ({letter}:)',
                    'is_dir': True, 'name': f'{label} ({letter}:)',
                    'type': 'Drive'
                })
        return drives

    def get_home(self):
        return os.path.expanduser('~')

    def list_directory(self, path):
        if not os.path.isdir(path):
            raise Exception(f'Path not found: {path}')
        
        system_items = {
            '$recycle.bin', 'system volume information', 'recycler',
            'pagefile.sys', 'hiberfil.sys', 'swapfile.sys'
        }
        entries = []
        
        try:
            for item in os.listdir(path):
                if item.lower() in system_items:
                    continue
                full = os.path.join(path, item)
                try:
                    stat = os.stat(full)
                    is_dir = os.path.isdir(full)
                    entries.append({
                        'name': item, 'path': full, 'is_dir': is_dir,
                        'size': 0 if is_dir else stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M'),
                        'type': 'Folder' if is_dir else (os.path.splitext(item)[1].upper() or 'File')
                    })
                except (OSError, PermissionError):
                    continue
        except Exception as e:
            raise Exception(f'Cannot read directory: {e}')
        
        entries.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
        return entries

    def delete_path(self, path):
        if not os.path.exists(path):
            raise Exception('Path not found')
        try:
            shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
        except Exception as e:
            raise Exception(f'Delete failed: {e}')

    def create_folder(self, parent, name):
        if not os.path.isdir(parent):
            raise Exception('Invalid parent directory')
        new_path = os.path.join(parent, name)
        try:
            os.makedirs(new_path, exist_ok=False)
        except FileExistsError:
            raise Exception('Folder already exists')
        except Exception as e:
            raise Exception(f'Create failed: {e}')

    def create_file(self, parent, name, content=''):
        if not os.path.isdir(parent):
            raise Exception('Invalid parent directory')
        new_path = os.path.join(parent, name)
        if os.path.exists(new_path):
            raise Exception('File already exists')
        with open(new_path, 'w', encoding='utf-8') as f:
            f.write(content)

    def rename_path(self, old_path, new_name):
        if not os.path.exists(old_path):
            raise Exception('Source not found')
        parent = os.path.dirname(old_path)
        new_path = os.path.join(parent, new_name)
        if os.path.exists(new_path):
            raise Exception('Target already exists')
        os.rename(old_path, new_path)

    def get_properties(self, path):
        if not os.path.exists(path):
            raise Exception('Path not found')
        stat = os.stat(path)
        is_dir = os.path.isdir(path)
        return {
            'name': os.path.basename(path), 'path': path, 'is_dir': is_dir,
            'size': 0 if is_dir else stat.st_size,
            'created': datetime.fromtimestamp(stat.st_ctime).strftime('%Y-%m-%d %H:%M:%S'),
            'modified': datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S'),
            'accessed': datetime.fromtimestamp(stat.st_atime).strftime('%Y-%m-%d %H:%M:%S')
        }

    def open_file(self, path):
        if not os.path.exists(path):
            raise Exception('Path not found')
        os.startfile(path)

    def copy_items(self, paths):
        self.clipboard = {'operation': 'copy', 'paths': paths[:]}
        return True

    def cut_items(self, paths):
        self.clipboard = {'operation': 'cut', 'paths': paths[:]}
        return True

    def paste_items(self, dest_dir):
        if not self.clipboard.get('paths'):
            raise Exception('Clipboard empty')
        op = self.clipboard['operation']
        results = []
        for src in self.clipboard['paths']:
            if not os.path.exists(src):
                results.append(f'Not found: {src}')
                continue
            base = os.path.basename(src)
            dst = os.path.join(dest_dir, base)
            counter = 1
            while os.path.exists(dst):
                name, ext = os.path.splitext(base)
                dst = os.path.join(dest_dir, f"{name} ({counter}){ext}")
                counter += 1
            try:
                if op == 'copy':
                    shutil.copytree(src, dst) if os.path.isdir(src) else shutil.copy2(src, dst)
                else:
                    shutil.move(src, dst)
                results.append(f'Success: {os.path.basename(dst)}')
            except Exception as e:
                results.append(f'Failed {base}: {e}')
        if op == 'cut':
            self.clipboard = {'operation': None, 'paths': []}
        return results

    def get_clipboard_status(self):
        return {
            'operation': self.clipboard.get('operation'),
            'count': len(self.clipboard.get('paths', []))
        }

    def choose_wallpaper_file(self):
        try:
            webview = _get_webview()
            window = webview.windows[0]
            window.show()
            result = window.create_file_dialog(
                webview.FileDialog.OPEN,
                allow_multiple=False,
                file_types=('Image files (*.jpg;*.jpeg;*.png;*.bmp;*.gif)',)
            )
            return result[0] if result else None
        except Exception as e:
            print(f"Choose wallpaper failed: {e}")
            return None

    def get_bing_wallpaper(self):
        try:
            requests = _get_requests()
            url = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
            r = requests.get(url, headers=headers, timeout=10)
            data = r.json()
            if data.get('images'):
                return "https://www.bing.com" + data['images'][0]['url']
            raise Exception("No wallpaper data")
        except Exception as e:
            raise Exception(f"Get wallpaper failed: {e}")

    def get_app_icon(self):
        try:
            icon_path = resource_path('app.png')
            if not os.path.exists(icon_path):
                return None
            with open(icon_path, 'rb') as f:
                return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"
        except Exception as e:
            print(f"Read icon failed: {e}")
            return None

    def read_file_as_base64(self, file_path):
        try:
            ext = os.path.splitext(file_path)[1].lower()
            mime = {
                '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
                '.png': 'image/png', '.gif': 'image/gif',
                '.bmp': 'image/bmp', '.webp': 'image/webp'
            }.get(ext, 'image/jpeg')
            with open(file_path, 'rb') as f:
                return f"data:{mime};base64,{base64.b64encode(f.read()).decode()}"
        except Exception as e:
            print(f"Read file failed: {e}")
            return None
