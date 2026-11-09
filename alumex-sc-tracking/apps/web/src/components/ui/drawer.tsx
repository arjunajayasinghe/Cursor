"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Drawer({
  open,
  onOpenChange,
  title,
  eyebrow,
  subtitle,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  eyebrow?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-[#16365252]" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-50 flex h-dvh w-full flex-col border-l border-[#c9d7e6] bg-white shadow-drawer animate-drawer-in outline-none",
            wide ? "max-w-[900px]" : "max-w-[720px]",
          )}
        >
          <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-5">
            <div>
              {eyebrow ? <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[1.35px] text-[#396384]">{eyebrow}</div> : null}
              <Dialog.Title className="text-[23px] font-semibold tracking-tight text-ink">{title}</Dialog.Title>
              {subtitle ? <Dialog.Description className="mt-1 text-[13px] text-sub">{subtitle}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <Button variant="subtle" size="icon" aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </header>
          <div className="flex-1 overflow-auto px-6 py-4">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-line px-6 py-3">{footer}</footer> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
