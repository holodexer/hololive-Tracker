import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users } from "lucide-react";

interface NicknameModalProps {
  open: boolean;
  onConfirm: (nickname: string) => void;
  onCancel?: () => void;
  locale?: "en" | "zh-TW" | "ja";
}

const localeLabels = {
  en: { title: "Set Nickname", desc: "Enter a nickname to join the watch room.", placeholder: "Your nickname...", button: "Join Room", cancel: "Cancel" },
  "zh-TW": { title: "設定暱稱", desc: "輸入暱稱以加入觀看房間。", placeholder: "你的暱稱...", button: "加入房間", cancel: "取消" },
  ja: { title: "ニックネームを設定", desc: "ニックネームを入力してルームに参加してください。", placeholder: "あなたのニックネーム...", button: "ルームに参加", cancel: "キャンセル" },
};

export function NicknameModal({ open, onConfirm, onCancel, locale = "en" }: NicknameModalProps) {
  const [name, setName] = useState("");
  const l = localeLabels[locale];

  useEffect(() => {
    if (!open) setName("");
  }, [open]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel?.(); }}>
      <DialogContent className="sm:max-w-md [&>button.absolute]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <DialogTitle>{l.title}</DialogTitle>
          </div>
          <DialogDescription>{l.desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <Input
            placeholder={l.placeholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} className="flex-1">
              {l.cancel}
            </Button>
            <Button onClick={handleConfirm} className="flex-1" disabled={!name.trim()}>
              {l.button}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
