import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function pythonBin(): string {
  const fromEnv = process.env.PAPER_LENS_PYTHON;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const venv = path.join(process.cwd(), ".venv", "bin", "python");
  if (fs.existsSync(venv)) return venv;
  return fromEnv || "python3";
}

export function runPython(
  script: string,
  payload: unknown,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  const file = path.join(process.cwd(), "scripts", script);
  const python = pythonBin();
  return new Promise((resolve, reject) => {
    const child = spawn(python, [file], { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Local model sidecar timed out."));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => out.push(chunk));
    child.stderr.on("data", (chunk) => err.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout: Buffer.concat(out).toString("utf8"),
        stderr: Buffer.concat(err).toString("utf8"),
      });
    });
    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export function parseSidecar<T>(stdout: string): T | null {
  const line = stdout.trim().split("\n").filter(Boolean).at(-1);
  if (!line) return null;
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
}
