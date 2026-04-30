import type { FileNode } from "@/lib/file-system";
import { VirtualFileSystem } from "@/lib/file-system";
import { streamText, appendResponseMessages } from "ai";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getLanguageModel } from "@/lib/provider";
import { generationPrompt } from "@/lib/prompts/generation";

export async function POST(req: Request) {
  const {
    messages,
    files,
    projectId,
  }: { messages: any[]; files: Record<string, FileNode>; projectId?: string } =
    await req.json();

  messages.unshift({
    role: "system",
    content: generationPrompt,
    providerOptions: {
      anthropic: { cacheControl: { type: "ephemeral" } },
    },
  });

  // Reconstruct the VirtualFileSystem from serialized data
  const fileSystem = new VirtualFileSystem();
  fileSystem.deserializeFromNodes(files);

  const model = getLanguageModel();
  // Use fewer steps for mock provider to prevent repetition
  const isMockProvider = !process.env.ANTHROPIC_API_KEY;

  // Store error to include in response
  let streamError: Error | null = null;

  try {
    const result = streamText({
      model,
      abortSignal: req.signal,
      messages,
      maxTokens: 10_000,
      maxSteps: isMockProvider ? 4 : 40,
      experimental_telemetry: { isEnabled: false },
      onError: ({ error }) => {
        console.debug("[DEBUG] StreamText onError triggered");
        console.debug("[DEBUG] Error type:", typeof error);
        console.debug("[DEBUG] Error value:", error);
        if (error instanceof Error) {
          console.debug("[DEBUG] Error message:", error.message);
          console.debug("[DEBUG] Error stack:", error.stack);
        }
        streamError = error instanceof Error ? error : new Error(String(error));
      },
      tools: {
        str_replace_editor: buildStrReplaceTool(fileSystem),
        file_manager: buildFileManagerTool(fileSystem),
      },
      onFinish: async ({ response, finishReason, error }) => {
        console.debug("[DEBUG] onFinish called, finishReason:", finishReason);

        // Log and store any errors
        if (error) {
          console.debug("[DEBUG] onFinish received error:");
          console.debug("[DEBUG]   type:", typeof error);
          console.debug("[DEBUG]   value:", error);
          if (error instanceof Error) {
            console.debug("[DEBUG]   message:", error.message);
            console.debug("[DEBUG]   stack:", error.stack);
          }
          streamError = error instanceof Error ? error : new Error(String(error));
        }

        // Also check for unknown finish reason which indicates an error
        if (finishReason === "unknown") {
          console.debug("[DEBUG] StreamText finished with unknown reason");
          console.debug("[DEBUG] streamError:", streamError);
          console.debug("[DEBUG] onFinish error param:", error);
          if (!streamError) {
            streamError = new Error("API request failed - please check your API key and base URL");
          }
        }

        // Save to project if projectId is provided and user is authenticated
        if (projectId && !error && finishReason !== "unknown") {
          try {
            // Check if user is authenticated
            const session = await getSession();
            if (!session) {
              console.error("User not authenticated, cannot save project");
              return;
            }

            // Get the messages from the response
            const responseMessages = response.messages || [];
            // Combine original messages with response messages
            const allMessages = appendResponseMessages({
              messages: [...messages.filter((m) => m.role !== "system")],
              responseMessages,
            });

            await prisma.project.update({
              where: {
                id: projectId,
                userId: session.userId,
              },
              data: {
                messages: JSON.stringify(allMessages),
                data: JSON.stringify(fileSystem.serialize()),
              },
            });
          } catch (error) {
            console.error("Failed to save project data:", error);
          }
        }
      },
    });

    // Create a transform stream to inject error message if needed
    const encoder = new TextEncoder();
    const originalStream = result.toDataStream();
    let hasReceivedData = false;
    let cancelled = false;
    let upstreamReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const transformedStream = new ReadableStream({
      async start(controller) {
        upstreamReader = originalStream.getReader();
        try {
          while (true) {
            const { done, value } = await upstreamReader.read();
            if (cancelled) break;
            if (done) {
              // If no data was received and there's a streamError, or stream ended immediately
              if (!hasReceivedData || streamError) {
                const errorMessage = streamError?.message || "API request failed - check API key and base URL";
                console.debug("[DEBUG] Stream ended with error:", errorMessage);
                const errorData = JSON.stringify({
                  error: {
                    message: errorMessage,
                    type: "api_error"
                  }
                });
                controller.enqueue(encoder.encode(`3:${errorData}\n`));
              }
              controller.close();
              break;
            }
            hasReceivedData = true;
            controller.enqueue(value);
          }
        } catch (readError: any) {
          if (cancelled) return;
          // Catch HTTP client errors during stream read
          console.debug("[DEBUG] Stream read error caught");
          console.debug("[DEBUG] Error type:", typeof readError);
          console.debug("[DEBUG] Error value:", readError);
          if (readError instanceof Error) {
            console.debug("[DEBUG] Error message:", readError.message);
            console.debug("[DEBUG] Error stack:", readError.stack);
          }

          // Inject error into stream before closing
          const errorMessage = readError?.message || "HTTP request failed";
          const errorData = JSON.stringify({
            error: {
              message: errorMessage,
              type: "http_error"
            }
          });
          try {
            controller.enqueue(encoder.encode(`3:${errorData}\n`));
            controller.close();
          } catch {
            // Controller already closed by runtime during client disconnect
          }
        }
      },
      cancel() {
        cancelled = true;
        if (upstreamReader) upstreamReader.cancel().catch(() => {});
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("API route error:", error);
    return new Response(
      JSON.stringify({
        error: error.message || "An error occurred while processing your request",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export const maxDuration = 120;
