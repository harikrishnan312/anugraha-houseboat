"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Boat = { _id: string; boatName: string; totalRooms: number; status: string };
type Booking = {
  _id: string; houseboatId: Boat | string; bookingDate: string; bookingType: string;
  roomsBooked: number; clientName: string; mobile: string; totalAmount: number;
  advanceAmount: number; balanceAmount: number; isAgent: boolean; agentName?: string;
  underWhom?: string; status: string;
};
type Availability = { houseboat: Boat; totalRooms: number; bookedRooms: number; availableRooms: number; bookingType: string };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function Dashboard() {
  const [date, setDate] = useState(today());
  const [boats, setBoats] = useState<Boat[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [tab, setTab] = useState("dashboard");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showBooking, setShowBooking] = useState(false);
  const [showBoat, setShowBoat] = useState(false);
  const [editingBoat, setEditingBoat] = useState<Boat | null>(null);

  const [bookingForm, setBookingForm] = useState({
    houseboatId: "", bookingDate: today(), bookingType: "sharing", roomsBooked: "1",
    clientName: "", mobile: "", totalAmount: "0", advanceAmount: "0",
    isAgent: false, agentName: "", underWhom: ""
  });
  const [boatForm, setBoatForm] = useState({ boatName: "", totalRooms: "1", status: "active" });

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [b, a, h] = await Promise.all([
        fetch(`/api/bookings?date=${date}`).then(r => r.json()),
        fetch(`/api/availability?date=${date}`).then(r => r.json()),
        fetch("/api/houseboats").then(r => r.json())
      ]);
      if (!b.success || !a.success || !h.success) throw new Error(b.message || a.message || h.message || "Unable to load data");
      setBookings(b.data);
      setAvailability(a.data);
      setBoats(h.data);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to load data");
    } finally { setLoading(false); }
  }, [date]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => {
    const totalRooms = availability.reduce((s, x) => s + x.totalRooms, 0);
    const bookedRooms = availability.reduce((s, x) => s + x.bookedRooms, 0);
    return {
      boats: availability.length, totalRooms, bookedRooms,
      availableRooms: totalRooms - bookedRooms,
      individual: bookings.filter(x => x.status === "confirmed" && x.bookingType === "individual").length,
      sharing: bookings.filter(x => x.status === "confirmed" && x.bookingType === "sharing").length
    };
  }, [availability, bookings]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload = {
      ...bookingForm, roomsBooked: Number(bookingForm.roomsBooked),
      totalAmount: Number(bookingForm.totalAmount), advanceAmount: Number(bookingForm.advanceAmount)
    };
    const res = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await res.json();
    if (!res.ok) { setMessage(result.message || "Booking failed"); return; }
    setShowBooking(false);
    setBookingForm({ ...bookingForm, clientName: "", mobile: "", totalAmount: "0", advanceAmount: "0" });
    await load();
    setMessage("Booking created successfully");
  }

  async function submitBoat(e: React.FormEvent) {
    e.preventDefault();
    const url = editingBoat ? `/api/houseboats/${editingBoat._id}` : "/api/houseboats";
    const res = await fetch(url, {
      method: editingBoat ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...boatForm, totalRooms: Number(boatForm.totalRooms) })
    });
    const result = await res.json();
    if (!res.ok) { setMessage(result.message || "Unable to save houseboat"); return; }
    setShowBoat(false); setEditingBoat(null);
    setBoatForm({ boatName: "", totalRooms: "1", status: "active" });
    await load(); setMessage("Houseboat saved");
  }

  async function cancelBooking(id: string) {
    if (!window.confirm("Cancel this booking? Its rooms will become available.")) return;
    const res = await fetch(`/api/bookings/${id}/cancel`, { method: "POST" });
    const result = await res.json();
    if (!res.ok) { setMessage(result.message || "Cancellation failed"); return; }
    await load(); setMessage("Booking cancelled");
  }

  async function deleteBoat(id: string) {
    if (!window.confirm("Delete this houseboat? Houseboats with booking history cannot be deleted.")) return;
    const res = await fetch(`/api/houseboats/${id}`, { method: "DELETE" });
    const result = await res.json();
    if (!res.ok) { setMessage(result.message || "Delete failed"); return; }
    await load(); setMessage("Houseboat deleted");
  }

  const nav = ["dashboard", "bookings", "houseboats", "reports"];
  return <main className="min-h-screen">
    <header className="bg-slate-950 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <div><p className="text-xs uppercase tracking-[.25em] text-cyan-300">Operations</p><h1 className="text-2xl font-bold">Houseboat Manager</h1></div>
        <div className="flex flex-wrap gap-2">{nav.map(n => <button key={n} onClick={() => setTab(n)} className={`rounded-lg px-4 py-2 text-sm capitalize ${tab === n ? "bg-cyan-400 font-semibold text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}>{n}</button>)}</div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-5 py-7">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-xl font-bold capitalize">{tab}</h2><p className="text-sm text-slate-500">Manage daily operations and room availability</p></div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="Selected date" type="date" value={date} onChange={e => setDate(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
          <button onClick={() => { setBookingForm({ ...bookingForm, bookingDate: date, houseboatId: boats[0]?._id || "" }); setShowBooking(true); }} className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-800">+ New booking</button>
          {tab === "houseboats" && <button onClick={() => { setEditingBoat(null); setBoatForm({ boatName: "", totalRooms: "1", status: "active" }); setShowBoat(true); }} className="rounded-lg bg-slate-900 px-4 py-2 text-white">+ Houseboat</button>}
        </div>
      </div>
      {message && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</div>}
      {loading && <p className="mb-3 text-sm text-slate-500">Loading…</p>}

      {tab === "dashboard" && <>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {[
            ["Houseboats", stats.boats], ["Total rooms", stats.totalRooms], ["Booked rooms", stats.bookedRooms],
            ["Available rooms", stats.availableRooms], ["Individual", stats.individual], ["Sharing", stats.sharing]
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></div>)}
        </section>
        <section className="mt-7 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold">Houseboat availability</h3>
            <div className="space-y-3">{availability.map(x => <div key={x.houseboat._id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex justify-between gap-3"><strong>{x.houseboat.boatName}</strong><span className="text-sm text-slate-500">{x.availableRooms}/{x.totalRooms} available</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-600" style={{ width: `${x.totalRooms ? x.bookedRooms / x.totalRooms * 100 : 0}%` }} /></div>
              <p className="mt-2 text-xs capitalize text-slate-500">{x.bookingType === "available" ? "Available" : `${x.bookingType} booking`}</p>
            </div>)}{availability.length === 0 && <p className="text-sm text-slate-500">No active houseboats. Add a houseboat to get started.</p>}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-bold">Bookings for {date}</h3>
            <BookingList bookings={bookings} cancelBooking={cancelBooking} />
          </div>
        </section>
      </>}

      {tab === "bookings" && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 font-bold">Bookings for selected date</h3><BookingList bookings={bookings} cancelBooking={cancelBooking} /></section>}

      {tab === "houseboats" && <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 font-bold">Houseboats</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="p-3">Name</th><th className="p-3">Rooms</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{boats.map(b => <tr key={b._id} className="border-b last:border-0"><td className="p-3 font-semibold">{b.boatName}</td><td className="p-3">{b.totalRooms}</td><td className="p-3 capitalize">{b.status}</td><td className="p-3"><div className="flex gap-2"><button className="text-cyan-700" onClick={() => { setEditingBoat(b); setBoatForm({ boatName: b.boatName, totalRooms: String(b.totalRooms), status: b.status }); setShowBoat(true); }}>Edit</button><button className="text-red-600" onClick={() => deleteBoat(b._id)}>Delete</button></div></td></tr>)}</tbody></table>{boats.length === 0 && <p className="p-4 text-sm text-slate-500">No houseboats found.</p>}</div></section>}

      {tab === "reports" && <Reports date={date} />}

      {showBooking && <Modal title="Create booking" close={() => setShowBooking(false)}><form onSubmit={submitBooking} className="grid gap-3 sm:grid-cols-2">
        <Field label="Houseboat"><select required value={bookingForm.houseboatId} onChange={e => setBookingForm({ ...bookingForm, houseboatId: e.target.value })} className="field"><option value="">Select houseboat</option>{boats.filter(b => b.status === "active").map(b => <option key={b._id} value={b._id}>{b.boatName} ({b.totalRooms} rooms)</option>)}</select></Field>
        <Field label="Booking date"><input required type="date" value={bookingForm.bookingDate} onChange={e => setBookingForm({ ...bookingForm, bookingDate: e.target.value })} className="field" /></Field>
        <Field label="Booking type"><select value={bookingForm.bookingType} onChange={e => setBookingForm({ ...bookingForm, bookingType: e.target.value, roomsBooked: e.target.value === "individual" ? String(boats.find(b => b._id === bookingForm.houseboatId)?.totalRooms || 1) : "1" })} className="field"><option value="sharing">Sharing</option><option value="individual">Individual (entire boat)</option></select></Field>
        <Field label="Rooms"><input required min="1" type="number" value={bookingForm.roomsBooked} disabled={bookingForm.bookingType === "individual"} onChange={e => setBookingForm({ ...bookingForm, roomsBooked: e.target.value })} className="field" /></Field>
        <Field label="Customer name"><input required value={bookingForm.clientName} onChange={e => setBookingForm({ ...bookingForm, clientName: e.target.value })} className="field" /></Field>
        <Field label="Mobile"><input required value={bookingForm.mobile} onChange={e => setBookingForm({ ...bookingForm, mobile: e.target.value })} className="field" /></Field>
        <Field label="Total amount"><input required min="0" type="number" value={bookingForm.totalAmount} onChange={e => setBookingForm({ ...bookingForm, totalAmount: e.target.value })} className="field" /></Field>
        <Field label="Advance amount"><input required min="0" type="number" value={bookingForm.advanceAmount} onChange={e => setBookingForm({ ...bookingForm, advanceAmount: e.target.value })} className="field" /></Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={bookingForm.isAgent} onChange={e => setBookingForm({ ...bookingForm, isAgent: e.target.checked })} /> Booking through agent</label>
        {bookingForm.isAgent && <><Field label="Agent name"><input value={bookingForm.agentName} onChange={e => setBookingForm({ ...bookingForm, agentName: e.target.value })} className="field" /></Field><Field label="Under whom"><input value={bookingForm.underWhom} onChange={e => setBookingForm({ ...bookingForm, underWhom: e.target.value })} className="field" /></Field></>}
        <div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setShowBooking(false)} className="rounded-lg border px-4 py-2">Close</button><button className="rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white">Save booking</button></div>
      </form></Modal>}

      {showBoat && <Modal title={editingBoat ? "Edit houseboat" : "Add houseboat"} close={() => setShowBoat(false)}><form onSubmit={submitBoat} className="grid gap-3">
        <Field label="Houseboat name"><input required value={boatForm.boatName} onChange={e => setBoatForm({ ...boatForm, boatName: e.target.value })} className="field" /></Field>
        <Field label="Total rooms"><input required min="1" max="100" type="number" value={boatForm.totalRooms} onChange={e => setBoatForm({ ...boatForm, totalRooms: e.target.value })} className="field" /></Field>
        <Field label="Status"><select value={boatForm.status} onChange={e => setBoatForm({ ...boatForm, status: e.target.value })} className="field"><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowBoat(false)} className="rounded-lg border px-4 py-2">Close</button><button className="rounded-lg bg-cyan-700 px-4 py-2 text-white">Save</button></div>
      </form></Modal>}
    </div>
  </main>;
}

function BookingList({ bookings, cancelBooking }: { bookings: Booking[]; cancelBooking: (id: string) => void }) {
  if (!bookings.length) return <p className="text-sm text-slate-500">No bookings for this date.</p>;
  return <div className="space-y-3">{bookings.map(b => {
    const boatName = typeof b.houseboatId === "object" ? b.houseboatId.boatName : "Houseboat";
    return <div key={b._id} className="rounded-lg border border-slate-100 p-3">
      <div className="flex flex-wrap justify-between gap-2"><div><strong>{b.clientName}</strong><p className="text-xs text-slate-500">{boatName} · {b.mobile}</p></div><span className="rounded-full bg-cyan-50 px-2 py-1 text-xs capitalize text-cyan-800">{b.bookingType} · {b.roomsBooked} room(s)</span></div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs"><div><p className="text-slate-500">Total</p><strong>{money(b.totalAmount)}</strong></div><div><p className="text-slate-500">Advance</p><strong>{money(b.advanceAmount)}</strong></div><div><p className="text-slate-500">Balance</p><strong>{money(b.balanceAmount)}</strong></div></div>
      {b.isAgent && <p className="mt-2 text-xs text-slate-500">Agent: {b.agentName || "—"} {b.underWhom ? `· ${b.underWhom}` : ""}</p>}
      {b.status === "confirmed" && <button onClick={() => cancelBooking(b._id)} className="mt-3 text-xs font-semibold text-red-600">Cancel booking</button>}
      {b.status === "cancelled" && <span className="mt-2 inline-block text-xs text-red-600">Cancelled</span>}
    </div>;
  })}</div>;
}

function Reports({ date }: { date: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch(`/api/reports?from=${date}&to=${date}`).then(r => r.json()).then(r => { if (r.success) setData(r.data); else setError(r.message); }).catch(() => setError("Unable to load report")); }, [date]);
  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading report…</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {[["Bookings", data.bookingCount], ["Revenue", money(data.totalAmount)], ["Advance collected", money(data.advanceAmount)], ["Outstanding", money(data.balanceAmount)]].map(([k,v]) => <div key={String(k)} className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-500">{k}</p><p className="mt-2 text-2xl font-bold">{v}</p></div>)}
  </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium">{label}{children}</label>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4"><div className="my-6 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">{title}</h3><button onClick={close} className="rounded-lg px-3 py-1 text-xl text-slate-500">×</button></div>{children}</div></div>;
}
