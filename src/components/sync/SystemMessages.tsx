import type { SystemMessage } from "@/hooks/useSyncWatch";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SystemMessagesProps {
  messages: SystemMessage[];
}

export function SystemMessages({ messages }: SystemMessagesProps) {
  if (messages.length === 0) return null;

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="space-y-1 p-2">
          {messages.map((msg) => (
            <p key={msg.id} className="text-[11px] text-muted-foreground">
              <span className="text-muted-foreground/60">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>{" "}
              {msg.text}
            </p>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
