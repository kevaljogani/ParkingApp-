using Microsoft.AspNetCore.Mvc;
using ParkingApp.Services;

namespace ParkingApp.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ParkingController : ControllerBase
    {
        private readonly ParkingService _service;
        public ParkingController(ParkingService service) => _service = service;

        [HttpGet("state")]
        public ActionResult State() => Ok(_service.GetState());

        public record OccupyRequest(int SlotId, string CarNumber, string OwnerName, string Phone);

        [HttpPost("occupy")]
        public ActionResult Occupy([FromBody] OccupyRequest req)
        {
            var ticket = _service.OccupySlot(req.SlotId, req.CarNumber, req.OwnerName, req.Phone);
            if (ticket == null) return BadRequest("Slot not available");
            return Ok(ticket);
        }

        public record ReleaseRequest(int SlotId);

        [HttpPost("release")]
        public ActionResult Release([FromBody] ReleaseRequest req)
        {
            var ok = _service.ReleaseSlot(req.SlotId);
            if (!ok) return BadRequest("Slot not occupied or not found");

            // return updated state and the most recent ticket (so client can show duration)
            var ticket = _service.GetMostRecentTicketForSlot(req.SlotId);
            return Ok(new { state = _service.GetState(), releasedTicket = ticket });
        }
    }
}
