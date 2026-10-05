import { HubConnectionBuilder, HubConnection, LogLevel, HttpTransportType } from '@microsoft/signalr';
import { getAccessToken } from './auth';

const HUB_URL = `${import.meta.env.VITE_API_BASE_URL ?? ''}/hubs/pulse`;

export function buildHubConnection(): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL, {
      // Browsers cannot set the Authorization header on WebSocket upgrades,
      // so the token is passed as a query param — mirrored by OnMessageReceived on the server.
      accessTokenFactory: () => getAccessToken() ?? '',
      transport: HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .configureLogging(
      import.meta.env.DEV ? LogLevel.Warning : LogLevel.Error,
    )
    .build();
}
