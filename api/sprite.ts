/**
 * Sprite CLI wrapper — thin shell around the `sprite` CLI binary.
 * Same pattern as the `openclaw()` wrapper in shared.ts.
 */

const SPRITE_BIN = process.env.SPRITE_BIN || "sprite";

/**
 * Run a sprite CLI command and return stdout.
 * Throws on non-zero exit code with stderr.
 */
export async function sprite(args: string[]): Promise<string> {
  const proc = Bun.spawn([SPRITE_BIN, ...args], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: process.env.HOME || "/root",
      PATH: `/root/.local/bin:${process.env.PATH}`,
    },
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`sprite ${args.join(" ")} failed (exit ${exitCode}): ${stderr.trim()}`);
  }
  return stdout.trim();
}

/**
 * Create a new sprite with the console initialization workaround.
 * `sprite create` requires a TTY console session to properly initialize.
 * We background it, wait for init, then kill the console process.
 */
export async function createSprite(name: string): Promise<void> {
  // Check if sprite already exists
  try {
    await execOnSprite(name, "echo ready");
    console.log(`Sprite ${name} already exists, skipping create`);
    return;
  } catch {}

  const proc = Bun.spawn([SPRITE_BIN, "create", name], {
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: process.env.HOME || "/root",
      PATH: `/root/.local/bin:${process.env.PATH}`,
    },
  });

  // Let the console session initialize the sprite
  await Bun.sleep(15_000);

  // Kill the console process (sprite is initialized and persists)
  proc.kill();
  await proc.exited.catch(() => {});

  // Verify it's reachable and stable
  try {
    await execOnSprite(name, "echo ready");
    // Stabilization — sprite needs time after first exec before piped writes work reliably
    await Bun.sleep(10_000);
  } catch (err) {
    throw new Error(`Sprite ${name} created but not reachable: ${err}`);
  }
}

/**
 * Run a command on a sprite via `sprite exec`.
 */
export async function execOnSprite(name: string, cmd: string): Promise<string> {
  return sprite(["exec", "-s", name, "--", "bash", "-c", cmd]);
}

/**
 * Write content to a file on a sprite.
 * Uses execSync with stdin for reliability — Bun.spawn pipes were unreliable.
 */
export async function writeToSprite(name: string, path: string, content: string): Promise<void> {
  const { execSync } = await import("child_process");
  const { writeFileSync, unlinkSync } = await import("fs");
  const tmpFile = `/tmp/sprite-write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    writeFileSync(tmpFile, content);
    execSync(
      `cat "${tmpFile}" | sprite exec -s ${name} -- bash -c "cat > ${path}"`,
      {
        env: { ...process.env, HOME: process.env.HOME || "/root", PATH: `/root/.local/bin:${process.env.PATH}` },
        timeout: 30_000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch (err: any) {
    const stderr = err?.stderr?.toString() || "";
    throw new Error(`Failed to write ${path} on sprite ${name}: ${stderr.trim()}`);
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Get a sprite's public URL.
 */
export async function getSpriteUrl(name: string): Promise<string> {
  const output = await sprite(["url", "-s", name]);
  // Output may be multi-line: "URL: https://...\nAuth: public"
  // or just the URL. Find the https:// part either way.
  for (const line of output.split("\n")) {
    const match = line.match(/(https:\/\/[^\s]+)/);
    if (match) return match[1];
  }
  throw new Error(`Could not parse sprite URL from: ${output}`);
}

/**
 * Make a sprite's URL publicly accessible.
 */
export async function makePublic(name: string): Promise<void> {
  await sprite(["url", "update", "--auth", "public", "-s", name]);
}

/**
 * Create a service on a sprite that auto-starts on wake.
 */
export async function createService(
  spriteName: string,
  serviceName: string,
  opts: { cmd: string; args?: string; httpPort?: number; env?: string; dir?: string },
): Promise<void> {
  const args = [
    "exec", "-s", spriteName, "--",
    "sprite-env", "services", "create", serviceName,
    "--cmd", opts.cmd,
  ];
  if (opts.args) args.push("--args", opts.args);
  if (opts.httpPort) args.push("--http-port", String(opts.httpPort));
  if (opts.env) args.push("--env", opts.env);
  if (opts.dir) args.push("--dir", opts.dir);

  await sprite(args);
}

/**
 * Destroy a sprite (non-interactive, via API).
 */
export async function destroySprite(name: string): Promise<void> {
  await sprite(["api", `/v1/sprites/${name}`, "--", "-X", "DELETE"]);
}

/**
 * List all sprites in the org.
 */
export async function listSprites(): Promise<string> {
  return sprite(["list"]);
}
