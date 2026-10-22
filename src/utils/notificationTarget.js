// Maps a notification to the in-app screen it belongs to. The backend stores
// the relevant ids in `notification.data` (see models/Notification.js).
export function getNotificationTarget(notification) {
  if (!notification) return null;

  const data = notification.data || {};
  const senderId = notification.sender?._id || notification.sender;

  switch (notification.type) {
    case "friend_request":
      return "/friends?tab=incoming";
    case "friend_accept":
      return "/friends?tab=friends";
    case "like":
    case "comment":
    case "reply":
    case "new_post": {
      if (!data.postId) return "/feed";
      const params = new URLSearchParams({ post: String(data.postId) });
      if (data.commentId) params.set("comment", String(data.commentId));
      return `/feed?${params.toString()}`;
    }
    case "message":
      if (data.conversationId) {
        return `/chat?conversation=${encodeURIComponent(String(data.conversationId))}`;
      }
      if (senderId) return `/chat?user=${encodeURIComponent(String(senderId))}`;
      return "/chat";
    case "group_invite":
      return "/groups";
    case "story_like":
      return "/stories";
    case "system":
    default:
      return null;
  }
}
