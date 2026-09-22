import React, { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bus, MapPin } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default marker icons for leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

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
const SECTIONS = ["A", "B", "C", "D"];

// Demo bus data
const DEMO_BUSES = [
  {
    id: 1,
    bus_number: "BUS-01",
    driver: "Ravi Kumar",
    class: "Class 5",
    section: "A",
    lat: 28.6139,
    lng: 77.209,
    status: "En Route",
    students: 32,
  },
  {
    id: 2,
    bus_number: "BUS-02",
    driver: "Suresh Singh",
    class: "Class 7",
    section: "B",
    lat: 28.62,
    lng: 77.215,
    status: "At School",
    students: 28,
  },
  {
    id: 3,
    bus_number: "BUS-03",
    driver: "Mahesh Yadav",
    class: "Class 9",
    section: "A",
    lat: 28.608,
    lng: 77.203,
    status: "En Route",
    students: 35,
  },
  {
    id: 4,
    bus_number: "BUS-04",
    driver: "Vijay Sharma",
    class: "Class 3",
    section: "C",
    lat: 28.616,
    lng: 77.22,
    status: "Delayed",
    students: 30,
  },
];

const statusColors = {
  "En Route": "bg-green-100 text-green-700",
  "At School": "bg-blue-100 text-blue-700",
  Delayed: "bg-amber-100 text-amber-700",
};

export default function BusTracking() {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const filtered = DEMO_BUSES.filter(
    (b) =>
      (!selectedClass || b.class === selectedClass) &&
      (!selectedSection || b.section === selectedSection),
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="GPS Bus Tracking"
        subtitle="Real-time bus location monitoring"
        breadcrumb={[{ label: "Bus Tracking" }]}
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap gap-4 items-end">
        <div>
          <Label className="text-xs mb-1 block">Filter by Class</Label>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="rounded-xl text-sm w-40">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Classes</SelectItem>
              {CLASSES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block">Filter by Section</Label>
          <Select value={selectedSection} onValueChange={setSelectedSection}>
            <SelectTrigger className="rounded-xl text-sm w-36">
              <SelectValue placeholder="All Sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Sections</SelectItem>
              {SECTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  Section {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {filtered.length}
          </span>{" "}
          buses
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bus Cards */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
              <Bus className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-slate-500 text-sm">No buses match filter</p>
            </div>
          ) : (
            filtered.map((bus) => (
              <div
                key={bus.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Bus className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {bus.bus_number}
                      </p>
                      <p className="text-xs text-slate-400">{bus.driver}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[bus.status]}`}
                  >
                    {bus.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {bus.class} - Section {bus.section}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {bus.students} students
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Map */}
        <div
          className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          style={{ height: "450px" }}
        >
          <MapContainer
            center={[28.6139, 77.209]}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {filtered.map((bus) => (
              <Marker key={bus.id} position={[bus.lat, bus.lng]}>
                <Popup>
                  <div className="text-xs">
                    <p className="font-bold">{bus.bus_number}</p>
                    <p>Driver: {bus.driver}</p>
                    <p>
                      Class: {bus.class} - {bus.section}
                    </p>
                    <p>Status: {bus.status}</p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
