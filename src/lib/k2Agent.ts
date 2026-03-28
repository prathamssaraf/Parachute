import * as Y from "yjs"

export interface K2AgentOptions {
  doc: Y.Doc
  workspaceCode: string
  filePath: string
  prompt: string
  agentName: string
  agentColor: string
  allFiles: string[]
  onThinking: (text: string) => void
  onTyping: (file: string) => void
  onDone: (summary: string) => void
  onError: (err: string) => void
}

export async function runK2Agent(opts: K2AgentOptions): Promise<void> {
  const { doc, workspaceCode, filePath, prompt, allFiles, onThinking, onTyping, onDone, onError } = opts

  // Gather all file contents for context
  const fileContents: Record<string, string> = {}
  for (const f of allFiles) {
    const yText = doc.getText(`file:${f}`)
    const content = yText.toString()
    if (content.trim()) fileContents[f] = content
  }

  onThinking("Sending to K2 Think V2...")

  try {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: workspaceCode,
        filePath,
        prompt,
        allFiles: fileContents,
      }),
    })

    if (!res.ok || !res.body) {
      onError(`Failed to connect to K2 agent: ${res.status}`)
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""
    let codeBuffer = ""
    let thinkingText = ""
    let startedWriting = false

    const yText = doc.getText(`file:${filePath}`)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const data = line.slice(6).trim()
        if (!data) continue

        try {
          const parsed = JSON.parse(data)

          if (parsed.type === "thinking") {
            thinkingText += parsed.content
            // Show last 80 chars of thinking
            const preview = thinkingText.slice(-80).replace(/\n/g, " ")
            onThinking(preview)
          }

          if (parsed.type === "content") {
            if (!startedWriting) {
              startedWriting = true
              onTyping(filePath)
            }
            codeBuffer += parsed.content
            // Type into Yjs doc character by character for visual effect
            const insertPos = yText.length
            doc.transact(() => {
              yText.insert(insertPos, parsed.content)
            })
            // Small delay for typing effect
            await new Promise(r => setTimeout(r, 15))
          }

          if (parsed.type === "done") {
            // Clean up: remove code fences if K2 wrapped them
            const currentText = yText.toString()
            if (currentText.includes("```")) {
              const cleaned = currentText
                .replace(/```[\w]*\n?/g, "")
                .replace(/```\s*$/g, "")
                .trim()
              doc.transact(() => {
                yText.delete(0, yText.length)
                yText.insert(0, cleaned)
              })
            }
            onDone(`Added ${codeBuffer.split("\n").length} lines to ${filePath}`)
            return
          }

          if (parsed.type === "error") {
            onError(parsed.content)
            return
          }
        } catch {}
      }
    }

    if (codeBuffer) {
      onDone(`Added ${codeBuffer.split("\n").length} lines to ${filePath}`)
    } else {
      onError("No code generated")
    }
  } catch (err: any) {
    onError(err.message || "Failed to run agent")
  }
}
