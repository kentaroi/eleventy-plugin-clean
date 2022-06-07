const path = require("path");
const { promises: fs } = require("fs");
const { open } = require("lmdb");
const chalk = require("kleur");
const PassthroughCopy = require("./passthrough-copy");
const { isInsideDirectory, removeDirectoryIfEmpty } = require("./utils");

const BUILD_NUMBER_KEY = null;
const OUTPUT_DIR_KEY = -10000; // -10000 does not have any meaning, but this must come before any String keys.
const OUTPUT_PATH_KEYS_START = 2;

const pluralize = function(count, singular, plural) {
  return count === 1 ? `${ count } ${ singular }` : `${ count } ${ plural }`;
};

let initialized = false;
let db = open(".eleventy-plugin-clean");
let currentBuildNumber;
let inputDir;
let outputDir;

const eleventyPluginClean = function(eleventyConfig) {
  inputDir = path.normalize(eleventyConfig.dir?.input ?? ".");
  outputDir = path.normalize(eleventyConfig.dir?.output ?? "_site");

  if (db.get(OUTPUT_DIR_KEY) == undefined) {
    db.put(OUTPUT_DIR_KEY, outputDir);
  }

  eleventyConfig.on("eleventy.before", async () => {
    currentBuildNumber = db.get(BUILD_NUMBER_KEY) || 0;
    currentBuildNumber++;
    db.put(BUILD_NUMBER_KEY, currentBuildNumber);

    await Promise.all(
      Object.entries(eleventyConfig.passthroughCopies)
      .map(async ([pathOrGlob, target]) => {
      let pc = new PassthroughCopy(pathOrGlob, target, inputDir, outputDir);
      let outputPaths = await pc.getOutputPaths();
      for(let outputPath of outputPaths) {
        console.log(`outputPath: ${ outputPath }`);
        db.put(outputPath, currentBuildNumber);
      }
    }));
  });

  eleventyConfig.addTransform("eleventy-plugin-clean", async function(content) {
    let outputPath = path.normalize(this.outputPath);
    console.log(`outputPath: ${ outputPath }`);
    db.put(outputPath, currentBuildNumber);
    return content;
  });

  eleventyConfig.on("eleventy.after", async () => {
    let oldOutputDir = db.get(OUTPUT_DIR_KEY);
    if (outputDir !== oldOutputDir) {
      if (isInsideDirectory(oldOutputDir, ".")) {
        await fs.rm(oldOutputDir, { recursive: true, force: true });

        let message = `Removed the old output directory: ${ oldOutputDir }`;
        console.log(chalk.cyan(`[eleventy-plugin-clean] ${ message }`));
      } else {
        let message = "Detected the change of the output directory.\nHowever, because it is not inside the project root, the plugin didn't touch the old output directory to avoid unintended removal.";
        console.log(chalk.yellow(`[eleventy-plugin-clean] ${ message }`));
      }

      for await (let { key: outputPath, value: buildNumber } of db.getRange({ start: OUTPUT_PATH_KEYS_START })) {
        if (buildNumber < currentBuildNumber) {
          db.remove(outputPath);
        }
      }

      db.put(OUTPUT_DIR_KEY, outputDir);
      return;
    }

    let fileCount = 0;
    let directoryCount = 0;
    await db.flushed;

    for await (let { key: outputPath, value: buildNumber } of db.getRange({ start: OUTPUT_PATH_KEYS_START })) {
      if (buildNumber < currentBuildNumber) {
        console.log("[eleventy-plugin-clean] Removing %s", outputPath);
        try {
          let response = await fs.rm(outputPath);
          fileCount++;
        } catch(e) { }

        try {
          directoryCount += await removeDirectoryIfEmpty(outputPath, outputDir);
        } catch(e) { }

        db.remove(outputPath);
      }
    }
    let nFiles = pluralize(fileCount, "file", "files");
    let nDirectories = pluralize(directoryCount, "directory", "directories");
    let message = directoryCount === 0
      ? `Removed ${ nFiles }`
      : `Removed ${ nFiles } and ${ nDirectories }`;
    console.log(chalk.cyan(`[eleventy-plugin-clean] ${ message }`));
  });
};

module.exports = eleventyPluginClean;
