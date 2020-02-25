import bot from './bot';
import express from 'express';

const PORT = process.env.PORT || 3000;

(async () => {
  const app = express();

  app.get('/', function (req, res) {
    res.send('Krunkrun beta');
  });

  await app.listen(PORT, function () {
    console.log(`Krunkrun listening on port ${PORT}!`);
  });

  await bot.start();
})();
