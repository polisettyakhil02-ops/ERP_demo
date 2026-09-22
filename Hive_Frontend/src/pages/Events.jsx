// pages/Events.jsx
//
// UI-only page - not routed in App.jsx. The old entityClient wiring
// (entities.Event.list/create/update/delete) was removed; the Event model is
// still served by the backend's generic /api/entities route, but nothing in
// the app calls it any more. Add/edit/delete work against the in-memory
// placeholder rows below so the layout stays demonstrable - swap
// PLACEHOLDER_EVENTS and the two handlers for real API calls when this is
// wired up.
import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Plus, Pencil, Trash2, PartyPopper, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const EMPTY = {
  title: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  end_date: "",
  venue: "",
  type: "Academic",
  for_class: "",
};

const typeColors = {
  Academic: "bg-indigo-50 text-indigo-700",
  Cultural: "bg-purple-50 text-purple-700",
  Sports: "bg-green-50 text-green-700",
  Holiday: "bg-amber-50 text-amber-700",
  Other: "bg-slate-100 text-slate-600",
};

// Sample rows so every type pill, the card grid and the empty state are all
// reachable without a backend.
const PLACEHOLDER_EVENTS = [
  {
    id: "ph-1",
    title: "Annual Day Celebrations",
    description: "Cultural performances by all classes, followed by prize distribution.",
    date: "2026-12-18",
    end_date: "",
    venue: "Main Auditorium",
    type: "Cultural",
    for_class: "",
  },
  {
    id: "ph-2",
    title: "Half-Yearly Examinations",
    description: "Timetable shared with parents via the homework notifications.",
    date: "2026-10-06",
    end_date: "2026-10-16",
    venue: "Respective classrooms",
    type: "Academic",
    for_class: "",
  },
  {
    id: "ph-3",
    title: "Inter-House Sports Meet",
    description: "Track and field events for Classes 6-10.",
    date: "2026-11-21",
    end_date: "",
    venue: "School Grounds",
    type: "Sports",
    for_class: "",
  },
];

export default function Events() {
  const [items, setItems] = useState(PLACEHOLDER_EVENTS);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const handleSave = () => {
    if (editing) {
      setItems((prev) =>
        prev.map((it) => (it.id === editing ? { ...it, ...form } : it)),
      );
    } else {
      setItems((prev) => [{ ...form, id: `ph-${Date.now()}` }, ...prev]);
    }
    setOpen(false);
  };

  const handleDelete = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Events"
        subtitle="Manage school events and activities"
        breadcrumb={[{ label: "Events" }]}
        action={
          <Button
            onClick={() => {
              setForm(EMPTY);
              setEditing(null);
              setOpen(true);
            }}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Event
          </Button>
        }
      />

      {items.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <PartyPopper className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">No events yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColors[item.type] || typeColors.Other}`}
                >
                  {item.type}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setForm(item);
                      setEditing(item.id);
                      setOpen(true);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">
                {item.title}
              </h3>
              {item.description && (
                <p className="text-xs text-slate-500 mb-2 line-clamp-2">
                  {item.description}
                </p>
              )}
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="w-3 h-3" />
                <span>
                  {item.date}
                  {item.end_date ? ` – ${item.end_date}` : ""}
                </span>
              </div>
              {item.venue && (
                <p className="text-xs text-slate-400 mt-1">📍 {item.venue}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "Add Event"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Title</Label>
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((p) => ({ ...p, title: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Start Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">End Date</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, end_date: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger className="rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Academic", "Cultural", "Sports", "Holiday", "Other"].map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Venue</Label>
              <Input
                value={form.venue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, venue: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
                className="rounded-xl text-sm"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl text-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm"
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
