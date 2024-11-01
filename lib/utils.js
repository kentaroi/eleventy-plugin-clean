import path from "node:path";
import fs from "node:fs/promises";

// `relative !== ".." && !relative.startsWith(`..${ path.sep }`)` instead of
// `relative.startsWith("..")`, because a file/directory name can start
// with "..". (eg. "....filename")
// `!path.isAbsolute(relative)` is needed in the case of comparing
// "C:\\foo" and "D:\\bar" on Windows, for example.
const isInsideOrSameDirectory = function(aPath, directory) {
  let relative = path.relative(directory, aPath);
  return relative !== ".."
    && !relative.startsWith(`..${ path.sep }`)
    && !path.isAbsolute(relative);
};

const isInsideDirectory = function(aPath, directory) {
  let relative = path.relative(directory, aPath);
  return relative
    && relative !== ".."
    && !relative.startsWith(`..${ path.sep }`)
    && !path.isAbsolute(relative);
};

const getFilePathsInDirectory = async function(dir) {
  let dirents = await fs.readdir(dir, { withFileTypes: true });
  let files = await Promise.all(dirents.map(async dirent => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? getFilePathsInDirectory(res) : res;
  }));
  return files.flat();
};

// Remove the directory of `filepath` if it is empty.
// Recursively remove its parent directories if they are empty and inside
// outputDir.
const removeDirectoryIfEmpty = async function(filepath, outputDir) {
  let dir = path.dirname(filepath);
  let filesInDir = await fs.readdir(dir);
  if (filesInDir.length > 0) { // Not empty
    return 0;
  }

  if (isInsideDirectory(dir, outputDir)) {
    console.log("[eleventy-plugin-clean] Removing %s", dir);
    await fs.rmdir(dir);
    return 1 + await removeDirectoryIfEmpty(dir, outputDir);
  } else {
    return 0;
  }
};

export {
  isInsideOrSameDirectory,
  isInsideDirectory,
  getFilePathsInDirectory,
  removeDirectoryIfEmpty
};
