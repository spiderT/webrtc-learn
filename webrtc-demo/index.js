let server = require('./server/server');
let log = require('./server/log').log;
let port = process.argv[2] || 5001;

let requestHandlers = require('./server/serverXHRSignalingChannel');

// 返回404
function notFound(info) {
  let res = info.res;
  log('Request handler NotFound was called.');
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.write('404 Page Not Found');
  res.end()
}

let handle = {};

handle['/'] = notFound;

handle['/connect'] = requestHandlers.connect;
handle['/send'] = requestHandlers.send;
handle['/get'] = requestHandlers.get;

server.serveFilePath('static');
server.start(handle, port);
