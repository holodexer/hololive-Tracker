import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettings } from "@/contexts/SettingsContext";
import type { ChatMessage } from "@/hooks/useSyncWatch";
import { cn } from "@/lib/utils";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  myNickname: string;
}

export function ChatPanel({ messages, onSend, myNickname }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const { t } = useSettings();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-1.5 p-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4 opacity-60">
              {t.sync.noMessages}
            </p>
          )}
          {messages.map((msg) => {
            const isMe = msg.sender === myNickname;
            return (
              <div key={msg.id} className={cn("flex flex-col gap-0.5", isMe ? "items-end" : "items-start")}>
                <span className="text-[10px] text-muted-foreground/70 px-1">
                  {msg.sender} · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div
                  className={cn(
                    "text-xs px-2.5 py-1.5 rounded-lg max-w-[85%] break-words",
                    isMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 p-3 border-t border-border/30">
        <Input
          placeholder={t.sync.messagePlaceholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="h-10 flex-1 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <Button size="sm" variant="secondary" className="h-10 w-10 p-0 shrink-0" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
