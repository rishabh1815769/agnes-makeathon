"use client"

import { FormEvent, useMemo, useState } from "react"
import { PaperPlaneTiltIcon, RobotIcon, UserIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
    content: "Hi there! How can I help you today?",
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
    <div className="flex h-full min-h-svh w-full flex-col bg-background">
      <section className="flex h-full w-full flex-1 flex-col border-l border-border">
        <header className="flex flex-col gap-1 border-b border-border bg-card px-6 py-4">
          <h1 className="text-lg font-semibold text-foreground">Spherecast Agent</h1>
          <p className="text-xs text-muted-foreground">
            Running scenario analysis for material substitutions.
          </p>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-background px-6 py-5">
          {messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "max-w-[90%] border px-4 py-3",
                message.role === "user"
                  ? "ml-auto w-fit border-primary/40 bg-primary/10"
                  : "mr-auto border-border bg-card"
              )}
            >
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                {message.role === "user" ? <UserIcon /> : <RobotIcon />}
                <span>{message.role === "user" ? "You" : "Agnes Agent"}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
              {message.structuredOutput ? (
                <pre className="mt-3 overflow-x-auto border border-border bg-muted p-3 text-xs text-foreground">
                  {JSON.stringify(message.structuredOutput, null, 2)}
                </pre>
              ) : null}
            </article>
          ))}

          {isLoading ? (
            <div className="mr-auto inline-flex border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              Running scenario analysis...
            </div>
          ) : null}
        </div>

        <form onSubmit={onSubmit} className="border-t border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Talk to Agnes"
              className="h-10 flex-1 text-sm"
            />
            <Button
              type="submit"
              disabled={!canSend}
              size="icon"
              variant="default"
              aria-label="Send message"
            >
              <PaperPlaneTiltIcon />
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
