"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import { PaperPlaneTiltIcon, RobotIcon, UserIcon } from "@phosphor-icons/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

type ChatMessage = {
  id: string
  role: "user" | "agent"
  content: string
  structuredOutput?: unknown
}

type StreamChunk = {
  type: "session" | "delta" | "final" | "error"
  session_id?: string
  text?: string
  message?: string
  structured_output?: unknown
  detail?: string
}

type Recommendation = {
  supplier_name: string
  sku: string
  functional_similarity: "high" | "medium" | "low"
  quality_match_score: number
  compliance_match: "full" | "partial" | "none"
  certifications: string[]
  regulatory_alignment: string[]
  dietary_compatibility: string
  key_advantages: string
  tradeoffs: string
  recommended_use_cases: string
  confidence_score: number
}

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"

const isDuplicateStructuredText = (content: string, structuredOutput: unknown): boolean => {
  if (!content.trim() || !structuredOutput) return false
  try {
    const parsedContent = JSON.parse(content)
    return JSON.stringify(parsedContent) === JSON.stringify(structuredOutput)
  } catch {
    return false
  }
}

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "agent",
    content: "Hi there! How can I help you today?",
  },
]

const loadingStatuses = [
  "Performing database scan",
  "Performing scenario analysis",
  "Checking compliance",
]

const asRecommendations = (structuredOutput: unknown): Recommendation[] => {
  if (!Array.isArray(structuredOutput)) return []

  return structuredOutput.filter((item): item is Recommendation => {
    if (!item || typeof item !== "object") return false
    const candidate = item as Record<string, unknown>
    return (
      typeof candidate.sku === "string" &&
      typeof candidate.supplier_name === "string" &&
      typeof candidate.functional_similarity === "string" &&
      typeof candidate.quality_match_score === "number" &&
      typeof candidate.compliance_match === "string" &&
      typeof candidate.confidence_score === "number"
    )
  })
}

const scoreTone = (score: number): "default" | "secondary" | "outline" => {
  if (score >= 85) return "default"
  if (score >= 65) return "secondary"
  return "outline"
}

const complianceTone = (
  value: Recommendation["compliance_match"]
): "default" | "secondary" | "destructive" => {
  if (value === "full") return "default"
  if (value === "partial") return "secondary"
  return "destructive"
}

const similarityTone = (
  value: Recommendation["functional_similarity"]
): "default" | "secondary" | "outline" => {
  if (value === "high") return "default"
  if (value === "medium") return "secondary"
  return "outline"
}

export default function AgentsPage() {
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStatusIndex, setLoadingStatusIndex] = useState(0)
  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading])

  useEffect(() => {
    if (!isLoading) {
      setLoadingStatusIndex(0)
      return
    }

    if (loadingStatusIndex >= loadingStatuses.length - 1) {
      return
    }

    const timeout = window.setTimeout(() => {
      setLoadingStatusIndex((prev) => Math.min(prev + 1, loadingStatuses.length - 1))
    }, 2500)

    return () => window.clearTimeout(timeout)
  }, [isLoading, loadingStatusIndex])

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

    const streamingMessageId = `agent-stream-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: streamingMessageId,
        role: "agent",
        content: "",
      },
    ])

    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/agnes/chat/stream`, {
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

      if (!response.body) {
        throw new Error("Streaming response body was empty.")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      const applyChunk = (chunk: StreamChunk) => {
        if (chunk.type === "session" && chunk.session_id) {
          setSessionId(chunk.session_id)
          return
        }

        if (chunk.type === "delta" && chunk.text) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === streamingMessageId
                ? { ...message, content: `${message.content}${chunk.text}` }
                : message
            )
          )
          return
        }

        if (chunk.type === "final") {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === streamingMessageId
                ? {
                    ...message,
                    content: chunk.message ?? message.content,
                    structuredOutput: chunk.structured_output,
                  }
                : message
            )
          )
          return
        }

        if (chunk.type === "error") {
          throw new Error(chunk.detail ?? "Unable to stream response from Agnes backend.")
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split("\n\n")
        buffer = events.pop() ?? ""

        for (const rawEvent of events) {
          const line = rawEvent
            .split("\n")
            .find((eventLine) => eventLine.startsWith("data:"))
          if (!line) continue

          const jsonPayload = line.slice("data:".length).trim()
          if (!jsonPayload) continue
          applyChunk(JSON.parse(jsonPayload) as StreamChunk)
        }
      }
    } catch (error) {
      const fallback =
        error instanceof Error ? error.message : "Unable to reach Agnes backend."
      setMessages((prev) =>
        prev.map((message) =>
          message.id === streamingMessageId
            ? {
                ...message,
                content: `I hit an error while running the scenario: ${fallback}`,
              }
            : message
        )
      )
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
              {!isDuplicateStructuredText(message.content, message.structuredOutput) ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{message.content}</p>
              ) : null}
              {message.structuredOutput ? (
                <div className="mt-3 flex flex-col gap-3">
                  {asRecommendations(message.structuredOutput).length > 0 ? (
                    asRecommendations(message.structuredOutput).map((recommendation, index) => (
                      <Card key={`${message.id}-recommendation-${index}`} className="bg-background">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">
                            {index + 1}. {recommendation.sku}
                          </CardTitle>
                          <CardDescription>
                            Supplier: {recommendation.supplier_name}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={similarityTone(recommendation.functional_similarity)}>
                              Functional Similarity: {recommendation.functional_similarity}
                            </Badge>
                            <Badge variant={scoreTone(recommendation.quality_match_score)}>
                              Quality Score: {recommendation.quality_match_score}/100
                            </Badge>
                            <Badge variant={complianceTone(recommendation.compliance_match)}>
                              Compliance: {recommendation.compliance_match}
                            </Badge>
                            <Badge variant={scoreTone(recommendation.confidence_score)}>
                              Confidence: {recommendation.confidence_score}/100
                            </Badge>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Dietary Compatibility
                            </p>
                            <p className="text-sm text-foreground">{recommendation.dietary_compatibility}</p>
                          </div>

                          <Separator />

                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Key Advantages
                            </p>
                            <p className="text-sm text-foreground">{recommendation.key_advantages}</p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Trade-offs
                            </p>
                            <p className="text-sm text-foreground">{recommendation.tradeoffs}</p>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Recommended Use Cases
                            </p>
                            <p className="text-sm text-foreground">{recommendation.recommended_use_cases}</p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Certifications
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {recommendation.certifications.map((cert) => (
                                <Badge key={cert} variant="secondary">
                                  {cert}
                                </Badge>
                              ))}
                            </div>
                          </div>                          
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <pre className="overflow-x-auto border border-border bg-muted p-3 text-xs text-foreground">
                      {JSON.stringify(message.structuredOutput, null, 2)}
                    </pre>
                  )}
                </div>
              ) : null}
            </article>
          ))}

          {isLoading ? (
            <div className="mr-auto inline-flex items-center gap-3 border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/70 border-t-transparent" />
              <span>{loadingStatuses[loadingStatusIndex]}</span>
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:200ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/70 [animation-delay:400ms]" />
              </span>
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
