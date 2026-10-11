import http from 'node:http';

import { createApp } from './app';
import { loadConfig } from './config';
import { removeStaleContainers } from './sandbox/docker';
import { Workspaces } from './sandbox/workspace';

async function main(): Promise<void> {
  const config = loadConfig();
  const workspaces = new Workspaces(config.workDir);
  await workspaces.init();
  await removeStaleContainers(config);

  const { app, attach, refreshSandbox } = createApp(config, workspaces);
  const server = http.createServer(app);
  attach(server);

  const sandbox = await refreshSandbox();
  server.listen(config.port, config.host, () => {
    console.log(`Algorithm Visualizer server listening on http://${config.host}:${config.port}`);
    console.log(
      sandbox.available
        ? `Sandbox ready (image ${sandbox.image})`
        : `Sandbox unavailable: ${sandbox.reason}. The C Playground is disabled; the Algorithm Lab still works.`,
    );
  });

  const shutdown = (): void => {
    server.close();
    void removeStaleContainers(config).finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
