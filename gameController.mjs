import host from './host';

const state = {
  inProgress: false,
  url: void 0,
  gameTime: process.env.GAME_TIME || 1
  // timeLimit: 1, // minutes
};

export default {
  startGame: (attempts = 0) => {
    ++attempts;
    console.group(`[startGame] attempt ${attempts}`);
    return host.startGame();
    // return Promise.resolve('start game')
  },
  waitEndGame: async () => {
    console.group("[waitEndGame]");
    return host.waitEndGame();
    // Promise.resolve('wait end game')
  },
  stopGame: () => {
    return host.stopGame();
    // Promise.resolve('stop game')
  },
  getState: () => state,
  setInProgress: (inProgress) => {
    state.inProgress = inProgress;
  },
  setUrl: (url) => {
    state.url = url;
  }
}

