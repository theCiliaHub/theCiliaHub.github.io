#!/usr/bin/env python3
"""
watch_genes.py
==============
Development file watcher: monitors the Excel source file(s) and automatically
runs `sync_genes.py` whenever a change is detected.

Uses filesystem polling only — no external dependencies beyond stdlib.

Usage:
    python3 scripts/watch_genes.py
    npm run watch-genes

Press Ctrl+C to stop.
"""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
SYNC_SCRIPT = Path(__file__).parent / "sync_genes.py"

# All candidate Excel source files (first found wins monitoring)
EXCEL_CANDIDATES = [
    REPO_ROOT / "data" / "source" / "genes.xlsx",
    REPO_ROOT / "data" / "source" / "final list merged human_ciliaminer (3).xlsx",
]

POLL_INTERVAL_S = 3      # seconds between filesystem checks
DEBOUNCE_S      = 8      # minimum seconds between successive syncs

# ANSI colours (degrade gracefully on terminals that don't support them)
_RESET  = "\033[0m"
_CYAN   = "\033[36m"
_GREEN  = "\033[32m"
_YELLOW = "\033[33m"
_RED    = "\033[31m"
_BOLD   = "\033[1m"

def _c(colour: str, text: str) -> str:
    return f"{colour}{text}{_RESET}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mtime(path: Path) -> Optional[float]:
    """Return mtime or None if the file doesn't exist."""
    try:
        return path.stat().st_mtime
    except FileNotFoundError:
        return None


def _snapshot() -> dict[str, Optional[float]]:
    """Capture current mtimes for all candidates."""
    return {str(p): _mtime(p) for p in EXCEL_CANDIDATES}


def _existing_files(snap: dict) -> list[str]:
    return [p for p, mt in snap.items() if mt is not None]


def _run_sync() -> bool:
    """Invoke sync_genes.py; return True on success."""
    print(_c(_CYAN, "\n⚡  Change detected — running sync pipeline…\n"))
    result = subprocess.run(
        [sys.executable, str(SYNC_SCRIPT)],
        check=False,
    )
    if result.returncode == 0:
        print(_c(_GREEN, "\n✅  Sync complete.\n"))
        return True
    else:
        print(_c(_RED, f"\n❌  Sync failed (exit code {result.returncode}). Check the output above.\n"))
        return False


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    print(_c(_BOLD, "\n👁  CiliaHub Gene Dataset Watcher\n"))
    print(f"   Script   : {SYNC_SCRIPT.relative_to(REPO_ROOT)}")
    print(f"   Watching :")
    for p in EXCEL_CANDIDATES:
        status = "✅ exists" if p.exists() else "⏳ not yet present"
        print(f"     • {p.relative_to(REPO_ROOT)}  [{status}]")
    print(f"\n   Poll interval : {POLL_INTERVAL_S}s")
    print(f"   Debounce      : {DEBOUNCE_S}s")
    print("   Press Ctrl+C to stop.\n")

    prev_snap = _snapshot()
    existing = _existing_files(prev_snap)
    last_sync_at: float = 0.0

    if existing:
        # Run an initial sync so the watcher starts from a clean state
        print(_c(_YELLOW, "   Running initial sync on startup…"))
        _run_sync()
        last_sync_at = time.time()
    else:
        print(_c(_YELLOW, "   No Excel file found yet — waiting for it to appear…\n"))

    while True:
        time.sleep(POLL_INTERVAL_S)

        curr_snap = _snapshot()
        curr_existing = _existing_files(curr_snap)

        changed = any(curr_snap[k] != prev_snap[k] for k in curr_snap)

        if changed:
            now = time.time()
            elapsed = now - last_sync_at

            if elapsed >= DEBOUNCE_S:
                # Report what changed
                for path, curr_mt in curr_snap.items():
                    prev_mt = prev_snap[path]
                    if curr_mt != prev_mt:
                        if curr_mt is None:
                            print(_c(_YELLOW, f"   Removed: {path}"))
                        elif prev_mt is None:
                            print(_c(_GREEN, f"   Appeared: {path}"))
                        else:
                            print(_c(_CYAN, f"   Modified: {path}"))

                if curr_existing:
                    _run_sync()
                    last_sync_at = time.time()
                else:
                    print(_c(_YELLOW, "   All Excel files removed — nothing to sync."))

                prev_snap = curr_snap
            else:
                remaining = int(DEBOUNCE_S - elapsed)
                print(_c(_YELLOW,
                    f"   Change detected (debounced — {remaining}s before next sync)"))
        else:
            # Print a heartbeat every 60 seconds so the user knows it's still alive
            if int(time.time()) % 60 == 0:
                ts = time.strftime("%H:%M:%S")
                files = ", ".join(Path(p).name for p in curr_existing) or "none"
                print(_c(_CYAN, f"   [{ts}] watching — tracked file(s): {files}"))


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print(_c(_YELLOW, "\n\n👋  Watcher stopped.\n"))
