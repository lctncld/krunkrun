import bot from './bot';
import httpServer from './httpServer';

(async () => {
  await httpServer.startServer();
  await bot.start();
})();
