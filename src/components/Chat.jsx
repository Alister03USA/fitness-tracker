import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function Chat({ session }) {
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");

  // New States for Image Handling
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  const [activeReactionMsg, setActiveReactionMsg] = useState(null);

  const messagesEndRef = useRef(null);
  const userId = session?.user?.id;

  const EMOJIS = ["👍", "❤️", "😂", "😮", "😢"];

  useEffect(() => {
    const fetchFriends = async () => {
      if (!userId) return;
      const { data } = await supabase
        .from("friendships")
        .select(
          "*, requester:profiles!friendships_requester_id_fkey(id, name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, name, avatar_url)",
        )
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted");

      if (data) {
        const friendsList = data.map((f) =>
          f.requester_id === userId ? f.addressee : f.requester,
        );
        setFriends(friendsList);
      }
    };
    fetchFriends();
  }, [userId]);

  const fetchMessages = useCallback(async () => {
    if (!activeChat || !userId) return;

    const { data } = await supabase
      .from("messages")
      .select("*, message_reactions(user_id, emoji)")
      .or(
        `and(sender_id.eq.${userId},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${userId})`,
      )
      .order("created_at", { ascending: true });

    setMessages(data || []);
    scrollToBottom();
  }, [activeChat, userId]);

  useEffect(() => {
    if (!activeChat) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat-updates`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => fetchMessages(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        () => fetchMessages(),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [activeChat, fetchMessages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Stage image instead of sending immediately
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setPendingImage(file);
    e.target.value = null; // Reset input so the same file can be selected again if canceled
  };

  // Send Message (Handles both Text and Staged Image)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !pendingImage) return;

    setUploading(true);
    let imageUrl = null;
    let content = newMessage.trim();

    try {
      // 1. Upload image if one is staged
      if (pendingImage) {
        const fileExt = pendingImage.name.split(".").pop();
        const filePath = `chat/${userId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, pendingImage, { upsert: true });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);
        imageUrl = data.publicUrl;

        if (!content) content = "📷 Sent an image"; // Fallback text if no caption is typed
      }

      // 2. Insert message record
      await supabase
        .from("messages")
        .insert([
          {
            sender_id: userId,
            receiver_id: activeChat.id,
            content: content,
            image_url: imageUrl,
          },
        ]);

      // 3. Trigger Notification
      await supabase.from("notifications").insert([
        {
          user_id: activeChat.id,
          actor_id: userId,
          type: "new_message",
          message: imageUrl
            ? "sent you a photo."
            : `sent you a message: "${content.substring(0, 20)}..."`,
        },
      ]);

      // 4. Reset form
      setNewMessage("");
      setPendingImage(null);
      scrollToBottom();
    } catch (err) {
      alert("Failed to send message: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleReaction = async (messageId, emoji) => {
    const existing = messages
      .find((m) => m.id === messageId)
      ?.message_reactions?.find(
        (r) => r.user_id === userId && r.emoji === emoji,
      );

    if (existing) {
      await supabase
        .from("message_reactions")
        .delete()
        .match({ message_id: messageId, user_id: userId, emoji: emoji });
    } else {
      await supabase
        .from("message_reactions")
        .insert([{ message_id: messageId, user_id: userId, emoji: emoji }]);
    }
    setActiveReactionMsg(null);
  };

  const filteredFriends = friends.filter((f) =>
    f.name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // --- VIEW: FULL SCREEN IMAGE MODAL ---
  if (fullScreenImage) {
    return (
      <div
        style={fullScreenOverlayStyle}
        onClick={() => setFullScreenImage(null)}
      >
        <button style={closeModalBtnStyle}>✖</button>
        <img
          src={fullScreenImage}
          alt="Full Screen"
          style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
        />
      </div>
    );
  }

  // --- VIEW: FRIEND LIST ---
  if (!activeChat) {
    return (
      <div style={{ padding: "15px", fontFamily: "sans-serif" }}>
        <h2>Messages</h2>
        <input
          type="text"
          placeholder="Search friends..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            borderRadius: "6px",
            border: "1px solid #ccc",
            boxSizing: "border-box",
          }}
        />
        {filteredFriends.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center" }}>
            No friends found.
          </p>
        ) : (
          filteredFriends.map((friend) => (
            <div
              key={friend.id}
              onClick={() => setActiveChat(friend)}
              style={friendCardStyle}
            >
              <img
                src={friend.avatar_url || "https://via.placeholder.com/40"}
                alt="Avatar"
                style={avatarStyle}
              />
              <strong>{friend.name || "User"}</strong>
            </div>
          ))
        )}
      </div>
    );
  }

  // --- VIEW: ACTIVE CHAT ---
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        fontFamily: "sans-serif",
      }}
    >
      {/* Chat Header */}
      <div style={chatHeaderStyle}>
        <button onClick={() => setActiveChat(null)} style={backBtnStyle}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <img
            src={activeChat.avatar_url || "https://via.placeholder.com/30"}
            alt="Avatar"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <strong>{activeChat.name}</strong>
        </div>
      </div>

      {/* Messages Window */}
      <div style={messagesWindowStyle}>
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          const reactionCounts =
            msg.message_reactions?.reduce((acc, curr) => {
              acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
              return acc;
            }, {}) || {};

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: isMe ? "flex-end" : "flex-start",
                marginBottom: "15px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  flexDirection: isMe ? "row-reverse" : "row",
                }}
              >
                <div style={isMe ? myMessageStyle : theirMessageStyle}>
                  {msg.image_url && (
                    <img
                      src={msg.image_url}
                      alt="Shared"
                      onClick={() => setFullScreenImage(msg.image_url)} // Open Full Screen
                      style={{
                        width: "100%",
                        maxWidth: "200px",
                        borderRadius: "8px",
                        marginBottom: "5px",
                        cursor: "pointer",
                      }}
                    />
                  )}
                  {msg.image_url &&
                  msg.content === "📷 Sent an image" ? null : (
                    <div>{msg.content}</div>
                  )}
                </div>

                <button
                  onClick={() =>
                    setActiveReactionMsg(
                      activeReactionMsg === msg.id ? null : msg.id,
                    )
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    opacity: 0.5,
                    fontSize: "16px",
                  }}
                >
                  ➕
                </button>
              </div>

              {activeReactionMsg === msg.id && (
                <div style={reactionPickerStyle}>
                  {EMOJIS.map((emoji) => (
                    <span
                      key={emoji}
                      onClick={() => handleReaction(msg.id, emoji)}
                      style={{ cursor: "pointer", fontSize: "18px" }}
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
              )}

              {Object.keys(reactionCounts).length > 0 && (
                <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                  {Object.entries(reactionCounts).map(([emoji, count]) => (
                    <span key={emoji} style={reactionBadgeStyle}>
                      {emoji} {count > 1 ? count : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending Image Preview Banner */}
      {pendingImage && (
        <div style={previewBannerStyle}>
          <img
            src={URL.createObjectURL(pendingImage)}
            alt="Preview"
            style={{ height: "40px", borderRadius: "4px" }}
          />
          <span
            style={{
              flex: 1,
              fontSize: "12px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {pendingImage.name}
          </span>
          <button
            type="button"
            onClick={() => setPendingImage(null)}
            style={cancelPreviewBtnStyle}
          >
            ✖
          </button>
        </div>
      )}

      {/* Input Area */}
      <form onSubmit={handleSendMessage} style={inputContainerStyle}>
        <label style={iconBtnStyle}>
          📸
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
        <label style={iconBtnStyle}>
          🖼️
          <input
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>

        <input
          type="text"
          placeholder="Type a caption or message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          style={inputFieldStyle}
          disabled={uploading}
        />
        <button
          type="submit"
          style={sendBtnStyle}
          disabled={uploading || (!newMessage.trim() && !pendingImage)}
        >
          {uploading ? "..." : "Send"}
        </button>
      </form>
    </div>
  );
}

// Inline Styles
const friendCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  padding: "12px",
  borderBottom: "1px solid #eee",
  cursor: "pointer",
  backgroundColor: "#fff",
  borderRadius: "8px",
  marginBottom: "8px",
};
const avatarStyle = {
  width: "45px",
  height: "45px",
  borderRadius: "50%",
  objectFit: "cover",
};
const chatHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "15px",
  padding: "12px 15px",
  backgroundColor: "#f8f9fa",
  borderBottom: "1px solid #ddd",
};
const backBtnStyle = {
  background: "none",
  border: "none",
  color: "#007bff",
  fontWeight: "bold",
  fontSize: "14px",
  cursor: "pointer",
  padding: "0",
};
const messagesWindowStyle = {
  flex: 1,
  padding: "15px",
  overflowY: "auto",
  backgroundColor: "#fff",
};
const myMessageStyle = {
  backgroundColor: "#007bff",
  color: "white",
  padding: "10px 15px",
  borderRadius: "18px 18px 0 18px",
  maxWidth: "80%",
  fontSize: "14px",
  wordWrap: "break-word",
};
const theirMessageStyle = {
  backgroundColor: "#f1f0f0",
  color: "#333",
  padding: "10px 15px",
  borderRadius: "18px 18px 18px 0",
  maxWidth: "80%",
  fontSize: "14px",
  wordWrap: "break-word",
};
const inputContainerStyle = {
  display: "flex",
  alignItems: "center",
  padding: "10px",
  borderTop: "1px solid #ddd",
  backgroundColor: "#f8f9fa",
  gap: "8px",
};
const inputFieldStyle = {
  flex: 1,
  padding: "10px",
  border: "1px solid #ccc",
  borderRadius: "20px",
  fontSize: "14px",
  outline: "none",
};
const iconBtnStyle = {
  fontSize: "20px",
  cursor: "pointer",
  padding: "5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const sendBtnStyle = {
  backgroundColor: "#007bff",
  color: "white",
  border: "none",
  borderRadius: "20px",
  padding: "10px 15px",
  cursor: "pointer",
  fontWeight: "bold",
};
const reactionPickerStyle = {
  backgroundColor: "#fff",
  border: "1px solid #ddd",
  borderRadius: "20px",
  padding: "5px 10px",
  marginTop: "5px",
  display: "flex",
  gap: "8px",
  boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
};
const reactionBadgeStyle = {
  backgroundColor: "#f0f0f0",
  borderRadius: "10px",
  padding: "2px 6px",
  fontSize: "12px",
  border: "1px solid #ddd",
};
const previewBannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 15px",
  backgroundColor: "#e9ecef",
  borderTop: "1px solid #ddd",
};
const cancelPreviewBtnStyle = {
  background: "none",
  border: "none",
  color: "#dc3545",
  fontWeight: "bold",
  cursor: "pointer",
};
const fullScreenOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.9)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexDirection: "column",
};
const closeModalBtnStyle = {
  position: "absolute",
  top: "20px",
  right: "20px",
  background: "none",
  color: "white",
  border: "none",
  fontSize: "30px",
  cursor: "pointer",
};
