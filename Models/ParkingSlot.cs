namespace ParkingApp.Models
{
    public class ParkingSlot
    {
        public int Id { get; set; }
        public bool Occupied { get; set; }
        public string? CarNumber { get; set; }
        public string? OwnerName { get; set; }
        public string? Phone { get; set; }
        public DateTime? OccupiedAt { get; set; }
    }
}
