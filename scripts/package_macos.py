#!/usr/bin/env python3
"""Stage a local, model-inclusive Apple Silicon Paper Lens app bundle."""

from __future__ import annotations

import json
import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "dist" / "Paper Lens.app"
CONTENTS = APP / "Contents"
RESOURCES = CONTENTS / "Resources"


def required(path: Path, label: str) -> Path:
    if not path.exists():
        raise SystemExit(f"Missing {label}: {path}")
    return path


def copy_tree(source: Path, destination: Path, hardlink: bool = False) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    for item in source.iterdir():
        target = destination / item.name
        if item.is_symlink():
            if hardlink:
                link = os.readlink(item)
                if os.path.isabs(link):
                    raise SystemExit(f"Refusing an absolute model-cache symlink: {item}")
                os.symlink(link, target)
            else:
                resolved = item.resolve(strict=True)
                if resolved.is_dir():
                    shutil.copytree(resolved, target)
                else:
                    shutil.copy2(resolved, target)
        elif item.is_dir():
            copy_tree(item, target, hardlink)
        elif hardlink:
            try:
                os.link(item, target)
            except OSError as error:
                raise SystemExit(
                    "The filesystem blocked bundling FLUX weights by hard-link. "
                    "Refusing to copy the 31 GB model; rerun outside the filesystem sandbox."
                ) from error
        else:
            shutil.copy2(item, target)


def install_ollama_model(source: Path, destination: Path, library: str, tag: str) -> None:
    manifest = source / "manifests/registry.ollama.ai/library" / library / tag
    required(manifest, f"Ollama model {library}:{tag}")
    data = json.loads(manifest.read_text())
    dest_manifest = destination / "manifests/registry.ollama.ai/library" / library / tag
    dest_manifest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(manifest, dest_manifest)
    digests = [data["config"]["digest"]]
    digests.extend(layer["digest"] for layer in data.get("layers", []))
    for digest in digests:
        blob = source / "blobs" / digest.replace(":", "-")
        required(blob, f"Ollama blob {digest}")
        target = destination / "blobs" / blob.name
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(blob, target)
        except OSError as error:
            raise SystemExit(
                "The filesystem blocked bundling Ollama model weights by hard-link. "
                "Refusing to duplicate the model cache; rerun outside the filesystem sandbox."
            ) from error


