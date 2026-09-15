"""Generate the complete offline English catalog for bundled Case Center comments.

The generator is a release-time tool only. The browser consumes the resulting
JSON and never loads Argos Translate or a model at runtime.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "campus-pulse-data"
CATALOG_PATH = ROOT / "src" / "campus-pulse" / "i18n" / "contentTranslations.en.json"
CASE_FILES = (
    DATA_DIR / "resource-policy-live-r1.json",
    DATA_DIR / "lecture-open-choice-r4.json",
)


def message_texts(value: Any) -> set[str]:
    texts: set[str] = set()
    if isinstance(value, dict):
        text = value.get("visible_text")
        if isinstance(text, str) and text.strip():
            texts.add(text.strip())
        for child in value.values():
            texts.update(message_texts(child))
    elif isinstance(value, list):
        for child in value:
            texts.update(message_texts(child))
    return texts


def load_case_texts() -> list[str]:
    texts: set[str] = set()
    for path in CASE_FILES:
        with path.open("r", encoding="utf-8") as handle:
            texts.update(message_texts(json.load(handle)))
    return sorted(texts)


def argos_translation(install_model: bool):
    from argostranslate import package, translate

    def find_translation():
        installed = translate.get_installed_languages()
        source = next((language for language in installed if language.code == "zh"), None)
        target = next((language for language in installed if language.code == "en"), None)
        return source.get_translation(target) if source and target else None

    translation = find_translation()
    if translation is not None:
        return translation
    if not install_model:
        raise RuntimeError("Argos zh→en model is not installed; rerun with --install-model")

    package.update_package_index()
    candidate = next(
        (item for item in package.get_available_packages() if item.from_code == "zh" and item.to_code == "en"),
        None,
    )
    if candidate is None:
        raise RuntimeError("Argos package index does not contain a zh→en model")
    package.install_from_path(candidate.download())
    translation = find_translation()
    if translation is None:
        raise RuntimeError("Argos zh→en model installation completed but is not loadable")
    return translation


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--install-model", action="store_true")
    args = parser.parse_args()

    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        catalog = json.load(handle)
    translations: dict[str, str] = catalog.setdefault("translations", {})
    texts = load_case_texts()
    missing = [text for text in texts if not translations.get(text, "").strip()]
    print(f"Case comments: {len(texts)} unique; existing: {len(texts) - len(missing)}; missing: {len(missing)}", flush=True)
    if missing:
        translator = argos_translation(args.install_model)
        for index, source in enumerate(missing, 1):
            translated = translator.translate(source).strip()
            if not translated:
                raise RuntimeError(f"Empty translation for: {source}")
            translations[source] = translated
            if index % 20 == 0 or index == len(missing):
                print(f"Translated {index}/{len(missing)}", flush=True)

    catalog["translations"] = dict(sorted(translations.items()))
    with NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=CATALOG_PATH.parent, delete=False) as handle:
        json.dump(catalog, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.replace(CATALOG_PATH)
    print(f"Wrote {len(catalog['translations'])} translations to {CATALOG_PATH}", flush=True)


if __name__ == "__main__":
    main()
