const puppeteer = require('puppeteer');

const TelegramBot = require('node-telegram-bot-api');
const token = process.env.KRUN_KRUN_TOKEN;

const game = {
  timeLimit: 1, // minutes
  inProgress: false,
  url: void 0
};

(async () => {
  const bot = new TelegramBot(token, {polling: true});
  bot.onText(/го/, async (message, match) => {
    const chatId = message.chat.id;

    if (game.inProgress) {
      if (game.url) {
        bot.sendMessage(chatId, `Уже играем! ${game.url}`);
      } else {
        bot.sendMessage(chatId, 'Создаю, пришлю ссылку как сделаю! (Может быть)');
      }
    } else {
      bot.sendMessage(chatId, 'Ща создам');
      game.inProgress = true;

      const browser = await puppeteer.launch({
        headless: false,
        args: [
          '--app=https://www.google.com/',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-position=0,0',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
        ]
      });
      const page = await browser.newPage();

      await hideFromBotDetector(page);
      game.url = await createGame(page);
      bot.sendMessage(chatId, game.url);

      setTimeout(async () => {
        bot.sendMessage(chatId, 'А теперь работать!');
        await stopHost(browser)
      }, (game.timeLimit + 1) * 1000 * 60);

      await page.waitForSelector('#instructions > span:nth-child(1)', {timeout: 0});
      console.log('RIP server');
      bot.sendMessage(chatId, 'Сервер отвалился, расходимся');
      await stopHost(browser);
    }
  });
})();

async function stopHost(browser) {
  console.log('stop host');
  await browser.close();
  game.inProgress = false;
  game.url = void 0;
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
  await page.evaluate(() => document.querySelector('#customSgameTime').value = 10);
  await page.evaluate(() => document.querySelector('#makePrivate').checked = true);

  console.log('create room');
  // await page.click('#menuWindow > div:nth-child(5) > div:nth-child(16) > div:nth-child(44) > a');
  await page.evaluate(() => createPrivateRoom());

  console.log('wait for url change');
  try {
    await page.waitForNavigation({waitUntil: 'networkidle2', timeout: 3000});
    const url = await page.url();
    console.log(`---> ${url}`);
    return url;
  } catch (e) {
    const serverMessage = await page.$eval('#hostGameMsg', element => element.textContent);
    console.log(`server message: ${serverMessage}`);
    if (serverMessage === 'Server limit reached. Try on a different Server') {
      console.log('reload and create game again');
      await createGame(page);
    }
  }
}
