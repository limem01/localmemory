"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw } from "lucide-react";
import { memoryApi } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ProactiveCard() {
  const { data: digest, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["digest"],
    queryFn: memoryApi.getTodayDigest,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: false,
  });

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4 text-primary" />
            Today's Digest
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {digest && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{digest.document_count} documents</span>
            <span>{digest.memory_count} memories</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="shimmer h-4 rounded" style={{ width: `${85 - i * 15}%` }} />
            ))}
          </div>
        ) : digest ? (
          <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
            {digest.content}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Feed me some documents and I'll start surfacing the good stuff here.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
