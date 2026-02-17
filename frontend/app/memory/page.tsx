"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sparkles, Pin, PinOff, Trash2, Plus, Search, Filter,
  Brain, Lightbulb, Heart, BookOpen, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { memoryApi, type Memory } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";

const MEMORY_TYPE_ICONS = {
  fact: <Brain className="w-3.5 h-3.5" />,
  preference: <Heart className="w-3.5 h-3.5" />,
  insight: <Lightbulb className="w-3.5 h-3.5" />,
  digest: <BookOpen className="w-3.5 h-3.5" />,
  note: <FileText className="w-3.5 h-3.5" />,
};

const MEMORY_TYPE_COLORS = {
  fact: "text-blue-400 bg-blue-400/10",
  preference: "text-pink-400 bg-pink-400/10",
  insight: "text-amber-400 bg-amber-400/10",
  digest: "text-violet-400 bg-violet-400/10",
  note: "text-gray-400 bg-gray-400/10",
};

function MemoryCard({ memory, onPin, onDelete }: {
  memory: Memory;
  onPin: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = MEMORY_TYPE_COLORS[memory.memory_type];
  const typeIcon = MEMORY_TYPE_ICONS[memory.memory_type];

  return (
    <Card
      className={cn(
        "transition-all hover:border-primary/30",
        memory.is_pinned && "border-primary/30 bg-primary/5"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Type icon */}
          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5", typeColor)}>
            {typeIcon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-medium text-foreground text-sm leading-tight">{memory.title}</h3>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-7 w-7", memory.is_pinned ? "text-primary" : "text-muted-foreground")}
                  onClick={() => onPin(memory.id)}
                  title={memory.is_pinned ? "Unpin" : "Pin"}
                >
                  {memory.is_pinned ? <Pin className="w-3.5 h-3.5 fill-current" /> : <PinOff className="w-3.5 h-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(memory.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Preview */}
            <div
              className={cn(
                "text-xs text-muted-foreground mt-1 leading-relaxed cursor-pointer",
                !expanded && "line-clamp-3"
              )}
              onClick={() => setExpanded(!expanded)}
            >
              {memory.content}
            </div>
            {memory.content.length > 200 && (
              <button
                className="text-xs text-primary mt-1 hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="outline" className={cn("text-xs gap-1 py-0", typeColor)}>
                {typeIcon}
                {memory.memory_type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Importance: {Math.round(memory.importance_score * 100)}%
              </span>
              <span className="text-xs text-muted-foreground">{formatDate(memory.created_at)}</span>
              {memory.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs py-0">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateMemoryForm({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [memType, setMemType] = useState<string>("note");
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: memoryApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory saved");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <h3 className="font-semibold text-sm">New Memory</h3>
        <Input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Textarea
          placeholder="The thing you don't want to forget..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="flex gap-2 flex-wrap">
          {(["fact", "preference", "insight", "note"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setMemType(type)}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors",
                memType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {MEMORY_TYPE_ICONS[type]}
              {type}
            </button>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim() || !content.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({
              title, content, memory_type: memType, importance_score: 0.5,
            })}
          >
            Save Memory
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MemoryPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["memories", search, filterType, showPinnedOnly],
    queryFn: () =>
      memoryApi.list({
        search: search || undefined,
        memory_type: filterType || undefined,
        is_pinned: showPinnedOnly || undefined,
      }),
    refetchInterval: 30000,
  });

  const pinMutation = useMutation({
    mutationFn: memoryApi.togglePin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["memories"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: memoryApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      toast.success("Memory deleted");
    },
  });

  const memories = data?.items ?? [];

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Memory
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {data?.total ?? 0} memories stored · {memories.filter((m) => m.is_pinned).length} pinned
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Add Memory
        </Button>
      </div>

      {/* Create form */}
      {showCreate && <CreateMemoryForm onClose={() => setShowCreate(false)} />}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search memories..."
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {(["", "fact", "preference", "insight", "digest", "note"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-full border transition-colors",
                filterType === type
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {type === "" ? "All" : type}
            </button>
          ))}
          <button
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className={cn(
              "flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border transition-colors",
              showPinnedOnly
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            <Pin className="w-3 h-3" />
            Pinned
          </button>
        </div>
      </div>

      {/* Memory list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 shimmer rounded-xl" />)}
        </div>
      ) : memories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <Brain className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {search || filterType || showPinnedOnly
                ? "Nothing matches that"
                : "Empty for now. Use the chat or add something yourself."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              onPin={(id) => pinMutation.mutate(id)}
              onDelete={(id) => {
                if (confirm("Delete this memory?")) deleteMutation.mutate(id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
