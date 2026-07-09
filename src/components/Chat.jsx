import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  Send,
  X,
  Trash2,
  Plus,
  Users,
  MessageCircle,
  Shield,
  Globe,
  Lock,
  Settings,
  Check,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { supabase } from "../supabaseClient";
import Card from "./ui/Card";
import Button from "./ui/Button";

export default function Chat({ session }) {
  const [activeTab, setActiveTab] = useState("direct");
  const userId = session?.user?.id;
  const messagesEndRef = useRef(null);

  // --- Shared Chat States ---
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const EMOJIS = ["👍", "❤️", "😂", "😮", "💪"];

  // --- Direct Chat States ---
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);

  // --- Group Chat States ---
  const [myGroups, setMyGroups] = useState([]);
  const [discoverGroups, setDiscoverGroups] = useState([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupMessages, setGroupMessages] = useState([]);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  // Group Admin States
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupRequests, setGroupRequests] = useState([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [isPrivateGroup, setIsPrivateGroup] = useState(false);

  // ==========================================
  // DATA FETCHING
  // ==========================================

  const fetchFriends = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("friendships")
      .select(
        "*, requester:profiles!friendships_requester_id_fkey(id, name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, name, avatar_url)",
      )
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
      .eq("status", "accepted");
    if (data) {
      setFriends(
        data.map((f) =>
          f.requester_id === userId ? f.addressee : f.requester,
        ),
      );
    }
  }, [userId]);

  const fetchGroups = useCallback(async () => {
    if (!userId) return;

    const { data: memberData } = await supabase
      .from("group_members")
      .select("group_id, status, groups(*)")
      .eq("user_id", userId);

    const joined =
      memberData?.filter((m) => m.status === "approved").map((m) => m.groups) ||
      [];
    const pendingIds =
      memberData
        ?.filter((m) => m.status === "pending")
        .map((m) => m.group_id) || [];
    setMyGroups(joined);

    let query = supabase.from("groups").select("*");
    if (groupSearchQuery) {
      query = query.ilike("name", `%${groupSearchQuery}%`);
    }
    const { data: allGroups } = await query.limit(20);

    if (allGroups) {
      const joinedIds = joined.map((g) => g.id);
      const filtered = allGroups.filter((g) => !joinedIds.includes(g.id));
      setDiscoverGroups(
        filtered.map((g) => ({
          ...g,
          isPending: pendingIds.includes(g.id),
        })),
      );
    }
  }, [userId, groupSearchQuery]);

  useEffect(() => {
    fetchFriends();
    fetchGroups();
  }, [fetchFriends, fetchGroups]);

  const fetchMessages = useCallback(async () => {
    if (activeChat) {
      const { data } = await supabase
        .from("messages")
        .select("*, message_reactions(user_id, emoji)")
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${userId})`,
        )
        .order("created_at", { ascending: true });
      setMessages(data || []);
      scrollToBottom();
    } else if (activeGroup) {
      const { data } = await supabase
        .from("group_messages")
        .select(
          "*, profiles(name, avatar_url), group_message_reactions(user_id, emoji)",
        )
        .eq("group_id", activeGroup.id)
        .order("created_at", { ascending: true });
      setGroupMessages(data || []);
      scrollToBottom();
    }
  }, [activeChat, activeGroup, userId]);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel(`chat-sync`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        fetchMessages,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        fetchMessages,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_messages" },
        fetchMessages,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_message_reactions" },
        fetchMessages,
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchMessages]);

  const scrollToBottom = () => {
    setTimeout(
      () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      100,
    );
  };

  // ==========================================
  // GROUP MANAGEMENT
  // ==========================================

  const fetchGroupAdminData = async () => {
    if (!activeGroup) return;

    const { data: mems } = await supabase
      .from("group_members")
      .select("*, profiles(name, avatar_url)")
      .eq("group_id", activeGroup.id)
      .eq("status", "approved");
    setGroupMembers(mems || []);

    if (activeGroup.creator_id === userId) {
      const { data: reqs } = await supabase
        .from("group_members")
        .select("*, profiles(name, avatar_url)")
        .eq("group_id", activeGroup.id)
        .eq("status", "pending");
      setGroupRequests(reqs || []);
    }
  };

  useEffect(() => {
    if (showGroupInfo && activeGroup) {
      fetchGroupAdminData();
    }
  }, [showGroupInfo, activeGroup]);

  // Group Settings: Upload Avatar
  const handleGroupAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeGroup || activeGroup.creator_id !== userId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `groups/${activeGroup.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await supabase
        .from("groups")
        .update({ avatar_url: data.publicUrl })
        .eq("id", activeGroup.id);
      setActiveGroup({ ...activeGroup, avatar_url: data.publicUrl });
      fetchGroups();
    } catch (error) {
      alert("Failed to upload group photo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const { data: group, error } = await supabase
      .from("groups")
      .insert([
        {
          name: newGroupName,
          description: newGroupDesc,
          is_private: isPrivateGroup,
          creator_id: userId,
        },
      ])
      .select()
      .single();

    if (!error && group) {
      await supabase.from("group_members").insert([
        {
          group_id: group.id,
          user_id: userId,
          role: "admin",
          status: "approved",
        },
      ]);
      setShowCreateGroup(false);
      setNewGroupName("");
      setNewGroupDesc("");
      fetchGroups();
      setActiveGroup(group);
    }
  };

  const handleJoinGroup = async (group) => {
    const status = group.is_private ? "pending" : "approved";
    const { error } = await supabase
      .from("group_members")
      .insert([{ group_id: group.id, user_id: userId, status: status }]);

    if (!error) {
      if (group.is_private) {
        // Notify Admin
        await supabase.from("notifications").insert([
          {
            user_id: group.creator_id,
            actor_id: userId,
            type: "group_request",
            message: `requested to join your group "${group.name}".`,
          },
        ]);
        alert("Join request sent to admin!");
      } else {
        // Notify Existing Members (New user joined public group)
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", group.id)
          .eq("status", "approved")
          .neq("user_id", userId);
        if (members && members.length > 0) {
          const notifs = members.map((m) => ({
            user_id: m.user_id,
            actor_id: userId,
            type: "group_joined",
            message: `joined the group "${group.name}".`,
          }));
          await supabase.from("notifications").insert(notifs);
        }
        alert("Joined group successfully!");
      }
      fetchGroups();
    }
  };

  const handleRespondGroupRequest = async (req, isApproved) => {
    if (isApproved) {
      await supabase
        .from("group_members")
        .update({ status: "approved" })
        .eq("id", req.id);

      // Notify the requester
      await supabase.from("notifications").insert([
        {
          user_id: req.user_id,
          actor_id: userId,
          type: "group_accepted",
          message: `approved your request to join "${activeGroup.name}".`,
        },
      ]);

      // Notify other members
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", activeGroup.id)
        .eq("status", "approved")
        .neq("user_id", req.user_id);
      if (members && members.length > 0) {
        const memberNotifs = members.map((m) => ({
          user_id: m.user_id,
          actor_id: req.user_id,
          type: "group_joined",
          message: `joined the group "${activeGroup.name}".`,
        }));
        await supabase.from("notifications").insert(memberNotifs);
      }
    } else {
      await supabase.from("group_members").delete().eq("id", req.id);
      await supabase.from("notifications").insert([
        {
          user_id: req.user_id,
          actor_id: userId,
          type: "group_declined",
          message: `declined your request to join "${activeGroup.name}".`,
        },
      ]);
    }
    fetchGroupAdminData();
  };

  const handleKickMember = async (member) => {
    if (!window.confirm(`Kick ${member.profiles.name} from the group?`)) return;
    await supabase.from("group_members").delete().eq("id", member.id);
    fetchGroupAdminData();
  };

  const handleAddFriendToGroup = async (friendId, friendName) => {
    const { error } = await supabase.from("group_members").insert([
      {
        group_id: activeGroup.id,
        user_id: friendId,
        status: "approved",
      },
    ]);

    if (!error) {
      // Notify the friend
      await supabase.from("notifications").insert([
        {
          user_id: friendId,
          actor_id: userId,
          type: "group_added",
          message: `added you to the group "${activeGroup.name}".`,
        },
      ]);

      // Notify the group
      const { data: members } = await supabase
        .from("group_members")
        .select("user_id")
        .eq("group_id", activeGroup.id)
        .eq("status", "approved")
        .neq("user_id", friendId);
      if (members && members.length > 0) {
        const memberNotifs = members.map((m) => ({
          user_id: m.user_id,
          actor_id: friendId,
          type: "group_joined",
          message: `was added to the group "${activeGroup.name}".`,
        }));
        await supabase.from("notifications").insert(memberNotifs);
      }
      alert(`${friendName} added to the group!`);
      fetchGroupAdminData();
    } else {
      alert("They might already be in the group or invited.");
    }
  };

  // ==========================================
  // SENDING MESSAGES & REACTIONS
  // ==========================================

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) setPendingImage(file);
    e.target.value = null;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !pendingImage) return;

    setUploading(true);
    let imageUrl = null;
    let content = newMessage.trim();

    try {
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
        if (!content) content = "📷 Sent an image";
      }

      if (activeChat) {
        // Send Direct Message
        await supabase
          .from("messages")
          .insert([
            {
              sender_id: userId,
              receiver_id: activeChat.id,
              content,
              image_url: imageUrl,
            },
          ]);
        await supabase.from("notifications").insert([
          {
            user_id: activeChat.id,
            actor_id: userId,
            type: "new_message",
            message: imageUrl
              ? "sent you a photo."
              : `sent a message: "${content.substring(0, 20)}..."`,
          },
        ]);
      } else if (activeGroup) {
        // Send Group Message
        await supabase
          .from("group_messages")
          .insert([
            {
              group_id: activeGroup.id,
              sender_id: userId,
              content,
              image_url: imageUrl,
            },
          ]);

        // Notify Group Members
        const { data: members } = await supabase
          .from("group_members")
          .select("user_id")
          .eq("group_id", activeGroup.id)
          .eq("status", "approved")
          .neq("user_id", userId);
        if (members && members.length > 0) {
          const notifs = members.map((m) => ({
            user_id: m.user_id,
            actor_id: userId,
            type: "new_group_message",
            message: imageUrl
              ? `sent a photo to "${activeGroup.name}".`
              : `sent a message to "${activeGroup.name}": "${content.substring(0, 20)}..."`,
          }));
          await supabase.from("notifications").insert(notifs);
        }
      }

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
    const table = activeChat ? "message_reactions" : "group_message_reactions";
    const targetMsgs = activeChat ? messages : groupMessages;

    const existing =
      targetMsgs
        .find((m) => m.id === messageId)
        ?.message_reactions?.find(
          (r) => r.user_id === userId && r.emoji === emoji,
        ) ||
      targetMsgs
        .find((m) => m.id === messageId)
        ?.group_message_reactions?.find(
          (r) => r.user_id === userId && r.emoji === emoji,
        );

    if (existing) {
      await supabase
        .from(table)
        .delete()
        .match({ message_id: messageId, user_id: userId, emoji: emoji });
    } else {
      await supabase
        .from(table)
        .insert([{ message_id: messageId, user_id: userId, emoji: emoji }]);
    }
    setActiveReactionMsg(null);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;
    const table = activeChat ? "messages" : "group_messages";
    await supabase.from(table).delete().eq("id", messageId);
  };

  // ==========================================
  // RENDER
  // ==========================================

  if (fullScreenImage) {
    return (
      <div
        style={fullScreenOverlayStyle}
        onClick={() => setFullScreenImage(null)}
      >
        <button style={closeModalBtnStyle} aria-label="Close">
          <X size={26} />
        </button>
        <img
          src={fullScreenImage}
          alt="Full Screen"
          style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }}
        />
      </div>
    );
  }

  // --- VIEW: CHAT INTERFACE (Direct or Group) ---
  if (activeChat || activeGroup) {
    const isGroup = !!activeGroup;
    const currentMessages = isGroup ? groupMessages : messages;
    const targetName = isGroup ? activeGroup.name : activeChat.name;
    const targetAvatar = isGroup
      ? activeGroup.avatar_url || "https://via.placeholder.com/30"
      : activeChat.avatar_url || "https://via.placeholder.com/30";
    const isGroupAdmin = isGroup && activeGroup.creator_id === userId;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 130px)",
        }}
      >
        <div style={chatHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={() => {
                setActiveChat(null);
                setActiveGroup(null);
                setShowGroupInfo(false);
              }}
              style={backBtnStyle}
            >
              <ArrowLeft size={18} />
            </button>
            <img
              src={targetAvatar}
              alt="Avatar"
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                objectFit: "cover",
                border: isGroup ? "2px solid var(--plum)" : "none",
              }}
            />
            <div>
              <strong
                style={{
                  fontSize: "14px",
                  display: "block",
                  color: "var(--ink)",
                }}
              >
                {targetName}
              </strong>
              {isGroup && (
                <span style={{ fontSize: "11px", color: "var(--ink-soft)" }}>
                  {activeGroup.is_private ? "Private Group" : "Public Group"}
                </span>
              )}
            </div>
          </div>
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(!showGroupInfo)}
              style={iconGhostBtnStyle}
            >
              <Settings size={18} />
            </button>
          )}
        </div>

        {/* Group Info Modal/Panel */}
        {showGroupInfo && isGroup && (
          <div
            style={{
              padding: "16px",
              backgroundColor: "var(--paper)",
              borderBottom: "1px solid var(--line)",
              maxHeight: "50%",
              overflowY: "auto",
            }}
          >
            {/* Editable Group Avatar Area */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ position: "relative" }}>
                <img
                  src={
                    activeGroup.avatar_url || "https://via.placeholder.com/60"
                  }
                  alt="Group Icon"
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--plum-soft)",
                  }}
                />
                {isGroupAdmin && (
                  <label style={uploadAvatarOverlayStyle}>
                    <Camera size={14} color="white" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleGroupAvatarUpload}
                      disabled={uploading}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
              <div>
                <h3 style={{ fontSize: "16px", color: "var(--ink)" }}>
                  {activeGroup.name}
                </h3>
                <p style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                  {activeGroup.description || "No description provided."}
                </p>
              </div>
            </div>

            {/* Admin Controls */}
            {isGroupAdmin && (
              <>
                {groupRequests.length > 0 && (
                  <div style={{ marginBottom: "16px" }}>
                    <h4
                      style={{
                        fontSize: "13px",
                        color: "var(--ink-soft)",
                        marginBottom: "8px",
                      }}
                    >
                      Pending Requests
                    </h4>
                    {groupRequests.map((req) => (
                      <div
                        key={req.id}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "8px",
                          padding: "8px",
                          backgroundColor: "var(--card)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--line)",
                        }}
                      >
                        <span style={{ fontSize: "13px", color: "var(--ink)" }}>
                          {req.profiles?.name}
                        </span>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            onClick={() => handleRespondGroupRequest(req, true)}
                            style={roundIconBtnStyle("var(--sprout)")}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={() =>
                              handleRespondGroupRequest(req, false)
                            }
                            style={roundIconBtnStyle("var(--danger)")}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginBottom: "16px" }}>
                  <h4
                    style={{
                      fontSize: "13px",
                      color: "var(--ink-soft)",
                      marginBottom: "8px",
                    }}
                  >
                    Add Friends to Group
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      overflowX: "auto",
                      gap: "8px",
                      paddingBottom: "4px",
                    }}
                  >
                    {friends.map((friend) => (
                      <Button
                        key={friend.id}
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleAddFriendToGroup(friend.id, friend.name)
                        }
                        style={{ whiteSpace: "nowrap" }}
                      >
                        <UserPlus size={14} /> {friend.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Member List */}
            <div>
              <h4
                style={{
                  fontSize: "13px",
                  color: "var(--ink-soft)",
                  marginBottom: "8px",
                }}
              >
                Members ({groupMembers.length})
              </h4>
              {groupMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 0",
                    borderBottom: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <img
                      src={
                        member.profiles?.avatar_url ||
                        "https://via.placeholder.com/30"
                      }
                      alt="av"
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                      }}
                    />
                    <span style={{ fontSize: "13px", color: "var(--ink)" }}>
                      {member.profiles?.name}{" "}
                      {member.user_id === activeGroup.creator_id && "(Admin)"}
                    </span>
                  </div>
                  {isGroupAdmin && member.user_id !== userId && (
                    <button
                      onClick={() => handleKickMember(member)}
                      style={iconGhostBtnStyle}
                    >
                      <UserMinus size={14} color="var(--danger)" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages List */}
        <div style={messagesWindowStyle}>
          {currentMessages.map((msg) => {
            const isMe = msg.sender_id === userId;
            const reactions = isGroup
              ? msg.group_message_reactions
              : msg.message_reactions;
            const reactionCounts =
              reactions?.reduce((acc, curr) => {
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
                {isGroup && !isMe && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--ink-soft)",
                      marginLeft: "4px",
                      marginBottom: "2px",
                    }}
                  >
                    {msg.profiles?.name}
                  </span>
                )}

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
                        onClick={() => setFullScreenImage(msg.image_url)}
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

                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMe ? "row-reverse" : "row",
                      gap: "5px",
                    }}
                  >
                    <button
                      onClick={() =>
                        setActiveReactionMsg(
                          activeReactionMsg === msg.id ? null : msg.id,
                        )
                      }
                      style={iconGhostBtnStyle}
                    >
                      <Plus size={14} />
                    </button>
                    {isMe && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        style={iconGhostBtnStyle}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
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
                  <div
                    style={{ display: "flex", gap: "4px", marginTop: "4px" }}
                  >
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

        {/* Input Area */}
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
                color: "var(--ink-soft)",
              }}
            >
              {pendingImage.name}
            </span>
            <button
              type="button"
              onClick={() => setPendingImage(null)}
              style={cancelPreviewBtnStyle}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} style={inputContainerStyle}>
          <label style={iconBtnStyle}>
            <Camera size={18} />
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
            <ImageIcon size={18} />
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
            placeholder="Message..."
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
            {uploading ? "..." : <Send size={16} />}
          </button>
        </form>
      </div>
    );
  }

  // --- VIEW: MAIN CHAT MENU (Direct vs Groups) ---
  return (
    <div
      style={{
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        height: "calc(100vh - 80px)",
        overflowY: "auto",
      }}
    >
      {/* Tab Selector */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => setActiveTab("direct")}
          style={subTabStyle(activeTab === "direct")}
        >
          <MessageCircle size={15} /> Direct
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          style={subTabStyle(activeTab === "groups")}
        >
          <Users size={15} /> Groups
        </button>
      </div>

      {/* --- DIRECT MESSAGES TAB --- */}
      {activeTab === "direct" && (
        <>
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
          {friends.filter((f) =>
            f.name?.toLowerCase().includes(searchQuery.toLowerCase()),
          ).length === 0 ? (
            <p
              style={{
                color: "var(--ink-soft)",
                textAlign: "center",
                fontSize: "13px",
                padding: "20px 0",
              }}
            >
              No friends found.
            </p>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {friends
                .filter((f) =>
                  f.name?.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((friend) => (
                  <Card
                    key={friend.id}
                    onClick={() => setActiveChat(friend)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      cursor: "pointer",
                      padding: "12px 16px",
                    }}
                  >
                    <img
                      src={
                        friend.avatar_url || "https://via.placeholder.com/45"
                      }
                      alt="Avatar"
                      style={{
                        width: "45px",
                        height: "45px",
                        borderRadius: "50%",
                        objectFit: "cover",
                      }}
                    />
                    <strong style={{ fontSize: "14px", color: "var(--ink)" }}>
                      {friend.name || "User"}
                    </strong>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}

      {/* --- GROUPS TAB --- */}
      {activeTab === "groups" && (
        <>
          {showCreateGroup ? (
            <Card>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "12px",
                }}
              >
                <h3 style={{ fontSize: "16px", color: "var(--ink)" }}>
                  Create New Group
                </h3>
                <button
                  onClick={() => setShowCreateGroup(false)}
                  style={iconGhostBtnStyle}
                >
                  <X size={18} />
                </button>
              </div>
              <form
                onSubmit={handleCreateGroup}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <input
                  type="text"
                  placeholder="Group Name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  style={searchInputStyle}
                  required
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  style={{
                    ...searchInputStyle,
                    resize: "vertical",
                    height: "60px",
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "4px 0",
                  }}
                >
                  <input
                    type="checkbox"
                    id="privateCheck"
                    checked={isPrivateGroup}
                    onChange={(e) => setIsPrivateGroup(e.target.checked)}
                  />
                  <label
                    htmlFor="privateCheck"
                    style={{ fontSize: "13px", color: "var(--ink)" }}
                  >
                    Make group Private (requires approval to join)
                  </label>
                </div>
                <Button type="submit" fullWidth>
                  Create Group
                </Button>
              </form>
            </Card>
          ) : (
            <Button
              variant="secondary"
              onClick={() => setShowCreateGroup(true)}
              style={{ color: "var(--plum)" }}
            >
              <Plus size={16} /> Create Group
            </Button>
          )}

          <div>
            <h4
              style={{
                fontSize: "14px",
                marginBottom: "8px",
                color: "var(--ink)",
              }}
            >
              My Groups
            </h4>
            {myGroups.length === 0 ? (
              <p
                style={{
                  color: "var(--ink-soft)",
                  fontSize: "13px",
                  marginBottom: "16px",
                }}
              >
                You haven't joined any groups yet.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                {myGroups.map((group) => (
                  <Card
                    key={group.id}
                    onClick={() => setActiveGroup(group)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      cursor: "pointer",
                      padding: "12px 16px",
                      borderLeft: "3px solid var(--plum)",
                    }}
                  >
                    {group.avatar_url ? (
                      <img
                        src={group.avatar_url}
                        alt="group"
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          backgroundColor: "var(--plum-soft)",
                          color: "var(--plum)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Users size={20} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <strong
                        style={{
                          fontSize: "14px",
                          display: "block",
                          color: "var(--ink)",
                        }}
                      >
                        {group.name}
                      </strong>
                      <span
                        style={{ fontSize: "12px", color: "var(--ink-soft)" }}
                      >
                        {group.is_private ? "Private" : "Public"}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4
              style={{
                fontSize: "14px",
                marginBottom: "8px",
                color: "var(--ink)",
              }}
            >
              Discover Groups
            </h4>
            <input
              type="text"
              placeholder="Search public & private groups..."
              value={groupSearchQuery}
              onChange={(e) => setGroupSearchQuery(e.target.value)}
              style={{ ...searchInputStyle, marginBottom: "10px" }}
            />
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {discoverGroups.map((group) => (
                <Card
                  key={group.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    {group.avatar_url ? (
                      <img
                        src={group.avatar_url}
                        alt="group"
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          backgroundColor: "var(--paper)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--ink-soft)",
                        }}
                      >
                        {group.is_private ? (
                          <Lock size={16} />
                        ) : (
                          <Globe size={16} />
                        )}
                      </div>
                    )}
                    <div>
                      <strong
                        style={{
                          fontSize: "13px",
                          display: "block",
                          color: "var(--ink)",
                        }}
                      >
                        {group.name}
                      </strong>
                      <span
                        style={{ fontSize: "11px", color: "var(--ink-soft)" }}
                      >
                        {group.is_private ? "Private" : "Public"}
                      </span>
                    </div>
                  </div>
                  {group.isPending ? (
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--ember)",
                        fontWeight: 600,
                      }}
                    >
                      Requested
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleJoinGroup(group)}
                    >
                      Join
                    </Button>
                  )}
                </Card>
              ))}
              {discoverGroups.length === 0 && (
                <p style={{ color: "var(--ink-soft)", fontSize: "13px" }}>
                  No discoverable groups.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ==========================================
// STYLES
// ==========================================

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
  fontSize: "13px",
  cursor: "pointer",
});
const searchInputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--line)",
  boxSizing: "border-box",
  fontSize: "14px",
  backgroundColor: "var(--card)",
  color: "var(--ink)",
};
const chatHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 16px",
  backgroundColor: "var(--card)",
  borderBottom: "1px solid var(--line)",
};
const backBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--ember)",
  cursor: "pointer",
  padding: "4px",
  display: "flex",
};
const messagesWindowStyle = {
  flex: 1,
  padding: "16px",
  overflowY: "auto",
  backgroundColor: "var(--paper)",
};
const myMessageStyle = {
  backgroundColor: "var(--ember)",
  color: "white",
  padding: "10px 15px",
  borderRadius: "18px 18px 4px 18px",
  maxWidth: "80%",
  fontSize: "14px",
  wordWrap: "break-word",
};
const theirMessageStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  color: "var(--ink)",
  padding: "10px 15px",
  borderRadius: "18px 18px 18px 4px",
  maxWidth: "80%",
  fontSize: "14px",
  wordWrap: "break-word",
};
const inputContainerStyle = {
  display: "flex",
  alignItems: "center",
  padding: "10px",
  borderTop: "1px solid var(--line)",
  backgroundColor: "var(--card)",
  gap: "6px",
};
const inputFieldStyle = {
  flex: 1,
  padding: "10px 14px",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  fontSize: "14px",
  outline: "none",
  backgroundColor: "var(--paper)",
  color: "var(--ink)",
};
const iconBtnStyle = {
  cursor: "pointer",
  padding: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ink-soft)",
};
const iconGhostBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  opacity: 0.5,
  display: "flex",
  color: "var(--ink)",
};
const sendBtnStyle = {
  backgroundColor: "var(--ember)",
  color: "white",
  border: "none",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
};
const reactionPickerStyle = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-full)",
  padding: "6px 12px",
  marginTop: "5px",
  display: "flex",
  gap: "8px",
  boxShadow: "var(--shadow-press)",
};
const reactionBadgeStyle = {
  backgroundColor: "var(--card)",
  color: "var(--ink)",
  borderRadius: "10px",
  padding: "2px 6px",
  fontSize: "12px",
  border: "1px solid var(--line)",
};
const previewBannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 16px",
  backgroundColor: "var(--paper)",
  borderTop: "1px solid var(--line)",
};
const cancelPreviewBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--danger)",
  cursor: "pointer",
  display: "flex",
};
const fullScreenOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(20,16,12,0.92)",
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
  cursor: "pointer",
  display: "flex",
};
const roundIconBtnStyle = (color) => ({
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  border: "none",
  backgroundColor: color,
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
});
const uploadAvatarOverlayStyle = {
  position: "absolute",
  bottom: "0",
  right: "0",
  backgroundColor: "var(--ember)",
  borderRadius: "50%",
  padding: "4px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
};
