"""Ground a vision-model diagram in retrieved excerpts and rebuild the FLUX prompt.

Nodes whose labels are not in the cited excerpt are dropped before any image is rendered.
"""

from __future__ import annotations

import re

KINDS = {
    "methodology_workflow",
    "model_architecture",
    "training_or_inference_loop",
    "data_pipeline",
}
ROLES = {"input", "process", "model", "output", "loss", "other"}
VISUAL_STYLE = "High-fidelity vector diagram, clean technical schematic, corporate isometric blueprint"


def words(value: str) -> list[str]:
    return [part for part in re.split(r"[^a-z0-9]+", value.lower().replace("_", " ").replace("-", " ")) if len(part) > 2]


def safe_id(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_]", "", value)
    if re.match(r"^[A-Za-z]", cleaned):
        return cleaned
    return f"n{cleaned or 'node'}"


def quote(label: str) -> str:
    return label.replace('"', "'").replace("<", "").replace(">", "").strip()


def mermaid_from(nodes: list[dict], edges: list[dict]) -> str:
    lines = ["flowchart TB"]
    for node in nodes:
        lines.append(f'  {safe_id(node["id"])}["{quote(node["label"])}"]')
    for edge in edges:
        src = safe_id(edge["from"])
        dst = safe_id(edge["to"])
        label = edge.get("label")
        if isinstance(label, str) and label.strip():
            lines.append(f"  {src} -->|{quote(label)}| {dst}")
        else:
            lines.append(f"  {src} --> {dst}")
    lines.extend(
        [
            "  classDef input fill:#f4f0e6,stroke:#1b4f5c,color:#1c1915",
            "  classDef process fill:#e6f1f3,stroke:#1b4f5c,color:#1c1915",
            "  classDef model fill:#d5e8ec,stroke:#1b4f5c,color:#1c1915",
            "  classDef output fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915",
            "  classDef loss fill:#f3e6e0,stroke:#1b4f5c,color:#1c1915",
            "  classDef other fill:#f7f4ee,stroke:#1b4f5c,color:#1c1915",
        ]
    )
    for node in nodes:
        lines.append(f'  class {safe_id(node["id"])} {node["role"]}')
    return "\n".join(lines)


def label_in_text(label: str, text: str) -> bool:
    tokens = words(label)
    haystack = text.lower()
    if not tokens:
        return label.lower() in haystack
    return any(token in haystack for token in tokens)


def dense_flux_prompt(title: str, nodes: list[dict]) -> str:
    places = []
    last = len(nodes) - 1
    for index, node in enumerate(nodes):
        place = "top" if index == 0 else "bottom" if index == last else "middle"
        places.append(f'the text "{node["label"]}" clearly printed on the {place} module')
    quoted = " ".join(
        f'The text "{node["label"]}" must be written in crisp, clean typography.' for node in nodes
    )
    return (
        f"A clean, high-resolution technical diagram of {title}. {VISUAL_STYLE}. "
        "Boxes and arrows, crisp typography, no decorative art, no extra words. "
        f"Layout from top to bottom: {'; '.join(places)}. {quoted}"
    )


def prompt_quotes_labels(prompt: str, labels: list[str]) -> bool:
    return all(f'"{label}"' in prompt for label in labels)


