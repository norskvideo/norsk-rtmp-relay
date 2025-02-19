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
        return s.app == app
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
      const exists = !!streams.find((s) => {
        return s.app == app && s.stream == publishName
      });
      if (exists) {
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

  for (const stream of streams) {
    infolog("Setting up stream egest", { app: stream.app, stream: stream.stream })

    const relay = await norsk.output.rtmp({
      id: `egest-${stream.app}-${stream.stream}`,
      url: `rtmp://${stream.host}:${stream.port}/${stream.app}/${stream.stream}`,
    })
    relay.subscribe([
      {
        source: ingest,
        sourceSelector: (streams) => {
          return streams.filter((s) => s.streamKey.sourceName == `${stream.app}-${stream.stream}`).map((s => s.streamKey))
        }
      }
    ])

  }
}


void main();



