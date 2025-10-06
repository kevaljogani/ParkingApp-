using System.Collections.Generic;

namespace ParkingApp.Models
{
    public class ParkingState
    {
        public List<ParkingSlot> Slots { get; set; } = new();
        public List<Ticket> Tickets { get; set; } = new();
    }
}