def main() -> None:
    if sys.platform != "darwin" or os.uname().machine != "arm64":
        raise SystemExit("Build the bundled app on an Apple Silicon Mac.")

    node = Path(shutil.which("node") or "")
    ollama_resources = Path(os.environ.get("OLLAMA_RESOURCES", "/Applications/Ollama.app/Contents/Resources"))
    ollama_models = Path(os.environ.get("OLLAMA_MODELS_SOURCE", str(Path.home() / ".ollama/models")))
    flux_cache = Path(os.environ.get(
        "FLUX_CACHE_SOURCE",
        str(Path.home() / ".cache/huggingface/hub/models--black-forest-labs--FLUX.1-schnell"),
    ))
    mflux_env = Path(os.environ.get("MFLUX_ENV", str(Path.home() / ".local/share/uv/tools/mflux")))
    python = required(mflux_env / "bin/python", "mflux Python environment")
    if not node.is_file():
        raise SystemExit("Node.js was not found on PATH.")
    required(ollama_resources / "ollama", "Ollama runtime")
    required(flux_cache / "snapshots", "FLUX.1-schnell model cache")
    required(ollama_models / "manifests", "Ollama model cache")

    python_meta = json.loads(subprocess.check_output([
        str(python), "-c",
        "import json,sys; print(json.dumps({'base':sys.base_prefix,'version':f'{sys.version_info.major}.{sys.version_info.minor}'}))",
    ], text=True))
    base = Path(python_meta["base"])
    version = python_meta["version"]
    packages = required(mflux_env / "lib" / f"python{version}" / "site-packages", "mflux Python packages")
    stdlib = required(base / "lib" / f"python{version}", "Python standard library")
    python_binary = required(base / "bin" / f"python{version}", "Python interpreter")
    libpython = required(base / "lib" / f"libpython{version}.dylib", "Python shared library")
    swiftc = Path(shutil.which("swiftc") or "")
    if not swiftc.is_file():
        raise SystemExit("swiftc is required to compile the bundled Apple OCR helper.")

    if APP.exists():
        shutil.rmtree(APP)
    (CONTENTS / "MacOS").mkdir(parents=True)
    RESOURCES.mkdir(parents=True)
    swift_package = ROOT / "macos/PaperLensApp"
    subprocess.run(["swift", "build", "--package-path", str(swift_package)], check=True)
    swift_bin = Path(subprocess.check_output([
        "swift", "build", "--package-path", str(swift_package), "--show-bin-path",
    ], text=True).strip()) / "PaperLensApp"
    shutil.copy2(required(swift_bin, "Swift app executable"), CONTENTS / "MacOS/PaperLensApp")
    shutil.copy2(node, RESOURCES / "node")

    web = required(ROOT / ".next/standalone", "Next.js standalone build")
    copy_tree(web, RESOURCES / "PaperLensServer")
    shutil.rmtree(RESOURCES / "PaperLensServer/.venv", ignore_errors=True)
    copy_tree(ROOT / ".next/static", RESOURCES / "PaperLensServer/.next/static")
    copy_tree(ROOT / "public", RESOURCES / "PaperLensServer/public")
    scripts_dest = RESOURCES / "PaperLensServer/scripts"
    scripts_dest.mkdir(exist_ok=True)
    for script in (ROOT / "scripts").glob("*.py"):
        shutil.copy2(script, scripts_dest / script.name)
    shutil.copy2(ROOT / "scripts/apple_ocr.swift", scripts_dest / "apple_ocr.swift")

    python_root = RESOURCES / "Python"
    (python_root / "bin").mkdir(parents=True)
    (python_root / "lib").mkdir()
    shutil.copy2(python_binary, python_root / "bin" / f"python{version}")
    shutil.copy2(libpython, python_root / "lib" / f"libpython{version}.dylib")
    shutil.copytree(
        stdlib,
        python_root / "lib" / f"python{version}",
        ignore=shutil.ignore_patterns("site-packages", "__pycache__", "test", "tests", "tkinter", "idlelib", "ensurepip"),
    )
    copy_tree(packages, RESOURCES / "PythonPackages")

    shutil.copytree(ollama_resources, RESOURCES / "Ollama")
    bundled_models = RESOURCES / "OllamaModels"
    install_ollama_model(ollama_models, bundled_models, "llama3.2", "3b")
    install_ollama_model(ollama_models, bundled_models, "nomic-embed-text", "latest")

    hf_root = RESOURCES / "HuggingFace/hub"
    copy_tree(flux_cache, hf_root / flux_cache.name, hardlink=True)
    subprocess.run([
        str(swiftc), "-O", str(ROOT / "scripts/apple_ocr.swift"),
        "-o", str(RESOURCES / "apple_ocr"),
    ], check=True)
    os.chmod(RESOURCES / "apple_ocr", 0o755)

    llama_manifest = json.loads((bundled_models / "manifests/registry.ollama.ai/library/llama3.2/3b").read_text())
    license_layer = next(
        (layer for layer in llama_manifest.get("layers", []) if "license" in layer.get("mediaType", "")), None
    )
    if license_layer:
        license_blob = bundled_models / "blobs" / license_layer["digest"].replace(":", "-")
        (RESOURCES / "Notice.txt").write_text(
            "Llama 3.2 is licensed under the Llama 3.2 Community License, Copyright © Meta Platforms, Inc. All Rights Reserved.\n"
            "Built with Llama.\n"
        )
        shutil.copy2(license_blob, RESOURCES / "Llama-3.2-License.txt")

    mflux_licenses = sorted(packages.glob("mflux-*.dist-info/LICENSE*"))
    if mflux_licenses:
        shutil.copy2(mflux_licenses[0], RESOURCES / "MFLUX-LICENSE.txt")

    info = {
        "CFBundleExecutable": "PaperLensApp",
        "CFBundleIdentifier": "com.paperpilot.paperlens",
        "CFBundleName": "Paper Lens",
        "CFBundleDisplayName": "Paper Lens",
        "CFBundlePackageType": "APPL",
        "CFBundleVersion": "1",
        "CFBundleShortVersionString": "0.1.0",
        "LSMinimumSystemVersion": "14.0",
        "LSRequiresNativeExecution": True,
        "NSPrincipalClass": "NSApplication",
        "NSAppTransportSecurity": {"NSAllowsLocalNetworking": True},
    }
    with (CONTENTS / "Info.plist").open("wb") as handle:
        plistlib.dump(info, handle)

    print(f"Staged {APP}")
    print("Includes Llama 3.2, nomic-embed-text, FLUX.1-schnell, Ollama, MFLUX, Node, Python, and Apple OCR.")
    print("FLUX weights are hard-linked from the local Hugging Face cache to avoid a second 31 GB copy.")


if __name__ == "__main__":
    main()
