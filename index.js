const puppeteer = require('puppeteer');

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.KRUN_KRUN_TOKEN;
const gameTime = process.env.GAME_TIME || 12;

const game = {
  timeLimit: 1, // minutes
  inProgress: false,
  url: void 0
};
let browser;

(async () => {
  
  try {
    const bot = new TelegramBot(token, {polling: true});
// bot.on("polling_error", (msg) => console.log(msg));
    bot.onText(/^го/i, async (message, match) => {
      const chatId = message.chat.id;

      if (game.inProgress) {
        if (game.url) {
          bot.sendMessage(chatId, `Уже играем! ${game.url}`);
        } else {
          bot.sendMessage(chatId, 'Создаю, пришлю ссылку как сделаю! (Может быть)');
        }
      } else {
        bot.sendMessage(chatId, `Ща создам игру на ${gameTime} мин`);
        const url = await startGame();
        game.url = url;
        if (!!url) {
          bot.sendMessage(chatId, url);
        } else {
          bot.sendMessage(chatId, 'Не получилось создать игру. Попробуйте позже.');
           throw new Error(`[startGame] doesn't return url`);
        }
        
        const result = await waitEndGame();
        if (!!result)
          bot.sendMessage(chatId, result);

        await stopGame();
        bot.sendMessage(chatId, 'Игра закончена.');

      }
    });

    bot.onText(/^стоп/i, async (message, match) => {
      const chatId = message.chat.id;
      await stopGame();
      bot.sendMessage(chatId, 'Сервер выключен');
    });

  } catch (e) {
    console.error(e.message);
  }
  
})();

async function stopGame() {
  console.group("[stopGame]");
  try {
    game.inProgress = false;
    browser && browser.close();
    console.log('done');
  } catch (e) {
    console.error(e.message);
  } finally {
    console.groupEnd();
  }
}

async function waitEndGame() {
  console.group("[waitEndGame]");
  try {
    const page = (await browser.pages()).find(page => page.url() === game.url);
    console.log('...');
    await page.waitFor(60000 * gameTime);
    await page.waitFor('#endTable', {timeout: 30000});
    const result = await page.evaluate(() => document.querySelector('#endTable').textContent);
    console.log('evaluate -> #endTable ', result);
    console.log('done');
    return result;
  } finally {
    console.groupEnd();
  }
}

async function startGame(attempts = 0) {
  ++attempts;
  console.group(`[startGame] attempt ${attempts}`);
  game.inProgress = true;
  
  browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
    ]
  });
  
  browser.on('disconnected', () => {
    console.log('Puppeteer disconnected');
    game.inProgress = false;
  });
  
  try {
    const page = await browser.newPage();
    
    await hideFromBotDetector(page);
    return await createGame(page);  // game url
    
  } catch (e) {
    console.error(e.message);
    game.inProgress = false;
    await browser.close();
    if (attempts < 5) {
      return await startGame(attempts);
    }
  } finally {
    console.groupEnd();
  }
}

async function hideFromBotDetector(page) {
  await page.evaluateOnNewDocument(() => {
    const newProto = navigator.__proto__;
    delete newProto.webdriver;
    navigator.__proto__ = newProto;
  });
  
  await page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) "
      + "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.106 Safari/537.36");
}

async function createGame(page) {
  console.log('goto index');
  await page.goto('https://krunker.io/', {waitUntil: 'networkidle2'});
  
  console.log('wait for #menuBtnHost');
  await page.waitFor('#menuBtnHost');
  
  console.log('call openHostWindow()');
  await page.evaluate(() => openHostWindow());
  // await page.click('#menuBtnHost');
  
  const maps = {
    littletown: '#menuWindow > div:nth-child(3) > label:nth-child(2) > div.hostMapName.blackShad'
  };
  console.log('wait for game options');
  await page.waitFor(maps.littletown);
  
  console.log('select map and set game params');
  await page.click(maps.littletown);
  
  await page.evaluate(() => document.querySelector('#customSmaxPlayers').value = 10);
  await page.evaluate(gameTime => document.querySelector('#customSgameTime').value = gameTime, gameTime);
  await page.evaluate(() => document.querySelector('#makePrivate').checked = true);
  
  console.log('create room');
  // await page.click('#menuWindow > div:nth-child(5) > div:nth-child(16) > div:nth-child(44) > a');
  await page.evaluate(() => createPrivateRoom());
  
  console.log('wait for url change');
  await page.waitFor(() => document.querySelector('#hostGameMsg').textContent !== 'Please wait...');
  
  const serverMessage = await page.$eval('#hostGameMsg', element => element.textContent);
  console.log('hostGameMsg ', serverMessage);
  
  if (serverMessage.indexOf('Success') >= 0) {
    const url = await page.url();
    console.log(`---> ${url}`);
    return url;
  }
  throw new Error('Error create game');
}
