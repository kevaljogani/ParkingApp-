namespace ParkingApp.Models
{
    public class Ticket
    {
        public string TicketId { get; set; } = Guid.NewGuid().ToString();
        public int SlotId { get; set; }
        public string CarNumber { get; set; } = "";
        public string OwnerName { get; set; } = "";
        public string Phone { get; set; } = "";
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
