import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'

export function createWorkspace(workspaceId: string, userName: string, color: string) {
  const doc = new Y.Doc()
  const wsUrl = typeof window !== 'undefined'
    ? `ws://${window.location.host}/ws/yjs`
    : 'ws://localhost:3000/ws/yjs'
  const provider = new WebsocketProvider(
    wsUrl,
    workspaceId,
    doc
  )
  provider.awareness.setLocalStateField('user', { name: userName, color })
  return { doc, provider }
}
