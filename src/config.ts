import config from 'config';

type Config = {
  server: Server,
  norsk: Norsk
}

type Server = {
  logs: () => string,
  rtmp_port: () => number,
  rtmp_host: () => string,
  streams: () => RelayStream[]
}


export type RelayStream = {
  from: {
    app: string,
    stream: string
  }
  to: {
    app: string,
    stream: string,
    host: string,
    port: number
  }
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
    logs: () => read('server.logs', 'logs'),
    rtmp_port: () => read('rtmp.port', 1935),
    rtmp_host: () => read('rtmp.host', '0.0.0.0'),
    streams: () => read('streams', [])
  },
  norsk: {
    host: () => read('norsk.host', '127.0.0.1'),
    api_port: () => read('norsk.api_port', 6790)
  }
}


export default Config;
