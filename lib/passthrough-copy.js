const path = require("path");
const { promises: fs } = require("fs");
const isGlob = require("is-glob");
const fastGlob = require("fast-glob");
const { isInsideDirectory, getFilePathsInDirectory } = require("./utils");

class PassthroughCopy {
  constructor(pathOrGlob, target, inputDir, outputDir) {
    if (isGlob(pathOrGlob)) {
      this.glob = pathOrGlob;
    } else {
      this.path = pathOrGlob;
    }
    this.target     = target;
    this.inputDir   = inputDir;
    this.outputDir  = outputDir;
  }

  async getOutputPaths() {
    if (this.glob) {
      let inputPaths = await fastGlob(this.glob, { caseSensitiveMatch: false, dot: true });
      if (this.target === true) {
        return inputPaths.map(inputPath => {
          if(isInsideDirectory(inputPath, this.inputDir)) {
            let relativePath = path.relative(this.inputDir, inputPath);
            return path.join(this.outputDir, relativePath);
          } else {
            let relativePath = path.relative(".", inputPath);
            return path.join(this.outputDir, relativePath);
          }
        });
      } else if (typeof this.target === "string") { // Unstructured copy
        return inputPaths.map(inputPath => {
          return path.join(this.outputDir, this.target, path.basename(inputPath));
        });
      } else {
        throw TypeError("The value for a glob property in addPassthroughCopy options should be true or of type String.");
      }
    } else if (this.path) {
      let stat = await fs.stat(this.path);
      let inputPaths = stat.isDirectory() ? await getFilePathsInDirectory(this.path)
                                          : [this.path];
      if (this.target === true) {
        return inputPaths.map(inputPath => {
          if (isInsideDirectory(inputPath, this.inputDir)) {
            let relativePath = path.relative(this.inputDir, inputPath);
            return path.join(this.outputDir, relativePath);
          } else {
            let relativePath = path.relative(".", inputPath);
            return path.join(this.outputDir, relativePath);
          }
        });
      } else if (typeof this.target === "string") {
        return inputPaths.map(inputPath => {
          let relativePath = path.relative(this.path, inputPath);
          return path.join(this.outputDir, this.target, relativePath);
        });
      } else {
        throw TypeError("The value for a path property in addPassthroughCopy options should be true or of type String.");
      }
    } else {
      throw Error("PassthroughCopy does not have either a glob or a path.");
    }
  }
}

module.exports = PassthroughCopy;
