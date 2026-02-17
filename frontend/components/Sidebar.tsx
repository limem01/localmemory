"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  MessageSquare,
  FileText,
  Sparkles,
  Activity,
  ChevronRight,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { systemApi } from "@/lib/api";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Brain },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/sources", label: "Sources", icon: FileText },
  { href: "/memory", label: "Memory", icon: Sparkles },
];

export function Sidebar() {
  const pathname = usePathname();

  const { data: health } = useQuery({
    queryKey: ["health"],
    queryFn: systemApi.health,
    refetchInterval: 30000,
    retry: false,
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: systemApi.stats,
    refetchInterval: 60000,
  });

  const ollamaOk = health?.ollama?.connected;

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="flex flex-col w-16 lg:w-64 h-screen border-r border-border bg-card shrink-0 transition-all duration-300">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div className="hidden lg:block">
            <h1 className="font-bold text-sm text-foreground">LocalMemory</h1>
            <p className="text-xs text-muted-foreground">all yours, all local</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-primary/15 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="hidden lg:block">{label}</span>
                    {active && (
                      <ChevronRight className="w-4 h-4 ml-auto hidden lg:block" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="lg:hidden">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Stats (desktop only) */}
        {stats && (
          <div className="hidden lg:block px-4 py-3 border-t border-border">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-foreground">{stats.documents}</div>
                <div className="text-muted-foreground">docs</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-foreground">{stats.vectors}</div>
                <div className="text-muted-foreground">vectors</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-foreground">{stats.memories}</div>
                <div className="text-muted-foreground">memories</div>
              </div>
              <div className="bg-muted rounded-lg p-2 text-center">
                <div className="font-bold text-foreground">{stats.messages}</div>
                <div className="text-muted-foreground">msgs</div>
              </div>
            </div>
          </div>
        )}

        {/* Ollama Status */}
        <div className="px-4 py-3 border-t border-border">
          <div className="flex items-center gap-2">
            {ollamaOk ? (
              <Wifi className="w-4 h-4 text-green-400 shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <div className="hidden lg:block text-xs">
              <div className={cn("font-medium", ollamaOk ? "text-green-400" : "text-red-400")}>
                {ollamaOk ? "Ollama connected" : "Ollama offline"}
              </div>
              {health?.ollama?.llm_model && (
                <div className="text-muted-foreground truncate">
                  {health.ollama.llm_model}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Version footer */}
        <div className="hidden lg:block px-4 py-2 text-[10px] text-muted-foreground/50">
          v0.1 · made with coffee & spite
        </div>
      </aside>
    </TooltipProvider>
  );
}
