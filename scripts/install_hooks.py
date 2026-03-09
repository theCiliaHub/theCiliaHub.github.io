#!/usr/bin/env python3
"""
install_hooks.py
================
Installs a git pre-commit hook that automatically runs the gene sync pipeline
whenever an Excel source file is staged for commit.

Usage:
    python3 scripts/install_hooks.py
    npm run install-hooks

The hook is installed at .git/hooks/pre-commit.
If a hook already exists, the installer backs it up and prepends the sync logic.
"""

from __future__ import annotations

import os
import stat
import sys
from pathlib import Path

REPO_ROOT  = Path(__file__).resolve().parent.parent
HOOKS_DIR  = REPO_ROOT / ".git" / "hooks"
HOOK_PATH  = HOOKS_DIR / "pre-commit"

# The snippet we inject (or the full hook if starting fresh)
HOOK_SNIPPET = r"""
# ── CiliaHub: auto-sync gene dataset on Excel changes ─────────────────────
_CILIAHUB_EXCEL_PATTERN="data/source/.*\.xlsx"
if git diff --cached --name-only | grep -qE "${_CILIAHUB_EXCEL_PATTERN}"; then
    echo ""
    echo "⚡  Excel source file staged — regenerating gene dataset..."
    echo ""

    python3 scripts/sync_genes.py
    SYNC_EXIT=$?

    if [ $SYNC_EXIT -ne 0 ]; then
        echo ""
        echo "❌  Gene sync failed (exit code ${SYNC_EXIT})."
        echo "    Fix the error above and try again, or commit with --no-verify to skip."
        echo ""
        exit $SYNC_EXIT
    fi

    # Stage the generated datasets so they are included in this commit
    git add \
        data/generated/genes.json \
        ciliahub_data.json \
        data/genes/ciliAI_master_database.json \
        data/genes/ciliAI_lookups.json

    echo ""
    echo "✅  Gene dataset regenerated and staged."
    echo ""
fi
# ── End CiliaHub sync ─────────────────────────────────────────────────────
"""

FULL_HOOK = f"""#!/bin/sh
# pre-commit hook — installed by scripts/install_hooks.py
{HOOK_SNIPPET}
"""


# ---------------------------------------------------------------------------
# ANSI helpers
# ---------------------------------------------------------------------------
def _ok(msg: str)   -> None: print(f"  \033[32m✅  {msg}\033[0m")
def _warn(msg: str) -> None: print(f"  \033[33m⚠️   {msg}\033[0m")
def _info(msg: str) -> None: print(f"  \033[36m    {msg}\033[0m")
def _err(msg: str)  -> None: print(f"  \033[31m❌  {msg}\033[0m")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def install() -> None:
    print("\n\033[1m🔧  CiliaHub git hook installer\033[0m\n")

    # Sanity check: are we inside a git repo?
    if not (REPO_ROOT / ".git").is_dir():
        _err(".git directory not found — run this from the repo root.")
        sys.exit(1)

    HOOKS_DIR.mkdir(parents=True, exist_ok=True)

    if HOOK_PATH.exists():
        existing = HOOK_PATH.read_text(encoding="utf-8")

        # Idempotent: don't install twice
        if "CiliaHub: auto-sync gene dataset" in existing:
            _ok("Hook already installed — nothing to do.")
            return

        # Back up the existing hook and prepend our snippet
        backup = HOOK_PATH.with_suffix(".pre-ciliahub.bak")
        backup.write_text(existing, encoding="utf-8")
        _warn(f"Existing pre-commit hook backed up → {backup.name}")

        # Inject after the shebang line (first line)
        lines = existing.splitlines(keepends=True)
        shebang = lines[0] if lines and lines[0].startswith("#!") else "#!/bin/sh\n"
        rest    = "".join(lines[1:]) if len(lines) > 1 else ""
        new_content = shebang + HOOK_SNIPPET + rest
        HOOK_PATH.write_text(new_content, encoding="utf-8")
        _ok("CiliaHub sync logic prepended to existing hook.")
    else:
        HOOK_PATH.write_text(FULL_HOOK, encoding="utf-8")
        _ok("Pre-commit hook created.")

    # Make it executable
    current_mode = HOOK_PATH.stat().st_mode
    HOOK_PATH.chmod(current_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    _ok("Hook made executable.")

    print()
    _info("What happens now:")
    _info("  • When you git commit and have staged an Excel source file,")
    _info("    the gene sync pipeline runs automatically.")
    _info("  • Generated JSON files are included in the same commit.")
    _info("  • Use  git commit --no-verify  to bypass the hook if needed.")
    print()


if __name__ == "__main__":
    install()
