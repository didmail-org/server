import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const missing = (error) => error.code === 'ENOENT';
const unsafe = () => new Error('Public package paths must be regular files and directories without links');

function checkEntry(file, directory = false) {
  const stat = fs.lstatSync(file);
  if (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1)) throw unsafe();
  return stat;
}

function checkTree(directory) {
  checkEntry(directory, true);
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) checkTree(file);
    else checkEntry(file);
  }
}

/** Public generated outputs only. Refuse aliases before touching the package tree. */
export function createPublicPackageWriter(directory) {
  const requested = path.resolve(directory);
  const root = path.join(fs.realpathSync(path.dirname(requested)), path.basename(requested));
  try {
    checkTree(root);
  } catch (error) {
    if (!missing(error) || fs.existsSync(root)) throw error;
    fs.mkdirSync(root);
  }

  function output(relative) {
    if (
      typeof relative !== 'string' ||
      !relative ||
      path.isAbsolute(relative) ||
      relative.includes('\\') ||
      relative.split('/').some((part) => !part || part === '.' || part === '..')
    )
      throw new Error('Public package output must be a confined relative path');
    checkEntry(root, true);
    if (fs.realpathSync(root) !== root) throw unsafe();
    const parts = relative.split('/');
    let parent = root;
    for (const name of parts.slice(0, -1)) {
      parent = path.join(parent, name);
      try {
        checkEntry(parent, true);
      } catch (error) {
        if (!missing(error)) throw error;
        fs.mkdirSync(parent);
      }
      if (fs.realpathSync(parent) !== parent) throw unsafe();
    }
    const file = path.join(parent, parts.at(-1));
    let stat;
    try {
      stat = checkEntry(file);
      fs.accessSync(file, fs.constants.W_OK);
    } catch (error) {
      if (!missing(error)) throw error;
    }
    return { file, parent, stat };
  }

  function write(relative, value, sourceMode) {
    const target = output(relative);
    const temporary = path.join(target.parent, `.${path.basename(target.file)}.${randomUUID()}.tmp`);
    let fd;
    let created = false;
    try {
      fd = fs.openSync(
        temporary,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
        0o600,
      );
      created = true;
      fs.writeFileSync(fd, value);
      fs.fchmodSync(fd, target.stat ? target.stat.mode & 0o777 : (sourceMode ?? 0o666 & ~process.umask()));
      fs.fsyncSync(fd);
      fs.closeSync(fd);
      fd = undefined;
      output(relative); // Recheck the destination and its parents before replacement.
      fs.renameSync(temporary, target.file);
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      if (created) {
        try {
          fs.unlinkSync(temporary);
        } catch (error) {
          if (!missing(error)) throw error;
        }
      }
    }
  }

  function copy(source, relative) {
    const before = checkEntry(source);
    const fd = fs.openSync(source, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    try {
      const current = fs.fstatSync(fd);
      if (!current.isFile() || current.nlink !== 1 || current.dev !== before.dev || current.ino !== before.ino)
        throw unsafe();
      write(relative, fs.readFileSync(fd), current.mode & 0o777);
    } finally {
      fs.closeSync(fd);
    }
  }

  return { root, write, copy };
}
