import puppeteer from 'puppeteer';
import controller from './gameController';
const headless = !!process.env.HEADLESS;
const auth = process.env.SKYPE_AUTH;

const WAIT_DOM_OPTIONS = {timeout: 120000, visible: true};

let gameUrl = void(0);

async function start() {
    console.log("Skype background working...");
    if (!auth)
        throw new Error('process.env.SKYPE_AUTH required');

    setInterval(async() => {
        const {url} = controller.getState();
        const isNewGameUrl = !!url && url !== gameUrl;
        if (isNewGameUrl) {
            console.group("{skype}");
            gameUrl = url;
            console.log(`----> ${url}`);
            await sendMessage(url);
            console.groupEnd();
        }
    }, 4000);
}
async function login(page) {
    console.group("[login]");
    try {
        const [login, password] = auth.split('/');
        console.log('goto');
        await page.goto('https://web.skype.com/', {waitUntil: 'networkidle0'});

        console.log('waitFor input[type="email"]');
        await page.waitFor('input[type="email"]')
            .then(jsHandle => jsHandle.type(login));

        console.log('waitFor input[type="submit"]');
        await page.waitFor('input[type="submit"]')
            .then(jsHandle => jsHandle.click());

        console.log('waitFor input[type="password"]');
        await page.waitFor(1000);
        await page.waitFor('input[type="password"]')
            .then(jsHandle => jsHandle.type(password));

        console.log('waitFor input[type="submit"]');
        await page.waitFor('input[type="submit"]')
            .then(jsHandle => jsHandle.click());

        securityAlert(page);

        console.log('✓ done');

    } finally {
        console.groupEnd();
    }
}

async function securityAlert(page) {
    try {
        await page.waitFor('#iLandingViewAction', {timeout: 10000, visible: true})
            .then(jsHandle => jsHandle.click());
    } catch(e) {
        //Ignore error
    }
}

async function echoToGeoGuessr(page, text) {
    console.group('[echoToGeoGuessr]');
    try {
        console.log('waitFor.click geoguessr');

        const [textarea, isChatActivated] = await Promise.all([
            page.waitFor('.DraftEditor-root', WAIT_DOM_OPTIONS),
            page.waitFor(() => {
                // const chat = document.querySelector('[title^="GeoGuessr"]');
                const chat = document.querySelector('[data-text-as-pseudo-element="Sergey Antonov"]');
                chat && chat.click();
                return !!document.querySelector('.DraftEditor-root');
             })
        ]);

        console.log('textarea.click.type');
        await textarea.click();
        await textarea.type(text);

        console.log('waitFor [title="Send message"]');
        const sendButton = await page.waitFor('[title="Send message"], [title="Отправить сообщение"]', WAIT_DOM_OPTIONS);
        await sendButton.click();
        console.log('✓ done');

        await page.waitFor(6000);

    } finally {
        console.groupEnd();
    }
}

async function sendMessage(text) {
    console.group('[sendMesage]');

    const browser = await puppeteer.launch({
        headless: headless,
        args: [
            '--no-sandbox'
        ]
    });

    try {
        const page = await browser.newPage();
        await login(page);
        await echoToGeoGuessr(page, text);
        console.log('✓ done');

        return Promise.resolve(true);

    } catch (e) {
        console.error(`Error: ${e.message}`);
    } finally {
        browser.close();
        console.groupEnd();
    }
    return Promise.resolve(false);
}

export default {
    start,
    sendMessage
};