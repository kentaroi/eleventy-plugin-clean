const fs = require("fs");
const path = require("path");

module.exports = function(projectName, sourceProject = "eleventy-project") {
  const sourceDir = path.join(__dirname, "fixtures", sourceProject);
  let projectDir = path.join(__dirname, "fixtures", projectName);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir);

  let names = fs.readdirSync(sourceDir);
  names.forEach(name => {
    fs.symlinkSync(path.join(sourceDir, name), path.join(projectDir, name));
  });
  let cwd = process.cwd();
  ["package.json", "package-lock.json", "node_modules"].forEach(name => {
    fs.symlinkSync(path.join(cwd, name), path.join(projectDir, name));
  });

  return projectDir;
};
