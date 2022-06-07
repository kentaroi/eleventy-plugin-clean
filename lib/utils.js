const path = require("path");
const { promises: fs } = require("fs");

const utils = {
  // `relative !== ".." && !relative.startsWith(`..${ path.sep }`)` instead of
  // `relative.startsWith("..")`, because a file/directory name can start
  // with "..". (eg. "....filename")
  // `!path.isAbsolute(relative)` is needed in the case of comparing
  // "C:\\foo" and "D:\\bar" on Windows, for example.
  isInsideOrSameDirectory(aPath, directory) {
    let relative = path.relative(directory, aPath);
    return relative !== ".."
      && !relative.startsWith(`..${ path.sep }`)
      && !path.isAbsolute(relative);
  },

  isInsideDirectory(aPath, directory) {
    let relative = path.relative(directory, aPath);
    return relative
      && relative !== ".."
      && !relative.startsWith(`..${ path.sep }`)
      && !path.isAbsolute(relative);
  },

  async getFilePathsInDirectory(dir) {
    let dirents = await fs.readdir(dir, { withFileTypes: true });
    let files = await Promise.all(dirents.map(async dirent => {
      const res = path.join(dir, dirent.name);
      return dirent.isDirectory() ? utils.getFilePathsInDirectory(res) : res;
    }));
    return files.flat();
  },

  // Remove the directory of `filepath` if it is empty.
  // Recursively remove its parent directories if they are empty and inside
  // outputDir.
  async removeDirectoryIfEmpty(filepath, outputDir) {
    let dir = path.dirname(filepath);
    let filesInDir = await fs.readdir(dir);
    if (filesInDir.length > 0) { // Not empty
      return 0;
    }

    if (utils.isInsideDirectory(dir, outputDir)) {
      console.log("[eleventy-plugin-clean] Removing %s", dir);
      await fs.rmdir(dir);
      return 1 + await utils.removeDirectoryIfEmpty(dir, outputDir);
    } else {
      return 0;
    }
  }
};

module.exports = utils;
