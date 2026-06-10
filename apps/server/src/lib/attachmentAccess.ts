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

  return true;
}
