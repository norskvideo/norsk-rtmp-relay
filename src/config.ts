import config from 'config';

type Config = {
  server: Server,
  norsk: Norsk
}

type Server = {
  logs: () => string,
}

type Norsk = {
  api_port: () => number,
  host: () => string,
}

function read<T>(key: string, def: T) {
  return config.has(key) ? config.get<T>(key) : def;
}

const Config: Config = {
  server: {
    logs: () => read('server.logs', 'logs')
  },
  norsk: {
    host: () => read('norsk.host', '127.0.0.1'),
    api_port: () => read('norsk.api_port', 6790)
  }
}


export default Config;
