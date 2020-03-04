import bot from './bot';
import httpServer from './httpServer';
import skype from './skype';

(async () => {
  await httpServer.startServer();
  await bot.start();
  if (!!process.env.SKYPE_AUTH)
    await skype.start();
})();
