"use client";

import { Toaster as Sonner } from "sonner";

function Toaster() {
  return (
    <Sonner
      position="top-center"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-float !font-sans !text-sm",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground !rounded-lg !font-semibold",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-destructive",
        },
      }}
    />
  );
}

export { Toaster };
