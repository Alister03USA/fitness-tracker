import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";

export default function SocialFeed({ session }) {
  const [activeSubTab, setActiveSubTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState(null);

  // Search & Live Auto-Complete States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const [friendRequests, setFriendRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [commentInputs, setCommentInputs] = useState({});
  const userId = session?.user?.id;

  // 1. Live Auto-Search Users Effect (CORRECTED)
  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);

      // Search profiles by display name or email using ilike (case-insensitive)
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

  // Fetch Feed Posts
  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles (name, avatar_url),
        post_likes (user_id),
        post_comments (*, profiles (name, avatar_url))
      `)
      .order("created_at", { ascending: false });

    if (!error) setPosts(data || []);
  }, []);

  // Fetch Friends & Requests
  const fetchFriendData = useCallback(async () => {
    if (!userId) return;

    const { data: requests } = await supabase
      .from("friendships")
      .select("*, requester:profiles!friendships_requester_id_fkey(id, name, avatar_url)")
      .eq("addressee_id", userId)
      .eq("status", "pending");

    setFriendRequests(requests || []);

    const { data: friends } = await supabase
      .from("friendships")
      .select("*, requester:profiles!friendships_requester_id_fkey(name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(name, avatar_url)")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted");

    setFriendsList(friends || []);
  }, [userId]);

  // Fetch Notifications
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts, fetchFriendData, fetchNotifications, userId]);

  // Send Friend Request from Dropdown (CORRECTED)
  const handleSendRequestToUser = async (targetUser) => {
    const { error: friendErr } = await supabase.from("friendships").insert([
      { requester_id: userId, addressee_id: targetUser.id, status: "pending" },
    ]);

    if (friendErr) {
      alert("Request error: " + friendErr.message);
    } else {
      await supabase.from("notifications").insert([
        {
          user_id: targetUser.id,
          actor_id: userId,
          type: "friend_request",
          message: "sent you a friend request.",
        },
      ]);

      alert(`Friend request sent to ${targetUser.name || "user"}!`);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  // Create Post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!caption && !imageFile) return;

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

        const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
        imageUrl = data.publicUrl;
      }

      await supabase.from("posts").insert([{ user_id: userId, caption, image_url: imageUrl }]);
      setCaption("");
      setImageFile(null);
      fetchPosts();
    } catch (err) {
      alert("Post error: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  // Respond to Friend Request
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

  const handleToggleLike = async (post) => {
    const existingLike = post.post_likes?.find((l) => l.user_id === userId);

    if (existingLike) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      await supabase.from("post_likes").insert([{ post_id: post.id, user_id: userId }]);

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

    await supabase.from("post_comments").insert([{ post_id: postId, user_id: userId, comment_text: text }]);
    setCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    fetchPosts();
  };

  return (
    <div style={{ padding: "15px", fontFamily: "sans-serif" }}>
      {/* Navigation Bar */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "15px" }}>
        <button onClick={() => setActiveSubTab("feed")} style={subTabStyle(activeSubTab === "feed")}>
          📰 Feed
        </button>
        <button onClick={() => setActiveSubTab("friends")} style={subTabStyle(activeSubTab === "friends")}>
          👥 Friends ({friendRequests.length})
        </button>
        <button onClick={markNotificationsRead} style={subTabStyle(activeSubTab === "notifications")}>
          🔔 Alerts {unreadCount > 0 && <span style={badgeStyle}>{unreadCount}</span>}
        </button>
      </div>

      {/* --- FEED TAB --- */}
      {activeSubTab === "feed" && (
        <div>
          <div style={cardStyle}>
            <h4 style={{ margin: "0 0 10px 0" }}>Create Post</h4>
            <textarea
              placeholder="Share a workout victory or meal log..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{ width: "100%", height: "60px", marginBottom: "10px", padding: "8px", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} />
              <button onClick={handleCreatePost} disabled={uploading} style={primaryBtnStyle}>
                {uploading ? "Posting..." : "Post"}
              </button>
            </div>
          </div>

          {posts.map((post) => {
            const isLiked = post.post_likes?.some((l) => l.user_id === userId);
            return (
              <div key={post.id} style={cardStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <img
                    src={post.profiles?.avatar_url || "https://via.placeholder.com/40"}
                    alt="avatar"
                    style={{ width: "35px", height: "35px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <strong>{post.profiles?.name || "Fitness User"}</strong>
                </div>

                <p style={{ margin: "5px 0" }}>{post.caption}</p>

                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post media"
                    style={{ width: "100%", maxHeight: "300px", objectFit: "cover", borderRadius: "6px", margin: "10px 0" }}
                  />
                )}

                <div style={{ display: "flex", gap: "15px", alignItems: "center", margin: "10px 0" }}>
                  <button onClick={() => handleToggleLike(post)} style={likeBtnStyle(isLiked)}>
                    {isLiked ? "❤️ Liked" : "🤍 Like"} ({post.post_likes?.length || 0})
                  </button>
                  <span style={{ fontSize: "14px", color: "#666" }}>
                    💬 {post.post_comments?.length || 0} Comments
                  </span>
                </div>

                <div style={{ backgroundColor: "#f9f9f9", padding: "8px", borderRadius: "6px" }}>
                  {post.post_comments?.map((c) => (
                    <div key={c.id} style={{ fontSize: "13px", marginBottom: "4px" }}>
                      <strong>{c.profiles?.name || "User"}: </strong>
                      {c.comment_text}
                    </div>
                  ))}

                  <div style={{ display: "flex", gap: "5px", marginTop: "8px" }}>
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      value={commentInputs[post.id] || ""}
                      onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                      style={{ flex: 1, padding: "6px", fontSize: "12px" }}
                    />
                    <button onClick={() => handleAddComment(post.id)} style={{ padding: "6px 10px", fontSize: "12px" }}>
                      Send
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- FRIENDS TAB WITH LIVE SEARCH DROPDOWN --- */}
      {activeSubTab === "friends" && (
        <div>
          <div style={{ ...cardStyle, position: "relative" }}>
            <h4 style={{ margin: "0 0 10px 0" }}>Find Users & Add Friends</h4>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ width: "100%", padding: "10px", boxSizing: "border-box", fontSize: "14px" }}
            />

            {/* Live Dropdown Results */}
            {searchQuery.trim() !== "" && (
              <div style={dropdownStyle}>
                {isSearching ? (
                  <div style={{ padding: "10px", textAlign: "center", color: "#666" }}>Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: "10px", textAlign: "center", color: "#666" }}>No users found for "{searchQuery}"</div>
                ) : (
                  searchResults.map((user) => (
                    <div key={user.id} style={dropdownItemStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <img
                          src={user.avatar_url || "https://via.placeholder.com/30"}
                          alt="avatar"
                          style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                        />
                        <div>
                          <strong style={{ display: "block", fontSize: "14px" }}>{user.name || "User"}</strong>
                          <span style={{ fontSize: "11px", color: "#888" }}>{user.email || "No email"}</span>
                        </div>
                      </div>
                      <button onClick={() => handleSendRequestToUser(user)} style={smallPrimaryBtnStyle}>
                        Add Friend
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Pending Requests */}
          {friendRequests.length > 0 && (
            <div style={cardStyle}>
              <h4>Pending Requests ({friendRequests.length})</h4>
              {friendRequests.map((req) => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span><strong>{req.requester?.name || "A User"}</strong> sent a friend request.</span>
                  <div style={{ display: "flex", gap: "5px" }}>
                    <button onClick={() => handleRespondRequest(req, "accepted")} style={{ backgroundColor: "#28a745", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                      Accept
                    </button>
                    <button onClick={() => handleRespondRequest(req, "declined")} style={{ backgroundColor: "#dc3545", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Friends List */}
          <div style={cardStyle}>
            <h4>My Friends ({friendsList.length})</h4>
            {friendsList.length === 0 ? (
              <p style={{ color: "#666" }}>No friends added yet.</p>
            ) : (
              friendsList.map((f) => {
                const friendProfile = f.requester_id === userId ? f.addressee : f.requester;
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0", borderBottom: "1px solid #eee" }}>
                    <img
                      src={friendProfile?.avatar_url || "https://via.placeholder.com/30"}
                      alt="avatar"
                      style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                    />
                    <strong>{friendProfile?.name || "Friend"}</strong>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* --- NOTIFICATIONS TAB --- */}
      {activeSubTab === "notifications" && (
        <div>
          <div style={cardStyle}>
            <h4 style={{ margin: "0 0 10px 0" }}>Activity Notifications</h4>
            {notifications.length === 0 ? (
              <p style={{ color: "#666" }}>No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid #eee" }}>
                  <img
                    src={n.actor?.avatar_url || "https://via.placeholder.com/30"}
                    alt="avatar"
                    style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <strong>{n.actor?.name || "Someone"}</strong> {n.message}
                    <div style={{ fontSize: "11px", color: "#999" }}>
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Inline Styles
const cardStyle = { border: "1px solid #ddd", borderRadius: "8px", padding: "12px", marginBottom: "15px", backgroundColor: "#fff" };
const subTabStyle = (active) => ({ flex: 1, padding: "8px", border: "none", backgroundColor: active ? "#007bff" : "#eee", color: active ? "#fff" : "#333", borderRadius: "4px", fontWeight: "bold", cursor: "pointer", position: "relative" });
const primaryBtnStyle = { backgroundColor: "#007bff", color: "#fff", border: "none", padding: "8px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" };
const smallPrimaryBtnStyle = { backgroundColor: "#007bff", color: "#fff", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", fontSize: "12px" };
const likeBtnStyle = (isLiked) => ({ border: "none", background: "none", cursor: "pointer", fontWeight: "bold", color: isLiked ? "#e74c3c" : "#555" });
const badgeStyle = { backgroundColor: "#dc3545", color: "white", borderRadius: "50%", padding: "2px 6px", fontSize: "10px", marginLeft: "5px" };

// Auto-Complete Dropdown Styles
const dropdownStyle = { border: "1px solid #007bff", borderRadius: "6px", backgroundColor: "#fff", marginTop: "5px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" };
const dropdownItemStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee" };