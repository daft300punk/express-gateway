let superagent = require('superagent');

module.exports = function ({baseUrl, verbose, headers}) {
  if (baseUrl[baseUrl.length - 1] !== '/') { // ensure trailing slash
    baseUrl += '/';
  }
  let methods = ['options', 'head', 'get', 'post', 'put', 'patch', 'del', 'delete'];
  let wrapHandler = {
    get: function (target, methodName) {
      if (methodName === 'send') {
        return (data) => {
          debug('> body:', JSON.stringify(data, null, 2));
          return new Proxy(target.send(data), wrapHandler);
        };
      } else if (methodName === 'set') {
        return (field, val) => {
          if (typeof field === 'string') {
            debug(`> header: ${field}:${val}`);
          } else {
            debug('> headers:', JSON.stringify(field, null, 2));
          }
          return new Proxy(target.set(field, val), wrapHandler);
        };
      } else {
        return target[methodName];
      }
    }
  };
  // eslint-disable-next-line no-console
  let debug = (verbose) ? console.error.bind(console) : () => {};
  let client = new Proxy(superagent, {
    get: function (request, name) {
      if (methods.indexOf(name) >= 0) {
        let method = name === 'del' ? 'delete' : name;
        return (url) => {
          debug('>', method.toUpperCase(), baseUrl + url);
          let relativeUrlRequest = new Proxy(request(method, baseUrl + url), wrapHandler);
          if (headers) {
            let headersToAdd = prepareHeaders(headers);
            return relativeUrlRequest.set(headersToAdd);
          }
          return relativeUrlRequest;
        };
      } else {
        return request[name];
      }
    }
  });
  return client;
};

function prepareHeaders (headers) {
  let processedHeaders = {};
  if (typeof headers === 'string') { // Format "KEY:VALUE"
    processHeaderLine(headers, processedHeaders);
  } else if (Array.isArray(headers)) { // Format ["KEY:VALUE", "KEY1:VALUE1"]
    headers.forEach(line => processHeaderLine(line, processedHeaders));
  } else { // Format {KEY:VALUE}
    processedHeaders = headers;
  }
  return processedHeaders;
}

function processHeaderLine (line, result) {
  let colonIndex = line.indexOf(':'); // Note key-auth contains ':' in value
  if (colonIndex === -1) {
    // eslint-disable-next-line no-console
    console.error('Invalid header format ' + line);
    return null;
  }
  let name = line.substr(0, colonIndex);
  let value = line.substr(colonIndex + 1, line.length - colonIndex - 1);
  result[name] = value;
}
