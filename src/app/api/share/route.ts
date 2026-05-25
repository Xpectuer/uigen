import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { v4 as uuidv4 } from "uuid";

// POST /api/share — create a share link
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { projectId } = await req.json();

  if (!projectId) {
    return Response.json({ error: "project_id_required" }, { status: 400 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
  });

  if (!project) {
    return Response.json({ error: "project_not_found" }, { status: 404 });
  }

  const shareUrl = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.project.update({
    where: { id: projectId },
    data: {
      data: JSON.stringify({
        shareUrl,
        sharedAt: new Date().toISOString(),
      }),
    },
  });

  return Response.json({
    shareId: shareUrl,
    shareUrl: `/share/${shareUrl}`,
    expiresAt: expiresAt.toISOString(),
  });
}
