import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Trash2, Loader2 } from "lucide-react";
import api from "../services/api";

interface ChatMessage {
  _id: string;
  senderId: string;
  senderName: string;
  senderNickname: string;
  text: string;
  createdAt: string;
}

interface HouseChatProps {
  currentUser: any;
}

export default function HouseChat({ currentUser }: HouseChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);
  const [newMessage, setNewMessage] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const response = await api.get<{ messages: ChatMessage[] }>("/chat");
      setMessages(response.data.messages);
    } catch (err) {
      console.error("Failed to fetch chat messages:", err);
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(true);
    // Poll every 3 seconds for real-time messages
    const interval = setInterval(() => {
      fetchMessages(false);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    const textToSend = newMessage.trim();
    setNewMessage("");
    setSending(true);

    try {
      const response = await api.post<{ message: ChatMessage }>("/chat", {
        text: textToSend,
      });
      setMessages((prev) => [...prev, response.data.message]);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Restore draft if failed
      setNewMessage(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    try {
      await api.delete(`/chat/${messageId}`);
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const timeString = date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (isToday) {
      return timeString;
    }

    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${timeString}`;
  };

  return (
    <div id="house-chat-container" className="flex flex-col h-[calc(100vh-140px)] bg-[#1C1512] border border-[#382923] rounded-3xl overflow-hidden shadow-2xl animate-fade-in">
      {/* Top Header */}
      <div className="px-6 py-4 bg-[#251B17] border-b border-[#382923] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#E38D73]/15 border border-[#E38D73]/30 text-[#E38D73] flex items-center justify-center shadow-sm">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-serif font-black text-base text-[#FAF6F0] flex items-center gap-2">
              House Chat
              <span className="text-[10px] font-sans font-bold px-2 py-0.5 rounded-full bg-[#E38D73]/10 text-[#E38D73] border border-[#E38D73]/20">
                LIVE
              </span>
            </h3>
            <p className="text-xs text-[#A69788]">
              Instant private messaging for roomies & household members
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#A69788]">
          <span className="w-2 h-2 rounded-full bg-[#A0B095] animate-pulse" />
          <span>Real-time sync active</span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#1C1512]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-[#A69788]">
            <Loader2 className="h-8 w-8 animate-spin text-[#E38D73]" />
            <p className="text-xs font-semibold">Opening house channel...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8 bg-[#251B17]/40 border border-[#382923]/60 rounded-3xl max-w-md mx-auto my-auto">
            <div className="w-14 h-14 rounded-full bg-[#E38D73]/10 border border-[#E38D73]/20 flex items-center justify-center text-2xl">
              🏠
            </div>
            <h4 className="font-serif font-bold text-lg text-[#FAF6F0]">
              No messages in House Chat yet!
            </h4>
            <p className="text-xs text-[#A69788] leading-relaxed">
              Say hello to your household members! Share grocery updates, dinner plans, or house notes right here.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?._id;

            return (
              <div
                key={msg._id}
                className={`flex items-start gap-3 group ${isMe ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-sm ${
                    isMe
                      ? "bg-[#E38D73] text-[#1C1512]"
                      : "bg-[#382923] text-[#FAF6F0] border border-[#4A3728]"
                  }`}
                  title={msg.senderName}
                >
                  {msg.senderName.substring(0, 2).toUpperCase()}
                </div>

                {/* Message Container */}
                <div
                  className={`max-w-[70%] space-y-1 ${isMe ? "items-end text-right" : "items-start text-left"}`}
                >
                  {/* Sender Name & Timestamp */}
                  <div className={`flex items-center gap-2 text-[10px] text-[#A69788] ${isMe ? "justify-end" : "justify-start"}`}>
                    <span className="font-bold text-[#FAF6F0]">{msg.senderName}</span>
                    {msg.senderNickname && (
                      <span className="font-mono text-[#78695C]">@{msg.senderNickname}</span>
                    )}
                    <span>•</span>
                    <span>{formatTime(msg.createdAt)}</span>
                  </div>

                  {/* Bubble */}
                  <div
                    className={`relative p-3.5 rounded-2xl text-xs leading-relaxed break-words shadow-md transition-all ${
                      isMe
                        ? "bg-[#E38D73] text-[#1C1512] font-medium rounded-tr-none"
                        : "bg-[#251B17] border border-[#382923] text-[#FAF6F0] rounded-tl-none"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>

                    {/* Delete Action on Hover */}
                    {(isMe || currentUser?.role === "admin") && (
                      <button
                        onClick={() => handleDelete(msg._id)}
                        className={`absolute top-2 ${
                          isMe ? "-left-7 text-[#78695C] hover:text-rose-450" : "-right-7 text-[#78695C] hover:text-rose-450"
                        } opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-transparent border-0 cursor-pointer`}
                        title="Delete message"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form onSubmit={handleSend} className="p-4 bg-[#251B17] border-t border-[#382923]">
        <div className="flex items-center gap-3 bg-[#1C1512] border border-[#382923] rounded-2xl px-4 py-2 focus-within:border-[#E38D73] focus-within:ring-2 focus-within:ring-[#E38D73]/15 transition-all">
          <input
            type="text"
            placeholder="Type a message to the house..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 bg-transparent border-none text-xs text-[#FAF6F0] placeholder-[#78695C] focus:outline-none py-1.5 font-medium"
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="bg-[#E38D73] hover:bg-[#F2A38A] disabled:opacity-40 text-[#1C1512] font-bold text-xs p-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center shrink-0"
          >
            {sending ? (
              <Loader2 size={16} className="animate-spin text-[#1C1512]" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
