import { prisma } from "./prisma.js";

export async function findAttachmentWithComment(attachmentId: string) {
  return prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      comment: {
        select: {
          id: true,
          taskId: true
        }
      },
      projectNote: {
        select: { id: true, projectId: true }
      },
      meetingMinute: {
        select: { id: true, projectId: true }
      }
    }
  });
}

export async function findCommentWithTask(commentId: string) {
  return prisma.comment.findUnique({
    where: { id: commentId },
    include: {
      task: {
        select: { id: true }
      }
    }
  });
}

export async function canAccessAttachment(attachmentId: string): Promise<boolean> {
  const attachment = await findAttachmentWithComment(attachmentId);

  if (!attachment) {
    return false;
  }

  if (attachment.comment?.taskId) {
    const task = await prisma.task.findUnique({
      where: { id: attachment.comment.taskId },
      select: { id: true }
    });
    return Boolean(task);
  }

  if (attachment.projectNote || attachment.meetingMinute) {
    return true;
  }

  // Imagens inline ainda não pertencem a um documento durante o upload.
  return true;
}
