// pages/Appointments.jsx
//
// UI-only page. The old entityClient wiring (entities.Appointment.list/
// create/update/delete) was removed - the Appointment model is still served
// by the backend's generic /api/entities route, but nothing in the app calls
// it any more, so this page runs entirely on the in-memory placeholder rows
// below. Add/edit/delete all work against local state so the UI stays
// demonstrable; swap PLACEHOLDER_APPOINTMENTS and the three handlers for real
// API calls when the feature is wired up.
import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Plus, Pencil, Trash2, Phone } from "lucide-react";
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

const EMPTY = {
  visitor_name: "",
  purpose: "",
  with_whom: "",
  date: new Date().toISOString().split("T")[0],
  time: "",
  phone: "",
  status: "Scheduled",
};

const statusColors = {
  Scheduled: "bg-blue-50 text-blue-700",
  Completed: "bg-green-50 text-green-700",
  Cancelled: "bg-rose-50 text-rose-700",
};

// Sample rows so the table, status pills and empty state are all visible
// without a backend. Replace with the real list once the API exists.
const PLACEHOLDER_APPOINTMENTS = [
  {
    id: "ph-1",
    visitor_name: "Ramesh Kumar",
    purpose: "Fee structure enquiry",
    with_whom: "Admin Officer",
    date: "2026-09-12",
    time: "10:30",
    phone: "9848012345",
    status: "Scheduled",
  },
  {
    id: "ph-2",
    visitor_name: "Lakshmi Devi",
    purpose: "Discuss ward's attendance",
    with_whom: "Class Teacher - 7B",
    date: "2026-09-11",
    time: "14:00",
    phone: "9701234567",
    status: "Completed",
  },
  {
    id: "ph-3",
    visitor_name: "Syed Imran",
    purpose: "Transport route change request",
    with_whom: "Principal",
    date: "2026-09-10",
    time: "09:15",
    phone: "9885544332",
    status: "Cancelled",
  },
];

export default function Appointments() {
  const [items, setItems] = useState(PLACEHOLDER_APPOINTMENTS);
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
        title="Appointments"
        subtitle="Manage visitor appointments"
        breadcrumb={[{ label: "Appointments" }]}
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
            <Plus className="w-4 h-4" /> New Appointment
          </Button>
        }
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <Phone className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No appointments yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Visitor</th>
                  <th className="px-4 py-3 text-left">Purpose</th>
                  <th className="px-4 py-3 text-left">With</th>
                  <th className="px-4 py-3 text-left">Date &amp; Time</th>
                  <th className="px-4 py-3 text-left">Phone</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {item.visitor_name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{item.purpose}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.with_whom || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.date} {item.time}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[item.status]}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setForm(item);
                            setEditing(item.id);
                            setOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Appointment" : "New Appointment"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Visitor Name</Label>
              <Input
                value={form.visitor_name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, visitor_name: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Purpose</Label>
              <Input
                value={form.purpose}
                onChange={(e) =>
                  setForm((p) => ({ ...p, purpose: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Meeting With</Label>
              <Input
                value={form.with_whom}
                onChange={(e) =>
                  setForm((p) => ({ ...p, with_whom: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, phone: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Date</Label>
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
              <Label className="text-xs mb-1 block">Time</Label>
              <Input
                type="time"
                value={form.time}
                onChange={(e) =>
                  setForm((p) => ({ ...p, time: e.target.value }))
                }
                className="rounded-xl text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}
              >
                <SelectTrigger className="rounded-xl text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Scheduled", "Completed", "Cancelled"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
