"use client"

import { FormEvent, useMemo, useState } from "react"
import { PaperPlaneTiltIcon, RobotIcon, UserIcon } from "@phosphor-icons/react"

type ChatMessage = {
  id: string
  role: "user" | "agent"
  content: string
  structuredOutput?: unknown
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "agent",
    content: "Ask me for substitute materials, and I will return ranked alternatives with supplier evidence.",
  },
]

export default function AgentsPage() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = input.trim()
    if (!prompt || isLoading) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: prompt,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/agnes/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: prompt,
          session_id: sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const payload = (await response.json()) as {
        session_id: string
        message: string
        structured_output?: unknown
      }

      setSessionId(payload.session_id)
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: "agent",
          content: payload.message,
          structuredOutput: payload.structured_output,
        },
      ])
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : "Unable to reach Agnes backend."
      setMessages((prev) => [
        ...prev,
        {
          id: `agent-error-${Date.now()}`,
          role: "agent",
          content: `I hit an error while running the scenario: ${fallback}`,
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex h-svh w-full items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.16),transparent_40%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.2),transparent_35%)]" />
      <section className="relative flex h-full max-h-[760px] w-full max-w-3xl flex-col rounded-2xl border border-white/10 bg-slate-900/70 shadow-[0_0_50px_rgba(15,23,42,0.8)] backdrop-blur-xl">
        <header className="border-b border-white/10 px-6 py-5">
          <h1 className="text-2xl font-semibold tracking-tight">Spherecast Agent</h1>
          <p className="mt-1 text-sm text-slate-300">Running scenario analysis for material substitutions.</p>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {messages.map((message) => (
            <article
              key={message.id}
              className={
                message.role === "user"
                  ? "ml-auto w-fit max-w-[88%] rounded-2xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3"
                  : "mr-auto max-w-[92%] rounded-2xl border border-white/10 bg-slate-800/75 px-4 py-3"
              }
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-300">
                {message.role === "user" ? <UserIcon size={14} /> : <RobotIcon size={14} />}
                <span>{message.role === "user" ? "You" : "Agnes Agent"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">{message.content}</p>
              {message.structuredOutput ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950/80 p-3 text-xs text-cyan-100">
                  {JSON.stringify(message.structuredOutput, null, 2)}
                </pre>
              ) : null}
            </article>
          ))}

          {isLoading ? (
            <div className="mr-auto inline-flex rounded-xl border border-white/10 bg-slate-800/75 px-4 py-3 text-sm text-slate-300">
              Running scenario analysis...
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Talk to Spherecast"
              className="h-9 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={!canSend}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-400/10 text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              <PaperPlaneTiltIcon size={16} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
