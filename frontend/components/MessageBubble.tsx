"use client";

import { Brain, User } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { SourceCitations } from "./SourceCitation";
import type { Message } from "@/lib/api";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

function renderContent(content: string) {
  // Simple markdown-like rendering
  const lines = content.split("\n");
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      result.push(
        <pre key={i} className="bg-muted rounded-lg p-3 my-2 overflow-x-auto">
          <code className="text-sm text-foreground font-mono">{codeLines.join("\n")}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Heading
    if (line.startsWith("### ")) {
      result.push(<h3 key={i} className="font-semibold text-base mt-3 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith("## ")) {
      result.push(<h2 key={i} className="font-semibold text-lg mt-4 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      result.push(<h1 key={i} className="font-bold text-xl mt-4 mb-2">{line.slice(2)}</h1>);
    }
    // List item
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      result.push(
        <li key={i} className="ml-4 list-disc text-sm mb-0.5">
          {renderInline(line.slice(2))}
        </li>
      );
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      const text = line.replace(/^\d+\. /, "");
      result.push(
        <li key={i} className="ml-4 list-decimal text-sm mb-0.5">
          {renderInline(text)}
        </li>
      );
    }
    // Empty line = paragraph break
    else if (line.trim() === "") {
      result.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      result.push(
        <p key={i} className="text-sm leading-relaxed mb-1">
          {renderInline(line)}
        </p>
      );
    }
    i++;
  }
  return result;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text** or __text__
  // Inline code: `code`
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, i) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-muted text-primary px-1.5 py-0.5 rounded text-xs font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    if ((part.startsWith("**") && part.endsWith("**")) ||
        (part.startsWith("__") && part.endsWith("__"))) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex gap-3 animate-fade-in",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-primary/20 text-primary"
            : "bg-violet-500/20 text-violet-400"
        )}
      >
        {isUser ? <User className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
      </div>

      {/* Content */}
      <div className={cn("flex flex-col gap-1 max-w-[80%]", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-border rounded-tl-sm"
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className={cn(isStreaming && "typing-cursor")}>
              {renderContent(message.content)}
            </div>
          )}
        </div>

        {/* Sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}

        {/* Metadata */}
        <div className={cn("flex items-center gap-2 text-xs text-muted-foreground px-1", isUser && "flex-row-reverse")}>
          <span>{formatDate(message.created_at)}</span>
          {message.latency_ms && (
            <span>• {(message.latency_ms / 1000).toFixed(1)}s</span>
          )}
        </div>
      </div>
    </div>
  );
}
