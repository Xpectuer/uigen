"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  projectId: string;
}

export function ShareButton({ projectId }: ShareButtonProps) {
  const [loading, setLoading] = useState(false);
  const [shareData, setShareData] = useState<{
    id: string;
    url: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleShare = async () => {
    setLoading(true);
    setError(null);

    try {
      // Agent-C calls /api/shares (plural) — but Agent-B built /api/share (singular)
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      // Agent-C expects { id, url } but Agent-B returns { shareId, shareUrl }
      setShareData({
        id: data.id,       // backend returns data.shareId — undefined!
        url: data.url,     // backend returns data.shareUrl — undefined!
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleShare} disabled={loading}>
        {loading ? "Creating share link..." : "Share Component"}
      </Button>

      {shareData && (
        <div className="text-sm text-green-600">
          Share URL: {shareData.url}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-500">
          Failed to create share: {error}
        </div>
      )}
    </div>
  );
}
