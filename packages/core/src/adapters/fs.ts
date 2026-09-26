import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import type { StorageAdapter } from '../types.js';

export class FsAdapter implements StorageAdapter {
  constructor(private rootDir: string) {}

  // Refuse any path that lands outside the root, whatever the caller: core
  // validates slugs, but nothing else guarantees a path stays in the repo.
  private resolve(path: string): string {
    const fullPath = join(this.rootDir, path);
    const fromRoot = relative(this.rootDir, fullPath);
    if (
      fromRoot === '..' ||
      fromRoot.startsWith(`..${sep}`) ||
      isAbsolute(fromRoot)
    ) {
      throw new Error(
        `Invalid path ${JSON.stringify(path)}: it resolves outside the project root.`,
      );
    }
    return fullPath;
  }

  async readFile(path: string): Promise<string> {
    return readFile(this.resolve(path), 'utf-8');
  }

  async readFileIfExists(path: string): Promise<string | null> {
    try {
      return await this.readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    const fullPath = this.resolve(path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  async deleteFile(path: string): Promise<void> {
    await unlink(this.resolve(path));
  }

  async listFiles(directory: string): Promise<string[]> {
    const fullPath = this.resolve(directory);
    try {
      return await readdir(fullPath);
    } catch {
      return [];
    }
  }

  async readFiles(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    for (const path of paths) {
      const content = await this.readFile(path);
      results.set(path, content);
    }
    return results;
  }

  async writeFiles(files: Map<string, string>): Promise<void> {
    for (const [path, content] of files) {
      await this.writeFile(path, content);
    }
  }
}
