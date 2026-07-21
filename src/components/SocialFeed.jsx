import React, { useState, useEffect, useCallback } from "react";
import {
  Newspaper,
  Users,
  Bell,
  Heart,
  MessageCircle,
  Trash2,
  UserPlus,
  Check,
  X,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import { showToast } from "../lib/toast";
import { confirmDialog } from "../lib/confirmDialog";
import Card from "./ui/Card";
import Button from "./ui/Button";

const SUB_TABS = [
  { key: "feed", label: "Feed", icon: Newspaper },
  { key: "friends", label: "Friends", icon: Users },
  { key: "notifications", label: "Alerts", icon: Bell },
];

const POST_PROMPTS = [
  "Finished a solid workout today.",
  "Logged a meal that kept me energized.",
  "Trying to stay consistent this week.",
];

export default function SocialFeed({ session, jumpToNotifications }) {
  const [activeSubTab, setActiveSubTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [pendingRequestIds, setPendingRequestIds] = useState(new Set());

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [commentInputs, setCommentInputs] = useState({});
  const userId = session?.user?.id;

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, avatar_url")
        .neq("id", userId)
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
        .limit(5);

      if (!error) {
        setSearchResults(data || []);
      } else {
        console.error("Search Error:", error);
      }
      setIsSearching(false);
    };

    const timer = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, userId]);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(
        `
        *,
        profiles (name, avatar_url),
        post_likes (user_id),
        post_comments (*, profiles (name, avatar_url))
      `,
      )
      .order("created_at", { ascending: false });

    if (!error) setPosts(data || []);
  }, []);

  const fetchFriendData = useCallback(async () => {
    if (!userId) return;

    const { data: requests } = await supabase
      .from("friendships")
      .select(
        "*, requester:profiles!friendships_requester_id_fkey(id, name, avatar_url)",
      )
      .eq("addressee_id", userId)
      .eq("status", "pending");

    setFriendRequests(requests || []);

    const { data: friends } = await supabase
      .from("friendships")
      .select(
        "*, requester:profiles!friendships_requester_id_fkey(name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(name, avatar_url)",
      )
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted");

    setFriendsList(friends || []);
  }, [userId]);

  const fetchPendingRequestIds = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("friendships")
      .select("addressee_id")
      .eq("requester_id", userId)
      .eq("status", "pending");

    setPendingRequestIds(new Set((data || []).map((r) => r.addressee_id)));
  }, [userId]);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from("notifications")
      .select("*, actor:profiles!notifications_actor_id_fkey(name, avatar_url)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  }, [userId]);

  useEffect(() => {
    fetchPosts();
    fetchFriendData();
    fetchNotifications();
    fetchPendingRequestIds();

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    fetchPosts,
    fetchFriendData,
    fetchNotifications,
    fetchPendingRequestIds,
    userId,
  ]);

  // Realtime friendships — covers both directions: someone responding to a
  // request I sent (updates pendingRequestIds / friendsList live), and
  // someone sending *me* a new request (updates the Pending list live).
  // postgres_changes filters only support one column condition each, so
  // this needs two separate listeners rather than one OR'd filter.
  useEffect(() => {
    if (!userId) return;

    const refetchFriendState = () => {
      fetchFriendData();
      fetchPendingRequestIds();
    };

    const channel = supabase
      .channel("realtime-friendships")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `requester_id=eq.${userId}`,
        },
        refetchFriendState,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`,
        },
        refetchFriendState,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchFriendData, fetchPendingRequestIds]);

  const handleSendRequestToUser = async (targetUser) => {
    const { error: friendErr } = await supabase.from("friendships").insert([
      {
        requester_id: userId,
        addressee_id: targetUser.id,
        status: "pending",
      },
    ]);

    if (friendErr) {
      showToast("Request error: " + friendErr.message, "error");
    } else {
      await supabase.from("notifications").insert([
        {
          user_id: targetUser.id,
          actor_id: userId,
          type: "friend_request",
          message: "sent you a friend request.",
        },
      ]);

      // Update this row's state instantly instead of closing the whole
      // search dropdown — the recipient's bell/toast (App.jsx) already
      // fires in realtime off the notifications insert above.
      setPendingRequestIds((prev) => new Set(prev).add(targetUser.id));
      showToast(
        `Friend request sent to ${targetUser.name || "user"}!`,
        "success",
      );
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    const cleanCaption = caption.trim();
    if (!cleanCaption && !imageFile) return;

    setUploading(true);
    let imageUrl = "";

    try {
      if (imageFile) {
        const fileExt = imageFile.name.split(".").pop();
        const filePath = `feed/${userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, imageFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
        imageUrl = data.publicUrl;
      }

      await supabase
        .from("posts")
        .insert([
          { user_id: userId, caption: cleanCaption, image_url: imageUrl },
        ]);
      setCaption("");
      setImageFile(null);
      fetchPosts();
    } catch (err) {
      showToast("Post error: " + err.message, "error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    const confirmed = await confirmDialog({
      title: "Delete post?",
      message: "This post and its comments/likes will be permanently removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;

    const { error } = await supabase.from("posts").delete().eq("id", postId);

    if (error) {
      showToast("Error deleting post: " + error.message, "error");
    } else {
      fetchPosts();
    }
  };

  const handleRespondRequest = async (request, newStatus) => {
    await supabase
      .from("friendships")
      .update({ status: newStatus })
      .eq("id", request.id);

    if (newStatus === "accepted") {
      await supabase.from("notifications").insert([
        {
          user_id: request.requester_id,
          actor_id: userId,
          type: "request_accepted",
          message: "accepted your friend request!",
        },
      ]);
    }

    fetchFriendData();
    fetchNotifications();
  };

  const markNotificationsRead = async () => {
    setActiveSubTab("notifications");
    if (unreadCount > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId);

      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (jumpToNotifications) {
      markNotificationsRead();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpToNotifications]);

  const handleToggleLike = async (post) => {
    const existingLike = post.post_likes?.find((l) => l.user_id === userId);

    if (existingLike) {
      await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", userId);
    } else {
      await supabase
        .from("post_likes")
        .insert([{ post_id: post.id, user_id: userId }]);

      if (post.user_id !== userId) {
        await supabase.from("notifications").insert([
          {
            user_id: post.user_id,
            actor_id: userId,
            type: "post_like",
            message: "liked your post.",
          },
        ]);
      }
    }
    fetchPosts();
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text) return;

    await supabase
      .from("post_comments")
      .insert([{ post_id: postId, user_id: userId, comment_text: text }]);
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    fetchPosts();
  };

  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Sub-tab bar — icon+label pills matching the main nav language */}
      <div style={{ display: "flex", gap: "8px" }}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeSubTab === key;
          const onClick =
            key === "notifications"
              ? markNotificationsRead
              : () => setActiveSubTab(key);
          return (
            <button key={key} onClick={onClick} style={subTabStyle(isActive)}>
              <Icon size={15} />
              {label}
              {key === "friends" && friendRequests.length > 0 && (
                <span style={badgeStyle}>{friendRequests.length}</span>
              )}
              {key === "notifications" && unreadCount > 0 && (
                <span style={badgeStyle}>{unreadCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* --- FEED TAB --- */}
      {activeSubTab === "feed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Card>
            <div style={sectionHeaderStyle}>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px" }}>Create post</h4>
                <p style={sectionHintStyle}>
                  Share progress, ideas, or check-ins with your friends.
                </p>
              </div>
              <span style={counterStyle}>{caption.length}/240</span>
            </div>
            <div style={promptRowStyle}>
              {POST_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setCaption(prompt)}
                  style={promptChipStyle}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Share a workout, meal idea, or consistency check-in..."
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 240))}
              style={textareaStyle}
              maxLength={240}
            />
            {imageFile && (
              <div style={selectedFileStyle}>
                <span>{imageFile.name}</span>
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  style={clearFileBtnStyle}
                  aria-label="Remove selected image"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "10px",
              }}
            >
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files[0])}
                style={{ fontSize: "12px", maxWidth: "150px" }}
              />
              <Button
                size="sm"
                onClick={handleCreatePost}
                disabled={uploading || (!caption.trim() && !imageFile)}
              >
                {uploading ? "Posting..." : "Post"}
              </Button>
            </div>
          </Card>

          {posts.length === 0 && (
            <Card style={{ textAlign: "center" }}>
              <Newspaper
                size={26}
                color="var(--ink-soft)"
                style={{ marginBottom: "8px" }}
              />
              <h4 style={{ margin: "0 0 6px", fontSize: "14px" }}>
                Your feed is quiet
              </h4>
              <p
                style={{
                  margin: 0,
                  color: "var(--ink-soft)",
                  fontSize: "13px",
                }}
              >
                Add friends or share a check-in to start the activity feed.
              </p>
            </Card>
          )}

          {posts.map((post) => {
            const isLiked = post.post_likes?.some((l) => l.user_id === userId);
            return (
              <Card key={post.id}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <img
                      src={
                        post.profiles?.avatar_url ||
                        "https://via.placeholder.com/40"
                      }
                      alt="avatar"
                      style={{
                        width: "35px",
                        height: "35px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <strong style={{ fontSize: "14px" }}>
                      {post.profiles?.name || "Fitness User"}
                    </strong>
                    <span style={timestampStyle}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {post.user_id === userId && (
                    <button
                      onClick={() => handleDeletePost(post.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--danger)",
                        display: "flex",
                      }}
                      title="Delete Post"
                      aria-label="Delete post"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {post.caption && (
                  <p style={{ margin: "5px 0", fontSize: "14px" }}>
                    {post.caption}
                  </p>
                )}

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post media"
                    style={{
                      width: "100%",
                      maxHeight: "300px",
                      objectFit: "cover",
                      borderRadius: "var(--radius-md)",
                      margin: "10px 0",
                    }}
                  />
                )}

                <div
                  style={{
                    display: "flex",
                    gap: "18px",
                    alignItems: "center",
                    margin: "10px 0",
                  }}
                >
                  <button
                    onClick={() => handleToggleLike(post)}
                    style={likeBtnStyle(isLiked)}
                  >
                    <Heart size={16} fill={isLiked ? "var(--ember)" : "none"} />
                    {post.post_likes?.length || 0}
                  </button>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--ink-soft)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <MessageCircle size={15} />
                    {post.post_comments?.length || 0}
                  </span>
                </div>

                <div
                  style={{
                    backgroundColor: "var(--paper)",
                    padding: "10px",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  {post.post_comments?.map((c) => (
                    <div
                      key={c.id}
                      style={{ fontSize: "13px", marginBottom: "4px" }}
                    >
                      <strong>{c.profiles?.name || "User"}: </strong>
                      {c.comment_text}
                    </div>
                  ))}

                  <div
                    style={{ display: "flex", gap: "6px", marginTop: "8px" }}
                  >
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentInputs[post.id] || ""}
                      onChange={(e) =>
                        setCommentInputs({
                          ...commentInputs,
                          [post.id]: e.target.value,
                        })
                      }
                      style={commentInputStyle}
                    />
                    <Button size="sm" onClick={() => handleAddComment(post.id)}>
                      Send
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* --- FRIENDS TAB --- */}
      {activeSubTab === "friends" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <Card style={{ position: "relative" }}>
            <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>
              Find users & add friends
            </h4>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />

            {searchQuery.trim() !== "" && (
              <div style={dropdownStyle}>
                {isSearching ? (
                  <div
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "var(--ink-soft)",
                      fontSize: "13px",
                    }}
                  >
                    Searching...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "var(--ink-soft)",
                      fontSize: "13px",
                    }}
                  >
                    No users found for "{searchQuery}"
                  </div>
                ) : (
                  searchResults.map((user) => {
                    const isPending = pendingRequestIds.has(user.id);
                    return (
                      <div
                        key={user.id}
                        style={
                          isPending
                            ? dropdownItemPendingStyle
                            : dropdownItemStyle
                        }
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                          }}
                        >
                          <img
                            src={
                              user.avatar_url ||
                              "https://via.placeholder.com/30"
                            }
                            alt="avatar"
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                          <div>
                            <strong
                              style={{ display: "block", fontSize: "14px" }}
                            >
                              {user.name || "User"}
                            </strong>
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--ink-soft)",
                              }}
                            >
                              {user.email || "No email"}
                            </span>
                          </div>
                        </div>
                        {isPending ? (
                          <span style={requestedBadgeStyle}>
                            <Check size={13} />
                            Requested
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSendRequestToUser(user)}
                          >
                            <UserPlus size={13} />
                            Add
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </Card>

          {friendRequests.length > 0 && (
            <Card>
              <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>
                Pending requests ({friendRequests.length})
              </h4>
              {friendRequests.map((req) => (
                <div
                  key={req.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <span style={{ fontSize: "13px" }}>
                    <strong>{req.requester?.name || "A User"}</strong> sent a
                    friend request.
                  </span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button
                      onClick={() => handleRespondRequest(req, "accepted")}
                      style={roundIconBtnStyle("var(--sprout)")}
                      aria-label="Accept"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => handleRespondRequest(req, "declined")}
                      style={roundIconBtnStyle("var(--danger)")}
                      aria-label="Decline"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card>
            <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>
              My friends ({friendsList.length})
            </h4>
            {friendsList.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: "13px" }}>
                No friends added yet.
              </p>
            ) : (
              friendsList.map((f) => {
                const friendProfile =
                  f.requester_id === userId ? f.addressee : f.requester;
                return (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "8px 0",
                      borderBottom: "1px solid var(--line)",
                    }}
                  >
                    <img
                      src={
                        friendProfile?.avatar_url ||
                        "https://via.placeholder.com/30"
                      }
                      alt="avatar"
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <strong style={{ fontSize: "14px" }}>
                      {friendProfile?.name || "Friend"}
                    </strong>
                  </div>
                );
              })
            )}
          </Card>
        </div>
      )}

      {/* --- NOTIFICATIONS TAB --- */}
      {activeSubTab === "notifications" && (
        <Card>
          <h4 style={{ marginBottom: "10px", fontSize: "14px" }}>
            Activity notifications
          </h4>
          {notifications.length === 0 ? (
            <p style={{ color: "var(--ink-soft)", fontSize: "13px" }}>
              No notifications yet.
            </p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <img
                  src={n.actor?.avatar_url || "https://via.placeholder.com/30"}
                  alt="avatar"
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "50%",
                    objectFit: "cover",
                  }}
                />
                <div>
                  <span style={{ fontSize: "13px" }}>
                    <strong>{n.actor?.name || "Someone"}</strong> {n.message}
                  </span>
                  <div style={{ fontSize: "11px", color: "var(--ink-faint)" }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>
      )}
    </div>
  );
}

// Styles
const subTabStyle = (active) => ({
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  padding: "9px",
  border: active ? "1px solid var(--ember)" : "1px solid var(--line)",
  backgroundColor: active ? "var(--ember-soft)" : "var(--card)",
  color: active ? "var(--ember)" : "var(--ink-soft)",
  borderRadius: "var(--radius-md)",
  fontWeight: 600,
  fontSize: "12px",
  cursor: "pointer",
  position: "relative",
});
const badgeStyle = {
  backgroundColor: "var(--ember)",
  color: "white",
  borderRadius: "50%",
  minWidth: "16px",
  height: "16px",
  padding: "0 3px",
  fontSize: "10px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  marginLeft: "2px",
};
const sectionHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "12px",
  marginBottom: "10px",
};
const sectionHintStyle = {
  margin: "4px 0 0",
  color: "var(--ink-soft)",
  fontSize: "12px",
  lineHeight: 1.35,
};
const counterStyle = {
  color: "var(--ink-soft)",
  fontSize: "11px",
  whiteSpace: "nowrap",
};
const promptRowStyle = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  paddingBottom: "8px",
  marginBottom: "8px",
};
const promptChipStyle = {
  border: "1px solid var(--line)",
  backgroundColor: "var(--paper)",
  color: "var(--ink)",
  borderRadius: "var(--radius-full)",
  padding: "7px 10px",
  fontSize: "12px",
  whiteSpace: "nowrap",
  cursor: "pointer",
};
const selectedFileStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  marginTop: "8px",
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-sm)",
  backgroundColor: "var(--paper)",
  color: "var(--ink-soft)",
  fontSize: "12px",
};
const clearFileBtnStyle = {
  display: "flex",
  alignItems: "center",
  border: "none",
  background: "transparent",
  color: "var(--danger)",
  cursor: "pointer",
};
const timestampStyle = {
  display: "block",
  marginTop: "2px",
  color: "var(--ink-faint)",
  fontSize: "11px",
  fontWeight: 400,
};
const likeBtnStyle = (isLiked) => ({
  border: "none",
  background: "none",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "13px",
  color: isLiked ? "var(--ember)" : "var(--ink-soft)",
  display: "flex",
  alignItems: "center",
  gap: "6px",
});
const roundIconBtnStyle = (color) => ({
  width: "30px",
  height: "30px",
  borderRadius: "50%",
  border: "none",
  backgroundColor: color,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});
const textareaStyle = {
  width: "100%",
  height: "60px",
  padding: "10px",
  boxSizing: "border-box",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  fontSize: "14px",
  fontFamily: "var(--font-body)",
  resize: "vertical",
};
const commentInputStyle = {
  flex: 1,
  padding: "8px 10px",
  fontSize: "12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
};
const searchInputStyle = {
  width: "100%",
  padding: "10px 12px",
  boxSizing: "border-box",
  fontSize: "14px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
};
const dropdownStyle = {
  border: "1px solid var(--ember)",
  borderRadius: "var(--radius-md)",
  backgroundColor: "var(--card)",
  marginTop: "8px",
  boxShadow: "var(--shadow-press)",
  overflow: "hidden",
};
const dropdownItemStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  borderBottom: "1px solid var(--line)",
};

const dropdownItemPendingStyle = {
  ...dropdownItemStyle,
  backgroundColor: "var(--sprout-soft)",
};

const requestedBadgeStyle = {
  display: "flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--sprout)",
  padding: "8px 12px",
};
