/**
 * Server-Sent Events broadcaster for dev live reload.
 */
export class SSEBroadcaster {
  constructor() {
    this.clients = new Set();
  }

  addClient(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('\n');

    this.clients.add(res);

    req.on('close', () => {
      this.clients.delete(res);
    });
  }

  reload() {
    for (const client of this.clients) {
      try {
        client.write('data: reload\n\n');
      } catch (err) {
        this.clients.delete(client);
      }
    }
  }
}
