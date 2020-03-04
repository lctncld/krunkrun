import host from './host';
import EventEmitter from 'events';

class GameEmitter extends EventEmitter {}
const gameEmitter = new GameEmitter();

const state = {
  inProgress: false,
  url: void 0,
  gameTime: process.env.GAME_TIME || 10
};

export default {
  startGame: () => {
    return host.startGame();
  },
  waitEndGame: async () => {
    return host.waitEndGame();
  },
  stopGame: () => {
    return host.stopGame();
  },
  resetState: () => {
    state.inProgress = false;
    state.url = void(0);
  },
  getState: () => state,
  setInProgress: (inProgress) => {
    state.inProgress = inProgress;
  },
  setUrl: (url) => {
    state.url = url;
    gameEmitter.emit('url', url);
  },
  getEmitter: () => gameEmitter
}

