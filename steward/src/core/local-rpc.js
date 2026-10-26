const crypto = require('node:crypto');
const net = require('node:net');

function invokeLocal(pipeName, request, { timeoutMs = 2500 } = {}) {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(pipeName);
    let buffer = '';
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.destroy();
      callback(value);
    };
    const timeout = setTimeout(() => finish(reject, new Error('本地部门没有及时响应。')), timeoutMs);
    socket.setEncoding('utf8');
    socket.once('error', (error) => finish(reject, new Error(`无法连接本地部门：${error.message}`)));
    socket.on('connect', () => socket.write(`${JSON.stringify({ ...request, id })}\n`));
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        let response;
        try { response = JSON.parse(line); } catch { continue; }
        if (response.id !== id) continue;
        if (!response.ok) return finish(reject, new Error(response.error?.message || '本地部门请求失败。'));
        return finish(resolve, response.result);
      }
    });
  });
}

module.exports = { invokeLocal };
