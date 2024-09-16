const events = require("events");
const fs = require("fs");
const readline = require("readline");

const TRAILING_LINES = 10;

class Watcher extends events.EventEmitter {
  constructor(watchFile) {
    super();
    this.watchFile = watchFile;
    this.store = [];
    this.lastSize = 0;
  }

  getLogs() {
    return this.store;
  }

  async readLastLines(filePath, linesToRead, startPosition) {
    return new Promise((resolve, reject) => {
      const lines = [];
      const fileStream = fs.createReadStream(filePath, {
        encoding: "utf8",
        start: startPosition,
      });

      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
      });

      rl.on("line", (line) => {
        lines.push(line);
        if (lines.length > linesToRead) {
          lines.shift();
        }
      });

      rl.on("close", () => {
        resolve(lines);
      });

      rl.on("error", (err) => {
        reject(err);
      });
    });
  }

  async watch(curr, prev) {
    try {
      const newLines = await this.readLastLines(
        this.watchFile,
        TRAILING_LINES,
        prev.size
      );

      if (newLines.length > 0) {
        if (this.store.length >= TRAILING_LINES) {
          this.store = [
            ...this.store.slice(-TRAILING_LINES + newLines.length),
            ...newLines,
          ];
        } else {
          this.store = [...this.store, ...newLines].slice(-TRAILING_LINES);
        }
        this.emit("process", newLines);
      }

      this.lastSize = curr.size;
    } catch (err) {
      console.error("Error watching file:", err);
    }
  }

  start() {
    const watcher = this;
    fs.stat(this.watchFile, (err, stats) => {
      if (err) throw err;
      this.lastSize = stats.size;

      this.readLastLines(
        this.watchFile,
        TRAILING_LINES,
        Math.max(0, stats.size - 8192)
      )
        .then((lines) => {
          this.store = lines;

          fs.watchFile(
            this.watchFile,
            { interval: 1000 },
            function (curr, prev) {
              watcher.watch(curr, prev);
            }
          );
        })
        .catch((err) => console.error("Error starting watcher:", err));
    });
  }
}

module.exports = Watcher;
