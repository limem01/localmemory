"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Brain, FileText, MessageSquare, Sparkles, ArrowRight,
  Upload, Cpu, Database, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProactiveCard } from "@/components/ProactiveCard";
import { systemApi, documentsApi } from "@/lib/api";
import { formatDate, getDocTypeIcon, getStatusColor } from "@/lib/utils";

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: systemApi.stats,
    refetchInterval: 30000,
  });

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: systemApi.health,
    refetchInterval: 30000,
    retry: false,
  });

  const { data: recentDocs } = useQuery({
    queryKey: ["documents", "recent"],
    queryFn: () => documentsApi.list({ page: 1, page_size: 5 }),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Hero */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-8 h-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">LocalMemory</h1>
          </div>
          <p className="text-muted-foreground max-w-lg">
            Your private second brain that remembers everything forever —{" "}
            <span className="text-primary font-medium">100% local</span>, proactive, and yours.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/sources">
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-1.5" />
              Upload
            </Button>
          </Link>
          <Link href="/chat">
            <Button size="sm">
              <MessageSquare className="w-4 h-4 mr-1.5" />
              Chat
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Documents", value: stats?.documents ?? 0, icon: FileText, color: "text-blue-400" },
          { label: "Vectors", value: stats?.vectors ?? 0, icon: Database, color: "text-violet-400" },
          { label: "Memories", value: stats?.memories ?? 0, icon: Brain, color: "text-amber-400" },
          { label: "Messages", value: stats?.messages ?? 0, icon: MessageSquare, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="hover:border-primary/30 transition-colors">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{value.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Proactive digest */}
        <div className="lg:col-span-3">
          <ProactiveCard />
        </div>

        {/* Ollama status */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Cpu className="w-4 h-4 text-primary" />
                AI Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Ollama</span>
                <Badge variant={health?.ollama?.connected ? "success" : "destructive"}>
                  {health?.ollama?.connected ? "connected" : "offline"}
                </Badge>
              </div>
              {health?.ollama?.llm_model && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">LLM</span>
                  <span className="text-sm font-mono text-foreground">
                    {health.ollama.llm_model}
                  </span>
                </div>
              )}
              {health?.ollama?.embed_model && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Embeddings</span>
                  <span className="text-sm font-mono text-foreground">
                    {health.ollama.embed_model}
                  </span>
                </div>
              )}
              {!health?.ollama?.connected && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-muted-foreground">
                  Start Ollama with{" "}
                  <code className="text-primary">ollama serve</code> and pull a model with{" "}
                  <code className="text-primary">ollama pull llama3.2</code>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-primary" />
              Recent Sources
            </CardTitle>
            <Link href="/sources">
              <Button variant="ghost" size="sm" className="text-xs">
                View all
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentDocs?.items.length === 0 ? (
            <div className="text-center py-8">
              <Upload className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No documents yet</p>
              <Link href="/sources">
                <Button variant="outline" size="sm" className="mt-3">
                  Upload your first document
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentDocs?.items.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="text-lg">{getDocTypeIcon(doc.doc_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.chunk_count} chunks · {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={doc.status === "ready" ? "success" : doc.status === "failed" ? "destructive" : "warning"}
                  >
                    {doc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/chat", icon: MessageSquare, label: "Start chatting", desc: "Ask questions about your documents" },
          { href: "/sources", icon: Upload, label: "Add sources", desc: "Upload PDFs, notes, and text files" },
          { href: "/memory", icon: Sparkles, label: "View memories", desc: "Browse your captured knowledge" },
        ].map(({ href, icon: Icon, label, desc }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/40 hover:bg-accent/30 transition-all cursor-pointer h-full">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
