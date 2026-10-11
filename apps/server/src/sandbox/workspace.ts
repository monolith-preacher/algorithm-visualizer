import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Host-side scratch directories. Each one holds the compiled binary (and the
 * stdin file for debug sessions) and is bind-mounted read-only into the
 * sandbox at /box. Sources are never written here: compilation happens inside
 * the sandbox and the binary is streamed back.
 */
export class Workspaces {
  constructor(private readonly root: string) {}

  async init(): Promise<void> {
    await fs.rm(this.root, { recursive: true, force: true });
    await fs.mkdir(this.root, { recursive: true, mode: 0o700 });
  }

  async create(): Promise<Workspace> {
    const dir = path.join(this.root, randomBytes(8).toString('hex'));
    await fs.mkdir(dir, { mode: 0o755 });
    // mkdir honours the umask; the sandbox user must be able to enter the directory.
    await fs.chmod(dir, 0o755);
    return new Workspace(dir);
  }
}

export class Workspace {
  constructor(readonly dir: string) {}

  async write(name: string, data: string | Buffer, mode = 0o644): Promise<string> {
    const file = path.join(this.dir, path.basename(name));
    await fs.writeFile(file, data, { mode });
    await fs.chmod(file, mode);
    return file;
  }

  async exists(name: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.dir, path.basename(name)));
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    await fs.rm(this.dir, { recursive: true, force: true });
  }
}
