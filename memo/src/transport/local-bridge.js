const net = require('node:net');

function send(socket, response) {
  socket.write(`${JSON.stringify(response)}\n`);
}

/**
 * A small local-only JSON-lines RPC server. A Windows named pipe is not a
 * TCP listener, so no port is exposed to the network. It is transport-only:
 * each department continues to validate its own actions and permissions.
 */
function createLocalBridge({ pipeName, handleRequest, logger = console }) {
  if (!pipeName || typeof handleRequest !== 'function') {
    throw new Error('本地桥接需要 pipeName 和 handleRequest。');
  }

  let server;

  return {
    async start() {
      if (server) return;
      server = net.createServer((socket) => {
        socket.setEncoding('utf8');
        let buffer = '';
        socket.on('data', (chunk) => {
          buffer += chunk;
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line) continue;
            let request;
            try {
              request = JSON.parse(line);
            } catch {
              send(socket, { id: null, ok: false, error: { code: 'invalid_json', message: '请求不是有效 JSON。' } });
              continue;
            }
            Promise.resolve(handleRequest(request))
              .then((result) => send(socket, { id: request.id ?? null, ok: true, result }))
              .catch((error) => {
                logger.warn?.('Steward local bridge request failed', error);
                send(socket, { id: request.id ?? null, ok: false, error: { code: 'request_failed', message: error.message || '部门无法完成请求。' } });
              });
          }
        });
      });
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(pipeName, () => {
          server.off('error', reject);
          resolve();
        });
      });
    },

    async stop() {
      if (!server) return;
      const closing = server;
      server = undefined;
      await new Promise((resolve, reject) => closing.close((error) => error ? reject(error) : resolve()));
    }
  };
}

module.exports = { createLocalBridge };
