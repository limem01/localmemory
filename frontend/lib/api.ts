const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API error: ${res.status}`);
  }

  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Document {
  id: number;
  title: string;
  filename: string;
  file_size: number | null;
  doc_type: string;
  status: "pending" | "processing" | "ready" | "failed";
  chunk_count: number;
  tags: string[] | null;
  error_message: string | null;
  is_watched: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentListResponse {
  items: Document[];
  total: number;
  page: number;
  page_size: number;
}

export interface SourceCitation {
  document_id: number;
  document_title: string;
  chunk_content: string;
  relevance_score: number;
  page_number: number | null;
}

export interface Message {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  sources: SourceCitation[] | null;
  tokens_used: number | null;
  latency_ms: number | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface Memory {
  id: number;
  title: string;
  content: string;
  memory_type: "fact" | "preference" | "insight" | "digest" | "note";
  importance_score: number;
  tags: string[] | null;
  is_pinned: boolean;
  source_document_id: number | null;
  source_conversation_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface Stats {
  documents: number;
  conversations: number;
  messages: number;
  memories: number;
  vectors: number;
}

export interface Health {
  status: string;
  ollama: {
    connected: boolean;
    host: string;
    llm_model: string;
    embed_model: string;
    available_models: string[];
  };
  app: string;
  version: string;
}

// ─── Document API ─────────────────────────────────────────────────────────────

export const documentsApi = {
  list: (params?: { page?: number; page_size?: number; search?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.page_size) qs.set("page_size", String(params.page_size));
    if (params?.search) qs.set("search", params.search);
    if (params?.status) qs.set("status", params.status);
    return apiFetch<DocumentListResponse>(`/api/documents?${qs}`);
  },

  upload: async (file: File, title?: string, tags?: string[]) => {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    if (tags?.length) formData.append("tags", JSON.stringify(tags));

    const res = await fetch(`${API_BASE}/api/documents/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "Upload failed");
    }
    return res.json() as Promise<Document>;
  },

  get: (id: number) => apiFetch<Document>(`/api/documents/${id}`),

  update: (id: number, data: { title?: string; tags?: string[] }) =>
    apiFetch<Document>(`/api/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<{ message: string }>(`/api/documents/${id}`, { method: "DELETE" }),

  reprocess: (id: number) =>
    apiFetch<{ message: string }>(`/api/documents/${id}/reprocess`, { method: "POST" }),
};

// ─── Chat API ─────────────────────────────────────────────────────────────────

export const chatApi = {
  listConversations: () => apiFetch<Conversation[]>("/api/chat/conversations"),

  createConversation: (title?: string) =>
    apiFetch<Conversation>("/api/chat/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  getConversation: (id: number) =>
    apiFetch<ConversationWithMessages>(`/api/chat/conversations/${id}`),

  deleteConversation: (id: number) =>
    apiFetch<{ message: string }>(`/api/chat/conversations/${id}`, { method: "DELETE" }),

  streamChat: (content: string, conversationId?: number) => {
    return fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, conversation_id: conversationId }),
    });
  },
};

// ─── Memory API ───────────────────────────────────────────────────────────────

export const memoryApi = {
  list: (params?: { memory_type?: string; is_pinned?: boolean; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.memory_type) qs.set("memory_type", params.memory_type);
    if (params?.is_pinned !== undefined) qs.set("is_pinned", String(params.is_pinned));
    if (params?.search) qs.set("search", params.search);
    if (params?.page) qs.set("page", String(params.page));
    return apiFetch<{ items: Memory[]; total: number }>(`/api/memory?${qs}`);
  },

  create: (data: {
    title: string;
    content: string;
    memory_type?: string;
    importance_score?: number;
    tags?: string[];
    is_pinned?: boolean;
  }) =>
    apiFetch<Memory>("/api/memory", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Memory>) =>
    apiFetch<Memory>(`/api/memory/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiFetch<{ message: string }>(`/api/memory/${id}`, { method: "DELETE" }),

  togglePin: (id: number) =>
    apiFetch<{ is_pinned: boolean }>(`/api/memory/${id}/pin`, { method: "POST" }),

  getTodayDigest: () =>
    apiFetch<{
      date: string;
      content: string;
      memory_count: number;
      document_count: number;
    }>("/api/memory/digest/today"),
};

// ─── System API ───────────────────────────────────────────────────────────────

export const systemApi = {
  health: () => apiFetch<Health>("/api/health"),
  stats: () => apiFetch<Stats>("/api/stats"),
};
