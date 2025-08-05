import { Norsk, OnStreamResult, RtmpOutputNode } from '@norskvideo/norsk-sdk';
import Config from './config';
import { debuglog, errorlog, infolog } from './logging';

// work around our 'void main'
const stayAlive = setTimeout(() => { }, 60000);

async function main() {
  debuglog("Connecting to Norsk");
  const active = new Map<string, { app: string, publishName: string, relays: RtmpOutputNode[] }>();

  const norsk = await Norsk.connect({
    url: `${Config.norsk.host()}:${Config.norsk.api_port()}`,
    onFailedToConnect: () => {
      errorlog("Failed to connect to norsk host")
    }
  });
  clearTimeout(stayAlive);

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
    onConnectionStatusChange: (connectionId, status) => {
      if (status !== 'disconnected') return;
      void stopStreamsForSource(connectionId);
    },
    onStream: (connectionId, app, _url, streamId, publishName): OnStreamResult => {
      const matching = streams.filter((s) => {
        return s.from.app == app && s.from.stream == publishName
      });
      if (matching.length > 0) {
        infolog("Accepting stream for app", { app, streamId, publishName })
        void startStreamsForSource(connectionId, app, publishName);
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

  async function startStreamsForSource(connectionId: string, app: string, publishName: string) {
    const v = active.get(connectionId);
    if (v) {
      errorlog("Stream already connected, this is a bug", { app, publishName });
      return;
    }
    const newV = { app, publishName, relays: new Array<RtmpOutputNode>() };
    active.set(connectionId, newV);
    streams.map(async (stream, i) => {
      if (stream.from.app == app && stream.from.stream == publishName) {
        infolog("Setting up stream egest", { from: stream.from, to: stream.to })
        const relay = await norsk.output.rtmp({
          id: `egest-${stream.from.stream}-${stream.to.stream}-${i}`,
          url: `rtmp://${stream.to.host}:${stream.to.port}/${stream.to.app}/${stream.to.stream}`,
        })
        newV.relays.push(relay);
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
      }
    })
  }

  async function stopStreamsForSource(connectionId: string) {
    const v = active.get(connectionId);
    if (!v) {
      errorlog("Unrecognised stream disconnected");
      return;
    }
    active.delete(connectionId);
    Promise.all(v.relays.map(async (r) => r.close()));
  }
}

void main();


