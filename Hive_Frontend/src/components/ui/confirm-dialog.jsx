import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Generic "Are you sure?" popup - replaces window.confirm() with something
// that matches the rest of the app's look instead of the browser's own
// unstyled dialog. `open` gates rendering (pass the record pending
// confirmation, or null); onConfirm/onCancel are the two ways out.
export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && (
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>
        {description && (
          <p className="text-sm text-slate-500">{description}</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={
              destructive
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }
          >
            {loading ? "Please wait..." : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
