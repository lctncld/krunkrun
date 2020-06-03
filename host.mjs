import controller from './gameController';
import puppeteer from 'puppeteer';

const headless = !!process.env.HEADLESS;

let browser;

async function startGame(attempt = 0) {
  ++attempt;
  console.group(`[startGame] attempt ${attempt}`);
  controller.setInProgress(true);

  browser = await puppeteer.launch({
    headless: headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-infobars',
      '--window-position=0,0',
      '--ignore-certifcate-errors',
      '--ignore-certifcate-errors-spki-list',
      '--ChromeOSMemoryPressureHandling=100'
    ]
  });

  try {
    const page = await browser.newPage();
    await hideFromBotDetector(page);
    return await createGame(page);  // game url
  } catch (e) {
    console.error(e.message);
    controller.setInProgress(false);
    await browser.close();
    if (attempt < 5) {
      return await startGame(attempt);
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
  await page.goto('https://krunker.io/', {waitUntil: 'domcontentloaded'});

  console.log('wait for connecting...');
  await page.waitFor(() => document.querySelector('#instructions').textContent.includes('CLICK TO PLAY'), {timeout: 30000});

  console.log('call openHostWindow()');
  await page.evaluate(() => openHostWindow());
  const maps = {
    littletown: '#gameMap1'
  };
  console.log('wait for game options');
  await page.waitFor(maps.littletown);

  console.log('select map and set game params');
  const mapSelectors = Object.values(maps);
  await page.evaluate(selectors => selectors.map(
      selector => document.querySelector(selector).checked = true
  ), mapSelectors);

  await page.evaluate(() => document.querySelector('#customSmaxPlayers').value = 10);
  await page.evaluate(gameTime => document.querySelector('#customSgameTime').value = gameTime, controller.getState().gameTime);
  await page.evaluate(() => document.querySelector('#makePrivate').checked = true);

  console.log('create room');
  await page.evaluate(() => createPrivateRoom());

  console.log('wait for url change');
  await page.waitFor(() => document.querySelector('#hostGameMsg').textContent !== 'Please wait...');

  const serverMessage = await page.$eval('#hostGameMsg', element => element.textContent);
  console.log('hostGameMsg ', serverMessage);

  if (serverMessage.includes('Success')) {
    const url = await page.url();
    controller.setUrl(url);
    console.log(`---> ${url}`);
    return url;
  }
  throw new Error(`Error create game: ${serverMessage}`);
}

async function stopGame() {
  console.group("[stopGame]");
  try {
    controller.resetState();
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
    const state = controller.getState();
    const page = (await browser.pages()).find(page => page.url() === state.url);
    console.log('...');

    const breakTime = 25000; // Max 25 sec
    const gameCount = 2;
    const gameTime = 60000 * state.gameTime * gameCount + breakTime;
    const error = await Promise.race([
      page.waitFor(gameTime).then(() => false),
      page.waitFor(() => {
        const instructions = document.querySelector('#instructions').textContent;
        return instructions.includes('DISCONNECTED') ? instructions : false;
      }, {timeout: gameTime})
    ]);

    if (!!error)
      throw new Error(`Game interrupted! ${error}`);

    // console.log('Waiting game result...');
    // await page.waitFor(() => !!document.querySelector('#endTable').textContent, {timeout: breakTime});
    // const result = await page.$eval('#endTable', el => el.innerHTML);
    // console.log('#endTable ', result);
    await page.waitFor(breakTime);
    console.log('done');
    return result;

  } finally {
    console.groupEnd();
  }
}

export default {
  startGame,
  stopGame,
  waitEndGame
}
