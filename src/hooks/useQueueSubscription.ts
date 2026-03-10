import { useEffect, useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface QueueSubscriptionOptions {
  queueId: string;
  onCompleted: (imageUrl: string) => void;
  onFailed: (errorMessage: string) => void;
  onPositionUpdate?: (position: number) => void;
}

interface QueueEntry {
  id: string;
  status: string;
  result_image_url: string | null;
  error_message: string | null;
  created_at: string;
}

// Maximum time to wait for generation (3 minutes)
const MAX_GENERATION_TIME_MS = 3 * 60 * 1000;
// Polling interval when realtime fails (5 seconds)
const FALLBACK_POLL_INTERVAL_MS = 5000;
// Max reconnection attempts
const MAX_RECONNECT_ATTEMPTS = 5;

export function useQueueSubscription({
  queueId,
  onCompleted,
  onFailed,
  onPositionUpdate,
}: QueueSubscriptionOptions) {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const hasCompletedRef = useRef(false);
  const { toast } = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Poll for status updates (fallback when realtime fails)
  const pollForStatus = useCallback(async () => {
    if (!queueId || hasCompletedRef.current) return;

    try {
      console.log(`[useQueueSubscription] Polling for status: ${queueId}`);
      const { data, error } = await supabase
        .from("generation_queue")
        .select("status, result_image_url, error_message")
        .eq("id", queueId)
        .maybeSingle();

      if (error) {
        console.error("[useQueueSubscription] Poll error:", error);
        return;
      }

      if (data) {
        console.log(`[useQueueSubscription] Poll result:`, {
          status: data.status,
          hasImage: Boolean(data.result_image_url),
        });

        if (data.status === "completed" && data.result_image_url) {
          hasCompletedRef.current = true;
          console.log(`[useQueueSubscription] Generation completed via polling!`);
          onCompleted(data.result_image_url);
        } else if (data.status === "failed") {
          hasCompletedRef.current = true;
          console.log(`[useQueueSubscription] Generation failed via polling:`, data.error_message);
          onFailed(data.error_message || "Erro desconhecido");
        }
      }
    } catch (err) {
      console.error("[useQueueSubscription] Poll exception:", err);
    }
  }, [queueId, onCompleted, onFailed]);

  // Start fallback polling
  const startFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current || hasCompletedRef.current) return;

    console.log(`[useQueueSubscription] Starting fallback polling`);
    pollIntervalRef.current = setInterval(pollForStatus, FALLBACK_POLL_INTERVAL_MS);
    
    // Also poll immediately
    pollForStatus();
  }, [pollForStatus]);

  // Stop fallback polling
  const stopFallbackPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      console.log(`[useQueueSubscription] Stopping fallback polling`);
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Reconnect to realtime channel
  const reconnectChannel = useCallback(() => {
    if (!queueId || hasCompletedRef.current) return;
    
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[useQueueSubscription] Max reconnection attempts reached, using polling only`);
      startFallbackPolling();
      return;
    }

    reconnectAttemptsRef.current += 1;
    console.log(`[useQueueSubscription] Reconnecting (attempt ${reconnectAttemptsRef.current})`);

    // Clean up old channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create new channel with unique name to avoid conflicts
    const channelName = `queue-${queueId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "generation_queue",
          filter: `id=eq.${queueId}`,
        },
        (payload) => {
          if (hasCompletedRef.current) return;
          
          const newData = payload.new as QueueEntry;
          console.log(`[useQueueSubscription] Queue update received:`, {
            id: newData.id,
            status: newData.status,
            hasImage: Boolean(newData.result_image_url),
          });

          if (newData.status === "completed" && newData.result_image_url) {
            hasCompletedRef.current = true;
            console.log(`[useQueueSubscription] Generation completed!`);
            stopFallbackPolling();
            onCompleted(newData.result_image_url);
          } else if (newData.status === "failed") {
            hasCompletedRef.current = true;
            console.log(`[useQueueSubscription] Generation failed:`, newData.error_message);
            stopFallbackPolling();
            onFailed(newData.error_message || "Erro desconhecido");
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useQueueSubscription] Subscription status: ${status}`);
        
        if (status === "SUBSCRIBED") {
          setIsSubscribed(true);
          reconnectAttemptsRef.current = 0; // Reset on successful connection
          // Poll once immediately in case we missed an update
          pollForStatus();
        } else if (status === "TIMED_OUT" || status === "CHANNEL_ERROR") {
          setIsSubscribed(false);
          
          if (status === "TIMED_OUT") {
            console.log(`[useQueueSubscription] Connection timed out, starting fallback polling and attempting reconnect`);
            startFallbackPolling();
            
            // Try to reconnect after a delay
            setTimeout(() => {
              if (!hasCompletedRef.current) {
                reconnectChannel();
              }
            }, 2000);
          } else {
            toast({
              title: "Erro de conexão",
              description: "Problema ao receber atualizações. Verificando status...",
              variant: "destructive",
            });
            startFallbackPolling();
          }
        } else if (status === "CLOSED") {
          setIsSubscribed(false);
          // If closed unexpectedly and we haven't completed, start polling
          if (!hasCompletedRef.current) {
            startFallbackPolling();
          }
        }
      });

    channelRef.current = channel;
  }, [queueId, onCompleted, onFailed, toast, pollForStatus, startFallbackPolling, stopFallbackPolling]);

  // Subscribe to queue updates
  useEffect(() => {
    if (!queueId) return;

    console.log(`[useQueueSubscription] Subscribing to queue: ${queueId}`);
    hasCompletedRef.current = false;
    reconnectAttemptsRef.current = 0;

    // Set up max timeout to prevent infinite waiting
    timeoutRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        console.log(`[useQueueSubscription] Max generation time exceeded`);
        hasCompletedRef.current = true;
        stopFallbackPolling();
        onFailed("Tempo limite excedido. A geração pode ter falhado ou demorado mais que o esperado. Tente novamente.");
      }
    }, MAX_GENERATION_TIME_MS);

    // Initial subscription
    reconnectChannel();

    // Also start polling as a safety net (in parallel with realtime)
    // This ensures we never miss an update even if realtime has issues
    const safetyPollInterval = setInterval(() => {
      if (!hasCompletedRef.current) {
        pollForStatus();
      }
    }, 10000); // Poll every 10 seconds as safety net

    // Cleanup on unmount
    return () => {
      console.log(`[useQueueSubscription] Unsubscribing from queue: ${queueId}`);
      
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      stopFallbackPolling();
      clearInterval(safetyPollInterval);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setIsSubscribed(false);
    };
  }, [queueId, onCompleted, onFailed, reconnectChannel, pollForStatus, stopFallbackPolling]);

  // Poll for queue position updates (every 5 seconds)
  useEffect(() => {
    if (!queueId || !onPositionUpdate) return;

    const fetchPosition = async () => {
      try {
        const { data, error } = await supabase
          .from("generation_queue")
          .select("id, created_at")
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: true });

        if (error || !data) return;

        const position = data.findIndex((entry) => entry.id === queueId) + 1;
        if (position > 0) {
          onPositionUpdate(position);
        }
      } catch (err) {
        console.error("[useQueueSubscription] Error fetching position:", err);
      }
    };

    // Initial fetch
    fetchPosition();

    // Poll every 5 seconds
    const interval = setInterval(fetchPosition, 5000);

    return () => clearInterval(interval);
  }, [queueId, onPositionUpdate]);

  return { isSubscribed };
}

// Hook to check initial queue status (in case we missed the update)
export function useQueueStatusCheck(queueId: string | null) {
  const [status, setStatus] = useState<"pending" | "processing" | "completed" | "failed" | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkStatus = useCallback(async () => {
    if (!queueId) return;

    try {
      const { data, error } = await supabase
        .from("generation_queue")
        .select("status, result_image_url, error_message")
        .eq("id", queueId)
        .maybeSingle();

      if (error) {
        console.error("[useQueueStatusCheck] Error fetching status:", error);
        return;
      }

      if (data) {
        setStatus(data.status as typeof status);
        setResultImageUrl(data.result_image_url);
        setErrorMessage(data.error_message);
      }
    } catch (err) {
      console.error("[useQueueStatusCheck] Error:", err);
    }
  }, [queueId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return { status, resultImageUrl, errorMessage, refetch: checkStatus };
}
