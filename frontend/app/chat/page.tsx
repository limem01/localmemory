"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ChatInterface } from "@/components/ChatInterface";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatApi, type Conversation } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

export default function ChatPage() {
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: chatApi.listConversations,
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: chatApi.deleteConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (selectedConvId) setSelectedConvId(null);
      toast.success("Conversation deleted");
    },
  });

  return (
    <div className="flex h-full">
      {/* Conversation list sidebar */}
      <div className="w-64 border-r border-border flex flex-col shrink-0 hidden md:flex">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Conversations</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSelectedConvId(null)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {conversations?.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8 px-2">
                Nothing yet. Ask something →
              </p>
            )}
            {conversations?.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors",
                  selectedConvId === conv.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setSelectedConvId(conv.id)}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {conv.title ?? "New conversation"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conv.message_count} msgs · {formatDate(conv.updated_at)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMutation.mutate(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex-1">
        <ChatInterface key={selectedConvId ?? "new"} />
      </div>
    </div>
  );
}
