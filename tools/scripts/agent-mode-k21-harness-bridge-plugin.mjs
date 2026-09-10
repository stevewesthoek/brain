/**
 * Source template for the K2.1 restricted child.  The parent writes this file
 * into an attempt-private directory with absolute imports into the pinned
 * Harness checkout.  The child has no provider credentials and can only ask
 * the parent for one model turn or the single allowlisted Brain read tool.
 */

export function createBridgePluginSource({ llmRuntime, toolsRuntime }) {
  return `import net from 'node:net'
import { LlmAdapter, ReasoningEffortId, ToolCallId } from ${JSON.stringify(llmRuntime)}
import { defineContentToolFixture } from ${JSON.stringify(toolsRuntime)}

const socketPath = process.env.BRAIN_AGENT_BRIDGE_SOCKET
if (!socketPath) throw new Error('Brain bridge socket is required')
let sequence = 0

function callParent(message) {
  return new Promise((resolve, reject) => {
    const requestId = 'child-' + (++sequence)
    const socket = net.createConnection(socketPath)
    let buffer = ''
    let settled = false
    const finish = (fn, value) => { if (!settled) { settled = true; socket.destroy(); fn(value) } }
    socket.once('error', error => finish(reject, error))
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      const newline = buffer.indexOf('\\n')
      if (newline < 0) return
      const response = JSON.parse(buffer.slice(0, newline))
      finish(resolve, response)
    })
    socket.once('connect', () => socket.write(JSON.stringify({ ...message, requestId }) + '\\n'))
  })
}

class BrainBedrockAdapter extends LlmAdapter {
  resolveModel(provider, model) {
    return Promise.resolve({
      provider, id: model, name: model,
      reasoning: { efforts: [ { id: ReasoningEffortId('default'), name: 'Default' } ] },
    })
  }

  async *stream(options) {
    const response = await callParent({
      kind: 'model',
      provider: options.provider,
      model: options.model,
      system: options.system,
      messages: options.messages,
      tools: options.tools,
      maxTokens: options.maxTokens,
    })
    if (response.ok === false) throw new Error(typeof response.error === 'string' ? response.error : 'Brain model bridge rejected the request')
    if (response.kind === 'tool_use') {
      const args = JSON.stringify(response.input ?? {})
      yield { type: 'block-start', index: 0, blockType: 'tool-call' }
      yield { type: 'tool-call-delta', index: 0, id: ToolCallId(response.toolUseId), name: response.name, argumentsDelta: args }
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: ToolCallId(response.toolUseId), name: response.name, arguments: args } }
      yield { type: 'usage', usage: response.usage ?? { inputTokens: 0, outputTokens: 0 } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    const text = typeof response.text === 'string' ? response.text : ''
    yield { type: 'block-start', index: 0, blockType: 'text' }
    yield { type: 'text-delta', index: 0, text }
    yield { type: 'block-end', index: 0, block: { type: 'text', text } }
    yield { type: 'usage', usage: response.usage ?? { inputTokens: 0, outputTokens: 0 } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

export const name = 'brain-k21-bridge'
export const inject = ['llm', 'tools']
export function apply(ctx) {
  ctx.llm.registerAdapter(['brain-bedrock'], new BrainBedrockAdapter())
  ctx.tools.register(defineContentToolFixture({
    name: 'brain_read',
    description: 'Read the one exact read-only fixture path authorized by Brain.',
    parameters: { path: { type: 'string', required: true } },
    async execute(args) {
      const response = await callParent({ kind: 'tool', name: 'brain_read', args })
      if (!response.ok) throw new Error(typeof response.error === 'string' ? response.error : 'Brain read rejected')
      return [{ type: 'text', text: typeof response.text === 'string' ? response.text : '' }]
    },
  }))
}
`
}