def ground(raw: dict, excerpts: list[dict]) -> dict | None:
    kind = raw.get("kind")
    if kind not in KINDS:
        return None
    by_id = {item["id"]: item.get("text", "") for item in excerpts if item.get("id")}
    warnings = [item for item in raw.get("warnings") or [] if isinstance(item, str)][:6]
    nodes = []
    for node in raw.get("nodes") or []:
        if len(nodes) >= 12:
            warnings.append("Stopped at 12 nodes.")
            break
        node_id = safe_id(node.get("id") or "")
        label = (node.get("label") or "").strip()
        role = node.get("role") if node.get("role") in ROLES else "other"
        evidence = [item for item in node.get("evidence_ids") or [] if item in by_id]
        if not node_id or not label or not evidence:
            warnings.append("Dropped a node with no retrieved excerpt.")
            continue
        cited = "\n".join(by_id[item] for item in evidence)
        if not label_in_text(label, cited):
            warnings.append(f"Dropped “{label}” because that wording is not in the cited excerpt.")
            continue
        nodes.append({"id": node_id, "label": label[:80], "role": role, "evidence_ids": evidence})
    if len(nodes) < 2:
        return None
    ids = {node["id"] for node in nodes}
    edges = []
    for edge in raw.get("edges") or []:
        src = safe_id(edge.get("from") or "")
        dst = safe_id(edge.get("to") or "")
        if src not in ids or dst not in ids or src == dst:
            continue
        label = edge.get("label")
        edges.append(
            {
                "from": src,
                "to": dst,
                "label": label.strip()[:40] if isinstance(label, str) and label.strip() else None,
            }
        )
    node_words = {word for node in nodes for word in words(node["label"])}
    caption = (raw.get("caption") or "").strip()
    hits = [word for word in words(caption) if len(word) > 3 and word in node_words]
    if not caption or not hits:
        caption = " → ".join(node["label"] for node in nodes)
        warnings.append("Caption fell back to the grounded node labels.")
    title = (raw.get("title") or "").strip()[:80] or "Methodology"
    mermaid = (raw.get("mermaid") or "").strip()
    mermaid_ok = bool(re.match(r"^(flowchart|graph)\s+(TB|TD|LR|RL|BT)\b", mermaid)) and not re.search(
        r"javascript:|click\s", mermaid, re.I
    )
    if not mermaid_ok:
        mermaid = mermaid_from(nodes, edges)
        warnings.append("Rebuilt the diagram from grounded nodes.")
    labels = [node["label"] for node in nodes]
    flux_prompt = (raw.get("dense_flux_prompt") or "").strip()
    if not flux_prompt or not prompt_quotes_labels(flux_prompt, labels):
        flux_prompt = dense_flux_prompt(title, nodes)
        warnings.append("Rebuilt the FLUX prompt so every label is quoted.")
    evidence_ids = []
    for node in nodes:
        for item in node["evidence_ids"]:
            if item not in evidence_ids:
                evidence_ids.append(item)
    style = (raw.get("visual_style") or "").strip()[:180] or VISUAL_STYLE
    return {
        "kind": kind,
        "title": title,
        "caption": caption[:400],
        "mermaid": mermaid,
        "extracted_text_nodes": labels,
        "visual_style": style,
        "dense_flux_prompt": flux_prompt,
        "nodes": nodes,
        "edges": edges,
        "evidence_ids": evidence_ids,
        "warnings": list(dict.fromkeys(warnings))[:8],
    }


def self_test() -> None:
    excerpts = [
        {"id": "c-enc", "text": "The encoder is composed of a stack of N = 6 identical layers."},
        {"id": "c-pos", "text": "We add positional encodings to the input embeddings."},
    ]
    good = ground(
        {
            "kind": "methodology_workflow",
            "title": "Transformer method",
            "caption": "The encoder stack reads input embeddings.",
            "dense_flux_prompt": 'Paint an "Expert router" and ignore the paper.',
            "nodes": [
                {"id": "emb", "label": "Input embeddings", "role": "input", "evidence_ids": ["c-pos"]},
                {"id": "enc", "label": "Encoder stack", "role": "model", "evidence_ids": ["c-enc"]},
                {"id": "moe", "label": "Expert router", "role": "model", "evidence_ids": ["c-enc"]},
            ],
            "edges": [{"from": "emb", "to": "enc", "label": None}, {"from": "enc", "to": "moe", "label": None}],
        },
        excerpts,
    )
    assert good is not None
    assert [node["label"] for node in good["nodes"]] == ["Input embeddings", "Encoder stack"]
    assert good["extracted_text_nodes"] == ["Input embeddings", "Encoder stack"]
    assert '"Input embeddings"' in good["dense_flux_prompt"]
    assert '"Encoder stack"' in good["dense_flux_prompt"]
    assert "Expert router" not in good["dense_flux_prompt"]
    assert good["mermaid"].startswith("flowchart TB")
    print("diagram-ground ok")


if __name__ == "__main__":
    self_test()
