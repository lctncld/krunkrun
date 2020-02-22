import controller from './gameController';
import puppeteer from 'puppeteer';

let browser;

async function startGame(attempt = 0) {
  ++attempt;
  console.group(`[startGame] attempt ${attempt}`);
  controller.setInProgress(true);

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
    controller.setInProgress(false);
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
  await page.evaluate(gameTime => document.querySelector('#customSgameTime').value = gameTime, controller.getState().gameTime);
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
    controller.setUrl(url);
    console.log(`---> ${url}`);
    return url;
  }
  throw new Error('Error create game');
}

async function stopGame() {
  console.group("[stopGame]");
  try {
    controller.setInProgress(false);
    controller.setUrl(void 0);
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
    await page.waitFor(60000 * state.gameTime);
    await page.waitFor(() => !!document.querySelector('#endTable').textContent);
    const result = await page.$eval('#endTable', el => el.innerHTML);
    await page.waitFor(15000);
    console.log('evaluate -> #endTable ', result);
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
