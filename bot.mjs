import gameController from './gameController';
import TelegramBot from 'node-telegram-bot-api';

const token = process.env.KRUN_KRUN_TOKEN;
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
        bot.sendMessage(chatId, `Ща создам игру на ${game.gameTime} мин`);
        const url = await gameController.startGame();
        if (!!url) {
          bot.sendMessage(chatId, url);
        } else {
          bot.sendMessage(chatId, 'Не получилось создать игру. Попробуйте позже.');
          throw new Error(`[startGame] doesn't return url`);
        }

        const result = await gameController.waitEndGame();
        if (!!result) {
          bot.sendMessage(chatId, result);
        }

        await gameController.stopGame();
        bot.sendMessage(chatId, 'Игра закончена.');
      }
    });
    return Promise.resolve();
  }
}
