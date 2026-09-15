"""Translate the extracted CampusPulse interface catalog through yunwu.

Only static, source-controlled UI strings are sent.  The key is read from the
explicit local file, never printed, and the generated catalog records only the
selected model and translations.
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import urllib.error
import urllib.request
from pathlib import Path


def request_translation(
    *, endpoint: str, proxy: str, key: str, model: str, values: list[str], kind: str
) -> list[str]:
    if kind == "content":
        task = "Translate each synthetic Chinese campus-forum message to natural English."
        role = "You translate synthetic campus-forum content without changing its meaning."
        extra_rules = [
            "Preserve the speaker's emotion, uncertainty, disagreement, informality and any incomplete resolution.",
            "Do not add facts, explanations, politeness, balance, or official-sounding language absent from the source.",
        ]
    else:
        task = "Translate each Chinese CampusPulse product-interface string to concise professional English."
        role = "You are a deterministic Chinese-to-English product UI translator."
        extra_rules = ["Use product UI English, not academic prose."]
    prompt = {
        "task": task,
        "rules": [
            "Return one JSON object with key translations and no explanation.",
            "translations must be an array with exactly the same length and order.",
            "Preserve CampusPulse, ForumTwin, Agent, LLM, Natural, A, D, T0-style tick labels, IDs, numbers and placeholders.",
            *extra_rules,
        ],
        "strings": values,
    }
    body = json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": role,
                },
                {"role": "user", "content": json.dumps(prompt, ensure_ascii=False)},
            ],
            "temperature": 0,
            "reasoning_effort": "none",
            "response_format": {"type": "json_object"},
            "max_tokens": 8192,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    opener = urllib.request.build_opener(
        urllib.request.ProxyHandler({"http": proxy, "https": proxy}),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()),
    )
    with opener.open(request, timeout=180) as response:
        payload = json.loads(response.read().decode("utf-8"))
    content = payload["choices"][0]["message"]["content"]
    decoded = json.loads(content)
    translations = decoded.get("translations")
    if not isinstance(translations, list) or len(translations) != len(values):
        raise ValueError("translation response length mismatch")
    if not all(isinstance(value, str) and value.strip() for value in translations):
        raise ValueError("translation response contains an invalid item")
    return [value.strip() for value in translations]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    credentials = parser.add_mutually_exclusive_group(required=True)
    credentials.add_argument("--key-file", type=Path)
    credentials.add_argument("--key-env")
    parser.add_argument("--endpoint", default="https://yunwu.ai/v1/chat/completions")
    parser.add_argument("--proxy", default="http://127.0.0.1:7897")
    parser.add_argument("--models", default="gpt-4o-mini,gpt-5.4-mini,gpt-5.6-luna")
    parser.add_argument("--batch-size", type=int, default=40)
    parser.add_argument("--kind", choices=("ui", "content"), default="ui")
    args = parser.parse_args()

    source = json.loads(args.input.read_text(encoding="utf-8"))
    values = source["strings"]
    key = (
        args.key_file.read_text(encoding="utf-8").strip()
        if args.key_file is not None
        else os.environ.get(args.key_env or "", "").strip()
    )
    if not key:
        raise SystemExit("API key file is empty")
    existing: dict[str, object] = {}
    if args.output.exists():
        try:
            loaded = json.loads(args.output.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                existing = loaded
        except (OSError, json.JSONDecodeError):
            existing = {}
    previous = existing.get("translations")
    catalog: dict[str, str] = {
        value: translated
        for value, translated in (previous.items() if isinstance(previous, dict) else [])
        if value in values and isinstance(translated, str) and translated.strip()
    }
    selected_model = (
        existing.get("translation_model")
        if isinstance(existing.get("translation_model"), str)
        else None
    )
    models = [value.strip() for value in args.models.split(",") if value.strip()]
    pending = [value for value in values if value not in catalog]
    for offset in range(0, len(pending), args.batch_size):
        batch = pending[offset : offset + args.batch_size]
        last_error: Exception | None = None
        for model in ([selected_model] if selected_model else models):
            if model is None:
                continue
            try:
                translated = request_translation(
                    endpoint=args.endpoint,
                    proxy=args.proxy,
                    key=key,
                    model=model,
                    values=batch,
                    kind=args.kind,
                )
                selected_model = model
                catalog.update(zip(batch, translated, strict=True))
                print(json.dumps({"translated": len(catalog), "total": len(values), "model": model}))
                break
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
                last_error = exc
                if selected_model:
                    raise
        else:
            raise SystemExit(f"all translation models failed: {type(last_error).__name__}")

    result = {
        "schema_version": (
            "campus-pulse-content-translations-en-v1"
            if args.kind == "content"
            else "campus-pulse-ui-catalog-zh-en-v1"
        ),
        "translation_model": selected_model,
        "source_string_count": len(values),
        "translations": dict(sorted(catalog.items())),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
