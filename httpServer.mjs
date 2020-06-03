import http from 'http';

const hostname = 'localhost';
const port = process.env.PORT || 3000;

function startServer() {

  const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end();
  });

  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
    return Promise.resolve();
  });
}

export default {
  startServer
}
