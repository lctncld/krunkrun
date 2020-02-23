import gameController from './gameController';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.KRUN_KRUN_TOKEN;
if (!token) {
  console.error(`ERROR! process.env.KRUN_KRUN_TOKEN required`);
  process.exit();
}

export default {
  start: () => {
    const bot = new TelegramBot(token, {polling: true});
    bot.onText(/^го/i, async (message, match) => {
      const chatId = message.chat.id;
      const game = gameController.getState();

      if (game.inProgress) {
        if (game.url) {
          bot.sendMessage(chatId, `Уже играем! ${game.url}`);
        } else {
          bot.sendMessage(chatId, 'Создаю, пришлю ссылку как сделаю! (Может быть)');
        }
      } else {
        try {
          await createAndWaitForGameEnd();
        } catch (e) {
          console.error(e.message);
        } finally {
          await gameController.stopGame();
          bot.sendMessage(chatId, 'Игра закончена.');
        }
      }

      async function createAndWaitForGameEnd() {
        bot.sendMessage(chatId, `Ща создам игру на ${game.gameTime} мин`);
        const url = await gameController.startGame();
        if (!!url) {
          bot.sendMessage(chatId, url);
        } else {
          bot.sendMessage(chatId, 'Не получилось создать игру. Попробуйте позже.');
          throw new Error(`[startGame] didn't return url`);
        }

        const result = await gameController.waitEndGame();
        if (!!result) {
          bot.sendMessage(chatId, result);
        }
      }
    });
    return Promise.resolve();
  }
}
