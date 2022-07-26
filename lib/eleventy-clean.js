const path = require("path");
const { promises: fs } = require("fs");
const { open } = require("lmdb");
const chalk = require("kleur");
const debugDev = require("debug")("Dev:EleventyPluginClean");
const PassthroughCopy = require("./passthrough-copy");
const { isInsideDirectory, removeDirectoryIfEmpty } = require("./utils");

const BUILD_NUMBER_KEY = null;
const OUTPUT_DIR_KEY = -10000; // -10000 does not have any meaning, but this must come before any String keys.
const OUTPUT_PATH_KEYS_START = 2;

const pluralize = function(count, singular, plural) {
  return count === 1 ? `${ count } ${ singular }` : `${ count } ${ plural }`;
};

// db.close() is not needed.
// https://github.com/Venemo/node-lmdb/issues/176#issuecomment-692341902
let db = open(".plugin-clean");
let currentBuildNumber;
let inputDir;
let outputDir;

const incrementBuildNumber = function() {
  currentBuildNumber = db.get(BUILD_NUMBER_KEY) ?? 0;
  currentBuildNumber++;
  db.put(BUILD_NUMBER_KEY, currentBuildNumber);
  debugDev(`Incremented build number to ${ currentBuildNumber }`);
};

const updateFileRecordsFromPassthroughCopies = async function(passthroughCopies) {
  await Promise.all(
    Object.entries(passthroughCopies)
    .map(async ([pathOrGlob, target]) => {
    let pc = new PassthroughCopy(pathOrGlob, target, inputDir, outputDir);
    let outputPaths = await pc.getOutputPaths();
    for(let outputPath of outputPaths) {
      debugDev(`Storing { "${ outputPath }": ${ currentBuildNumber } }\t\t from { "${ pathOrGlob }": ${ typeof target === "boolean" ? target : '"' + target + '"' } }`);
      db.put(outputPath, currentBuildNumber);
    }
  }));
};

const updateFileRecord = function(outputPath, inputPath) {
  let key = path.normalize(outputPath);
  debugDev(`Storing { "${ key }": ${ currentBuildNumber } }\t\t from "${ inputPath }"`);
  db.put(key, currentBuildNumber);
};

const cleanOutputDirectory = async function() {
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
};

const eleventyPluginClean = function(eleventyConfig) {
  inputDir = path.normalize(eleventyConfig.dir?.input ?? ".");
  outputDir = path.normalize(eleventyConfig.dir?.output ?? "_site");

  if (!db.doesExist(OUTPUT_DIR_KEY)) {
    db.put(OUTPUT_DIR_KEY, outputDir);
  }

  eleventyConfig.events.prependListener("eleventy.before", () => {
    incrementBuildNumber();
  });

  eleventyConfig.on("eleventy.before", async () => {
    await updateFileRecordsFromPassthroughCopies(eleventyConfig.passthroughCopies);
  });

  eleventyConfig.addTransform("eleventy-plugin-clean", async function(content) {
    updateFileRecord(this.outputPath, this.inputPath);
    return content;
  });

  eleventyConfig.on("eleventy.after", async () => {
    await cleanOutputDirectory();
  });
};

const plugin = {
  configFunction: eleventyPluginClean,
  updateFileRecord,
  name: "eleventy-plugin-clean"
};

module.exports = plugin;
