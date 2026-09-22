import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { Calendar } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const PERIODS = [
  "8:00 - 8:45",
  "8:45 - 9:30",
  "9:30 - 10:15",
  "Break",
  "10:30 - 11:15",
  "11:15 - 12:00",
  "Lunch",
  "12:45 - 1:30",
  "1:30 - 2:15",
];
const CLASSES = [
  "Class 1",
  "Class 2",
  "Class 3",
  "Class 4",
  "Class 5",
  "Class 6",
  "Class 7",
  "Class 8",
  "Class 9",
  "Class 10",
];

export default function Timetable() {
  const [selectedClass, setSelectedClass] = useState("");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Time Table"
        subtitle="View class timetables"
        breadcrumb={[{ label: "Timetable" }]}
      />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
        <div>
          <Label className="text-xs mb-1 block">Select Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="rounded-xl text-sm w-48">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedClass ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Calendar className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">
            Select a class to view timetable
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-700">
              {selectedClass} — Weekly Timetable
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">
                    Period / Time
                  </th>
                  {DAYS.map((d) => (
                    <th key={d} className="px-4 py-3 text-left font-medium">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {PERIODS.map((period, idx) => {
                  const isBreak = period === "Break" || period === "Lunch";
                  return (
                    <tr
                      key={period}
                      className={
                        isBreak ? "bg-slate-50" : "hover:bg-slate-50/50"
                      }
                    >
                      <td className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">
                        {period}
                      </td>
                      {DAYS.map((day) => (
                        <td key={day} className="px-4 py-3">
                          {isBreak ? (
                            <span className="text-slate-400 italic">
                              {period}
                            </span>
                          ) : (
                            <div className="bg-indigo-50 text-indigo-700 rounded-lg px-2 py-1 text-center">
                              <p className="font-medium">Subject {idx + 1}</p>
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
