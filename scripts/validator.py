#!/usr/bin/env python3
import json
import pathlib
import subprocess
import sys


def run(cmd, cwd=None):
    p = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    return {"code": p.returncode, "out": p.stdout, "err": p.stderr}

def exists_any(paths):
    return any(pathlib.Path(p).exists() for p in paths)

def main():
    result = {
        "lint": {}, "typecheck": {}, "tests": {}, "build": {},
        "summary": {"ok": True, "reasons": []}
    }

    # ---------- TypeScript/Node checks ----------
    if pathlib.Path("package.json").exists():
        # ESLint
        eslint = run("npx --yes eslint src --ext .ts,.tsx")
        result["lint"]["eslint"] = eslint
        if eslint["code"] != 0:
            result["summary"]["ok"] = False
            result["summary"]["reasons"].append("eslint")

        # TypeScript
        if pathlib.Path("tsconfig.json").exists():
            tsc = run("npx --yes tsc --noEmit")
            result["typecheck"]["tsc"] = tsc
            if tsc["code"] != 0:
                result["summary"]["ok"] = False
                result["summary"]["reasons"].append("tsc")

        # Jest tests
        if pathlib.Path("jest.config.js").exists():
            jest = run("npx --yes jest --passWithNoTests --coverage")
            result["tests"]["jest"] = jest
            if jest["code"] != 0:
                result["summary"]["ok"] = False
                result["summary"]["reasons"].append("jest")

        # Build
        build = run("npm run build:ts")
        result["build"]["typescript"] = build
        if build["code"] != 0:
            result["summary"]["ok"] = False
            result["summary"]["reasons"].append("build")

    # ---------- Rust checks ----------
    if pathlib.Path("Cargo.toml").exists():
        cargo_check = run("cargo check")
        result["typecheck"]["rust"] = cargo_check
        if cargo_check["code"] != 0:
            result["summary"]["ok"] = False
            result["summary"]["reasons"].append("rust_check")

        cargo_test = run("cargo test")
        result["tests"]["rust"] = cargo_test
        if cargo_test["code"] != 0:
            result["summary"]["ok"] = False
            result["summary"]["reasons"].append("rust_test")

    # ---------- Go checks ----------
    if pathlib.Path("go.mod").exists():
        go_build = run("go build ./...")
        result["build"]["go"] = go_build
        if go_build["code"] != 0:
            result["summary"]["ok"] = False
            result["summary"]["reasons"].append("go_build")

    print(json.dumps(result, indent=2))
    sys.exit(0 if result["summary"]["ok"] else 1)

if __name__ == "__main__":
    main()
