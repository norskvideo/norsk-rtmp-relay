import { Norsk, OnStreamResult } from '@norskvideo/norsk-sdk';
import Config from './config';
import { debuglog, errorlog, infolog } from './logging';



async function main() {
  debuglog("Connecting to Norsk");

  const norsk = await Norsk.connect({
    url: `${Config.norsk.host()}:${Config.norsk.api_port()}`,
    onFailedToConnect: () => {
      errorlog("Failed to connect to norsk host")
    }
  });

  const streams = Config.server.streams();
  debuglog("Reading streams", { streams });


  debuglog("Setting up ingest", { host: Config.server.rtmp_host(), port: Config.server.rtmp_port() });
  const ingest = await norsk.input.rtmpServer({
    // host: Config.server.rtmp_host(),
    port: Config.server.rtmp_port(),
    onConnection: (_connectionId, app, _url) => {
      const exists = !!streams.find((s) => {
        return s.from.app == app
      });
      if (exists) {
        infolog("Accepting connection for app", { app })
        return { accept: true }
      } else {
        infolog("Rejecting connection for app", { app })
        return { accept: false, reason: "unknown app" }
      }
    },
    onStream: (_connectionId, app, _url, streamId, publishName): OnStreamResult => {
      const matching = streams.filter((s) => {
        return s.from.app == app && s.from.stream == publishName
      });
      if (matching.length > 0) {
        infolog("Accepting stream for app", { app, streamId, publishName })
        return {
          accept: true,
          videoStreamKey: {
            programNumber: 1,
            sourceName: `${app}-${publishName}`,
            streamId: streamId,
            renditionName: 'default'
          },
          audioStreamKey: {
            programNumber: 1,
            sourceName: `${app}-${publishName}`,
            streamId: streamId + 1,
            renditionName: 'default'
          },
        }
      } else {
        infolog("Rejecting stream for app", { app, streamId, publishName })
        return { accept: false, reason: "unknown stream" }
      }

    }
  })

  streams.map(async (stream, i) => {
    infolog("Setting up stream egest", { from: stream.from, to: stream.to })
    const relay = await norsk.output.rtmp({
      id: `egest-${stream.from}-${stream.to}-${i}`,
      url: `rtmp://${stream.to.host}:${stream.to.port}/${stream.to.app}/${stream.to.stream}`,
    })
    relay.subscribe([
      {
        source: ingest,
        sourceSelector: (streams) => {
          return streams
            .filter((s) =>
              s.streamKey.sourceName == `${stream.from.app}-${stream.from.stream}`)
            .map((s => s.streamKey))

        }
      }
    ])
  })
}


void main();


