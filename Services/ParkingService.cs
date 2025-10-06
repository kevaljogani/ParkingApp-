using System;
using System.Collections.Generic;
using System.Linq;

namespace ParkingApp.Services
{
    public class ParkingService
    {
        private readonly List<Slot> _slots;
        private readonly List<Ticket> _tickets;

        // event list to compute peak occupancy: (time, delta)
        private readonly List<(DateTime Time, int Delta)> _events;

        public ParkingService()
        {
            _slots = new List<Slot>();
            _tickets = new List<Ticket>();
            _events = new List<(DateTime, int)>();

            // initialize 20 slots (same as original behaviour)
            for (int i = 1; i <= 20; i++)
            {
                _slots.Add(new Slot { Id = i, Name = $"S{i:00}", Occupied = false });
            }
        }

        public IEnumerable<Slot> GetSlots() => _slots;

        public IEnumerable<Ticket> GetTickets() => _tickets.OrderByDescending(t => t.Timestamp);

        public object GetState()
        {
            var slots = _slots.Select(s => new
            {
                s.Id,
                s.Name,
                s.Occupied
            }).ToList();

            var tickets = _tickets.Select(t => new
            {
                t.SlotId,
                t.CarNumber,
                t.OwnerName,
                t.Phone,
                Timestamp = t.Timestamp,
                ExitTime = t.ExitTime,
                DurationMinutes = t.ExitTime.HasValue ? (t.ExitTime.Value - t.Timestamp).TotalMinutes : (double?)null
            }).OrderByDescending(t => t.Timestamp).ToList();

            var stats = ComputeStats();

            return new
            {
                slots,
                tickets,
                stats
            };
        }

        public Ticket OccupySlot(int slotId, string carNumber, string ownerName, string phone)
        {
            var slot = _slots.FirstOrDefault(s => s.Id == slotId);
            if (slot == null || slot.Occupied) return null;

            slot.Occupied = true;
            var ticket = new Ticket
            {
                SlotId = slotId,
                CarNumber = carNumber,
                OwnerName = ownerName,
                Phone = phone,
                Timestamp = DateTime.Now,
                ExitTime = null
            };
            _tickets.Add(ticket);

            // add +1 event for peak occupancy computation
            _events.Add((ticket.Timestamp, +1));

            return ticket;
        }

        public bool ReleaseSlot(int slotId)
        {
            var slot = _slots.FirstOrDefault(s => s.Id == slotId);
            if (slot == null || !slot.Occupied) return false;

            // find the most recent ticket for this slot that has no ExitTime
            var ticket = _tickets
                .Where(t => t.SlotId == slotId && t.ExitTime == null)
                .OrderByDescending(t => t.Timestamp)
                .FirstOrDefault();

            if (ticket == null) return false;

            // set exit time
            ticket.ExitTime = DateTime.Now;

            // add -1 event for peak occupancy computation
            _events.Add((ticket.ExitTime.Value, -1));

            slot.Occupied = false;
            return true;
        }

        // compute stats for the right side daily summary
        private SummaryStats ComputeStats()
        {
            var now = DateTime.Now;
            var today = now.Date;

            // total cars parked today (tickets with Timestamp on today's date)
            var totalToday = _tickets.Count(t => t.Timestamp.Date == today);

            // peak occupancy: compute using events (sort by time, accumulate delta)
            int peak = 0;
            int running = 0;
            foreach (var ev in _events.OrderBy(e => e.Time))
            {
                running += ev.Delta;
                if (running > peak) peak = running;
            }

            // average parking time in minutes for tickets with ExitTime (and optionally only today)
            var finished = _tickets.Where(t => t.ExitTime.HasValue && t.Timestamp.Date == today).ToList();
            double? avgMinutes = null;
            if (finished.Any())
            {
                avgMinutes = finished.Average(t => (t.ExitTime.Value - t.Timestamp).TotalMinutes);
            }

            // current occupied count
            var currentOccupied = _slots.Count(s => s.Occupied);

            return new SummaryStats
            {
                TotalToday = totalToday,
                PeakOccupancy = peak,
                AverageParkingMinutes = avgMinutes,
                CurrentOccupied = currentOccupied
            };
        }

        // small helper to allow controller to get a released ticket for UI
        public Ticket GetMostRecentTicketForSlot(int slotId)
        {
            return _tickets
                .Where(t => t.SlotId == slotId)
                .OrderByDescending(t => t.Timestamp)
                .FirstOrDefault();
        }
    }

    public class Slot
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public bool Occupied { get; set; }
    }

    public class Ticket
    {
        public int SlotId { get; set; }
        public string CarNumber { get; set; }
        public string OwnerName { get; set; }
        public string Phone { get; set; }
        public DateTime Timestamp { get; set; }
        public DateTime? ExitTime { get; set; }
    }

    public class SummaryStats
    {
        public int TotalToday { get; set; }
        public int PeakOccupancy { get; set; }
        public double? AverageParkingMinutes { get; set; }
        public int CurrentOccupied { get; set; }
    }
}
