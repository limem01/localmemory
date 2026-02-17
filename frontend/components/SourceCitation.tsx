"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SourceCitation as SourceCitationType } from "@/lib/api";

interface SourceCitationProps {
  sources: SourceCitationType[];
}

export function SourceCitations({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          {sources.length} source{sources.length !== 1 ? "s" : ""} referenced
        </span>
        {expanded ? (
          <ChevronUp className="w-3 h-3 ml-auto" />
        ) : (
          <ChevronDown className="w-3 h-3 ml-auto" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 divide-y divide-border/30">
          {sources.map((source, i) => (
            <div key={i} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-5 h-5 rounded bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {source.document_title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="text-green-400 font-medium">
                        {Math.round(source.relevance_score * 100)}% match
                      </span>
                      {source.page_number && (
                        <span>• page {source.page_number}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expandedIndex === i ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              </div>

              {expandedIndex === i && (
                <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded p-2 leading-relaxed max-h-32 overflow-y-auto">
                  {source.chunk_content}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
