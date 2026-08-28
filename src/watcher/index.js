import path from 'node:path';
import chokidar from 'chokidar';

export class FileWatcher {
  constructor({ config, builder, devServer, logger }) {
    this.config = config;
    this.builder = builder;
    this.devServer = devServer;
    this.logger = logger;
    this.watcher = null;
    this.isRebuilding = false;
  }

  start() {
    const watchPaths = [this.config.docsDir];
    if (this.config.configFile) {
      watchPaths.push(this.config.configFile);
    }

    this.watcher = chokidar.watch(watchPaths, {
      ignored: [
        /(^|[\/\\])\../,        // dotfiles
        '**/node_modules/**',
        '**/.docboot/**',
        '**/dist/**'
      ],
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 50,
        pollInterval: 10
      }
    });

    this.watcher.on('all', async (event, filePath) => {
      if (this.isRebuilding) return;
      this.isRebuilding = true;

      try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.md' || ext === '.markdown' || filePath === this.config.configFile) {
          const relativePath = path.relative(this.config.docsDir, filePath);
          const startTime = performance.now();

          const result = await this.builder.build({ isDev: true });
          const elapsedMs = Math.round(performance.now() - startTime);

          const route = path.basename(filePath).startsWith('README') || path.basename(filePath).startsWith('index')
            ? '/' + path.dirname(relativePath).replace(/^\./, '')
            : '/' + relativePath.slice(0, -ext.length).replace(/\\/g, '/');

          if (this.logger) {
            this.logger.change(relativePath, route, elapsedMs);
          }

          if (this.devServer) {
            this.devServer.reload();
          }
        }
      } catch (err) {
        if (this.logger) {
          this.logger.error('Rebuild failed during watch:', err);
        }
      } finally {
        this.isRebuilding = false;
      }
    });

    return this.watcher;
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
