import os
import zipfile
import sys

def create_zip():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    out_dir = os.path.abspath(os.path.join(base_dir, ".."))
    zip_path = os.path.join(out_dir, "symbiosis_spacecraft_autonomy.zip")
    
    # Also save one directly in workspace root for easy access
    local_zip_path = os.path.join(base_dir, "symbiosis_spacecraft_autonomy.zip")
    
    exclude_dirs = {"__pycache__", ".git", "node_modules", ".gemini", ".venv", ".pytest_cache"}
    exclude_exts = {".pyc", ".zip"}
    
    for target_zip in [zip_path, local_zip_path]:
        count = 0
        with zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(base_dir):
                dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.endswith('.egg-info')]
                for f in files:
                    if f == "symbiosis_spacecraft_autonomy.zip" or any(f.endswith(ext) for ext in exclude_exts):
                        continue
                    fp = os.path.join(root, f)
                    arcname = os.path.relpath(fp, base_dir)
                    zf.write(fp, arcname)
                    count += 1
        
        size_mb = os.path.getsize(target_zip) / (1024 * 1024)
        print(f"Archive saved to: {target_zip}")
        print(f"Total files packaged: {count} | Total archive size: {size_mb:.2f} MB")

if __name__ == "__main__":
    create_zip()
