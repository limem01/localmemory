"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Upload, FileText, Trash2, RefreshCw, Search, CheckCircle,
  AlertCircle, Clock, Loader2, Tag,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { documentsApi, type Document } from "@/lib/api";
import { formatDate, formatFileSize, getDocTypeIcon, cn } from "@/lib/utils";

const STATUS_ICONS = {
  ready: <CheckCircle className="w-4 h-4 text-green-400" />,
  failed: <AlertCircle className="w-4 h-4 text-red-400" />,
  processing: <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />,
  pending: <Clock className="w-4 h-4 text-blue-400" />,
};

const STATUS_BADGE: Record<string, "success" | "destructive" | "warning" | "info"> = {
  ready: "success",
  failed: "destructive",
  processing: "warning",
  pending: "info",
};

export default function SourcesPage() {
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["documents", search],
    queryFn: () => documentsApi.list({ search, page_size: 50 }),
    refetchInterval: 5000, // Poll for status changes
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Document deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reprocessMutation = useMutation({
    mutationFn: documentsApi.reprocess,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast.success("Reprocessing started");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setUploading(true);
      setUploadProgress(0);

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        try {
          await documentsApi.upload(file);
          setUploadProgress(((i + 1) / acceptedFiles.length) * 100);
          toast.success(`"${file.name}" uploaded and processing`);
        } catch (err: any) {
          toast.error(`Failed to upload "${file.name}": ${err.message}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      setUploading(false);
      setUploadProgress(0);
    },
    [queryClient]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/markdown": [".md"],
    },
    disabled: uploading,
  });

  const docs = data?.items ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Sources
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data?.total ?? 0} documents · {docs.filter((d) => d.status === "ready").length} ready
        </p>
      </div>

      {/* Upload Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Uploading and processing...</p>
            <Progress value={uploadProgress} className="max-w-xs mx-auto" />
          </div>
        ) : (
          <>
            <Upload className={cn("w-10 h-10 mx-auto mb-3", isDragActive ? "text-primary" : "text-muted-foreground")} />
            <p className="font-medium text-foreground">
              {isDragActive ? "Let go" : "Drag stuff here, or click"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDFs, text, DOCX, Markdown — up to 50MB each
            </p>
          </>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents..."
          className="pl-10"
        />
      </div>

      {/* Documents list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 shimmer rounded-xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              {search ? "Nothing matches" : "Drop some files in up there ↑"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Card
              key={doc.id}
              className={cn(
                "hover:border-primary/30 transition-colors",
                doc.status === "failed" && "border-destructive/30"
              )}
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Type icon */}
                <span className="text-2xl">{getDocTypeIcon(doc.doc_type)}</span>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{doc.title}</p>
                    {doc.is_watched && (
                      <Badge variant="outline" className="text-xs shrink-0">auto</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{doc.filename}</span>
                    {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                    {doc.chunk_count > 0 && <span>{doc.chunk_count} chunks</span>}
                    <span>{formatDate(doc.created_at)}</span>
                  </div>
                  {doc.error_message && (
                    <p className="text-xs text-destructive mt-1 truncate">{doc.error_message}</p>
                  )}
                  {doc.tags && doc.tags.length > 0 && (
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {doc.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs py-0">
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 shrink-0">
                  {STATUS_ICONS[doc.status]}
                  <Badge variant={STATUS_BADGE[doc.status]}>
                    {doc.status}
                  </Badge>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {doc.status === "failed" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => reprocessMutation.mutate(doc.id)}
                      title="Reprocess"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Delete "${doc.title}"?`)) {
                        deleteMutation.mutate(doc.id);
                      }
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
