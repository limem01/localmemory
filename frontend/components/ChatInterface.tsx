"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Send, Plus, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "@/components/MessageBubble";
import { chatApi, type Message, type SourceCitation } from "@/lib/api";

interface StreamEvent {
  type: "token" | "sources" | "done" | "error";
  content?: string;
  sources?: SourceCitation[];
  conversation_id?: number;
  message_id?: number;
  error?: string;
}

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  const { data: conversation, refetch: refetchConversation } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => chatApi.getConversation(conversationId!),
    enabled: !!conversationId,
    staleTime: Infinity,
  });

  const messages = conversation?.messages ?? [];

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 50);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, streamingMessage?.content, scrollToBottom]);

  const handleNewChat = () => {
    setConversationId(null);
    setStreamingMessage(null);
    setInput("");
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userContent = input.trim();
    setInput("");
    setIsStreaming(true);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: Date.now(),
      role: "user",
      content: userContent,
      sources: null,
      tokens_used: null,
      latency_ms: null,
      created_at: new Date().toISOString(),
    };

    // Add streaming placeholder for assistant
    const tempAssistantMsg: Message = {
      id: Date.now() + 1,
      role: "assistant",
      content: "",
      sources: null,
      tokens_used: null,
      latency_ms: null,
      created_at: new Date().toISOString(),
    };
    setStreamingMessage(tempAssistantMsg);

    try {
      const response = await chatApi.streamChat(userContent, conversationId ?? undefined);

      if (!response.ok || !response.body) {
        throw new Error("Stream failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = "";
      let sources: SourceCitation[] = [];
      let newConvId = conversationId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));

            if (event.type === "token" && event.content) {
              accumulatedContent += event.content;
              setStreamingMessage((prev) =>
                prev ? { ...prev, content: accumulatedContent } : null
              );
            } else if (event.type === "sources" && event.sources) {
              sources = event.sources;
              setStreamingMessage((prev) =>
                prev ? { ...prev, sources } : null
              );
            } else if (event.type === "done") {
              if (event.conversation_id) {
                newConvId = event.conversation_id;
                setConversationId(event.conversation_id);
              }
            } else if (event.type === "error") {
              throw new Error(event.error);
            }
          } catch (parseError) {
            // Skip malformed events
          }
        }
      }

      // Refresh conversation data
      if (newConvId) {
        await queryClient.invalidateQueries({ queryKey: ["conversation", newConvId] });
        await refetchConversation();
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {
      toast.error("Failed to send message. Is Ollama running?");
      console.error(err);
    } finally {
      setIsStreaming(false);
      setStreamingMessage(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const allMessages: Message[] = [
    ...messages,
    ...(isStreaming && streamingMessage ? [streamingMessage] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div>
          <h1 className="font-semibold text-foreground">
            {conversation?.title ?? "New Chat"}
          </h1>
          {conversation && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {conversation.message_count} messages
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleNewChat}>
          <Plus className="w-4 h-4 mr-1.5" />
          New Chat
        </Button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-6 space-y-6"
      >
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Ask your second brain</h2>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                Ask anything about your documents, notes, or memories. LocalMemory will find relevant context and answer intelligently.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {[
                "Summarize my recent notes",
                "What do I know about machine learning?",
                "Find information about project deadlines",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="text-xs bg-muted hover:bg-accent text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          allMessages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={isStreaming && i === allMessages.length - 1 && msg.role === "assistant"}
            />
          ))
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-border">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask your second brain anything... (Enter to send, Shift+Enter for newline)"
              className="min-h-[52px] max-h-[200px] pr-12 resize-none bg-card border-border"
              disabled={isStreaming}
              rows={1}
            />
          </div>
          <Button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className="h-[52px] w-[52px] shrink-0"
            size="icon"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Running 100% locally on your machine · No data leaves your computer
        </p>
      </div>
    </div>
  );
}
